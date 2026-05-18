import { useMemo } from 'react';
import type { SerialConnectionState } from '../types/ecg';

// ─── Types ──────────────────────────────────────────────────────

export interface StatusBarProps {
  /** 串口连接状态 */
  connectionState: SerialConnectionState;
  /** 已连接端口名 */
  portName: string | null;
  /** 心率（BPM），null表示未检测到 */
  heartRate: number | null;
  /** 累计帧数 */
  frameCount: number;
  /** 累计接收字节数 */
  bytesReceived: number;
  /** 是否正在记录 */
  isRecording: boolean;
  /** 最近错误信息 */
  lastError?: string | null;
  /** 附加类名 */
  className?: string;
}

// ─── Connection State Config ────────────────────────────────────

interface StateConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotClass: string;
}

const STATE_MAP: Record<SerialConnectionState, StateConfig> = {
  closed: {
    label: '未连接',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.08)',
    borderColor: 'rgba(100, 116, 139, 0.2)',
    dotClass: 'bg-slate-500',
  },
  opening: {
    label: '连接中...',
    color: '#FFD740',
    bgColor: 'rgba(255, 215, 64, 0.08)',
    borderColor: 'rgba(255, 215, 64, 0.2)',
    dotClass: 'bg-amber-400 animate-pulse',
  },
  open: {
    label: '已连接',
    color: '#00E676',
    bgColor: 'rgba(0, 230, 118, 0.08)',
    borderColor: 'rgba(0, 230, 118, 0.2)',
    dotClass: 'bg-emerald-400',
  },
  closing: {
    label: '断开中...',
    color: '#FFD740',
    bgColor: 'rgba(255, 215, 64, 0.08)',
    borderColor: 'rgba(255, 215, 64, 0.2)',
    dotClass: 'bg-amber-400 animate-pulse',
  },
  error: {
    label: '错误',
    color: '#FF5252',
    bgColor: 'rgba(255, 82, 82, 0.08)',
    borderColor: 'rgba(255, 82, 82, 0.2)',
    dotClass: 'bg-red-400',
  },
};

// ─── Helper ─────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatFrameCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1_000_000).toFixed(2)}M`;
}

// ─── Component ──────────────────────────────────────────────────

/**
 * 状态栏组件
 *
 * 显示系统运行状态：串口连接、心率、数据统计、记录状态。
 * 水平布局，适合放置在页面顶部或底部。
 */
export default function StatusBar({
  connectionState,
  portName,
  heartRate,
  frameCount,
  bytesReceived,
  isRecording,
  lastError,
  className = '',
}: StatusBarProps) {
  const stateConfig = STATE_MAP[connectionState];

  const heartRateDisplay = useMemo(() => {
    if (heartRate == null || heartRate <= 0) return null;
    const rounded = Math.round(heartRate);
    // 心率异常阈值
    const isAbnormal = rounded < 60 || rounded > 100;
    return { value: rounded, isAbnormal };
  }, [heartRate]);

  return (
    <div
      className={`
        flex items-center h-10 px-4 gap-4
        bg-[#0c0e1f] border-b border-white/[0.06]
        text-xs select-none
        ${className}
      `}
    >
      {/* ── 连接状态 ── */}
      <div
        className="flex items-center gap-2 px-2.5 py-1 rounded-md"
        style={{
          backgroundColor: stateConfig.bgColor,
          border: `1px solid ${stateConfig.borderColor}`,
        }}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${stateConfig.dotClass}`} />
        <span
          className="font-medium tracking-wide"
          style={{ color: stateConfig.color }}
        >
          {stateConfig.label}
        </span>
        {portName && connectionState === 'open' && (
          <span className="text-slate-500 font-mono text-[11px]">
            {portName}
          </span>
        )}
      </div>

      {/* ── 错误信息 ── */}
      {lastError && connectionState === 'error' && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/[0.08] border border-red-500/[0.2]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF5252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-red-400 text-[11px] truncate max-w-[200px]">
            {lastError}
          </span>
        </div>
      )}

      {/* ── 分隔线 ── */}
      <div className="w-px h-5 bg-white/[0.06]" />

      {/* ── 心率 ── */}
      {heartRateDisplay ? (
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#00FF00]/[0.06] border border-[#00FF00]/[0.15]">
          {/* 心跳动画 */}
          <div className="relative w-4 h-4 flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={heartRateDisplay.isAbnormal ? '#FF5252' : '#00FF00'}
              className="animate-pulse"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
          <span
            className="font-mono font-bold text-sm tabular-nums"
            style={{ color: heartRateDisplay.isAbnormal ? '#FF5252' : '#00FF00' }}
          >
            {heartRateDisplay.value}
          </span>
          <span
            className="text-[11px] font-medium"
            style={{ color: heartRateDisplay.isAbnormal ? '#FF525280' : '#00FF0080' }}
          >
            BPM
          </span>
          {heartRateDisplay.isAbnormal && (
            <span className="text-[10px] text-red-400/80 ml-0.5">
              {heartRateDisplay.value < 60 ? '心动过缓' : '心动过速'}
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
          <span className="text-slate-600 font-mono text-[11px]">--</span>
          <span className="text-[11px] text-slate-600">BPM</span>
        </div>
      )}

      {/* ── 分隔线 ── */}
      <div className="w-px h-5 bg-white/[0.06]" />

      {/* ── 数据统计 ── */}
      <div className="flex items-center gap-3">
        {/* 帧计数 */}
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span className="text-slate-500 font-mono text-[11px] tabular-nums">
            {formatFrameCount(frameCount)}
          </span>
          <span className="text-slate-600 text-[10px]">帧</span>
        </div>

        {/* 接收字节 */}
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="text-slate-500 font-mono text-[11px] tabular-nums">
            {formatBytes(bytesReceived)}
          </span>
        </div>
      </div>

      {/* ── 右侧：记录状态 ── */}
      <div className="ml-auto flex items-center gap-3">
        {isRecording && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-red-500/[0.08] border border-red-500/[0.2]">
            <div className="relative flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute opacity-40" />
              <div className="w-2 h-2 rounded-full bg-red-500 relative" />
            </div>
            <span className="text-red-400 text-[11px] font-medium tracking-wide">
              REC
            </span>
          </div>
        )}

        {/* 时间戳 */}
        <span className="text-slate-600 font-mono text-[10px] tabular-nums">
          {new Date().toLocaleTimeString('zh-CN', { hour12: false })}
        </span>
      </div>
    </div>
  );
}

StatusBar.displayName = 'StatusBar';
