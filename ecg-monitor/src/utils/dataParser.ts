import {
  type ECGData,
  type FrameConfig,
  ECGLead,
  ECG_LEADS,
  DEFAULT_FRAME_CONFIG,
} from '../types/ecg';
import {
  PhysioParameter,
  type PhysioFrame,
  type MultiParamFrameConfig,
  DEFAULT_MULTI_PARAM_CONFIG,
  CHANNEL_CONFIGS,
} from '../types/physio';

// ─── 串口数据解析 ────────────────────────────────────────────

/** 单帧字节长度 = 帧头 + 数据 + 帧尾 */
function frameSize(cfg: FrameConfig): number {
  return cfg.header.length + cfg.leadCount * cfg.bytesPerSample + cfg.footer.length;
}

/** 匹配帧头 */
function matchHeader(view: DataView, offset: number, cfg: FrameConfig): boolean {
  for (let i = 0; i < cfg.header.length; i++) {
    if (view.getUint8(offset + i) !== cfg.header[i]) return false;
  }
  return true;
}

/** 匹配帧尾 */
function matchFooter(view: DataView, offset: number, cfg: FrameConfig): boolean {
  const footerStart = offset + cfg.header.length + cfg.leadCount * cfg.bytesPerSample;
  for (let i = 0; i < cfg.footer.length; i++) {
    if (view.getUint8(footerStart + i) !== cfg.footer[i]) return false;
  }
  return true;
}

/**
 * 解析串口二进制数据为 ECGData 数组
 * @param raw 原始 ArrayBuffer
 * @param cfg 帧配置（可选，默认 DEFAULT_FRAME_CONFIG）
 * @returns 解析后的 ECGData 数组
 */
export function parseSerialData(
  raw: ArrayBuffer,
  cfg: FrameConfig = DEFAULT_FRAME_CONFIG,
): ECGData[] {
  const view = new DataView(raw);
  const size = frameSize(cfg);
  const results: ECGData[] = [];

  let offset = 0;
  while (offset + size <= raw.byteLength) {
    // 寻找帧头
    if (!matchHeader(view, offset, cfg)) {
      offset++;
      continue;
    }
    // 校验帧尾
    if (!matchFooter(view, offset, cfg)) {
      offset++;
      continue;
    }

    // 提取各导联数据（小端序有符号16位）
    const dataOffset = offset + cfg.header.length;
    const leads = {} as Record<ECGLead, number>;
    for (let i = 0; i < cfg.leadCount; i++) {
      const byteOffset = dataOffset + i * cfg.bytesPerSample;
      leads[ECG_LEADS[i]] =
        cfg.bytesPerSample === 2
          ? view.getInt16(byteOffset, true) // 小端序
          : view.getInt8(byteOffset);
    }

    results.push({ timestamp: Date.now(), leads });
    offset += size;
  }

  return results;
}

// ─── 12导联分离 ─────────────────────────────────────────────

/**
 * 将 ECGData 数组按导联分离为独立序列
 * @param data 解析后的 ECGData 数组
 * @returns 导联名 → 数值数组 的映射
 */
export function separateLeads(data: ECGData[]): Map<ECGLead, number[]> {
  const map = new Map<ECGLead, number[]>();
  for (const lead of ECG_LEADS) {
    map.set(lead, new Array(data.length));
  }
  for (let i = 0; i < data.length; i++) {
    for (const lead of ECG_LEADS) {
      map.get(lead)![i] = data[i].leads[lead];
    }
  }
  return map;
}

// ─── 数据归一化 ─────────────────────────────────────────────

/**
 * 将数值数组归一化到 [0, 1] 范围
 * @param data 原始数值数组
 * @returns 归一化后的数组（原数组不变）
 */
export function normalizeData(data: number[]): number[] {
  if (data.length === 0) return [];

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }

  const range = max - min;
  // 全相同值 → 返回全0
  if (range === 0) return new Array(data.length).fill(0);

  const result = new Array<number>(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = (data[i] - min) / range;
  }
  return result;
}

/**
 * 将 12 导联 ECG 数据归一化，保留导联间相对幅度关系
 *
 * 使用全局 Z-Score 标准化：先计算所有导联的全局均值和标准差，
 * 再进行标准化并缩放到目标范围。这保留了各导联之间的相对幅度关系，
 * 适合心电波形的特征展示。
 *
 * @param data       12 导联原始数据 Record<ECGLead, number[]>
 * @param targetMin  目标范围最小值（默认 -1）
 * @param targetMax  目标范围最大值（默认  1）
 * @param scaleFactor 缩放因子（默认 1，可手动调整以放大/缩小波形）
 * @returns 归一化后的 12 导联数据（原对象不变）
 */
export function normalizeECGData(
  data: Record<ECGLead, number[]>,
  targetMin: number = -1,
  targetMax: number = 1,
  scaleFactor: number = 1,
): Record<ECGLead, number[]> {
  const result = {} as Record<ECGLead, number[]>;

  // 收集所有导联的全部数据点
  const allValues: number[] = [];
  for (const lead of ECG_LEADS) {
    const arr = data[lead];
    if (arr && arr.length > 0) {
      for (let i = 0; i < arr.length; i++) {
        if (Number.isFinite(arr[i])) {
          allValues.push(arr[i]);
        }
      }
    }
  }

  // 无有效数据 → 返回空
  if (allValues.length === 0) {
    for (const lead of ECG_LEADS) {
      result[lead] = data[lead] ? new Array(data[lead].length).fill(0) : [];
    }
    return result;
  }

  // 使用 MAD（中位数绝对偏差）过滤异常值
  // 计算中位数
  const sorted = [...allValues].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  // 计算 MAD = median(|xi - median|)
  const absDeviations = allValues.map(v => Math.abs(v - median)).sort((a, b) => a - b);
  const mad = absDeviations.length % 2 === 0
    ? (absDeviations[absDeviations.length / 2 - 1] + absDeviations[absDeviations.length / 2]) / 2
    : absDeviations[Math.floor(absDeviations.length / 2)];

  // 过滤掉超出 median ± 5*MAD 的异常值（阈值5比3更宽松，适合ECG信号）
  // 当 MAD 为0时，使用百分位数方法
  const threshold = 5;
  let cleanValues: number[];
  if (mad > 0) {
    const lower = median - threshold * mad;
    const upper = median + threshold * mad;
    cleanValues = allValues.filter(v => v >= lower && v <= upper);
  } else {
    // MAD 为0说明数据高度集中，使用百分位数过滤
    const p5 = sorted[Math.floor(sorted.length * 0.05)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    cleanValues = allValues.filter(v => v >= p5 && v <= p95);
  }

  // 如果过滤后数据太少，回退使用原始数据
  if (cleanValues.length < allValues.length * 0.5) {
    cleanValues = allValues;
  }

  // 计算过滤后数据的均值和标准差
  let sum = 0;
  for (let i = 0; i < cleanValues.length; i++) {
    sum += cleanValues[i];
  }
  const mean = sum / cleanValues.length;

  let sumSq = 0;
  for (let i = 0; i < cleanValues.length; i++) {
    sumSq += (cleanValues[i] - mean) ** 2;
  }
  const std = Math.sqrt(sumSq / cleanValues.length);

  // 目标范围中心和半幅
  const targetCenter = (targetMin + targetMax) / 2;
  const targetHalfRange = (targetMax - targetMin) / 2;

  // 标准差为零（所有值相同）→ 返回 0
  if (std === 0) {
    for (const lead of ECG_LEADS) {
      const arr = data[lead];
      result[lead] = arr ? new Array(arr.length).fill(0) : [];
    }
    return result;
  }

  // 对每个导联应用 Z-Score 标准化并缩放
  for (const lead of ECG_LEADS) {
    const arr = data[lead];
    if (!arr || arr.length === 0) {
      result[lead] = [];
      continue;
    }

    const out = new Array<number>(arr.length);
    for (let i = 0; i < arr.length; i++) {
      // Z-Score 标准化
      const z = (arr[i] - mean) / std;
      // 缩放到目标范围，乘以 scaleFactor
      out[i] = z * targetHalfRange * scaleFactor + targetCenter;
    }
    result[lead] = out;
  }

  return result;
}

// ─── 数据校验 ───────────────────────────────────────────────

/** 单导联合理范围（16位有符号） */
const ADC_MIN = -32768;
const ADC_MAX = 32767;

/**
 * 校验单帧 ECGData 是否合法
 * - 所有导联数值在 16-bit 有符号范围内
 * - 不含 NaN / Infinity
 */
export function validateData(data: ECGData): boolean {
  for (const lead of ECG_LEADS) {
    const v = data.leads[lead];
    if (!Number.isFinite(v)) return false;
    if (v < ADC_MIN || v > ADC_MAX) return false;
  }
  return true;
}

// ─── ASCII 数据解析 ───────────────────────────────────────────

/** 导联名字符串 → ECGLead 枚举映射 */
const LEAD_NAME_MAP: Record<string, ECGLead> = {
  I: ECGLead.I,
  II: ECGLead.II,
  III: ECGLead.III,
  aVR: ECGLead.aVR,
  aVL: ECGLead.aVL,
  aVF: ECGLead.aVF,
  V1: ECGLead.V1,
  V2: ECGLead.V2,
  V3: ECGLead.V3,
  V4: ECGLead.V4,
  V5: ECGLead.V5,
  V6: ECGLead.V6,
};

/**
 * 解析 ASCII 格式串口数据为 ECGData 数组
 *
 * 支持格式：
 * `I:%d, II:%d, III:%d, aVR:%d, aVL:%d, aVF:%d, V1:%d, V2:%d, V3:%d, V4:%d, V5:%d, V6:%d\r\n`
 *
 * @param input 原始 ASCII 字符串
 * @returns 解析后的 ECGData 数组（跳过格式错误的行）
 */
export function parseASCIIData(input: string): ECGData[] {
  if (!input) return [];

  const results: ECGData[] = [];
  // 按 \r\n 或 \n 分割行
  const lines = input.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue; // 跳过空行

    const leads = {} as Record<ECGLead, number>;
    let valid = true;

    // 按 ", " 分割键值对
    const pairs = trimmed.split(', ');
    if (pairs.length < 12) continue; // 至少需要12个导联

    for (const pair of pairs) {
      const colonIdx = pair.indexOf(':');
      if (colonIdx === -1) { valid = false; break; }

      const key = pair.substring(0, colonIdx).trim();
      const valueStr = pair.substring(colonIdx + 1).trim();

      const lead = LEAD_NAME_MAP[key];
      if (lead === undefined) { valid = false; break; }

      const value = Number(valueStr);
      if (!Number.isFinite(value)) { valid = false; break; }

      leads[lead] = value;
    }

    // 确保所有12个导联都已解析
    if (valid && Object.keys(leads).length === 12) {
      results.push({ timestamp: Date.now(), leads });
    }
  }

  return results;
}

// ─── 便捷导出 ───────────────────────────────────────────────

/**
 * 完整流水线：解析 → 校验 → 分离
 * 返回通过校验的数据
 */
export function parseAndSeparate(
  raw: ArrayBuffer,
  cfg?: FrameConfig,
): { data: ECGData[]; leads: Map<ECGLead, number[]> } {
  const parsed = parseSerialData(raw, cfg);
  const valid = parsed.filter(validateData);
  return { data: valid, leads: separateLeads(valid) };
}

// ─── 多参数帧解析 ─────────────────────────────────────────────

/**
 * 解析多参数二进制数据（带 Type-ID 字节）
 * @param raw 原始 ArrayBuffer
 * @param cfg 多参数帧配置（可选，默认 DEFAULT_MULTI_PARAM_CONFIG）
 * @returns 解析后的 PhysioFrame 数组
 */
export function parseMultiParamBinaryData(
  raw: ArrayBuffer,
  cfg: MultiParamFrameConfig = DEFAULT_MULTI_PARAM_CONFIG,
): PhysioFrame[] {
  const view = new DataView(raw);
  const results: PhysioFrame[] = [];
  let offset = 0;

  while (offset < raw.byteLength) {
    // 寻找帧头
    if (!matchHeader(view, offset, cfg)) {
      offset++;
      continue;
    }

    // 读取 Type-ID 字节
    let param = PhysioParameter.ECG; // 默认
    const dataStart = offset + cfg.header.length;
    if (cfg.typeField?.enabled && cfg.typeField.typeMap) {
      const typeId = view.getUint8(dataStart);
      param = cfg.typeField.typeMap[typeId] ?? PhysioParameter.ECG;
    }

    // 计算帧大小（使用 CHANNEL_CONFIGS）
    const typeSize = cfg.typeField?.enabled ? 1 : 0;
    const channelConfig = CHANNEL_CONFIGS[param];
    // 如果没有找到配置，使用旧版 12 导联 ECG 大小
    const channelCount = channelConfig ? channelConfig.channels.length : 12;
    const size = cfg.header.length + typeSize + channelCount * cfg.bytesPerSample + cfg.footer.length;

    if (offset + size > raw.byteLength) break;

    // 校验帧尾
    const footerStart = dataStart + typeSize + channelCount * cfg.bytesPerSample;
    let footerMatch = true;
    for (let i = 0; i < cfg.footer.length; i++) {
      if (view.getUint8(footerStart + i) !== cfg.footer[i]) {
        footerMatch = false;
        break;
      }
    }
    if (!footerMatch) { offset++; continue; }

    // 提取各通道数据
    const channels: Record<string, number> = {};
    const channelNames = channelConfig ? channelConfig.channels : ECG_LEADS.map(l => l.toString());
    for (let i = 0; i < channelCount; i++) {
      const byteOffset = dataStart + typeSize + i * cfg.bytesPerSample;
      channels[channelNames[i]] = cfg.bytesPerSample === 2
        ? view.getInt16(byteOffset, true)
        : view.getInt8(byteOffset);
    }

    results.push({ parameter: param, timestamp: Date.now(), channels });
    offset += size;
  }

  return results;
}

/** ASCII TYPE 前缀 → PhysioParameter 映射 */
const ASCII_TYPE_MAP: Record<string, PhysioParameter> = {
  ECG: PhysioParameter.ECG,
  SPO2: PhysioParameter.SpO2,
  RESP: PhysioParameter.Respiration,
  EMG: PhysioParameter.EMG,
  TEMP: PhysioParameter.Temperature,
};

/**
 * 解析多参数 ASCII 数据（带 TYPE: 前缀）
 * @param input 原始 ASCII 字符串
 * @returns 解析后的 PhysioFrame 数组
 */
export function parseMultiParamASCIIData(input: string): PhysioFrame[] {
  if (!input) return [];
  const results: PhysioFrame[] = [];
  const lines = input.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for TYPE: prefix
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const prefix = trimmed.substring(0, colonIdx).toUpperCase();
    const rest = trimmed.substring(colonIdx + 1).trim();

    const param = ASCII_TYPE_MAP[prefix];
    if (!param) {
      // No recognized prefix → try legacy ECG parsing (handled by existing parseASCIIData)
      continue;
    }

    const channels: Record<string, number> = {};
    let valid = true;

    const pairs = rest.split(', ');
    for (const pair of pairs) {
      const eqIdx = pair.indexOf(':');
      if (eqIdx === -1) { valid = false; break; }
      const key = pair.substring(0, eqIdx).trim();
      const val = Number(pair.substring(eqIdx + 1).trim());
      if (!Number.isFinite(val)) { valid = false; break; }
      channels[key] = val;
    }

    if (valid && Object.keys(channels).length > 0) {
      results.push({ parameter: param, timestamp: Date.now(), channels });
    }
  }

  return results;
}

/**
 * 多参数数据解析便捷流水线
 * @param raw 原始 ArrayBuffer
 * @param cfg 多参数帧配置（可选）
 * @returns 解析后的 PhysioFrame 数组
 */
export function parseMultiParamAndRoute(
  raw: ArrayBuffer,
  cfg?: MultiParamFrameConfig,
): PhysioFrame[] {
  return parseMultiParamBinaryData(raw, cfg);
}
