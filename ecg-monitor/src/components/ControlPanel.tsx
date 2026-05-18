import { useCallback } from 'react';
import type { SerialConnectionState } from '../types/ecg';

// ─── Types ──────────────────────────────────────────────────────

export interface ControlPanelProps {
  /** 串口连接状态 */
  connectionState: SerialConnectionState;
  /** 是否正在记录 */
  isRecording: boolean;
  /** 点击连接/断开 */
  onToggleConnection: () => void;
  /** 点击开始/停止记录 */
  onToggleRecording: () => void;
  /** 点击重置 */
  onReset: () => void;
  /** 点击设置（可选） */
  onSettings?: () => void;
  /** 附加类名 */
  className?: string;
}

// ─── Button Variants ────────────────────────────────────────────

interface ButtonDef {
  key: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant: 'primary' | 'danger' | 'ghost' | 'warning';
  disabled?: boolean;
  pulse?: boolean;
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: `
    bg-emerald-500/[0.12] border-emerald-500/[0.3] text-emerald-400
    hover:bg-emerald-500/[0.2] hover:border-emerald-500/[0.5]
    active:scale-[0.97]
  `,
  danger: `
    bg-red-500/[0.12] border-red-500/[0.3] text-red-400
    hover:bg-red-500/[0.2] hover:border-red-500/[0.5]
    active:scale-[0.97]
  `,
  warning: `
    bg-amber-500/[0.12] border-amber-500/[0.3] text-amber-400
    hover:bg-amber-500/[0.2] hover:border-amber-500/[0.5]
    active:scale-[0.97]
  `,
  ghost: `
    bg-white/[0.04] border-white/[0.08] text-slate-400
    hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-slate-300
    active:scale-[0.97]
  `,
};

// ─── Icons ──────────────────────────────────────────────────────

function PlugIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function UnplugIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18" />
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
    </svg>
  );
}

function RecordIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ─── Component ──────────────────────────────────────────────────

/**
 * 控制面板组件
 *
 * 提供串口连接控制、数据记录控制和系统操作按钮。
 * 垂直布局，适合放置在侧边栏。
 */
export default function ControlPanel({
  connectionState,
  isRecording,
  onToggleConnection,
  onToggleRecording,
  onReset,
  onSettings,
  className = '',
}: ControlPanelProps) {
  const isConnected = connectionState === 'open';
  const isBusy = connectionState === 'opening' || connectionState === 'closing';

  // ── 构建按钮列表 ──
  const handleToggleConnection = useCallback(() => {
    if (!isBusy) onToggleConnection();
  }, [isBusy, onToggleConnection]);

  const buttons: ButtonDef[] = [
    {
      key: 'connection',
      label: isConnected ? '断开连接' : '连接串口',
      icon: isConnected ? <UnplugIcon /> : <PlugIcon />,
      onClick: handleToggleConnection,
      variant: isConnected ? 'danger' : 'primary',
      disabled: isBusy,
    },
    {
      key: 'record',
      label: isRecording ? '停止记录' : '开始记录',
      icon: isRecording ? <StopIcon /> : <RecordIcon />,
      onClick: onToggleRecording,
      variant: isRecording ? 'warning' : 'ghost',
      disabled: !isConnected,
      pulse: isRecording,
    },
    {
      key: 'reset',
      label: '重置数据',
      icon: <ResetIcon />,
      onClick: onReset,
      variant: 'ghost',
    },
  ];

  if (onSettings) {
    buttons.push({
      key: 'settings',
      label: '参数设置',
      icon: <SettingsIcon />,
      onClick: onSettings,
      variant: 'ghost',
    });
  }

  return (
    <div
      className={`
        flex flex-col gap-2 p-3
        bg-[#0f1126] border-r border-white/[0.06]
        ${className}
      `}
    >
      {/* ── 标题 ── */}
      <div className="px-1 mb-1">
        <h3 className="text-[11px] font-semibold text-slate-400 tracking-widest uppercase">
          控制台
        </h3>
      </div>

      {/* ── 按钮组 ── */}
      {buttons.map((btn) => (
        <button
          key={btn.key}
          onClick={btn.onClick}
          disabled={btn.disabled}
          className={`
            relative flex items-center gap-3 w-full px-3 py-2.5
            rounded-lg border text-sm font-medium
            transition-all duration-200
            disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
            ${VARIANT_CLASSES[btn.variant]}
          `}
        >
          {/* 脉冲动画 */}
          {btn.pulse && (
            <div className="absolute inset-0 rounded-lg animate-pulse bg-amber-500/[0.05]" />
          )}

          <span className="relative shrink-0">{btn.icon}</span>
          <span className="relative">{btn.label}</span>
        </button>
      ))}

      {/* ── 分隔线 ── */}
      <div className="my-2 h-px bg-white/[0.06]" />

      {/* ── 状态提示 ── */}
      <div className="px-1">
        {isBusy && (
          <p className="text-[11px] text-amber-400/70 animate-pulse">
            {connectionState === 'opening' ? '正在建立连接...' : '正在断开连接...'}
          </p>
        )}
        {connectionState === 'error' && (
          <p className="text-[11px] text-red-400/70">
            连接异常，请检查设备
          </p>
        )}
        {!isConnected && !isBusy && connectionState !== 'error' && (
          <p className="text-[11px] text-slate-600">
            请先连接串口设备
          </p>
        )}
        {isConnected && !isRecording && (
          <p className="text-[11px] text-slate-600">
            设备已就绪
          </p>
        )}
        {isRecording && (
          <p className="text-[11px] text-amber-400/60">
            正在采集数据...
          </p>
        )}
      </div>
    </div>
  );
}

ControlPanel.displayName = 'ControlPanel';
