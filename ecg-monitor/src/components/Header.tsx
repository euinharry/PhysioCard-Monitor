import { useCallback } from 'react';
import type { SerialConnectionState } from '../types/ecg';

export interface HeaderProps {
  title: string;
  connectionState: SerialConnectionState;
  portName: string | null;
  isSerialSupported: boolean;
  heartRate: number | null;
  frameCount: number;
  isRecording: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  className?: string;
}

function StatusDot({ connected, label }: { connected: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-1.5 h-1.5 rounded-full ${
          connected ? 'bg-emerald-400' : 'bg-slate-600'
        }`}
        style={connected ? { boxShadow: '0 0 6px rgba(52, 211, 153, 0.5)' } : undefined}
      />
      <span className="text-[11px] text-slate-500">{label}</span>
    </div>
  );
}

export default function Header({
  title,
  connectionState,
  portName,
  isSerialSupported,
  heartRate,
  frameCount,
  onConnect,
  onDisconnect,
  className = '',
}: HeaderProps) {
  const isConnected = connectionState === 'open';
  const isBusy = connectionState === 'opening' || connectionState === 'closing';

  const handleToggleConnection = useCallback(() => {
    if (isBusy) return;
    if (isConnected) onDisconnect();
    else onConnect();
  }, [isBusy, isConnected, onConnect, onDisconnect]);

  const connectionLabel = isConnected
    ? portName ?? 'Serial'
    : '未连接';

  return (
    <div className={`ecg-header ${className}`}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            className="text-emerald-400"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <h1 className="text-sm font-semibold text-slate-200 tracking-wide">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {isSerialSupported && (
          <button
            onClick={handleToggleConnection}
            disabled={isBusy}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              isConnected
                ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300 border border-slate-600/50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22v-5" />
              <path d="M9 8V2" />
              <path d="M15 8V2" />
              <path d="M18 8v5a6 6 0 0 1-12 0V8" />
            </svg>
            {isConnected ? '断开' : '连接串口'}
          </button>
        )}

        <StatusDot connected={isConnected} label={connectionLabel} />

        <span className="text-[11px] text-slate-600 tabular-nums hidden md:inline">
          {frameCount.toLocaleString()} 帧
        </span>

        <div
          className="flex items-center justify-center gap-2 border border-slate-700/60 rounded-lg bg-slate-800/40 py-1 px-3 min-w-[100px]"
          style={
            heartRate !== null
              ? { boxShadow: '0 0 12px rgba(248, 113, 113, 0.3), 0 0 4px rgba(248, 113, 113, 0.15)' }
              : undefined
          }
        >
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              heartRate !== null ? 'bg-red-400 animate-pulse' : 'bg-slate-600'
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
  );
}

Header.displayName = 'Header';
