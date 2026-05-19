import { type ReactNode } from 'react';
import { PhysioParameter } from '../types/physio';

export interface ViewContainerProps {
  activeTab: PhysioParameter;
  views: Record<PhysioParameter, ReactNode>;
  className?: string;
}

export default function ViewContainer({ activeTab, views, className = '' }: ViewContainerProps) {
  return (
    <div className={`relative flex-1 overflow-hidden bg-[#0a0b1a] ${className}`}>
      {(
        Object.entries(views) as [PhysioParameter, ReactNode][]
      ).map(([param, view]) => (
        <div
          key={param}
          className="absolute inset-0 transition-opacity duration-150"
          style={{
            opacity: param === activeTab ? 1 : 0,
            pointerEvents: param === activeTab ? 'auto' : 'none',
            zIndex: param === activeTab ? 1 : 0,
          }}
        >
          {view}
        </div>
      ))}
    </div>
  );
}

ViewContainer.displayName = 'ViewContainer';
