import { useRef, useEffect, useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { PhysioParameter } from '../types/physio';
import { usePhysioBuffer } from '../hooks/usePhysioBuffer';

const RENDER_INTERVAL_MS = 200;
const MAX_POINTS = 200;

export interface TemperatureViewProps {
  physioData: ReturnType<typeof usePhysioBuffer>;
  isConnected: boolean;
  className?: string;
}

function tempColor(temp: number): string {
  if (temp > 39) return '#FF4444';
  if (temp > 37.5) return '#FF8C00';
  return '#22C55E';
}

function tempLabel(temp: number): string {
  if (temp > 39) return '高热';
  if (temp > 37.5) return '发热';
  return '正常';
}

export default function TemperatureView({ physioData, isConnected, className }: TemperatureViewProps) {
  const chartRef = useRef<ReactECharts | null>(null);
  const [temp, setTemp] = useState<number | null>(null);
  const [trend, setTrend] = useState<number[]>([]);

  useEffect(() => {
    if (!isConnected) {
      setTemp(null);
      setTrend([]);
      return;
    }

    let lastVersion = -1;

    const tick = () => {
      const version = physioData.getDataVersion(PhysioParameter.Temperature);
      if (version !== lastVersion) {
        lastVersion = version;

        const vals = physioData.getData(PhysioParameter.Temperature, 'TEMP', 1);
        if (vals.length > 0) setTemp(vals[vals.length - 1]);

        const trendData = physioData.getData(PhysioParameter.Temperature, 'TEMP', MAX_POINTS);
        setTrend(trendData);
      }
    };

    const id = setInterval(tick, RENDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isConnected, physioData]);

  const color = temp !== null ? tempColor(temp) : '#64748b';
  const label = temp !== null ? tempLabel(temp) : '';

  const option = useMemo<EChartsOption>(() => {
    const trendColor = temp !== null ? tempColor(temp) : '#FF6347';
    return {
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
        min: 35,
        max: 42,
        splitLine: { lineStyle: { color: '#1a1a2e' } },
        axisLabel: { color: '#6B7280', fontSize: 10 },
      },
      series: [{
        type: 'line',
        data: trend.map((y, i) => [i, y]),
        symbol: 'none',
        lineStyle: { color: trendColor, width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${trendColor}40` },
              { offset: 1, color: `${trendColor}05` },
            ],
          },
        },
        smooth: true,
        markLine: {
          silent: true,
          data: [
            { yAxis: 37.5, label: { formatter: '37.5℃', color: '#FF8C00', fontSize: 10 }, lineStyle: { color: '#FF8C0040', type: 'dashed' } },
            { yAxis: 39, label: { formatter: '39℃', color: '#FF4444', fontSize: 10 }, lineStyle: { color: '#FF444440', type: 'dashed' } },
          ],
        },
      }],
    };
  }, [trend, temp]);

  return (
    <div className={`flex flex-col h-full bg-[#0a0b1a] ${className}`}>
      <div className="flex items-center justify-center gap-12 py-8">
        <div className="text-center">
          <div className="text-xs text-slate-500 mb-1 tracking-wider">体温</div>
          <div
            className="text-6xl font-bold tabular-nums"
            style={{ color }}
          >
            {temp !== null ? temp.toFixed(1) : '--'}
          </div>
          <div className="text-sm mt-1" style={{ color: `${color}80` }}>℃</div>
          {label && (
            <div
              className="mt-2 text-xs font-semibold"
              style={{ color }}
            >
              {label}
            </div>
          )}
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

TemperatureView.displayName = 'TemperatureView';
