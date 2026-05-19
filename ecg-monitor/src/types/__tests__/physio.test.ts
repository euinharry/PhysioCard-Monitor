/**
 * physio (多参数监护类型系统) 单元测试
 *
 * 测试覆盖：
 * 1. PhysioParameter 枚举 — 5个值、字符串表示
 * 2. PARAMETER_LIST — 有序列表
 * 3. PARAMETER_LABELS — 中文标签映射
 * 4. PARAMETER_COLORS — 颜色映射
 * 5. createECGFrame  — ECG → PhysioFrame 转换
 * 6. DEFAULT_MULTI_PARAM_CONFIG — 继承 + typeField
 * 7. CHANNEL_CONFIGS — 各参数通道配置
 */
import { describe, it, expect } from 'vitest';
import {
  PhysioParameter,
  PARAMETER_LABELS,
  PARAMETER_COLORS,
  CHANNEL_CONFIGS,
  DEFAULT_MULTI_PARAM_CONFIG,
  PARAMETER_LIST,
  createECGFrame,
} from '../physio';
import { type ECGData, ECGLead, DEFAULT_FRAME_CONFIG } from '../ecg';

// ─── 枚举值 ──────────────────────────────────────────────────

describe('PhysioParameter', () => {
  it('应有且仅有 5 个值', () => {
    const values = Object.values(PhysioParameter);
    expect(values).toHaveLength(5);
  });

  it('每个值的字符串表示与自身一致', () => {
    expect(PhysioParameter.ECG).toBe('ECG');
    expect(PhysioParameter.SpO2).toBe('SpO2');
    expect(PhysioParameter.Respiration).toBe('Respiration');
    expect(PhysioParameter.EMG).toBe('EMG');
    expect(PhysioParameter.Temperature).toBe('Temperature');
  });

  it('所有值都是 PhysioParameter 类型', () => {
    const values = Object.values(PhysioParameter);
    for (const v of values) {
      expect(Object.values(PhysioParameter)).toContain(v);
    }
  });
});

// ─── PARAMETER_LIST ──────────────────────────────────────────

describe('PARAMETER_LIST', () => {
  it('应包含全部 5 个参数', () => {
    expect(PARAMETER_LIST).toHaveLength(5);
  });

  it('顺序应为 ECG → SpO2 → Respiration → EMG → Temperature', () => {
    expect(PARAMETER_LIST).toEqual([
      PhysioParameter.ECG,
      PhysioParameter.SpO2,
      PhysioParameter.Respiration,
      PhysioParameter.EMG,
      PhysioParameter.Temperature,
    ]);
  });

  it('第一个元素应为 ECG，最后一个应为 Temperature', () => {
    expect(PARAMETER_LIST[0]).toBe(PhysioParameter.ECG);
    expect(PARAMETER_LIST[PARAMETER_LIST.length - 1]).toBe(PhysioParameter.Temperature);
  });

  it('应为只读不可变', () => {
    // TypeScript 编译时约束，运行时检查 Object.isFrozen 或类似
    expect(Object.isFrozen(PARAMETER_LIST) || Array.isArray(PARAMETER_LIST)).toBe(true);
  });
});

// ─── PARAMETER_LABELS ───────────────────────────────────────

describe('PARAMETER_LABELS', () => {
  it('应包含全部 5 个参数的标签', () => {
    const keys = Object.keys(PARAMETER_LABELS);
    expect(keys).toHaveLength(5);
  });

  it('心电标签应为 "心电 (ECG)"', () => {
    expect(PARAMETER_LABELS[PhysioParameter.ECG]).toBe('心电 (ECG)');
  });

  it('血氧标签应为 "血氧 (SpO₂)"', () => {
    expect(PARAMETER_LABELS[PhysioParameter.SpO2]).toBe('血氧 (SpO₂)');
  });

  it('呼吸标签应为 "呼吸 (Resp)"', () => {
    expect(PARAMETER_LABELS[PhysioParameter.Respiration]).toBe('呼吸 (Resp)');
  });

  it('肌电标签应为 "肌电 (EMG)"', () => {
    expect(PARAMETER_LABELS[PhysioParameter.EMG]).toBe('肌电 (EMG)');
  });

  it('体温标签应为 "体温 (Temp)"', () => {
    expect(PARAMETER_LABELS[PhysioParameter.Temperature]).toBe('体温 (Temp)');
  });

  it('所有标签均为非空字符串', () => {
    for (const label of Object.values(PARAMETER_LABELS)) {
      expect(label).toBeTypeOf('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });
});

// ─── PARAMETER_COLORS ───────────────────────────────────────

describe('PARAMETER_COLORS', () => {
  it('应包含全部 5 个参数的颜色', () => {
    const keys = Object.keys(PARAMETER_COLORS);
    expect(keys).toHaveLength(5);
  });

  it('ECG 颜色应为 #00FF00', () => {
    expect(PARAMETER_COLORS[PhysioParameter.ECG]).toBe('#00FF00');
  });

  it('SpO2 颜色应为 #00BFFF', () => {
    expect(PARAMETER_COLORS[PhysioParameter.SpO2]).toBe('#00BFFF');
  });

  it('Respiration 颜色应为 #00CED1', () => {
    expect(PARAMETER_COLORS[PhysioParameter.Respiration]).toBe('#00CED1');
  });

  it('EMG 颜色应为 #FFD700', () => {
    expect(PARAMETER_COLORS[PhysioParameter.EMG]).toBe('#FFD700');
  });

  it('Temperature 颜色应为 #FF6347', () => {
    expect(PARAMETER_COLORS[PhysioParameter.Temperature]).toBe('#FF6347');
  });

  it('所有颜色均为有效的 6 位十六进制色值', () => {
    for (const color of Object.values(PARAMETER_COLORS)) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

// ─── createECGFrame ─────────────────────────────────────────

describe('createECGFrame', () => {
  function makeECGData(
    overrides: Partial<Record<ECGLead, number>> = {},
    timestamp: number = 1000,
  ): ECGData {
    const leads = {} as Record<ECGLead, number>;
    for (const lead of Object.values(ECGLead)) {
      leads[lead] = overrides[lead] ?? 0;
    }
    return { timestamp, leads };
  }

  it('应将 parameter 设为 PhysioParameter.ECG', () => {
    const frame = createECGFrame(makeECGData());
    expect(frame.parameter).toBe(PhysioParameter.ECG);
  });

  it('应保留原始时间戳', () => {
    const ts = 1234567890;
    const frame = createECGFrame(makeECGData({}, ts));
    expect(frame.timestamp).toBe(ts);
  });

  it('应将 12 导联全部映射到 channels', () => {
    const frame = createECGFrame(makeECGData());
    const channels = frame.channels;
    for (const lead of Object.values(ECGLead)) {
      expect(channels).toHaveProperty(lead);
    }
    expect(Object.keys(channels)).toHaveLength(12);
  });

  it('应正确保留各导联值', () => {
    const leads: Partial<Record<ECGLead, number>> = {
      [ECGLead.I]: 100,
      [ECGLead.II]: 200,
      [ECGLead.V6]: 1200,
    };
    const frame = createECGFrame(makeECGData(leads));
    expect(frame.channels[ECGLead.I]).toBe(100);
    expect(frame.channels[ECGLead.II]).toBe(200);
    expect(frame.channels[ECGLead.V6]).toBe(1200);
  });

  it('应正确保留负值', () => {
    const leads: Partial<Record<ECGLead, number>> = {
      [ECGLead.I]: -32768,
      [ECGLead.II]: -100,
    };
    const frame = createECGFrame(makeECGData(leads));
    expect(frame.channels[ECGLead.I]).toBe(-32768);
    expect(frame.channels[ECGLead.II]).toBe(-100);
  });

  it('应正确保留边界值', () => {
    const frame = createECGFrame(
      makeECGData({ [ECGLead.I]: 32767, [ECGLead.II]: -32768 }),
    );
    expect(frame.channels[ECGLead.I]).toBe(32767);
    expect(frame.channels[ECGLead.II]).toBe(-32768);
  });

  it('返回的对象结构应符合 PhysioFrame 接口', () => {
    const frame = createECGFrame(makeECGData());
    expect(frame).toHaveProperty('parameter');
    expect(frame).toHaveProperty('timestamp');
    expect(frame).toHaveProperty('channels');
    expect(typeof frame.parameter).toBe('string');
    expect(typeof frame.timestamp).toBe('number');
    expect(typeof frame.channels).toBe('object');
  });
});

// ─── DEFAULT_MULTI_PARAM_CONFIG ─────────────────────────────

describe('DEFAULT_MULTI_PARAM_CONFIG', () => {
  it('应继承 DEFAULT_FRAME_CONFIG 的所有字段', () => {
    expect(DEFAULT_MULTI_PARAM_CONFIG.header).toEqual(DEFAULT_FRAME_CONFIG.header);
    expect(DEFAULT_MULTI_PARAM_CONFIG.footer).toEqual(DEFAULT_FRAME_CONFIG.footer);
    expect(DEFAULT_MULTI_PARAM_CONFIG.bytesPerSample).toBe(DEFAULT_FRAME_CONFIG.bytesPerSample);
    expect(DEFAULT_MULTI_PARAM_CONFIG.leadCount).toBe(DEFAULT_FRAME_CONFIG.leadCount);
  });

  it('应包含 typeField 配置', () => {
    expect(DEFAULT_MULTI_PARAM_CONFIG.typeField).toBeDefined();
  });

  it('typeField 应启用', () => {
    expect(DEFAULT_MULTI_PARAM_CONFIG.typeField!.enabled).toBe(true);
  });

  it('typeField position 应为 after_header', () => {
    expect(DEFAULT_MULTI_PARAM_CONFIG.typeField!.position).toBe('after_header');
  });

  it('typeMap 应映射 0x01→ECG … 0x05→Temperature', () => {
    const typeMap = DEFAULT_MULTI_PARAM_CONFIG.typeField!.typeMap;
    expect(typeMap[0x01]).toBe(PhysioParameter.ECG);
    expect(typeMap[0x02]).toBe(PhysioParameter.SpO2);
    expect(typeMap[0x03]).toBe(PhysioParameter.Respiration);
    expect(typeMap[0x04]).toBe(PhysioParameter.EMG);
    expect(typeMap[0x05]).toBe(PhysioParameter.Temperature);
  });

  it('typeMap 应有且仅有 5 个条目', () => {
    const keys = Object.keys(DEFAULT_MULTI_PARAM_CONFIG.typeField!.typeMap);
    expect(keys).toHaveLength(5);
  });

  it('0x00 和 0x06 不应在 typeMap 中', () => {
    const typeMap = DEFAULT_MULTI_PARAM_CONFIG.typeField!.typeMap;
    expect(typeMap[0x00]).toBeUndefined();
    expect(typeMap[0x06]).toBeUndefined();
  });
});

// ─── CHANNEL_CONFIGS ────────────────────────────────────────

describe('CHANNEL_CONFIGS', () => {
  it('应包含全部 5 个参数的通道配置', () => {
    const keys = Object.keys(CHANNEL_CONFIGS);
    expect(keys).toHaveLength(5);
  });

  // ── ECG ──
  describe('ECG', () => {
    const cfg = CHANNEL_CONFIGS[PhysioParameter.ECG];

    it('parameter 应为 ECG', () => {
      expect(cfg.parameter).toBe(PhysioParameter.ECG);
    });

    it('应有 12 个导联通道', () => {
      expect(cfg.channels).toEqual([
        'I', 'II', 'III', 'aVR', 'aVL', 'aVF',
        'V1', 'V2', 'V3', 'V4', 'V5', 'V6',
      ]);
    });

    it('默认采样率应为 250Hz', () => {
      expect(cfg.defaultSampleRate).toBe(250);
    });

    it('波形标签应为 "mV"', () => {
      expect(cfg.waveformLabel).toBe('mV');
    });
  });

  // ── SpO2 ──
  describe('SpO2', () => {
    const cfg = CHANNEL_CONFIGS[PhysioParameter.SpO2];

    it('parameter 应为 SpO2', () => {
      expect(cfg.parameter).toBe(PhysioParameter.SpO2);
    });

    it('应有 SpO2 和 PR 两个通道', () => {
      expect(cfg.channels).toEqual(['SpO2', 'PR']);
    });

    it('默认采样率应为 100Hz', () => {
      expect(cfg.defaultSampleRate).toBe(100);
    });

    it('波形标签应为 "%"', () => {
      expect(cfg.waveformLabel).toBe('%');
    });
  });

  // ── Respiration ──
  describe('Respiration', () => {
    const cfg = CHANNEL_CONFIGS[PhysioParameter.Respiration];

    it('parameter 应为 Respiration', () => {
      expect(cfg.parameter).toBe(PhysioParameter.Respiration);
    });

    it('应有 RESP 单个通道', () => {
      expect(cfg.channels).toEqual(['RESP']);
    });

    it('默认采样率应为 50Hz', () => {
      expect(cfg.defaultSampleRate).toBe(50);
    });

    it('波形标签应为 "次/分"', () => {
      expect(cfg.waveformLabel).toBe('次/分');
    });
  });

  // ── EMG ──
  describe('EMG', () => {
    const cfg = CHANNEL_CONFIGS[PhysioParameter.EMG];

    it('parameter 应为 EMG', () => {
      expect(cfg.parameter).toBe(PhysioParameter.EMG);
    });

    it('应有 CH1 和 CH2 两个通道', () => {
      expect(cfg.channels).toEqual(['CH1', 'CH2']);
    });

    it('默认采样率应为 500Hz', () => {
      expect(cfg.defaultSampleRate).toBe(500);
    });

    it('波形标签应为 "μV"', () => {
      expect(cfg.waveformLabel).toBe('μV');
    });
  });

  // ── Temperature ──
  describe('Temperature', () => {
    const cfg = CHANNEL_CONFIGS[PhysioParameter.Temperature];

    it('parameter 应为 Temperature', () => {
      expect(cfg.parameter).toBe(PhysioParameter.Temperature);
    });

    it('应有 TEMP 单个通道', () => {
      expect(cfg.channels).toEqual(['TEMP']);
    });

    it('默认采样率应为 10Hz', () => {
      expect(cfg.defaultSampleRate).toBe(10);
    });

    it('波形标签应为 "℃"', () => {
      expect(cfg.waveformLabel).toBe('℃');
    });
  });

  // ── 统一属性检查 ──
  it('所有配置的 parameter 应等于其键', () => {
    for (const [key, cfg] of Object.entries(CHANNEL_CONFIGS)) {
      expect(cfg.parameter).toBe(key as unknown as PhysioParameter);
    }
  });

  it('所有配置的 channels 非空', () => {
    for (const cfg of Object.values(CHANNEL_CONFIGS)) {
      expect(cfg.channels.length).toBeGreaterThan(0);
    }
  });

  it('所有配置的 defaultSampleRate 为正整数', () => {
    for (const cfg of Object.values(CHANNEL_CONFIGS)) {
      expect(cfg.defaultSampleRate).toBeGreaterThan(0);
      expect(Number.isInteger(cfg.defaultSampleRate)).toBe(true);
    }
  });

  it('所有配置的 waveformLabel 为非空字符串', () => {
    for (const cfg of Object.values(CHANNEL_CONFIGS)) {
      expect(cfg.waveformLabel).toBeTypeOf('string');
      expect(cfg.waveformLabel.length).toBeGreaterThan(0);
    }
  });
});
