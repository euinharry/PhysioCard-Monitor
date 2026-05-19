import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import {
  ECGLead,
  ECG_LEADS,
  DEFAULT_WAVEFORM_CONFIG,
} from '../types/ecg';
import { PhysioParameter } from '../types/physio';
import { LEAD_COLORS } from './WaveformDisplay';
import { usePhysioBuffer } from '../hooks/usePhysioBuffer';
const MAX_DISPLAY_POINTS = 5000;

function getGridPosition(index: number) {
  const row = Math.floor(index / 3);
  const col = index % 3;
  return {
    top: `${4 + row * 23.5}%`,
    left: `${10 + col * 29}%`,
    width: '28%',
    height: '21.5%',
  };
}

export interface ECGViewProps {
  physioData: ReturnType<typeof usePhysioBuffer>;
  isConnected: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function ECGView({ physioData, isConnected, className, style }: ECGViewProps) {
  const chartRef = useRef<ReactECharts | null>(null);
  const followModeRef = useRef(true);
  const isProgrammaticZoomRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const [displayData, setDisplayData] = useState<Record<ECGLead, number[]> | null>(null);

  const config = DEFAULT_WAVEFORM_CONFIG;

  useEffect(() => {
    if (!isConnected) {
      setDisplayData(null);
      return;
    }

    let lastVersion = -1;

    const render = () => {
      rafIdRef.current = requestAnimationFrame(render);

      const currentVersion = physioData.getDataVersion(PhysioParameter.ECG);
      if (currentVersion !== lastVersion) {
        lastVersion = currentVersion;
        const data: Record<ECGLead, number[]> = {} as Record<ECGLead, number[]>;
        for (const lead of ECG_LEADS) {
          data[lead] = physioData.getData(PhysioParameter.ECG, lead, MAX_DISPLAY_POINTS);
        }
        setDisplayData(data);
      }
    };

    rafIdRef.current = requestAnimationFrame(render);
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isConnected, physioData]);

  const rawData = displayData ?? ({} as Record<ECGLead, number[]>);

  const normalizedData = useMemo(() => {
    const result = {} as Record<ECGLead, number[]>;
    const allValues: number[] = [];

    for (const lead of ECG_LEADS) {
      const arr = rawData[lead];
      if (arr && arr.length > 0) {
        for (const v of arr) {
          if (Number.isFinite(v)) allValues.push(v);
        }
      }
    }

    if (allValues.length === 0) {
      for (const lead of ECG_LEADS) result[lead] = [];
      return result;
    }

    const sorted = [...allValues].sort((a, b) => a - b);
    const p5 = sorted[Math.floor(sorted.length * 0.05)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const range = p95 - p5 || 1;

    for (const lead of ECG_LEADS) {
      const arr = rawData[lead];
      if (!arr || arr.length === 0) {
        result[lead] = [];
        continue;
      }
      const out = new Array<number>(arr.length);
      for (let i = 0; i < arr.length; i++) {
        out[i] = ((arr[i] - p5) / range) * 2 - 1;
      }
      result[lead] = out;
    }

    return result;
  }, [rawData]);

  const baseOption = useMemo<EChartsOption>(() => {
    const grids = ECG_LEADS.map((_, i) => ({
      ...getGridPosition(i),
      containLabel: false,
    }));

    const xAxes = ECG_LEADS.map((_, i) => ({
      type: 'value' as const,
      gridIndex: i,
      min: 0,
      max: config.timeWindow,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        show: i >= 9,
        color: '#6B7280',
        fontSize: 10,
        formatter: (value: number) => `${value.toFixed(1)}s`,
      },
      splitLine: {
        show: config.showGrid,
        lineStyle: { color: config.gridColor, width: 0.5 },
      },
      minorSplitLine: {
        show: config.showGrid,
        lineStyle: { color: config.gridColor, width: 0.2, opacity: 0.3 },
      },
      splitNumber: 5,
      minorTick: { show: true, splitNumber: 4 },
      axisPointer: { show: false },
    }));

    const yAxes = ECG_LEADS.map((_, i) => ({
      type: 'value' as const,
      gridIndex: i,
      min: -2,
      max: 2,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: {
        show: config.showGrid,
        lineStyle: { color: config.gridColor, width: 0.5 },
      },
      minorSplitLine: {
        show: config.showGrid,
        lineStyle: { color: config.gridColor, width: 0.2, opacity: 0.3 },
      },
      splitNumber: 4,
      minorTick: { show: true, splitNumber: 4 },
      axisPointer: { show: false },
    }));

    const series = ECG_LEADS.map((lead, i) => ({
      type: 'line' as const,
      xAxisIndex: i,
      yAxisIndex: i,
      data: [] as [number, number][],
      symbol: 'none',
      lineStyle: {
        color: LEAD_COLORS[lead],
        width: config.lineWidth,
        join: 'round' as const,
        cap: 'round' as const,
      },
      areaStyle: { color: 'transparent' },
      large: true,
      largeThreshold: 50000,
      sampling: 'none' as const,
      silent: true,
    }));

    return {
      animation: false,
      backgroundColor: config.backgroundColor,
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series,
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: ECG_LEADS.map((_, i) => i),
          zoomOnMouseWheel: true,
          moveOnMouseMove: false,
          moveOnMouseWheel: false,
          preventDefaultMouseMove: false,
        },
      ],
    };
  }, [config]);

  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const chart = chartRef.current?.getEchartsInstance();
      if (!chart) return;

      const maxVisiblePoints = Math.floor(config.timeWindow * config.sampleRate);

      const seriesData = ECG_LEADS.map((lead) => {
        const leadData = normalizedData[lead] || [];
        const n = leadData.length;
        const trimmed = n > MAX_DISPLAY_POINTS ? leadData.slice(n - MAX_DISPLAY_POINTS) : leadData;
        const len = trimmed.length;
        const visibleData = len > maxVisiblePoints ? trimmed.slice(len - maxVisiblePoints) : trimmed;
        return {
          data: visibleData.map((y, i) => [i / config.sampleRate, y]),
        };
      });

      const allValues: number[] = [];
      for (const lead of ECG_LEADS) {
        const leadData = normalizedData[lead] || [];
        for (const val of leadData) {
          if (Number.isFinite(val)) allValues.push(val);
        }
      }

      let yMin: number;
      let yMax: number;

      if (allValues.length === 0) {
        yMin = -2;
        yMax = 2;
      } else {
        allValues.sort((a, b) => a - b);
        const p5 = allValues[Math.floor(allValues.length * 0.05)];
        const p95 = allValues[Math.floor(allValues.length * 0.95)];
        const range = p95 - p5 || 1;
        const margin = range * 0.05;
        yMin = p5 - margin;
        yMax = p95 + margin;
      }

      const optionUpdate: Record<string, unknown> = {
        series: seriesData,
        yAxis: ECG_LEADS.map(() => ({ min: yMin, max: yMax })),
      };

      if (followModeRef.current) {
        isProgrammaticZoomRef.current = true;
        optionUpdate.dataZoom = [{ startValue: 0, endValue: config.timeWindow }];
      }

      chart.setOption(optionUpdate, { lazyUpdate: true });
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [normalizedData, config]);

  const handleDataZoom = useCallback(() => {
    if (!isProgrammaticZoomRef.current) {
      followModeRef.current = false;
    }
    isProgrammaticZoomRef.current = false;
  }, []);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        height: '100%',
        width: '100%',
        backgroundColor: config.backgroundColor,
        overflow: 'hidden',
        ...style,
      }}
    >
      {ECG_LEADS.map((lead, i) => {
        const pos = getGridPosition(i);
        const color = LEAD_COLORS[lead];
        return (
          <div
            key={lead}
            style={{
              position: 'absolute',
              top: `calc(${pos.top} + 6px)`,
              left: `calc(${pos.left} + 6px)`,
              color,
              fontSize: '12px',
              fontWeight: 700,
              fontFamily: 'JetBrains Mono, SF Mono, Consolas, monospace',
              backgroundColor: `${config.backgroundColor}DD`,
              padding: '2px 8px',
              borderRadius: '4px',
              zIndex: 10,
              pointerEvents: 'none',
              letterSpacing: '1px',
              textShadow: `0 0 8px ${color}40`,
            }}
          >
            {lead}
          </div>
        );
      })}

      <ReactECharts
        ref={chartRef}
        option={baseOption}
        style={{ height: '100%', width: '100%' }}
        onEvents={{ datazoom: handleDataZoom }}
        opts={{ renderer: 'canvas' }}
        autoResize
        notMerge={false}
        lazyUpdate
      />
    </div>
  );
}

ECGView.displayName = 'ECGView';
