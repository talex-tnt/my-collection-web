import { useState } from 'react';
import {
  useGetPublicUserTagsQuery,
  useUpdateUserItemMutation,
} from '../api/firestore/firestoreApi';
import type { UserTag } from '../api/firestore/services/public/userTags';
import AddTagInput from './AddTagInput'; // Import the newly separated input file

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

  const [updateItem] = useUpdateUserItemMutation();
  const [addTagError, setAddTagError] = useState<string | null>(null);

  // Build a map for fast style lookup, including the new imageUrl field
  const styleMap = userTags.reduce<
    Record<string, NonNullable<UserTag['style']> & { imageUrl?: string | null }>
  >((acc, t) => {
    acc[t.id] = {
      backgroundColor: t.style?.backgroundColor || null,
      foregroundColor: t.style?.foregroundColor || null,
      imageUrl: (t.style as { imageUrl?: string | null })?.imageUrl || null,
    };
    return acc;
  }, {});

  const handleRemoveTag = async (tagToRemove: string) => {
    setAddTagError(null);
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
  };

  return (
    <div className="w-full">
      <div className="flex flex-row flex-wrap gap-2 items-center justify-start">
        {/* RENDER CURRENT ITEM BADGES */}
        {tags && tags.length > 0 ? (
          tags.map((tag) => {
            const style = styleMap[tag] || {
              backgroundColor: null,
              foregroundColor: null,
              imageUrl: null,
            };
            return (
              <span
                key={tag}
                className={
                  'badge badge-outline flex items-center' +
                  (style.imageUrl ? ' p-0 px-2' : ' gap-2 py-3 px-2.5')
                }
                style={{
                  backgroundColor: style.backgroundColor || undefined,
                  color: style.foregroundColor || undefined,
                }}
              >
                {/* RENDER THE IMAGE IF PRESET IN THE TAG DESIGN */}
                {style.imageUrl && (
                  <img
                    src={style.imageUrl}
                    alt=""
                    className="w-20 h-20 object-contain shrink-0"
                    loading="lazy"
                  />
                )}

                {!style.imageUrl && (
                  <span className="truncate max-w-[120px]">{tag}</span>
                )}

                {!readOnly && (
                  <button
                    type="button"
                    className="ml-1 text-xs text-error hover:text-error-content font-bold transition-colors"
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

        {/* REUSABLE INPUT SUB-COMPONENT */}
        {!readOnly && (
          <AddTagInput
            userId={userId}
            itemId={itemId}
            collectionId={collectionId}
            isPublicItem={isPublicItem}
            assignedTags={tags}
            userTags={userTags}
            onTagsChange={onTagsChange}
            onError={setAddTagError}
          />
        )}
      </div>

      {addTagError && (
        <div className="text-xs text-error mt-1 w-full">{addTagError}</div>
      )}
    </div>
  );
}
