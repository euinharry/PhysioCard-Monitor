import { useState, useCallback, useMemo } from 'react';
import { ECGLead, ECG_LEADS } from '../types/ecg';

// ─── 导联分组定义 ─────────────────────────────────────────

interface LeadGroup {
  label: string;
  description: string;
  leads: ECGLead[];
  color: string;
  accentBg: string;
  accentBorder: string;
}

const LEAD_GROUPS: LeadGroup[] = [
  {
    label: '标准肢体导联',
    description: '反映额面电活动',
    leads: [ECGLead.I, ECGLead.II, ECGLead.III],
    color: '#00FF00',
    accentBg: 'rgba(0, 255, 0, 0.08)',
    accentBorder: 'rgba(0, 255, 0, 0.25)',
  },
  {
    label: '加压肢体导联',
    description: '单极肢体电位',
    leads: [ECGLead.aVR, ECGLead.aVL, ECGLead.aVF],
    color: '#FFFF00',
    accentBg: 'rgba(255, 255, 0, 0.08)',
    accentBorder: 'rgba(255, 255, 0, 0.25)',
  },
  {
    label: '胸前导联',
    description: '反映横面电活动',
    leads: [ECGLead.V1, ECGLead.V2, ECGLead.V3, ECGLead.V4, ECGLead.V5, ECGLead.V6],
    color: '#FF6B6B',
    accentBg: 'rgba(255, 107, 107, 0.08)',
    accentBorder: 'rgba(255, 107, 107, 0.25)',
  },
];

const LEAD_DESCRIPTIONS: Record<ECGLead, string> = {
  [ECGLead.I]: '左臂 − 右臂',
  [ECGLead.II]: '左腿 − 右臂',
  [ECGLead.III]: '左腿 − 左臂',
  [ECGLead.aVR]: '右臂',
  [ECGLead.aVL]: '左臂',
  [ECGLead.aVF]: '左腿',
  [ECGLead.V1]: '胸骨右缘第4肋间',
  [ECGLead.V2]: '胸骨左缘第4肋间',
  [ECGLead.V3]: 'V2与V4之间',
  [ECGLead.V4]: '左锁骨中线第5肋间',
  [ECGLead.V5]: '左腋前线与V4同水平',
  [ECGLead.V6]: '左腋中线与V4同水平',
};

// ─── Props ─────────────────────────────────────────────────

interface LeadPanelProps {
  /** 当前选中的导联 */
  selectedLead: ECGLead | null;
  /** 选中导联回调 */
  onSelectLead: (lead: ECGLead | null) => void;
  /** 各导联可见性 */
  leadVisibility: Record<ECGLead, boolean>;
  /** 切换导联可见性 */
  onToggleVisibility: (lead: ECGLead) => void;
  /** 导联顺序（可选，支持重排序） */
  leadOrder?: ECGLead[];
  /** 更新导联顺序 */
  onReorderLead?: (fromIndex: number, toIndex: number) => void;
  /** 导联颜色映射 */
  leadColors?: Record<ECGLead, string>;
  /** 心率显示 */
  heartRate?: number | null;
  /** 附加类名 */
  className?: string;
}

// ─── 子组件：单个导联按钮 ──────────────────────────────────

interface LeadCardProps {
  lead: ECGLead;
  isSelected: boolean;
  isVisible: boolean;
  color: string;
  description: string;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

function LeadCard({
  lead,
  isSelected,
  isVisible,
  color,
  description,
  onSelect,
  onToggleVisibility,
  onDragStart,
  onDragOver,
  onDrop,
}: LeadCardProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-lg
        cursor-pointer select-none transition-all duration-200
        ${isSelected
          ? 'shadow-lg scale-[1.02]'
          : 'hover:bg-white/[0.04] active:scale-[0.98]'
        }
        ${!isVisible ? 'opacity-40' : ''}
      `}
      style={{
        backgroundColor: isSelected ? `${color}10` : undefined,
        boxShadow: isSelected ? `0 0 16px ${color}15, 0 4px 12px rgba(0,0,0,0.3)` : undefined,
        border: isSelected ? `1px solid ${color}40` : '1px solid transparent',
      }}
    >
      {/* 拖拽手柄 */}
      <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-40 transition-opacity shrink-0 cursor-grab active:cursor-grabbing">
        <div className="w-1 h-1 rounded-full bg-white/60" />
        <div className="w-1 h-1 rounded-full bg-white/60" />
        <div className="w-1 h-1 rounded-full bg-white/60" />
      </div>

      {/* 导联标识圆点 */}
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform duration-200"
        style={{
          backgroundColor: isVisible ? color : '#555',
          boxShadow: isVisible ? `0 0 8px ${color}60` : 'none',
          transform: isSelected ? 'scale(1.3)' : 'scale(1)',
        }}
      />

      {/* 导联名称 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className="font-mono font-bold text-sm tracking-wider"
            style={{ color: isSelected ? color : '#e2e8f0' }}
          >
            {lead}
          </span>
          <span className="text-[11px] text-slate-500 truncate">
            {description}
          </span>
        </div>
      </div>

      {/* 可见性切换按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
        }}
        className={`
          shrink-0 w-7 h-7 rounded-md flex items-center justify-center
          transition-all duration-150
          ${isVisible
            ? 'bg-white/[0.08] hover:bg-white/[0.15] text-slate-300'
            : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-600'
          }
        `}
        title={isVisible ? '隐藏导联' : '显示导联'}
      >
        {isVisible ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── 主组件 ─────────────────────────────────────────────────

export default function LeadPanel({
  selectedLead,
  onSelectLead,
  leadVisibility,
  onToggleVisibility,
  leadOrder,
  onReorderLead,
  leadColors,
  heartRate,
  className = '',
}: LeadPanelProps) {
  // 内部维护的导联顺序
  const [internalOrder, setInternalOrder] = useState<ECGLead[]>([...ECG_LEADS]);
  const order = leadOrder ?? internalOrder;

  // 拖拽状态
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // 获取导联颜色
  const getColor = useCallback(
    (lead: ECGLead): string => {
      if (leadColors?.[lead]) return leadColors[lead];
      const group = LEAD_GROUPS.find((g) => g.leads.includes(lead));
      return group?.color ?? '#00FF00';
    },
    [leadColors],
  );

  // 获取导联描述
  const getDescription = useCallback((lead: ECGLead): string => {
    return LEAD_DESCRIPTIONS[lead] ?? '';
  }, []);

  // 拖拽处理
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (targetIndex: number) => {
      if (dragIndex === null || dragIndex === targetIndex) {
        setDragIndex(null);
        return;
      }

      if (onReorderLead) {
        onReorderLead(dragIndex, targetIndex);
      } else {
        setInternalOrder((prev) => {
          const next = [...prev];
          const [moved] = next.splice(dragIndex, 1);
          next.splice(targetIndex, 0, moved);
          return next;
        });
      }
      setDragIndex(null);
    },
    [dragIndex, onReorderLead],
  );

  // 按分组组织导联
  const groupedLeads = useMemo(() => {
    return LEAD_GROUPS.map((group) => ({
      ...group,
      orderedLeads: group.leads.sort(
        (a, b) => order.indexOf(a) - order.indexOf(b),
      ),
    }));
  }, [order]);

  // 统计信息
  const visibleCount = useMemo(
    () => ECG_LEADS.filter((l) => leadVisibility[l]).length,
    [leadVisibility],
  );

  // 全选/全不选
  const handleToggleAll = useCallback(
    (visible: boolean) => {
      ECG_LEADS.forEach((lead) => {
        if (leadVisibility[lead] !== visible) {
          onToggleVisibility(lead);
        }
      });
    },
    [leadVisibility, onToggleVisibility],
  );

  return (
    <div
      className={`
        flex flex-col h-full overflow-hidden
        bg-[#0f1126] border-r border-white/[0.06]
        ${className}
      `}
    >
      {/* ── 头部 ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-200 tracking-wide">
            导联选择
          </h2>
          <span className="text-[11px] text-slate-500 tabular-nums">
            {visibleCount}/{ECG_LEADS.length} 可见
          </span>
        </div>

        {/* 心率指示 */}
        {heartRate != null && heartRate > 0 && (
          <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-md bg-[#00FF00]/[0.06] border border-[#00FF00]/[0.15]">
            <div className="relative w-2 h-2">
              <div className="absolute inset-0 rounded-full bg-[#00FF00] animate-ping opacity-40" />
              <div className="relative w-2 h-2 rounded-full bg-[#00FF00]" />
            </div>
            <span className="text-[#00FF00] font-mono text-sm font-bold tabular-nums">
              {Math.round(heartRate)}
            </span>
            <span className="text-[11px] text-[#00FF00]/60">BPM</span>
          </div>
        )}

        {/* 快捷操作 */}
        <div className="flex gap-1.5 mt-3">
          <button
            onClick={() => handleToggleAll(true)}
            className="
              flex-1 px-2 py-1 rounded text-[11px] font-medium
              bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-slate-300
              transition-colors duration-150
            "
          >
            全部显示
          </button>
          <button
            onClick={() => handleToggleAll(false)}
            className="
              flex-1 px-2 py-1 rounded text-[11px] font-medium
              bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-slate-300
              transition-colors duration-150
            "
          >
            全部隐藏
          </button>
          {selectedLead && (
            <button
              onClick={() => onSelectLead(null)}
              className="
                px-2 py-1 rounded text-[11px] font-medium
                bg-white/[0.06] text-slate-400 hover:bg-white/[0.1] hover:text-slate-300
                transition-colors duration-150
              "
            >
              取消选择
            </button>
          )}
        </div>
      </div>

      {/* ── 导联列表 ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 space-y-3 scrollbar-thin">
        {groupedLeads.map((group) => (
          <div key={group.label}>
            {/* 分组标题 */}
            <div className="flex items-center gap-2 px-1 mb-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: group.color }}
              />
              <span className="text-[11px] font-medium text-slate-500 tracking-wider uppercase">
                {group.label}
              </span>
              <span className="text-[10px] text-slate-600 ml-auto">
                {group.description}
              </span>
            </div>

            {/* 导联卡片 */}
            <div className="space-y-0.5">
              {group.orderedLeads.map((lead) => {
                const globalIndex = order.indexOf(lead);
                return (
                  <LeadCard
                    key={lead}
                    lead={lead}
                    isSelected={selectedLead === lead}
                    isVisible={leadVisibility[lead]}
                    color={getColor(lead)}
                    description={getDescription(lead)}
                    onSelect={() =>
                      onSelectLead(selectedLead === lead ? null : lead)
                    }
                    onToggleVisibility={() => onToggleVisibility(lead)}
                    onDragStart={() => handleDragStart(globalIndex)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(globalIndex)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── 底部图例 ── */}
      <div className="shrink-0 px-4 py-3 border-t border-white/[0.06]">
        <div className="text-[10px] text-slate-600 mb-2">颜色图例</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {LEAD_GROUPS.map((group) => (
            <div key={group.label} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-sm"
                style={{ backgroundColor: group.color }}
              />
              <span className="text-[10px] text-slate-500">{group.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
