import { useRef, useMemo, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import {
  ECGLead,
  ECG_LEADS,
  DEFAULT_WAVEFORM_CONFIG,
  type WaveformDisplayConfig,
} from '../types/ecg';

// ─── Types ──────────────────────────────────────────────────────

export interface WaveformDisplayProps {
  /** 12导联数据（采样值数组） */
  data: Record<ECGLead, number[]>;
  /** 显示配置覆盖 */
  config?: Partial<WaveformDisplayConfig>;
  /** 是否启用实时自动滚动 */
  realtime?: boolean;
  /** 容器CSS类名 */
  className?: string;
  /** 容器样式（需要定义高度） */
  style?: React.CSSProperties;
}

// ─── Constants ──────────────────────────────────────────────────

/** 安全上限，防止父组件传入过多数据导致渲染卡顿 */
const MAX_DATA_POINTS = 50000;

/** 导联颜色映射（按导联分组：肢体=绿、加压=琥珀、胸前=红） */
export const LEAD_COLORS: Record<ECGLead, string> = {
  [ECGLead.I]: '#00E676',
  [ECGLead.II]: '#00E676',
  [ECGLead.III]: '#00E676',
  [ECGLead.aVR]: '#FFD740',
  [ECGLead.aVL]: '#FFD740',
  [ECGLead.aVF]: '#FFD740',
  [ECGLead.V1]: '#FF5252',
  [ECGLead.V2]: '#FF5252',
  [ECGLead.V3]: '#FF5252',
  [ECGLead.V4]: '#FF5252',
  [ECGLead.V5]: '#FF5252',
  [ECGLead.V6]: '#FF5252',
};

// ─── Helpers ────────────────────────────────────────────────────

/**
 * 计算4×3网格中第i个导联的grid位置
 * 标准12导联布局：I II III / aVR aVL aVF / V1 V2 V3 / V4 V5 V6
 */
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

// ─── Component ──────────────────────────────────────────────────

/**
 * 心电波形显示组件
 *
 * 使用ECharts渲染12导联心电波形，支持：
 * - 实时自动滚动（延迟<100ms）
 * - 鼠标滚轮缩放
 * - 拖拽平移
 * - ECG纸风格网格背景
 * - 12导联标识
 * - 性能优化（large模式，保留全部数据点无降采样）
 *
 * @example
 * ```tsx
 * <WaveformDisplay
 *   data={leadData}
 *   realtime={isStreaming}
 *   config={{ timeWindow: 5, sampleRate: 500 }}
 * />
 * ```
 */
export function WaveformDisplay({
  data,
  config: configOverrides,
  realtime = true,
  className,
  style,
}: WaveformDisplayProps) {
  // ── Refs ──
  const chartRef = useRef<ReactECharts | null>(null);
  const followModeRef = useRef(realtime);
  const isProgrammaticZoomRef = useRef(false);
  /** RAF ID 用于取消待执行的渲染帧 */
  const rafIdRef = useRef<number | null>(null);
  /** 缓存最新的 data 引用，避免 RAF 回调中使用过期闭包 */
  const dataRef = useRef(data);
  dataRef.current = data;

  // ── Merge config ──
  const config = useMemo(
    () => ({ ...DEFAULT_WAVEFORM_CONFIG, ...configOverrides }),
    [configOverrides],
  );

  // ── Build base ECharts option ──
  const baseOption = useMemo<EChartsOption>(() => {
    // Grids: 4×3 layout
    const grids = ECG_LEADS.map((_, i) => ({
      ...getGridPosition(i),
      containLabel: false,
    }));

    // X-axes (time in seconds)
    const xAxes = ECG_LEADS.map((_, i) => ({
      type: 'value' as const,
      gridIndex: i,
      min: 0,
      max: config.timeWindow,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        show: i >= 9, // Bottom row only
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

    // Y-axes (amplitude in mV)
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

    // Series: one line per lead
    const series = ECG_LEADS.map((lead, i) => ({
      type: 'line' as const,
      xAxisIndex: i,
      yAxisIndex: i,
      data: [] as [number, number][],
      symbol: 'none',
      lineStyle: {
        color: config.leadColors[lead] || LEAD_COLORS[lead],
        width: config.lineWidth,
        join: 'round' as const,
        cap: 'round' as const,
      },
      areaStyle: { color: 'transparent' },
      large: true,
      largeThreshold: 50000,
      sampling: 'none' as const,
      silent: true, // 不响应鼠标事件，避免干扰dataZoom
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

  // ── Update data when it changes ──
  // 使用 requestAnimationFrame 合并多次数据更新为单次渲染帧
  // 将 series + dataZoom 合并为一次 setOption 调用，减少 ECharts 重绘次数
  useEffect(() => {
    // 取消上一帧待执行的渲染
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const chart = chartRef.current?.getEchartsInstance();
      if (!chart) return;

      const currentData = dataRef.current;

      // 可见窗口内的最大数据点数（timeWindow秒 × sampleRate采样率）
      const maxVisiblePoints = Math.floor(config.timeWindow * config.sampleRate);

      // Build series data: [time, value] pairs
      // 只取最后 maxVisiblePoints 个点，映射到 [0, timeWindow] 实现滚动效果
      const seriesData = ECG_LEADS.map((lead) => {
        const leadData = currentData[lead] || [];
        const n = leadData.length;
        // 安全上限截断
        const trimmed = n > MAX_DATA_POINTS ? leadData.slice(n - MAX_DATA_POINTS) : leadData;
        const len = trimmed.length;
        // 只取最后 maxVisiblePoints 个点用于显示
        const visibleData = len > maxVisiblePoints ? trimmed.slice(len - maxVisiblePoints) : trimmed;
        return {
          data: visibleData.map((y, i) => [i / config.sampleRate, y]),
        };
      });

      // 计算当前可见数据的 Y 轴范围（跨所有导联）
      // 使用百分位数（5%~95%）过滤异常值，防止线被移动时产生的异常数据压缩波形
      const allValues: number[] = [];
      for (const lead of ECG_LEADS) {
        const leadData = currentData[lead] || [];
        for (const val of leadData) {
          if (Number.isFinite(val)) {
            allValues.push(val);
          }
        }
      }

      let yMin: number;
      let yMax: number;

      if (allValues.length === 0) {
        // 无数据，回退到默认范围
        yMin = -2;
        yMax = 2;
      } else {
        // 排序后取 5% 和 95% 分位数
        allValues.sort((a, b) => a - b);
        const p5 = allValues[Math.floor(allValues.length * 0.05)];
        const p95 = allValues[Math.floor(allValues.length * 0.95)];
        // 添加 5% 边距
        const range = (p95 - p5) || 1;
        const margin = range * 0.05;
        yMin = p5 - margin;
        yMax = p95 + margin;
      }

      // 动态 Y 轴范围
      const yAxisUpdate = ECG_LEADS.map(() => ({ min: yMin, max: yMax }));

      // 合并 series、dataZoom、yAxis 为一次 setOption 调用
      const optionUpdate: Record<string, unknown> = {
        series: seriesData,
        yAxis: yAxisUpdate,
      };

      // Auto-scroll in follow mode: 固定显示 [0, timeWindow] 窗口
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
  }, [data, config]);

  // ── Detect user-initiated zoom/pan ──
  const handleDataZoom = useCallback(() => {
    if (!isProgrammaticZoomRef.current) {
      followModeRef.current = false;
    }
    isProgrammaticZoomRef.current = false;
  }, []);

  // ── Sync follow mode with realtime prop ──
  useEffect(() => {
    followModeRef.current = realtime;
  }, [realtime]);

  // ── Render ──
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        backgroundColor: config.backgroundColor,
        borderRadius: '12px',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* 导联标识 */}
      {ECG_LEADS.map((lead, i) => {
        const pos = getGridPosition(i);
        const color = config.leadColors[lead] || LEAD_COLORS[lead];
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

      {/* ECharts画布 */}
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

WaveformDisplay.displayName = 'WaveformDisplay';
