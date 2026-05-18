/**
 * dataParser 单元测试
 *
 * 测试覆盖：
 * 1. parseSerialData  — 二进制帧解析
 * 2. separateLeads    — 12导联数据分离
 * 3. normalizeData    — 数值归一化
 * 4. validateData     — 数据校验
 * 5. parseAndSeparate — 完整流水线
 *
 * 帧格式（默认 DEFAULT_FRAME_CONFIG）：
 *   [0xAA, 0x55] + 12×2字节(小端序有符号) + [0x0D, 0x0A]
 *   单帧 = 2 + 24 + 2 = 28 字节
 */
import { describe, it, expect } from 'vitest';
import {
  parseSerialData,
  separateLeads,
  normalizeData,
  validateData,
  parseAndSeparate,
} from '../dataParser';
import { type ECGData, type FrameConfig, ECGLead, ECG_LEADS, DEFAULT_FRAME_CONFIG } from '../../types/ecg';

// ─── 测试辅助函数 ────────────────────────────────────────────

/** 构造单帧 ArrayBuffer */
function buildFrame(
  leadValues: number[],
  cfg: FrameConfig = DEFAULT_FRAME_CONFIG,
): ArrayBuffer {
  const size = cfg.header.length + cfg.leadCount * cfg.bytesPerSample + cfg.footer.length;
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  let offset = 0;

  // 帧头
  for (const b of cfg.header) {
    view.setUint8(offset++, b);
  }

  // 数据（小端序有符号16位）
  for (let i = 0; i < cfg.leadCount; i++) {
    if (cfg.bytesPerSample === 2) {
      view.setInt16(offset, leadValues[i] ?? 0, true);
    } else {
      view.setInt8(offset, leadValues[i] ?? 0);
    }
    offset += cfg.bytesPerSample;
  }

  // 帧尾
  for (const b of cfg.footer) {
    view.setUint8(offset++, b);
  }

  return buf;
}

/** 构造多帧 ArrayBuffer */
function buildMultiFrame(
  frames: number[][],
  cfg: FrameConfig = DEFAULT_FRAME_CONFIG,
): ArrayBuffer {
  const buffers = frames.map((values) => buildFrame(values, cfg));
  const totalSize = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const result = new ArrayBuffer(totalSize);
  const view = new Uint8Array(result);
  let offset = 0;
  for (const buf of buffers) {
    view.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result;
}

/** 生成12导联全零帧 */
function zeroFrame(): number[] {
  return new Array(12).fill(0);
}

/** 生成12导联递增帧 */
function incrementFrame(start: number): number[] {
  return Array.from({ length: 12 }, (_, i) => start + i);
}

// ─── parseSerialData ─────────────────────────────────────────

describe('parseSerialData', () => {
  it('应正确解析单帧数据', () => {
    const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];
    const raw = buildFrame(values);
    const result = parseSerialData(raw);

    expect(result).toHaveLength(1);
    expect(result[0].leads[ECGLead.I]).toBe(100);
    expect(result[0].leads[ECGLead.II]).toBe(200);
    expect(result[0].leads[ECGLead.V6]).toBe(1200);
  });

  it('应正确解析多帧数据', () => {
    const frame1 = incrementFrame(0);
    const frame2 = incrementFrame(100);
    const frame3 = incrementFrame(200);
    const raw = buildMultiFrame([frame1, frame2, frame3]);
    const result = parseSerialData(raw);

    expect(result).toHaveLength(3);
    expect(result[0].leads[ECGLead.I]).toBe(0);
    expect(result[1].leads[ECGLead.I]).toBe(100);
    expect(result[2].leads[ECGLead.I]).toBe(200);
  });

  it('应处理负值（有符号16位）', () => {
    const values = [-100, -200, -300, -400, -500, -600, -700, -800, -900, -1000, -1100, -1200];
    const raw = buildFrame(values);
    const result = parseSerialData(raw);

    expect(result).toHaveLength(1);
    expect(result[0].leads[ECGLead.I]).toBe(-100);
    expect(result[0].leads[ECGLead.V6]).toBe(-1200);
  });

  it('应处理16位边界值', () => {
    const values = [32767, -32768, 0, 32767, -32768, 0, 32767, -32768, 0, 32767, -32768, 0];
    const raw = buildFrame(values);
    const result = parseSerialData(raw);

    expect(result).toHaveLength(1);
    expect(result[0].leads[ECGLead.I]).toBe(32767);
    expect(result[0].leads[ECGLead.II]).toBe(-32768);
  });

  it('空输入应返回空数组', () => {
    const raw = new ArrayBuffer(0);
    const result = parseSerialData(raw);
    expect(result).toEqual([]);
  });

  it('不完整帧应被跳过', () => {
    // 只有帧头，没有完整帧
    const raw = new ArrayBuffer(5);
    const view = new Uint8Array(raw);
    view[0] = 0xaa;
    view[1] = 0x55;
    const result = parseSerialData(raw);
    expect(result).toEqual([]);
  });

  it('错误帧头应被跳过', () => {
    const raw = new ArrayBuffer(28);
    const view = new Uint8Array(raw);
    // 错误帧头
    view[0] = 0x00;
    view[1] = 0x00;
    const result = parseSerialData(raw);
    expect(result).toEqual([]);
  });

  it('错误帧尾应被跳过', () => {
    const raw = new ArrayBuffer(28);
    const view = new Uint8Array(raw);
    // 正确帧头
    view[0] = 0xaa;
    view[1] = 0x55;
    // 错误帧尾
    view[26] = 0x00;
    view[27] = 0x00;
    const result = parseSerialData(raw);
    expect(result).toEqual([]);
  });

  it('每帧应有 timestamp 字段', () => {
    const raw = buildFrame(zeroFrame());
    const result = parseSerialData(raw);
    expect(result[0].timestamp).toBeTypeOf('number');
    expect(result[0].timestamp).toBeGreaterThan(0);
  });

  it('支持自定义 FrameConfig', () => {
    const customCfg: FrameConfig = {
      header: [0xab, 0xcd],
      footer: [0xef, 0x01],
      bytesPerSample: 2,
      leadCount: 4,
    };
    const values = [10, 20, 30, 40];
    const raw = buildFrame(values, customCfg);
    const result = parseSerialData(raw, customCfg);

    expect(result).toHaveLength(1);
    expect(result[0].leads[ECGLead.I]).toBe(10);
    expect(result[0].leads[ECGLead.II]).toBe(20);
    expect(result[0].leads[ECGLead.III]).toBe(30);
    expect(result[0].leads[ECGLead.aVR]).toBe(40);
  });
});

// ─── separateLeads ───────────────────────────────────────────

describe('separateLeads', () => {
  it('应正确分离12导联数据', () => {
    const data: ECGData[] = [
      {
        timestamp: 1,
        leads: {
          [ECGLead.I]: 10, [ECGLead.II]: 20, [ECGLead.III]: 30,
          [ECGLead.aVR]: 40, [ECGLead.aVL]: 50, [ECGLead.aVF]: 60,
          [ECGLead.V1]: 70, [ECGLead.V2]: 80, [ECGLead.V3]: 90,
          [ECGLead.V4]: 100, [ECGLead.V5]: 110, [ECGLead.V6]: 120,
        },
      },
      {
        timestamp: 2,
        leads: {
          [ECGLead.I]: 110, [ECGLead.II]: 120, [ECGLead.III]: 130,
          [ECGLead.aVR]: 140, [ECGLead.aVL]: 150, [ECGLead.aVF]: 160,
          [ECGLead.V1]: 170, [ECGLead.V2]: 180, [ECGLead.V3]: 190,
          [ECGLead.V4]: 200, [ECGLead.V5]: 210, [ECGLead.V6]: 220,
        },
      },
    ];

    const leads = separateLeads(data);

    expect(leads.size).toBe(12);
    expect(leads.get(ECGLead.I)).toEqual([10, 110]);
    expect(leads.get(ECGLead.V6)).toEqual([120, 220]);
  });

  it('空数据应返回全空导联', () => {
    const leads = separateLeads([]);
    expect(leads.size).toBe(12);
    for (const lead of ECG_LEADS) {
      expect(leads.get(lead)).toEqual([]);
    }
  });
});

// ─── normalizeData ───────────────────────────────────────────

describe('normalizeData', () => {
  it('应归一化到 [0, 1]', () => {
    const result = normalizeData([10, 20, 30, 40, 50]);
    expect(result[0]).toBeCloseTo(0);
    expect(result[4]).toBeCloseTo(1);
    expect(result[2]).toBeCloseTo(0.5);
  });

  it('空数组应返回空数组', () => {
    expect(normalizeData([])).toEqual([]);
  });

  it('全相同值应返回全0', () => {
    const result = normalizeData([5, 5, 5, 5]);
    expect(result).toEqual([0, 0, 0, 0]);
  });

  it('单元素应返回 [0]', () => {
    expect(normalizeData([42])).toEqual([0]);
  });

  it('负值范围应正确归一化', () => {
    const result = normalizeData([-100, 0, 100]);
    expect(result[0]).toBeCloseTo(0);
    expect(result[1]).toBeCloseTo(0.5);
    expect(result[2]).toBeCloseTo(1);
  });

  it('不应修改原数组', () => {
    const original = [3, 1, 4, 1, 5];
    const copy = [...original];
    normalizeData(original);
    expect(original).toEqual(copy);
  });
});

// ─── validateData ────────────────────────────────────────────

describe('validateData', () => {
  function makeECGData(overrides: Partial<Record<ECGLead, number>> = {}): ECGData {
    const leads = {} as Record<ECGLead, number>;
    for (const lead of ECG_LEADS) {
      leads[lead] = overrides[lead] ?? 0;
    }
    return { timestamp: Date.now(), leads };
  }

  it('正常数据应通过校验', () => {
    expect(validateData(makeECGData())).toBe(true);
  });

  it('边界值应通过校验', () => {
    expect(validateData(makeECGData({ [ECGLead.I]: 32767 }))).toBe(true);
    expect(validateData(makeECGData({ [ECGLead.I]: -32768 }))).toBe(true);
  });

  it('超范围值应失败', () => {
    expect(validateData(makeECGData({ [ECGLead.I]: 32768 }))).toBe(false);
    expect(validateData(makeECGData({ [ECGLead.I]: -32769 }))).toBe(false);
  });

  it('NaN 应失败', () => {
    expect(validateData(makeECGData({ [ECGLead.I]: NaN }))).toBe(false);
  });

  it('Infinity 应失败', () => {
    expect(validateData(makeECGData({ [ECGLead.I]: Infinity }))).toBe(false);
    expect(validateData(makeECGData({ [ECGLead.I]: -Infinity }))).toBe(false);
  });
});

// ─── parseAndSeparate ────────────────────────────────────────

describe('parseAndSeparate', () => {
  it('应返回通过校验的数据和分离的导联', () => {
    const values = incrementFrame(100);
    const raw = buildFrame(values);
    const { data, leads } = parseAndSeparate(raw);

    expect(data).toHaveLength(1);
    expect(leads.size).toBe(12);
    expect(leads.get(ECGLead.I)).toEqual([100]);
  });

  it('非法数据应被过滤', () => {
    // 构造一帧合法 + 一帧非法（帧头错误导致无法解析为有效帧）
    const validFrame = buildFrame(incrementFrame(0));
    // 追加一些垃圾字节
    const garbage = new ArrayBuffer(10);
    const combined = new ArrayBuffer(validFrame.byteLength + garbage.byteLength);
    new Uint8Array(combined).set(new Uint8Array(validFrame), 0);
    new Uint8Array(combined).set(new Uint8Array(garbage), validFrame.byteLength);

    const { data } = parseAndSeparate(combined);
    expect(data).toHaveLength(1);
  });

  it('空输入应返回空结果', () => {
    const { data, leads } = parseAndSeparate(new ArrayBuffer(0));
    expect(data).toEqual([]);
    expect(leads.size).toBe(12);
  });
});
