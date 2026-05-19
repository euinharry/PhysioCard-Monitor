import { useRef, useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { PhysioParameter } from '../types/physio';
import { usePhysioBuffer } from '../hooks/usePhysioBuffer';

const RENDER_INTERVAL_MS = 100;
const MAX_POINTS = 500;

export interface SpO2ViewProps {
  physioData: ReturnType<typeof usePhysioBuffer>;
  isConnected: boolean;
  className?: string;
}

export default function SpO2View({ physioData, isConnected, className }: SpO2ViewProps) {
  const chartRef = useRef<ReactECharts | null>(null);
  const [spo2, setSpO2] = useState<number | null>(null);
  const [pr, setPR] = useState<number | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);

  useEffect(() => {
    if (!isConnected) {
      setSpO2(null);
      setPR(null);
      setWaveform([]);
      return;
    }

    let lastVersion = -1;

    const tick = () => {
      const version = physioData.getDataVersion(PhysioParameter.SpO2);
      if (version !== lastVersion) {
        lastVersion = version;

        const spo2Vals = physioData.getData(PhysioParameter.SpO2, 'SpO2', 1);
        const prVals = physioData.getData(PhysioParameter.SpO2, 'PR', 1);
        if (spo2Vals.length > 0) setSpO2(spo2Vals[spo2Vals.length - 1]);
        if (prVals.length > 0) setPR(prVals[prVals.length - 1]);

        const wave = physioData.getData(PhysioParameter.SpO2, 'SpO2', MAX_POINTS);
        setWaveform(wave);
      }
    };

    const id = setInterval(tick, RENDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isConnected, physioData]);

  const isLow = spo2 !== null && spo2 < 90;

  const option = useMemo<EChartsOption>(() => ({
    animation: false,
    backgroundColor: '#0a0b1a',
    grid: { left: 40, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'value',
      show: true,
      axisLine: { lineStyle: { color: '#334' } },
      axisLabel: { color: '#6B7280', fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      splitLine: { lineStyle: { color: '#1a1a2e' } },
      axisLabel: { color: '#6B7280', fontSize: 10 },
    },
    series: [{
      type: 'line',
      data: waveform.map((y, i) => [i, y]),
      symbol: 'none',
      lineStyle: { color: isLow ? '#FF4444' : '#00BFFF', width: 2 },
      areaStyle: {
        color: isLow
          ? { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255,68,68,0.3)' }, { offset: 1, color: 'rgba(255,68,68,0.02)' }] }
          : { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,191,255,0.3)' }, { offset: 1, color: 'rgba(0,191,255,0.02)' }] },
      },
      smooth: true,
    }],
  }), [waveform, isLow]);

  return (
    <div className={`flex flex-col h-full bg-[#0a0b1a] ${className}`}>
      <div className="flex items-center justify-center gap-12 py-8">
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-1 tracking-wider">SpO₂</div>
          <div
            className="text-6xl font-bold tabular-nums"
            style={{ color: isLow ? '#FF4444' : '#00BFFF' }}
          >
            {spo2 !== null ? Math.round(spo2) : '--'}
          </div>
          <div
            className="text-sm mt-1"
            style={{ color: isLow ? '#FF4444' : '#00BFFF80' }}
          >
            %
          </div>
          {isLow && (
            <div className="mt-2 text-xs font-semibold text-red-400 animate-pulse">
              低血氧预警
            </div>
          )}
        </div>

        <div className="text-center">
          <div className="text-xs text-slate-500 mb-1 tracking-wider">脉率</div>
          <div className="text-4xl font-bold tabular-nums text-slate-200">
            {pr !== null ? Math.round(pr) : '--'}
          </div>
          <div className="text-sm text-slate-500 mt-1">BPM</div>
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

SpO2View.displayName = 'SpO2View';
