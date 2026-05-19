import { useRef, useState, useCallback, useEffect } from 'react';
import { PhysioParameter, type PhysioFrame, CHANNEL_CONFIGS } from '../types/physio';
import { RingBuffer } from '../utils/ringBuffer';
import { getDataRouter } from '../utils/dataRouter';
import { detectHeartRate } from '../utils/heartRateDetector';

const DEFAULT_SAMPLE_RATE = 250;
const BUFFER_DURATION_SECONDS = 10;
const DEFAULT_BUFFER_CAPACITY = BUFFER_DURATION_SECONDS * DEFAULT_SAMPLE_RATE;
const HR_WINDOW_SECONDS = 5;

export interface UsePhysioBufferReturn {
  addData: (frames: PhysioFrame[]) => void;
  getData: (parameter: PhysioParameter, channel?: string, count?: number) => number[];
  getFrameCount: (parameter?: PhysioParameter) => number;
  getDataVersion: (parameter: PhysioParameter) => number;
  getHeartRate: () => number | null;
  clearData: () => void;
  isRecording: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  exportData: () => PhysioFrame[];
}

function detectHeartRateFromBuffer(buffer: RingBuffer<number>, sampleRate: number): number | null {
  const windowSize = Math.min(buffer.length, sampleRate * HR_WINDOW_SECONDS);
  if (windowSize < sampleRate) return null;

  const startIdx = buffer.length - windowSize;
  const data: number[] = [];
  for (let i = startIdx; i < buffer.length; i++) {
    const val = buffer.get(i);
    if (val !== undefined) data.push(val);
  }

  if (data.length < sampleRate) return null;
  return detectHeartRate(data, sampleRate);
}

export function usePhysioBuffer(
  bufferCapacity: number = DEFAULT_BUFFER_CAPACITY,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): UsePhysioBufferReturn {
  const buffersRef = useRef<Record<PhysioParameter, RingBuffer<number>> | null>(null);
  const channelMapRef = useRef<Record<PhysioParameter, Record<string, RingBuffer<number>>> | null>(null);
  const rawDataRef = useRef<RingBuffer<PhysioFrame> | null>(null);
  const lastHRComputeRef = useRef(0);
  const frameCountRef = useRef<Record<PhysioParameter, number>>(
    Object.fromEntries(Object.values(PhysioParameter).map(p => [p, 0])) as Record<PhysioParameter, number>,
  );
  const heartRateRef = useRef<number | null>(null);
  const dataVersionRef = useRef<Record<PhysioParameter, number>>(
    Object.fromEntries(Object.values(PhysioParameter).map(p => [p, 0])) as Record<PhysioParameter, number>,
  );

  if (!buffersRef.current) {
    const buffers = {} as Record<PhysioParameter, RingBuffer<number>>;
    const channelMap = {} as Record<PhysioParameter, Record<string, RingBuffer<number>>>;
    for (const param of Object.values(PhysioParameter)) {
      buffers[param] = new RingBuffer<number>(bufferCapacity);
      channelMap[param] = {};
      const config = CHANNEL_CONFIGS[param];
      if (config) {
        for (const ch of config.channels) {
          channelMap[param][ch] = new RingBuffer<number>(bufferCapacity);
        }
      }
    }
    buffersRef.current = buffers;
    channelMapRef.current = channelMap;
    rawDataRef.current = new RingBuffer<PhysioFrame>(bufferCapacity);
  }

  const [isRecording, setIsRecording] = useState(false);

  const addData = useCallback(
    (frames: PhysioFrame[]) => {
      if (!buffersRef.current || !channelMapRef.current || !rawDataRef.current) return;

      for (const frame of frames) {
        const param = frame.parameter;
        const mainBuf = buffersRef.current[param];
        if (mainBuf) {
          const values = Object.values(frame.channels);
          const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          mainBuf.push(avg);
        }

        const channelBufs = channelMapRef.current[param];
        if (channelBufs) {
          for (const [ch, value] of Object.entries(frame.channels)) {
            const buf = channelBufs[ch];
            if (buf) buf.push(value);
          }
        }

        rawDataRef.current.push(frame);
        frameCountRef.current[param] = (frameCountRef.current[param] || 0) + 1;
        dataVersionRef.current[param]++;
      }

      const now = Date.now();
      if (now - lastHRComputeRef.current > 500) {
        lastHRComputeRef.current = now;
        const leadII = channelMapRef.current[PhysioParameter.ECG]?.['II'];
        if (leadII) {
          const newHR = detectHeartRateFromBuffer(leadII, sampleRate);
          if (newHR !== null) {
            heartRateRef.current = newHR;
          }
        }
      }
    },
    [sampleRate],
  );

  const getData = useCallback(
    (parameter: PhysioParameter, channel?: string, count?: number): number[] => {
      if (channel && channelMapRef.current?.[parameter]?.[channel]) {
        const buffer = channelMapRef.current[parameter][channel];
        const n = count !== undefined ? Math.min(count, buffer.length) : buffer.length;
        const result = new Array<number>(n);
        const startIdx = buffer.length - n;
        for (let i = 0; i < n; i++) {
          result[i] = buffer.get(startIdx + i) ?? 0;
        }
        return result;
      }

      if (!buffersRef.current) return [];
      const buffer = buffersRef.current[parameter];
      if (!buffer) return [];
      const n = count !== undefined ? Math.min(count, buffer.length) : buffer.length;
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

  const getFrameCount = useCallback(
    (parameter?: PhysioParameter): number => {
      if (parameter) return frameCountRef.current[parameter] ?? 0;
      return Object.values(frameCountRef.current).reduce((a, b) => a + b, 0);
    },
    [],
  );

  const getDataVersion = useCallback(
    (parameter: PhysioParameter): number => {
      return dataVersionRef.current[parameter] ?? 0;
    },
    [],
  );

  const clearData = useCallback(() => {
    if (!buffersRef.current || !channelMapRef.current || !rawDataRef.current) return;

    for (const param of Object.values(PhysioParameter)) {
      buffersRef.current[param].clear();
      const channelBufs = channelMapRef.current[param];
      for (const ch of Object.keys(channelBufs)) {
        channelBufs[ch].clear();
      }
    }
    rawDataRef.current.clear();
    heartRateRef.current = null;
    for (const param of Object.values(PhysioParameter)) {
      frameCountRef.current[param] = 0;
      dataVersionRef.current[param] = 0;
    }
    lastHRComputeRef.current = 0;
  }, []);

  const startRecording = useCallback(() => {
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
  }, []);

  const exportData = useCallback((): PhysioFrame[] => {
    if (!rawDataRef.current) return [];
    return rawDataRef.current.toArray();
  }, []);

  useEffect(() => {
    const router = getDataRouter();
    const unsubscribers: (() => void)[] = [];

    for (const param of Object.values(PhysioParameter)) {
      const unsub = router.subscribe(param, (frame: PhysioFrame) => {
        addData([frame]);
      });
      unsubscribers.push(unsub);
    }

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }, [addData]);

  return {
    addData,
    getData,
    getFrameCount,
    getDataVersion,
    getHeartRate,
    clearData,
    isRecording,
    startRecording,
    stopRecording,
    exportData,
  };
}
