import { useRef, useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { PhysioParameter } from '../types/physio';
import { usePhysioBuffer } from '../hooks/usePhysioBuffer';

const RENDER_INTERVAL_MS = 100;
const MAX_POINTS = 500;

export interface EMGViewProps {
  physioData: ReturnType<typeof usePhysioBuffer>;
  isConnected: boolean;
  className?: string;
}

export default function EMGView({ physioData, isConnected, className }: EMGViewProps) {
  const chartRef = useRef<ReactECharts | null>(null);
  const [ch1Data, setCh1Data] = useState<number[]>([]);
  const [ch2Data, setCh2Data] = useState<number[]>([]);
  const [activity, setActivity] = useState(0);

  useEffect(() => {
    if (!isConnected) {
      setCh1Data([]);
      setCh2Data([]);
      setActivity(0);
      return;
    }

    let lastVersion = -1;

    const tick = () => {
      const version = physioData.getDataVersion(PhysioParameter.EMG);
      if (version !== lastVersion) {
        lastVersion = version;

        const ch1 = physioData.getData(PhysioParameter.EMG, 'CH1', MAX_POINTS);
        const ch2 = physioData.getData(PhysioParameter.EMG, 'CH2', MAX_POINTS);
        setCh1Data(ch1);
        setCh2Data(ch2);

        if (ch1.length > 0) {
          const absSum = ch1.reduce((a, b) => a + Math.abs(b), 0) / ch1.length;
          setActivity(Math.min(100, absSum * 2));
        }
      }
    };

    const id = setInterval(tick, RENDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isConnected, physioData]);

  const option = useMemo<EChartsOption>(() => ({
    animation: false,
    backgroundColor: '#0a0b1a',
    grid: [{ left: 40, right: 20, top: 10, bottom: '55%' }, { left: 40, right: 20, top: '55%', bottom: 30 }],
    xAxis: [
      { type: 'value', show: true, axisLine: { lineStyle: { color: '#334' } }, axisLabel: { color: '#6B7280', fontSize: 10 }, splitLine: { show: false }, gridIndex: 0 },
      { type: 'value', show: true, axisLine: { lineStyle: { color: '#334' } }, axisLabel: { color: '#6B7280', fontSize: 10 }, splitLine: { show: false }, gridIndex: 1 },
    ],
    yAxis: [
      { type: 'value', splitLine: { lineStyle: { color: '#1a1a2e' } }, axisLabel: { color: '#6B7280', fontSize: 10 }, gridIndex: 0 },
      { type: 'value', splitLine: { lineStyle: { color: '#1a1a2e' } }, axisLabel: { color: '#6B7280', fontSize: 10 }, gridIndex: 1 },
    ],
    series: [
      {
        type: 'line', xAxisIndex: 0, yAxisIndex: 0,
        data: ch1Data.map((y, i) => [i, y]),
        symbol: 'none',
        lineStyle: { color: '#FFD700', width: 1.5 },
      },
      {
        type: 'line', xAxisIndex: 1, yAxisIndex: 1,
        data: ch2Data.map((y, i) => [i, y]),
        symbol: 'none',
        lineStyle: { color: '#FF8C00', width: 1.5 },
      },
    ],
  }), [ch1Data, ch2Data]);

  const activityColor = activity < 30 ? '#22C55E' : activity < 70 ? '#FFD700' : '#FF4444';

  return (
    <div className={`flex flex-col h-full bg-[#0a0b1a] ${className}`}>
      <div className="flex items-center justify-center gap-8 py-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFD700' }} />
          <span className="text-sm text-slate-400">CH1</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF8C00' }} />
          <span className="text-sm text-slate-400">CH2</span>
        </div>
      </div>

      <div className="flex justify-center mb-4">
        <div className="w-48">
          <div className="text-xs text-slate-500 mb-1 text-center">肌电活动强度</div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${activity}%`, backgroundColor: activityColor }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-4 pb-4">
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
          autoResize
          lazyUpdate
        />
      </div>
    </div>
  );
}

EMGView.displayName = 'EMGView';
