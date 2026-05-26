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
  className = 'bg-base-100 rounded-lg',
  headerClassName = 'text-sm font-bold flex items-center',
  contentClassName = 'space-y-3',
}: CollapsePanelProps) {
  // 'md:collapse-open' forces the panel to stay open on desktop screens.
  // 'md:pointer-events-none' disables clicking the header on desktop since it's already open.
  const containerStyles =
    `collapse collapse-arrow md:collapse-open ${className}`.trim();
  const headerStyles =
    `collapse-title md:pointer-events-none ${headerClassName}`.trim();
  const contentStyles = `collapse-content ${contentClassName}`.trim();

  return (
    <div className={containerStyles}>
      {/* 
        The checkbox manages mobile states. 
        On desktop, 'md:hidden' ensures it doesn't conflict with 'collapse-open'.
      */}
      <input
        type="checkbox"
        className="peer md:hidden"
        aria-label="Toggle collapse panel"
      />

      <div className={headerStyles}>{title}</div>

      <div className={contentStyles}>{children}</div>
    </div>
  );
}

export default CollapsePanel;
