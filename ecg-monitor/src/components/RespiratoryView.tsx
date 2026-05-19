import { useRef, useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { PhysioParameter } from '../types/physio';
import { usePhysioBuffer } from '../hooks/usePhysioBuffer';

const RENDER_INTERVAL_MS = 100;
const MAX_POINTS = 500;

export interface RespiratoryViewProps {
  physioData: ReturnType<typeof usePhysioBuffer>;
  isConnected: boolean;
  className?: string;
}

export default function RespiratoryView({ physioData, isConnected, className }: RespiratoryViewProps) {
  const chartRef = useRef<ReactECharts | null>(null);
  const [rr, setRR] = useState<number | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);

  useEffect(() => {
    if (!isConnected) {
      setRR(null);
      setWaveform([]);
      return;
    }

    let lastVersion = -1;

    const tick = () => {
      const version = physioData.getDataVersion(PhysioParameter.Respiration);
      if (version !== lastVersion) {
        lastVersion = version;

        const vals = physioData.getData(PhysioParameter.Respiration, 'RESP', 1);
        if (vals.length > 0) setRR(vals[vals.length - 1]);

        const wave = physioData.getData(PhysioParameter.Respiration, 'RESP', MAX_POINTS);
        setWaveform(wave);
      }
    };

    const id = setInterval(tick, RENDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isConnected, physioData]);

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
      splitLine: { lineStyle: { color: '#1a1a2e' } },
      axisLabel: { color: '#6B7280', fontSize: 10 },
    },
    series: [{
      type: 'line',
      data: waveform.map((y, i) => [i, y]),
      symbol: 'none',
      lineStyle: { color: '#00CED1', width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(0,206,209,0.25)' },
            { offset: 1, color: 'rgba(0,206,209,0.02)' },
          ],
        },
      },
      smooth: true,
    }],
  }), [waveform]);

  return (
    <div className={`flex flex-col h-full bg-[#0a0b1a] ${className}`}>
      <div className="flex items-center justify-center gap-12 py-8">
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-1 tracking-wider">呼吸频率</div>
          <div className="text-6xl font-bold tabular-nums text-[#00CED1]">
            {rr !== null ? Math.round(rr) : '--'}
          </div>
          <div className="text-sm text-[#00CED180] mt-1">次/分</div>
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

RespiratoryView.displayName = 'RespiratoryView';
