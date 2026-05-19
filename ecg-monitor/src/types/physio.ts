/**
 * 多参数生理监护类型系统
 * 将ECG-only心电监护扩展为多参数生理监护平台
 */

import { type FrameConfig, DEFAULT_FRAME_CONFIG, ECGLead, type ECGData } from './ecg';

/**
 * 生理参数类型枚举
 */
export enum PhysioParameter {
  /** 心电 */
  ECG = 'ECG',
  /** 血氧饱和度 */
  SpO2 = 'SpO2',
  /** 呼吸 */
  Respiration = 'Respiration',
  /** 肌电 */
  EMG = 'EMG',
  /** 体温 */
  Temperature = 'Temperature',
}

/**
 * 参数中文标签映射（带符号）
 */
export const PARAMETER_LABELS: Record<PhysioParameter, string> = {
  [PhysioParameter.ECG]: '心电 (ECG)',
  [PhysioParameter.SpO2]: '血氧 (SpO₂)',
  [PhysioParameter.Respiration]: '呼吸 (Resp)',
  [PhysioParameter.EMG]: '肌电 (EMG)',
  [PhysioParameter.Temperature]: '体温 (Temp)',
};

/**
 * 各参数默认颜色
 */
export const PARAMETER_COLORS: Record<PhysioParameter, string> = {
  [PhysioParameter.ECG]: '#00FF00',
  [PhysioParameter.SpO2]: '#00BFFF',
  [PhysioParameter.Respiration]: '#00CED1',
  [PhysioParameter.EMG]: '#FFD700',
  [PhysioParameter.Temperature]: '#FF6347',
};

/**
 * 通用数据帧接口（代替ECGData的泛化版本）
 */
export interface PhysioFrame {
  /** 参数类型 */
  parameter: PhysioParameter;
  /** 时间戳（ms） */
  timestamp: number;
  /** 通道数据映射（参数名→采样值） */
  channels: Record<string, number>;
}

/**
 * 将ECGData转换为PhysioFrame
 * @param data ECG原始数据
 * @returns 泛化的生理参数帧
 */
export function createECGFrame(data: ECGData): PhysioFrame {
  const channels: Record<string, number> = {};
  for (const lead of Object.keys(data.leads) as ECGLead[]) {
    channels[lead] = data.leads[lead];
  }
  return {
    parameter: PhysioParameter.ECG,
    timestamp: data.timestamp,
    channels,
  };
}

/**
 * 每个参数的通道配置
 */
export interface PhysioChannelConfig {
  /** 参数类型 */
  parameter: PhysioParameter;
  /** 通道名列表 */
  channels: string[];
  /** 默认采样率（Hz） */
  defaultSampleRate: number;
  /** 波形显示单位 */
  waveformLabel: string;
}

/**
 * 预定义5个参数的通道配置
 */
export const CHANNEL_CONFIGS: Record<PhysioParameter, PhysioChannelConfig> = {
  [PhysioParameter.ECG]: {
    parameter: PhysioParameter.ECG,
    channels: ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'],
    defaultSampleRate: 250,
    waveformLabel: 'mV',
  },
  [PhysioParameter.SpO2]: {
    parameter: PhysioParameter.SpO2,
    channels: ['SpO2', 'PR'],
    defaultSampleRate: 100,
    waveformLabel: '%',
  },
  [PhysioParameter.Respiration]: {
    parameter: PhysioParameter.Respiration,
    channels: ['RESP'],
    defaultSampleRate: 50,
    waveformLabel: '次/分',
  },
  [PhysioParameter.EMG]: {
    parameter: PhysioParameter.EMG,
    channels: ['CH1', 'CH2'],
    defaultSampleRate: 500,
    waveformLabel: 'μV',
  },
  [PhysioParameter.Temperature]: {
    parameter: PhysioParameter.Temperature,
    channels: ['TEMP'],
    defaultSampleRate: 10,
    waveformLabel: '℃',
  },
};

/**
 * 类型字段配置（用于多参数帧识别）
 */
export interface TypeFieldConfig {
  /** 是否启用类型字段 */
  enabled: boolean;
  /** Type-ID在帧头之后 */
  position: 'after_header';
  /** 类型映射（字节值→参数类型） */
  typeMap: Record<number, PhysioParameter>;
}

/**
 * 扩展FrameConfig支持多参数帧识别
 */
export interface MultiParamFrameConfig extends FrameConfig {
  /** 类型字段配置 */
  typeField?: TypeFieldConfig;
}

/**
 * 默认多参数帧配置
 */
export const DEFAULT_MULTI_PARAM_CONFIG: MultiParamFrameConfig = {
  ...DEFAULT_FRAME_CONFIG,
  typeField: {
    enabled: true,
    position: 'after_header',
    typeMap: {
      0x01: PhysioParameter.ECG,
      0x02: PhysioParameter.SpO2,
      0x03: PhysioParameter.Respiration,
      0x04: PhysioParameter.EMG,
      0x05: PhysioParameter.Temperature,
    },
  },
};

/**
 * 有序参数列表（用于菜单渲染）
 */
export const PARAMETER_LIST: readonly PhysioParameter[] = [
  PhysioParameter.ECG,
  PhysioParameter.SpO2,
  PhysioParameter.Respiration,
  PhysioParameter.EMG,
  PhysioParameter.Temperature,
];