import { useState, useRef, useEffect } from 'react';
import {
  useGetPublicUserTagsQuery,
  useCreatePublicUserTagMutation,
  useUpdateUserItemMutation,
} from '../api/firestore/firestoreApi';
import type { UserTag } from '../api/firestore/services/public/userTags';

interface TagsProps {
  userId: string;
  itemId: string;
  collectionId?: string;
  isPublicItem: boolean;
  tags: string[];
  onTagsChange?: (tags: string[]) => void;
  readOnly?: boolean;
}

export default function Tags({
  userId,
  itemId,
  collectionId,
  isPublicItem,
  tags = [],
  onTagsChange,
  readOnly = false,
}: TagsProps) {
  const { data: userTags = [] } = useGetPublicUserTagsQuery(
    { userId },
    { skip: !userId }
  );
  const [createTag] = useCreatePublicUserTagMutation();
  const [updateItem] = useUpdateUserItemMutation();
  const [newTag, setNewTag] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [addTagError, setAddTagError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close the custom dropdown when clicking outside the input or menu container
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

  const handleAddTag = async (tagValue?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAddTagError(null);

    const tag = (tagValue || newTag).trim();
    if (!tag) return;

    const tagExists = userTags.some(
      (t) => t.id.toLowerCase() === tag.toLowerCase()
    );

    try {
      if (!tagExists) {
        await createTag({ userId, tag }).unwrap();
      }
      if (!tags.includes(tag)) {
        const updatedTags = [...tags, tag];
        await updateItem({
          id: itemId,
          userId,
          updates: { tags: updatedTags },
          isPublicItem,
          collectionId,
        }).unwrap();
        onTagsChange?.(updatedTags);
      }
      setNewTag('');
      setShowAddTag(false);
    } catch (err: unknown) {
      setAddTagError(
        (err as { message?: string })?.message || 'Failed to add tag'
      );
    }
  };

  // Build a map for fast style lookup
  const styleMap = userTags.reduce<Record<string, UserTag['style']>>(
    (acc, t) => {
      acc[t.id] = t.style || {
        backgroundColor: null,
        foregroundColor: null,
      };
      return acc;
    },
    {}
  );

  // Filter out suggestions that are already assigned to this item
  const unassignedSuggestions = userTags.filter(
    (t) =>
      !tags.includes(t.id) && t.id.toLowerCase().includes(newTag.toLowerCase())
  );

  return (
    <div className="w-full">
      <div className="flex flex-row flex-wrap gap-2 items-center justify-start">
        {tags && tags.length > 0 ? (
          tags.map((tag) => {
            const style = styleMap[tag] || {
              backgroundColor: null,
              foregroundColor: null,
            };
            return (
              <span
                key={tag}
                className="badge badge-outline flex items-center gap-1"
                style={{
                  backgroundColor: style.backgroundColor || undefined,
                  color: style.foregroundColor || undefined,
                }}
              >
                {tag}
                {!readOnly && (
                  <button
                    type="button"
                    className="ml-1 text-xs text-error hover:text-error-content"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => handleRemoveTag(tag)}
                    tabIndex={0}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })
        ) : (
          <span className="text-xs text-base-content/50 italic">No tags</span>
        )}

        {!readOnly &&
          (showAddTag ? (
            <div ref={containerRef} className="relative inline-block text-left">
              <form
                className="flex gap-2 items-center"
                onSubmit={(e) => handleAddTag(undefined, e)}
              >
                <input
                  type="text"
                  className="input input-xs input-bordered"
                  placeholder="Add tag"
                  value={newTag}
                  autoFocus
                  onChange={(e) => setNewTag(e.target.value)}
                />
              </form>

              {/* Custom styled suggestion dropdown menu */}
              {unassignedSuggestions.length > 0 && (
                <ul className="absolute left-0 mt-1 z-50 p-1 shadow menu menu-compact bg-base-100 rounded-box w-48 max-h-40 overflow-y-auto border border-base-200 flex-col flex-nowrap">
                  {unassignedSuggestions.map((t) => {
                    const tagStyle = t.style || {
                      backgroundColor: null,
                      foregroundColor: null,
                    };
                    return (
                      <li key={t.id} className="w-full">
                        <button
                          type="button"
                          onClick={() => handleAddTag(t.id)}
                          className="flex items-center justify-start text-xs my-0.5 w-full active:bg-base-200"
                        >
                          <span
                            className="badge badge-outline truncate w-full justify-start block text-left"
                            style={{
                              backgroundColor:
                                tagStyle.backgroundColor || undefined,
                              color: tagStyle.foregroundColor || undefined,
                            }}
                          >
                            {t.id}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-xs btn-circle btn-outline flex items-center justify-center"
              aria-label="Add tag"
              onClick={() => setShowAddTag(true)}
              tabIndex={0}
            >
              <span className="text-lg leading-none h-5">+</span>
            </button>
          ))}
      </div>
      {addTagError && (
        <div className="text-xs text-error mt-1 w-full">{addTagError}</div>
      )}
    </div>
  );

  async function handleRemoveTag(tagToRemove: string) {
    const updatedTags = tags.filter((t) => t !== tagToRemove);
    try {
      await updateItem({
        id: itemId,
        userId,
        updates: { tags: updatedTags },
        isPublicItem,
        collectionId,
      }).unwrap();
      onTagsChange?.(updatedTags);
    } catch (err: unknown) {
      setAddTagError(
        (err as { message?: string })?.message || 'Failed to remove tag'
      );
    }
  }
}
