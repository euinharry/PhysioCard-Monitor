import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ECGLead, ECG_LEADS, DEFAULT_WAVEFORM_CONFIG } from '../types/ecg';
import { WaveformDisplay, LEAD_COLORS } from './WaveformDisplay';
import { useSerialPort } from '../hooks/useSerialPort';
import { useECGData } from '../hooks/useECGData';
import { parseASCIIData, normalizeECGData } from '../utils/dataParser';
import '../styles/responsive.css';

// ─── Performance Constants ──────────────────────────────────────
/** 渲染间隔（ms）— 60Hz ≈ 16ms */
const RENDER_INTERVAL_MS = 16;
/** 传给波形显示的最大数据点数 */
const MAX_DISPLAY_POINTS = 5000;
// ─── Connection Status Indicator ──────────────────────────────

interface StatusDotProps {
  connected: boolean;
  label: string;
}

function StatusDot({ connected, label }: StatusDotProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-1.5 h-1.5 rounded-full ${
          connected
            ? 'bg-emerald-400 ecg-status-dot--active'
            : 'bg-slate-600'
        }`}
        style={connected ? { boxShadow: '0 0 6px rgba(52, 211, 153, 0.5)' } : undefined}
      />
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
}

// ─── ECG Monitor Component ────────────────────────────────────

export interface ECGMonitorProps {
  /** 附加类名 */
  className?: string;
}

/**
 * ECG Monitor 主布局组件
 *
 * 响应式布局策略：
 * - 桌面端（>1024px）：左右布局，波形区占满剩余宽度，导联面板固定280px
 * - 平板端（768-1024px）：上下布局，波形区自适应高度，导联面板固定高度
 * - 移动端（<768px）：单列布局，导联面板可折叠
 */
export default function ECGMonitor({ className = '' }: ECGMonitorProps) {
  // ── Serial Port Hook ──
  const {
    state: serialState,
    connect: serialConnect,
    disconnect: serialDisconnect,
    onData: serialOnData,
    onError: serialOnError,
    isConnected: isSerialConnected,
    isSupported: isSerialSupported,
  } = useSerialPort();

  // ── ECG Data Hook ──
  /** 缓冲区仅保留 10 秒数据，超出自动丢弃旧采样点 */
  const ecgData = useECGData(10 * 250, 250);

  // ── State ──
  const [realtimeData, setRealtimeData] = useState<Record<ECGLead, number[]> | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [frameCount, setFrameCount] = useState(0);

  // Refs for streaming serial decode
  const lineBufferRef = useRef('');
  const decoderRef = useRef(new TextDecoder());

  // ── Serial Data Reception (流式行缓冲解码) ──
  useEffect(() => {
    if (!isSerialConnected) {
      lineBufferRef.current = '';
      return;
    }

    const decoder = decoderRef.current;
    const unsubscribe = serialOnData((data: ArrayBuffer) => {
      // 流式解码：{ stream: true } 保持多字节字符的跨块状态
      lineBufferRef.current += decoder.decode(data, { stream: true });

      // 提取最后一个换行符之前的所有完整行
      const lastNewline = lineBufferRef.current.lastIndexOf('\n');
      if (lastNewline === -1) return; // 还没有完整行

      const completePart = lineBufferRef.current.substring(0, lastNewline);
      lineBufferRef.current = lineBufferRef.current.substring(lastNewline + 1);

      const parsed = parseASCIIData(completePart);
      if (parsed.length > 0) {
        ecgData.addData(parsed);
      }
    });

    return unsubscribe;
  }, [isSerialConnected, serialOnData, ecgData.addData]);

  // ── Serial Error Handling ──
  useEffect(() => {
    const unsubscribe = serialOnError((error: Error) => {
      console.error('[ECGMonitor] Serial error:', error.message);
    });
    return unsubscribe;
  }, [serialOnError]);

  // ── Render Real Data When Connected ──
  // 使用 RAF 以显示器原生刷新率（~60Hz）渲染
  // 通过 dataVersion diff 检测数据变更，避免无意义的重渲染
  useEffect(() => {
    if (!isSerialConnected) {
      setRealtimeData(null);
      return;
    }

    let rafId: number | null = null;
    let lastVersion = -1;
    let lastRenderTime = 0;

    const render = (timestamp: number) => {
      // 节流：至少间隔 RENDER_INTERVAL_MS（~60Hz）
      if (timestamp - lastRenderTime >= RENDER_INTERVAL_MS) {
        const currentVersion = ecgData.getDataVersion();
        if (currentVersion !== lastVersion) {
          lastVersion = currentVersion;
          lastRenderTime = timestamp;

          // 批量读取数据 + 单次 setState
          const data: Record<ECGLead, number[]> = {} as Record<ECGLead, number[]>;
          for (const lead of ECG_LEADS) {
            data[lead] = ecgData.getLeadData(lead, MAX_DISPLAY_POINTS);
          }
          setRealtimeData(data);
          setFrameCount(ecgData.getFrameCount());
          setHeartRate(ecgData.getHeartRate());
        }
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isSerialConnected, ecgData.getDataVersion, ecgData.getLeadData, ecgData.getFrameCount, ecgData.getHeartRate]);

  // ── Connect/Disconnect Handlers ──
  const handleConnect = useCallback(async () => {
    try {
      await serialConnect();
    } catch (err) {
      console.error('[ECGMonitor] Connect failed:', err);
    }
  }, [serialConnect]);

  const handleDisconnect = useCallback(async () => {
    try {
      await serialDisconnect();
      // Clear real data on disconnect
      setRealtimeData(null);
      ecgData.clearData();
    } catch (err) {
      console.error('[ECGMonitor] Disconnect failed:', err);
    }
  }, [serialDisconnect, ecgData.clearData]);

  // ── Build waveform config ──
  const waveformConfig = useMemo(
    () => ({
      ...DEFAULT_WAVEFORM_CONFIG,
      leadColors: { ...LEAD_COLORS } as Record<ECGLead, string>,
      leadVisibility: { ...DEFAULT_WAVEFORM_CONFIG.leadVisibility },
    }),
    [],
  );

  // ── Determine raw data: real when connected ──
  const rawData = realtimeData ?? ({} as Record<ECGLead, number[]>);

  // ── Normalize to [-1, 1] for waveform display (raw data preserved for export) ──
  const displayData = useMemo(() => normalizeECGData(rawData, -1, 1), [rawData]);

  // ── Build status label ──
  const connectionLabel = isSerialConnected
    ? serialState.portName ?? 'Serial'
    : '未连接';

  // ── Render ──
  return (
    <div className={`ecg-monitor ${className}`}>
      {/* ── Header ── */}
      <div className="ecg-header">
        <div className="flex items-center gap-3">
          {/* Logo / Heartbeat icon */}
          <div className="relative">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              className="text-emerald-400"
            >
              <path
                d="M22 12h-4l-3 9L9 3l-3 9H2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-sm font-semibold text-slate-200 tracking-wide">
            ECG Monitor
          </h1>
          <span className="text-[11px] text-slate-600 hidden sm:inline">
            心电信号监测系统
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Serial port connect/disconnect button */}
          {isSerialSupported && (
            <button
              onClick={isSerialConnected ? handleDisconnect : handleConnect}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                isSerialConnected
                  ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-600/50'
              }`}
            >
              {/* Plug icon */}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isSerialConnected ? (
                  <>
                    <path d="M12 22v-5" />
                    <path d="M9 8V2" />
                    <path d="M15 8V2" />
                    <path d="M18 8v5a6 6 0 0 1-12 0V8" />
                  </>
                ) : (
                  <>
                    <path d="M12 22v-5" />
                    <path d="M9 8V2" />
                    <path d="M15 8V2" />
                    <path d="M18 8v5a6 6 0 0 1-12 0V8" />
                  </>
                )}
              </svg>
              {isSerialConnected ? '断开' : '连接串口'}
            </button>
          )}

          <StatusDot
            connected={isSerialConnected}
            label={connectionLabel}
          />
          <span className="text-[11px] text-slate-600 tabular-nums hidden md:inline">
            {frameCount.toLocaleString()} 帧
          </span>

          {/* Heart Rate Display */}
          <div
            className="w-[280px] flex items-center justify-center gap-2 border border-slate-700/60 rounded-lg bg-slate-800/40 py-1 px-3"
            style={
              heartRate !== null
                ? { boxShadow: '0 0 12px rgba(248, 113, 113, 0.3), 0 0 4px rgba(248, 113, 113, 0.15)' }
                : undefined
            }
          >
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                heartRate !== null
                  ? 'bg-red-400 animate-pulse'
                  : 'bg-slate-600'
              }`}
              style={
                heartRate !== null
                  ? { boxShadow: '0 0 8px rgba(248, 113, 113, 0.6)' }
                  : undefined
              }
            />
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-500 leading-none">心率</span>
              <span className="text-2xl font-bold tabular-nums text-red-400 leading-tight">
                {heartRate !== null ? heartRate : '--'}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 self-end mb-0.5">BPM</span>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="ecg-content">
        {/* ── Waveform Section ── */}
        <div className="ecg-waveform-area">
          <WaveformDisplay
            data={displayData}
            config={waveformConfig}
            realtime={true}
            style={{ height: '100%', width: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
