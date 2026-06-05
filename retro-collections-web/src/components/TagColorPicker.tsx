import { useState, useRef } from 'react';

export interface TagColorPair {
  name?: string;
  backgroundColor: string | null;
  foregroundColor: string | null;
}

interface TagColorPickerProps {
  text?: string;
  valueIndex: number;
  onChange: (idx: number) => void;
  colorPairs: TagColorPair[];
}

export function TagColorPicker({
  text = 'Tag Color',
  valueIndex,
  onChange,
  colorPairs,
}: TagColorPickerProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'Enter' || e.key === ' ')) {
      setOpen(true);
      e.preventDefault();
    } else if (open) {
      if (e.key === 'Escape') {
        setOpen(false);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        const next = Math.min(valueIndex + 1, colorPairs.length - 1);
        onChange(next);
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        const prev = Math.max(valueIndex - 1, 0);
        onChange(prev);
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === ' ') {
        setOpen(false);
        e.preventDefault();
      }
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setOpen(false);
    }
  };

  return (
    <div className="relative" tabIndex={0} onBlur={handleBlur}>
      <button
        type="button"
        className="flex items-center min-w-[80px]"
        ref={buttonRef}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleKeyDown}
      >
        <span
          className="font-mono px-2 py-1 rounded border"
          style={{
            backgroundColor:
              colorPairs[valueIndex]?.backgroundColor || undefined,
            color: colorPairs[valueIndex]?.foregroundColor || undefined,
            borderColor: '#ccc',
            display: 'inline-block',
            minWidth: 60,
            textAlign: 'center',
          }}
        >
          {(text ?? colorPairs[valueIndex]?.name) || 'Custom'}
        </span>
        {/* <span className="ml-1">▼</span> */}
      </button>
      {open && (
        <ul
          className="absolute z-10 mt-1 bg-base-100 border rounded shadow w-40 max-h-60 overflow-auto"
          role="listbox"
          tabIndex={-1}
          ref={listRef}
        >
          {colorPairs.map((pair, idx) => (
            <li
              key={(pair?.name ?? '') + idx}
              role="option"
              aria-selected={idx === valueIndex}
              className={`cursor-pointer px-2 py-1 flex items-center gap-2 ${idx === valueIndex ? 'bg-base-200' : ''}`}
              onClick={() => {
                onChange(idx);
                setOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onChange(idx);
                  setOpen(false);
                }
              }}
              tabIndex={0}
            >
              <span
                className="font-mono px-2 py-1 rounded border"
                style={{
                  backgroundColor: pair.backgroundColor || undefined,
                  color: pair.foregroundColor || undefined,
                  borderColor: '#ccc',
                  display: 'inline-block',
                  minWidth: 60,
                  textAlign: 'center',
                }}
              >
                {pair.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
