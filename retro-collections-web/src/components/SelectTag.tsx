import { type KeyboardEvent } from 'react';
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
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnterPress();
    }
  };

  return (
    <>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          className="input input-xs input-bordered"
          placeholder="Add tag"
          value={inputValue}
          autoFocus
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {suggestions.length > 0 && (
        <ul className="absolute left-0 mt-1 z-50 p-1 shadow menu menu-compact bg-base-100 rounded-box w-48 max-h-40 overflow-y-auto border border-base-200 flex-col flex-nowrap">
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
              <li key={t.id} className="w-full">
                <button
                  type="button"
                  onClick={() => onTagSelected(t.id)}
                  className="flex items-center justify-start text-xs my-0.5 w-full active:bg-base-200"
                >
                  <span
                    className={`badge badge-outline flex items-center ${
                      tagStyle.imageUrl ? 'p-0 px-2' : 'gap-2 py-3 px-2.5'
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
                        className="max-w-[80px] max-h-[22px] object-contain shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <span className="truncate max-w-[120px]">{t.id}</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
