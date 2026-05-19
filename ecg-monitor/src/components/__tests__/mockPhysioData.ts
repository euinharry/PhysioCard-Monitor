import { type Mock, vi } from 'vitest';
import { PhysioParameter } from '../../types/physio';

type ChannelData = Record<string, number[]>;

interface MockPhysioDataOptions {
  [PhysioParameter.ECG]?: { channels: ChannelData; frameCount?: number; dataVersion?: number };
  [PhysioParameter.SpO2]?: { channels: ChannelData; frameCount?: number; dataVersion?: number };
  [PhysioParameter.Respiration]?: { channels: ChannelData; frameCount?: number; dataVersion?: number };
  [PhysioParameter.EMG]?: { channels: ChannelData; frameCount?: number; dataVersion?: number };
  [PhysioParameter.Temperature]?: { channels: ChannelData; frameCount?: number; dataVersion?: number };
}

function makeParamCounters() {
  return Object.fromEntries(
    Object.values(PhysioParameter).map(p => [p, 0]),
  ) as Record<PhysioParameter, number>;
}

export function createMockPhysioData(data?: MockPhysioDataOptions) {
  const buffers = data ?? {};
  const versions = makeParamCounters();
  const counts = makeParamCounters();

  for (const [param, cfg] of Object.entries(buffers) as [PhysioParameter, { channels: ChannelData; frameCount?: number; dataVersion?: number }][]) {
    if (cfg.dataVersion !== undefined) versions[param] = cfg.dataVersion;
    else if (Object.values(cfg.channels).some(c => c.length > 0)) versions[param] = 1;
    if (cfg.frameCount !== undefined) counts[param] = cfg.frameCount;
  }

  return {
    addData: vi.fn() as Mock,
    getData: vi.fn((param: PhysioParameter, channel?: string, count?: number): number[] => {
      const cfg = buffers[param];
      if (!cfg || !cfg.channels) return [];
      if (channel && cfg.channels[channel]) {
        const arr = cfg.channels[channel];
        if (count !== undefined) return arr.slice(-count);
        return arr;
      }
      const allChs = Object.values(cfg.channels);
      if (allChs.length === 0) return [];
      const maxLen = Math.max(...allChs.map(c => c.length));
      const result: number[] = [];
      for (let i = 0; i < maxLen; i++) {
        let sum = 0;
        let n = 0;
        for (const ch of allChs) {
          if (i < ch.length) { sum += ch[i]; n++; }
        }
        result.push(n > 0 ? sum / n : 0);
      }
      if (count !== undefined) return result.slice(-count);
      return result;
    }) as Mock,
    getFrameCount: vi.fn((param?: PhysioParameter): number => {
      if (param) return counts[param] ?? 0;
      return Object.values(counts).reduce((a, b) => a + b, 0);
    }) as Mock,
    getDataVersion: vi.fn((param: PhysioParameter): number => versions[param] ?? 0) as Mock,
    getHeartRate: vi.fn((): number | null => null) as Mock,
    clearData: vi.fn() as Mock,
    isRecording: false,
    startRecording: vi.fn() as Mock,
    stopRecording: vi.fn() as Mock,
    exportData: vi.fn((): [] => []) as Mock,
  };
}
