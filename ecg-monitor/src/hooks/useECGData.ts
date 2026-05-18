import { useRef, useState, useCallback } from 'react';
import { ECGLead, ECGData, ECG_LEADS } from '../types/ecg';
import { RingBuffer } from '../utils/ringBuffer';
import { detectHeartRate } from '../utils/heartRateDetector';

// ─── 常量 ────────────────────────────────────────────────────

/** 默认采样率 (Hz) */
const DEFAULT_SAMPLE_RATE = 250;

/**
 * 缓冲区保留时长（秒）
 * 环形缓冲区仅保留最近 10 秒的数据，自动丢弃更早的采样点，
 * 防止长时间运行导致内存无限增长。
 */
const BUFFER_DURATION_SECONDS = 10;

/** 默认缓冲区容量：10秒 × 250Hz = 2500采样点 */
const DEFAULT_BUFFER_CAPACITY = BUFFER_DURATION_SECONDS * DEFAULT_SAMPLE_RATE;

/** 心率计算滑动窗口（秒） */
const HR_WINDOW_SECONDS = 5;

// ─── 类型 ────────────────────────────────────────────────────

/** useECGData Hook 返回接口 */
export interface UseECGDataReturn {
  /** 添加新数据帧（不触发 React 重渲染） */
  addData: (data: ECGData[]) => void;
  /** 获取指定导联数据（最近 count 个采样点） */
  getLeadData: (lead: ECGLead, count?: number) => number[];
  /** 获取当前心率 (BPM) */
  getHeartRate: () => number | null;
  /** 获取累计帧数 */
  getFrameCount: () => number;
  /** 获取数据版本号（每次 addData 递增，用于变更检测） */
  getDataVersion: () => number;
  /** 清空所有数据 */
  clearData: () => void;
  /** 开始记录 */
  startRecording: () => void;
  /** 停止记录 */
  stopRecording: () => void;
  /** 导出已记录的原始数据 */
  exportData: () => ECGData[];
  /** 是否正在记录 */
  isRecording: boolean;
}

// ─── 心率检测算法 ─────────────────────────────────────────────

/**
 * 从环形缓冲区中提取Lead II数据并使用Pan-Tompkins算法检测心率
 *
 * 从环形缓冲区提取最近HR_WINDOW_SECONDS秒的数据，
 * 委托给Pan-Tompkins算法进行QRS检测和心率计算。
 *
 * @param buffer Lead II的环形缓冲区
 * @param sampleRate 采样率 (Hz)
 * @returns 心率 (BPM) 或 null（数据不足时）
 */
function detectHeartRateFromBuffer(
  buffer: RingBuffer<number>,
  sampleRate: number,
): number | null {
  const windowSize = Math.min(buffer.length, sampleRate * HR_WINDOW_SECONDS);

  // 至少需要1秒数据才能检测
  if (windowSize < sampleRate) return null;

  // 提取窗口数据
  const startIdx = buffer.length - windowSize;
  const data: number[] = [];
  for (let i = startIdx; i < buffer.length; i++) {
    const val = buffer.get(i);
    if (val !== undefined) data.push(val);
  }

  if (data.length < sampleRate) return null;

  // 使用Pan-Tompkins算法检测心率
  return detectHeartRate(data, sampleRate);
}

// ─── Hook ────────────────────────────────────────────────────

/**
 * ECG数据管理Hook
 *
 * 管理12导联环形缓冲区，提供数据读写、心率计算、录制控制等功能。
 * 使用useRef存储缓冲区避免渲染时的不必要重绘。
 *
 * @param bufferCapacity 缓冲区容量（默认2500，即10秒@250Hz，满时自动丢弃旧数据）
 * @param sampleRate 采样率（默认250Hz）
 */
export function useECGData(
  bufferCapacity: number = DEFAULT_BUFFER_CAPACITY,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): UseECGDataReturn {
  // ── Refs（可变数据，不触发重渲染）──

  /** 12导联独立环形缓冲区 */
  const buffersRef = useRef<Record<ECGLead, RingBuffer<number>> | null>(null);

  /** 原始ECGData缓冲区（用于导出） */
  const rawDataRef = useRef<RingBuffer<ECGData> | null>(null);

  /** 上次心率计算时间戳，用于节流 */
  const lastHRComputeRef = useRef(0);

  /** 累计帧数（ref，不触发渲染） */
  const frameCountRef = useRef(0);

  /** 当前心率（ref，不触发渲染） */
  const heartRateRef = useRef<number | null>(null);

  /** 数据版本号：每次 addData 递增，供消费方检测变更 */
  const dataVersionRef = useRef(0);

  // ── 延迟初始化 ──
  if (!buffersRef.current) {
    const buffers = {} as Record<ECGLead, RingBuffer<number>>;
    for (const lead of ECG_LEADS) {
      buffers[lead] = new RingBuffer<number>(bufferCapacity);
    }
    buffersRef.current = buffers;
    rawDataRef.current = new RingBuffer<ECGData>(bufferCapacity);
  }

  // ── State（仅 UI 控制用）──
  const [isRecording, setIsRecording] = useState(false);

  // ── 回调函数 ──

  /**
   * 添加数据帧 — 纯 ref 操作，零 React 状态更新
   * 消费方通过 getDataVersion() 检测变更后自行拉取数据
   */
  const addData = useCallback(
    (data: ECGData[]) => {
      if (!buffersRef.current || !rawDataRef.current) return;

      for (const frame of data) {
        for (const lead of ECG_LEADS) {
          buffersRef.current[lead].push(frame.leads[lead]);
        }
        rawDataRef.current.push(frame);
      }

      frameCountRef.current += data.length;
      dataVersionRef.current++;

      // 节流：每500ms最多计算一次心率
      const now = Date.now();
      if (now - lastHRComputeRef.current > 500) {
        lastHRComputeRef.current = now;
        const newHR = detectHeartRateFromBuffer(
          buffersRef.current[ECGLead.II],
          sampleRate,
        );
        if (newHR !== null) {
          heartRateRef.current = newHR;
        }
      }
    },
    [sampleRate],
  );

  const getLeadData = useCallback(
    (lead: ECGLead, count?: number): number[] => {
      if (!buffersRef.current) return [];

      const buffer = buffersRef.current[lead];
      const n =
        count !== undefined ? Math.min(count, buffer.length) : buffer.length;

      // 预分配数组，避免 push 扩容
      const result = new Array<number>(n);
      const startIdx = buffer.length - n;
      for (let i = 0; i < n; i++) {
        result[i] = buffer.get(startIdx + i) ?? 0;
      }
      return result;
    },
    [],
  );

  const getHeartRate = useCallback((): number | null => {
    return heartRateRef.current;
  }, []);

  const getFrameCount = useCallback((): number => {
    return frameCountRef.current;
  }, []);

  const getDataVersion = useCallback((): number => {
    return dataVersionRef.current;
  }, []);

  const clearData = useCallback(() => {
    if (!buffersRef.current || !rawDataRef.current) return;

    for (const lead of ECG_LEADS) {
      buffersRef.current[lead].clear();
    }
    rawDataRef.current.clear();

    heartRateRef.current = null;
    frameCountRef.current = 0;
    dataVersionRef.current = 0;
    lastHRComputeRef.current = 0;
  }, []);

  const startRecording = useCallback(() => {
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  const exportData = useCallback((): ECGData[] => {
    if (!rawDataRef.current) return [];
    return rawDataRef.current.toArray();
  }, []);

  // ── 返回值 ──
  return {
    addData,
    getLeadData,
    getHeartRate,
    getFrameCount,
    getDataVersion,
    clearData,
    startRecording,
    stopRecording,
    exportData,
    isRecording,
  };
}
