import {
  PhysioParameter,
  PARAMETER_LABELS,
  PARAMETER_COLORS,
  PARAMETER_LIST,
} from '../types/physio';

export interface MenuBarProps {
  activeTab: PhysioParameter;
  onTabChange: (tab: PhysioParameter) => void;
  className?: string;
}

function TabIcon({ parameter }: { parameter: PhysioParameter }) {
  const cls = 'w-4 h-4';
  switch (parameter) {
    case PhysioParameter.ECG:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      );
    case PhysioParameter.SpO2:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
        </svg>
      );
    case PhysioParameter.Respiration:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12h3l2-3 3 3 3-3 3 3 3-3 2 3h3" />
        </svg>
      );
    case PhysioParameter.EMG:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1v22M17 5H7M17 19H7M20 9H4M20 15H4" />
        </svg>
      );
    case PhysioParameter.Temperature:
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
        </svg>
      );
  }
}

export default function MenuBar({ activeTab, onTabChange, className = '' }: MenuBarProps) {
  return (
    <nav className={`flex items-center gap-1 px-4 py-2 bg-[#0f1126] border-b border-white/[0.06] ${className}`}>
      {PARAMETER_LIST.map((param) => {
        const isActive = param === activeTab;
        const color = PARAMETER_COLORS[param];
        return (
          <button
            key={param}
            onClick={() => onTabChange(param)}
            className={`
              relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition-all duration-200
              ${isActive
                ? 'shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }
            `}
            style={{
              color: isActive ? color : undefined,
              backgroundColor: isActive ? `${color}10` : undefined,
              boxShadow: isActive ? `inset 0 -2px 0 ${color}` : undefined,
            }}
          >
            <TabIcon parameter={param} />
            <span>{PARAMETER_LABELS[param]}</span>
            {isActive && (
              <div
                className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                style={{ backgroundColor: color }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}

MenuBar.displayName = 'MenuBar';
