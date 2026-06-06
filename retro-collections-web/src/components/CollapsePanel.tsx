import { type ReactNode, useState, useEffect } from 'react';

interface CollapsePanelProps {
  title: string | ReactNode;
  children: ReactNode;
  open?: 'mobile' | 'desktop' | boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
}

function CollapsePanel({
  title,
  children,
  open,
  className = 'bg-base-100 rounded-lg',
  headerClassName = 'text-sm font-bold flex items-center',
  contentClassName = 'space-y-3',
}: CollapsePanelProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (open === true) return true;
    if (open === false) return false;
    if (open === 'desktop') return true;
    if (open === 'mobile') return false;
    return false;
  });

  useEffect(() => {
    if (open === undefined) {
      const isDesktopMedia = window.matchMedia('(min-width: 768px)').matches;
      if (isDesktopMedia) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsOpen(true);
      }
    }
  }, [open]);

  const containerStyles = `
    collapse collapse-arrow ${className}
    ${isOpen ? 'collapse-open' : 'collapse-close'}
    ${open === 'desktop' ? 'md:collapse-open' : ''}
    ${open === 'mobile' ? 'max-md:collapse-open' : ''}
  `
    .trim()
    .replace(/\s+/g, ' ');

  const headerStyles =
    `collapse-title cursor-pointer ${headerClassName}`.trim();
  const contentStyles = `collapse-content ${contentClassName}`.trim();

  return (
    <div className={containerStyles}>
      <input
        type="checkbox"
        className="peer px-2"
        checked={isOpen}
        onChange={(e) => setIsOpen(e.target.checked)}
        aria-label="Toggle collapse panel"
      />
      <div className={headerStyles}>{title}</div>
      <div className={contentStyles}>{children}</div>
    </div>
  );
}

export default CollapsePanel;
