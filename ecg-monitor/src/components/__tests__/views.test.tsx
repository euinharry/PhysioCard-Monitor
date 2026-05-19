import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { PhysioParameter } from '../../types/physio';
import { createMockPhysioData } from './mockPhysioData';
import SpO2View from '../SpO2View';
import RespiratoryView from '../RespiratoryView';
import EMGView from '../EMGView';
import TemperatureView from '../TemperatureView';

vi.mock('echarts-for-react', () => ({
  default: ({ option }: { option: Record<string, unknown> }) => (
    <div data-testid="mock-echarts" data-option={JSON.stringify(option)} />
  ),
}));

describe('SpO2View', () => {
  it('未连接时应显示默认值', () => {
    const physioData = createMockPhysioData();
    const { container } = render(
      <SpO2View physioData={physioData} isConnected={false} />,
    );
    expect(container.textContent).toContain('SpO₂');
    expect(container.textContent).toContain('%');
    expect(container.textContent).toContain('BPM');
  });

  it('连接后应显示数据', () => {
    const physioData = createMockPhysioData({
      [PhysioParameter.SpO2]: {
        channels: { SpO2: [98, 99, 97], PR: [72, 73, 71] },
      },
    });
    const { container } = render(
      <SpO2View physioData={physioData} isConnected={true} />,
    );
    expect(container.textContent).toContain('SpO₂');
  });
});

describe('RespiratoryView', () => {
  it('未连接时应显示默认值', () => {
    const physioData = createMockPhysioData();
    const { container } = render(
      <RespiratoryView physioData={physioData} isConnected={false} />,
    );
    expect(container.textContent).toContain('呼吸频率');
    expect(container.textContent).toContain('次/分');
  });

  it('连接后应显示呼吸数据', () => {
    const physioData = createMockPhysioData({
      [PhysioParameter.Respiration]: {
        channels: { RESP: [15, 16, 14, 18, 17] },
      },
    });
    const { container } = render(
      <RespiratoryView physioData={physioData} isConnected={true} />,
    );
    expect(container.textContent).toContain('呼吸频率');
  });
});

describe('EMGView', () => {
  it('未连接时应显示默认值', () => {
    const physioData = createMockPhysioData();
    const { container } = render(
      <EMGView physioData={physioData} isConnected={false} />,
    );
    expect(container.textContent).toContain('CH1');
    expect(container.textContent).toContain('CH2');
    expect(container.textContent).toContain('肌电活动强度');
  });

  it('连接后应显示通道标签', () => {
    const physioData = createMockPhysioData({
      [PhysioParameter.EMG]: {
        channels: { CH1: [10, 20, 30], CH2: [5, 15, 25] },
      },
    });
    const { container } = render(
      <EMGView physioData={physioData} isConnected={true} />,
    );
    expect(container.textContent).toContain('CH1');
    expect(container.textContent).toContain('CH2');
  });
});

describe('TemperatureView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('未连接时应显示默认值', () => {
    const physioData = createMockPhysioData();
    const { container } = render(
      <TemperatureView physioData={physioData} isConnected={false} />,
    );
    expect(container.textContent).toContain('体温');
    expect(container.textContent).toContain('℃');
  });

  it('正常温度应显示绿色', () => {
    const physioData = createMockPhysioData({
      [PhysioParameter.Temperature]: {
        channels: { TEMP: [36.5] },
      },
    });
    const { container } = render(
      <TemperatureView physioData={physioData} isConnected={true} />,
    );
    act(() => { vi.advanceTimersByTime(200); });
    expect(container.textContent).toContain('正常');
  });

  it('发热温度应显示橙色', () => {
    const physioData = createMockPhysioData({
      [PhysioParameter.Temperature]: {
        channels: { TEMP: [38.0] },
      },
    });
    const { container } = render(
      <TemperatureView physioData={physioData} isConnected={true} />,
    );
    act(() => { vi.advanceTimersByTime(200); });
    expect(container.textContent).toContain('发热');
  });

  it('高热温度应显示红色', () => {
    const physioData = createMockPhysioData({
      [PhysioParameter.Temperature]: {
        channels: { TEMP: [39.5] },
      },
    });
    const { container } = render(
      <TemperatureView physioData={physioData} isConnected={true} />,
    );
    act(() => { vi.advanceTimersByTime(200); });
    expect(container.textContent).toContain('高热');
  });
});
