import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhysioBuffer } from '../usePhysioBuffer';
import { PhysioParameter, type PhysioFrame } from '../../types/physio';

function makeFrame(
  parameter: PhysioParameter,
  channels: Record<string, number>,
  timestamp?: number,
): PhysioFrame {
  return {
    parameter,
    timestamp: timestamp ?? Date.now(),
    channels,
  };
}

describe('usePhysioBuffer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始状态应包含所有参数且数据为空', () => {
    const { result } = renderHook(() => usePhysioBuffer());

    for (const param of Object.values(PhysioParameter)) {
      expect(result.current.getData(param)).toEqual([]);
      expect(result.current.getDataVersion(param)).toBe(0);
    }
    expect(result.current.getHeartRate()).toBeNull();
    expect(result.current.isRecording).toBe(false);
  });

  it('addData 后应能读取数据', () => {
    const { result } = renderHook(() => usePhysioBuffer());

    act(() => {
      result.current.addData([
        makeFrame(PhysioParameter.ECG, { II: 100, I: 50 }),
      ]);
    });

    const ecgData = result.current.getData(PhysioParameter.ECG);
    expect(ecgData.length).toBe(1);
    expect(result.current.getDataVersion(PhysioParameter.ECG)).toBe(1);
    expect(result.current.getFrameCount(PhysioParameter.ECG)).toBe(1);
  });

  it('不同参数数据应独立存储', () => {
    const { result } = renderHook(() => usePhysioBuffer());

    act(() => {
      result.current.addData([
        makeFrame(PhysioParameter.ECG, { II: 100 }),
        makeFrame(PhysioParameter.SpO2, { SpO2: 98, PR: 72 }),
      ]);
    });

    expect(result.current.getData(PhysioParameter.ECG).length).toBe(1);
    expect(result.current.getDataVersion(PhysioParameter.ECG)).toBe(1);
    expect(result.current.getData(PhysioParameter.SpO2).length).toBe(1);
    expect(result.current.getDataVersion(PhysioParameter.SpO2)).toBe(1);
    expect(result.current.getData(PhysioParameter.EMG).length).toBe(0);
    expect(result.current.getDataVersion(PhysioParameter.EMG)).toBe(0);
  });

  it('getData 应支持按通道读取数据', () => {
    const { result } = renderHook(() => usePhysioBuffer());

    act(() => {
      result.current.addData([
        makeFrame(PhysioParameter.ECG, { II: 100, I: 50 }),
        makeFrame(PhysioParameter.ECG, { II: 120, I: 60 }),
      ]);
    });

    const leadII = result.current.getData(PhysioParameter.ECG, 'II');
    expect(leadII).toEqual([100, 120]);

    const leadI = result.current.getData(PhysioParameter.ECG, 'I');
    expect(leadI).toEqual([50, 60]);
  });

  it('getDataVersion 应在每次 addData 后递增', () => {
    const { result } = renderHook(() => usePhysioBuffer());
    const param = PhysioParameter.Respiration;

    expect(result.current.getDataVersion(param)).toBe(0);

    act(() => {
      result.current.addData([makeFrame(param, { RESP: 15 })]);
    });
    expect(result.current.getDataVersion(param)).toBe(1);

    act(() => {
      result.current.addData([makeFrame(param, { RESP: 18 })]);
    });
    expect(result.current.getDataVersion(param)).toBe(2);
  });

  it('getData 应支持 count 参数限制返回数量', () => {
    const { result } = renderHook(() => usePhysioBuffer(5, 250));

    act(() => {
      result.current.addData([
        makeFrame(PhysioParameter.ECG, { II: 1 }),
        makeFrame(PhysioParameter.ECG, { II: 2 }),
        makeFrame(PhysioParameter.ECG, { II: 3 }),
        makeFrame(PhysioParameter.ECG, { II: 4 }),
        makeFrame(PhysioParameter.ECG, { II: 5 }),
      ]);
    });

    expect(result.current.getData(PhysioParameter.ECG).length).toBe(5);
    expect(result.current.getData(PhysioParameter.ECG, undefined, 3).length).toBe(3);
    expect(result.current.getData(PhysioParameter.ECG, undefined, 10).length).toBe(5);
  });

  it('clearData 应清空所有参数数据', () => {
    const { result } = renderHook(() => usePhysioBuffer());

    act(() => {
      result.current.addData([
        makeFrame(PhysioParameter.ECG, { II: 100 }),
        makeFrame(PhysioParameter.SpO2, { SpO2: 98 }),
      ]);
    });

    expect(result.current.getData(PhysioParameter.ECG).length).toBe(1);
    expect(result.current.getData(PhysioParameter.SpO2).length).toBe(1);

    act(() => {
      result.current.clearData();
    });

    for (const param of Object.values(PhysioParameter)) {
      expect(result.current.getData(param)).toEqual([]);
      expect(result.current.getDataVersion(param)).toBe(0);
    }
  });

  it('getFrameCount 应返回指定参数帧数', () => {
    const { result } = renderHook(() => usePhysioBuffer());

    act(() => {
      result.current.addData([
        makeFrame(PhysioParameter.ECG, { II: 1 }),
        makeFrame(PhysioParameter.ECG, { II: 2 }),
        makeFrame(PhysioParameter.SpO2, { SpO2: 98 }),
      ]);
    });

    expect(result.current.getFrameCount(PhysioParameter.ECG)).toBe(2);
    expect(result.current.getFrameCount(PhysioParameter.SpO2)).toBe(1);
    expect(result.current.getFrameCount(PhysioParameter.Temperature)).toBe(0);
  });

  it('getFrameCount 无参数时应返回总帧数', () => {
    const { result } = renderHook(() => usePhysioBuffer());

    act(() => {
      result.current.addData([
        makeFrame(PhysioParameter.ECG, { II: 1 }),
        makeFrame(PhysioParameter.SpO2, { SpO2: 98 }),
        makeFrame(PhysioParameter.EMG, { CH1: 50 }),
      ]);
    });

    expect(result.current.getFrameCount()).toBe(3);
  });

  it('缓冲区满时应自动覆盖最旧数据', () => {
    const { result } = renderHook(() => usePhysioBuffer(3, 250));

    act(() => {
      result.current.addData([
        makeFrame(PhysioParameter.ECG, { II: 10 }),
        makeFrame(PhysioParameter.ECG, { II: 20 }),
        makeFrame(PhysioParameter.ECG, { II: 30 }),
      ]);
    });

    expect(result.current.getData(PhysioParameter.ECG)).toEqual([10, 20, 30]);

    act(() => {
      result.current.addData([
        makeFrame(PhysioParameter.ECG, { II: 40 }),
      ]);
    });

    expect(result.current.getData(PhysioParameter.ECG)).toEqual([20, 30, 40]);
  });

  it('startRecording/stopRecording 应切换状态', () => {
    const { result } = renderHook(() => usePhysioBuffer());

    expect(result.current.isRecording).toBe(false);

    act(() => {
      result.current.startRecording();
    });
    expect(result.current.isRecording).toBe(true);

    act(() => {
      result.current.stopRecording();
    });
    expect(result.current.isRecording).toBe(false);
  });

  it('exportData 应导出全部原始帧', () => {
    const { result } = renderHook(() => usePhysioBuffer());

    const frames = [
      makeFrame(PhysioParameter.ECG, { II: 100 }),
      makeFrame(PhysioParameter.SpO2, { SpO2: 98 }),
    ];

    act(() => {
      result.current.addData(frames);
    });

    const exported = result.current.exportData();
    expect(exported).toHaveLength(2);
    expect(exported[0].parameter).toBe(PhysioParameter.ECG);
    expect(exported[1].parameter).toBe(PhysioParameter.SpO2);
  });
});
