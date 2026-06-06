import { useState, useRef, useEffect } from 'react';
import type { UserTag } from '../api/firestore/services/public/userTags';
import SelectTag from './SelectTag';

interface SelectTagsProps {
  selectedTags: string[];
  userTags: UserTag[];
  onSelectedTagsChange: (tags: string[]) => void;
}

export default function SelectTags({
  selectedTags,
  userTags,
  onSelectedTagsChange,
}: SelectTagsProps) {
  const [showAddTag, setShowAddTag] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowAddTag(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = selectedTags.filter((t) => t !== tagToRemove);
    onSelectedTagsChange(updatedTags);
  };

  const handleAddTag = (tagId?: string) => {
    const tagToAdd = (tagId || searchQuery).trim();
    if (!tagToAdd) return;

    if (!selectedTags.includes(tagToAdd)) {
      const updatedTags = [...selectedTags, tagToAdd];
      onSelectedTagsChange(updatedTags);
    }

    setSearchQuery('');
    setShowAddTag(false);
  };

  const unassignedSuggestions = userTags.filter(
    (t) =>
      !selectedTags.includes(t.id) &&
      t.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedTags.length > 0 && (
        <button
          type="button"
          className="btn btn-xs ml-2"
          onClick={() => onSelectedTagsChange([])}
        >
          Clear
        </button>
      )}
      {selectedTags.map((tagId) => {
        const matchedTag = userTags.find((t) => t.id === tagId);
        const tagStyle = matchedTag?.style || {
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
          <span
            key={tagId}
            className={`badge badge-outline flex items-center gap-1 pl-2 pr-1 py-3 ${
              tagStyle.imageUrl ? 'h-7' : ''
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
                className="max-w-[60px] max-h-[18px] object-contain shrink-0"
                loading="lazy"
              />
            ) : (
              <span className="truncate max-w-[100px] text-xs">{tagId}</span>
            )}

            <button
              type="button"
              onClick={() => handleRemoveTag(tagId)}
              className="btn btn-ghost btn-xs btn-circle h-4 w-4 min-h-0 p-0 hover:bg-black/20 text-current flex items-center justify-center font-bold text-[10px]"
              aria-label={`Remove ${tagId}`}
            >
              ✕
            </button>
          </span>
        );
      })}

      {showAddTag ? (
        <div ref={containerRef} className="relative inline-block text-left">
          <SelectTag
            inputValue={searchQuery}
            onInputChange={setSearchQuery}
            suggestions={unassignedSuggestions}
            onTagSelected={handleAddTag}
            onEnterPress={() => handleAddTag()}
          />
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-xs btn-circle btn-outline flex items-center justify-center"
          aria-label="Add tag to selection"
          onClick={() => setShowAddTag(true)}
        >
          <span className="text-lg leading-none h-5">+</span>
        </button>
      )}
    </div>
  );
}
