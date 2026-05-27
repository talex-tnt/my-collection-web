import { useState } from 'react';
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

  const handleAddTag = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAddTagError(null);
    const tag = newTag.trim();
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
          isPublicItem, // Ensure the item is treated as public for tag updates
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

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = tags.filter((t) => t !== tagToRemove);
    try {
      await updateItem({
        id: itemId,
        userId,
        updates: { tags: updatedTags },
        isPublicItem, // Ensure the item is treated as public for tag updates
        collectionId,
      }).unwrap();
      onTagsChange?.(updatedTags);
    } catch (err: unknown) {
      setAddTagError(
        (err as { message?: string })?.message || 'Failed to remove tag'
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
            <form
              className="flex gap-2 items-center"
              onSubmit={handleAddTag}
              tabIndex={-1}
            >
              <input
                type="text"
                className="input input-xs input-bordered"
                placeholder="Add tag"
                value={newTag}
                autoFocus
                onChange={(e) => setNewTag(e.target.value)}
                onBlur={() => setTimeout(() => setShowAddTag(false), 100)}
                list={`tag-suggestions-${itemId}`}
              />
              <datalist id={`tag-suggestions-${itemId}`}>
                {userTags.map((t) => (
                  <option key={t.id} value={t.id} />
                ))}
              </datalist>
            </form>
          ) : (
            <button
              type="button"
              className="btn btn-xs btn-circle btn-outline flex items-center justify-center "
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
}
