import { type KeyboardEvent, useState } from 'react';
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
  size,
} from '@floating-ui/react';
import { createPortal } from 'react-dom';
import type { UserTag } from '../api/firestore/services/public/userTags';

interface SelectTagProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  suggestions: UserTag[];
  onTagSelected: (tagId: string) => void;
  onEnterPress: () => void;
}

export default function SelectTag({
  inputValue,
  onInputChange,
  suggestions,
  onTagSelected,
  onEnterPress,
}: SelectTagProps) {
  const [isOpen, setIsOpen] = useState(true);

  const { refs, floatingStyles } = useFloating({
    open: suggestions.length > 0 && isOpen,
    onOpenChange: setIsOpen,
    middleware: [
      offset(6),
      flip(),
      shift({ padding: 10 }),
      size({
        apply({ availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxHeight: `${Math.min(availableHeight - 10, 240)}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnterPress();
    }
  };

  return (
    <div className="relative inline-block w-full">
      <div className="flex gap-2 items-center">
        <input
          ref={refs.setReference}
          type="text"
          className="input input-xs input-bordered w-full"
          placeholder="Add tag"
          value={inputValue}
          autoFocus
          onChange={(e) => {
            onInputChange(e.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>

      {suggestions.length > 0 &&
        isOpen &&
        createPortal(
          <ul
            // eslint-disable-next-line react-hooks/refs
            ref={refs.setFloating}
            style={{
              ...floatingStyles,
              width: 'calc(100vw - 2rem)',
              maxWidth: '600px',
            }}
            className="z-[99999] p-2 shadow-2xl bg-base-100 rounded-box border border-base-200 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 overflow-y-auto"
          >
            {suggestions.map((t) => {
              const tagStyle = t.style || {
                backgroundColor: null,
                foregroundColor: null,
                imageUrl: null,
              };

              let absoluteImagePath = null;
              if (tagStyle.imageUrl) {
                const baseUrl = import.meta.env.BASE_URL;
                if (baseUrl !== '/' && tagStyle.imageUrl.startsWith(baseUrl)) {
                  absoluteImagePath = tagStyle.imageUrl;
                } else {
                  absoluteImagePath = `${baseUrl.replace(/\/$/, '')}${tagStyle.imageUrl}`;
                }
              }

              return (
                <li key={t.id} className="block">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onTagSelected(t.id);
                      setIsOpen(false);
                    }}
                    className="flex items-center justify-center text-xs p-1 w-full h-10 border border-base-300 rounded bg-base-200/40 hover:bg-base-200 active:bg-base-300 transition-all"
                  >
                    <span
                      className={`badge badge-outline flex items-center justify-center w-full h-full border-none ${
                        tagStyle.imageUrl ? 'p-0' : 'px-1'
                      }`}
                      style={{
                        backgroundColor: tagStyle.backgroundColor || undefined,
                        color: tagStyle.foregroundColor || undefined,
                      }}
                    >
                      {absoluteImagePath ? (
                        <img
                          src={absoluteImagePath}
                          alt=""
                          className={`max-w-full max-h-[28px] object-contain shrink-0 ${tagStyle.backgroundColor === 'transparent' ? 'px-0' : 'px-2'}`}
                          loading="lazy"
                        />
                      ) : (
                        <span className="truncate text-[11px] leading-tight text-center w-full">
                          {t.id}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </div>
  );
}
