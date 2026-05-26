import { type ReactNode } from 'react';

interface CollapsePanelProps {
  title: string | ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

function CollapsePanel({
  title,
  children,
  className = 'bg-base-200 rounded-lg',
  headerClassName = 'text-sm font-bold peer-checked:bg-base-300 transition-colors flex items-center',
  contentClassName = 'pt-3 space-y-3',
}: CollapsePanelProps) {
  return (
    <div className={`collapse collapse-arrow ${className}`}>
      {/* Invisible checkbox dictates open/close state via CSS */}
      <input
        type="checkbox"
        className="peer"
        aria-label="Toggle collapse panel"
      />

      <div className={`collapse-title ${headerClassName}`}>{title}</div>

      <div className="collapse-content">
        <div className={contentClassName}>{children}</div>
      </div>
    </div>
  );
}

export default CollapsePanel;
