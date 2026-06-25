import { useState } from 'react';
import {
  useGetPublicUserTagsQuery,
  useUpdateUserItemMutation,
} from '../api/firestore/firestoreApi';
import type { UserTag } from '../api/firestore/services/public/userTags';
import AddUserTag from './AddUserTag';
import TagBadge from './TagBadge'; // Import the new component

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

  // Build a map for fast style lookup
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

  const sortedTags = [...tags].sort((a, b) => {
    const orderA = userTags.find((t) => t.id === a)?.order ?? 0;
    const orderB = userTags.find((t) => t.id === b)?.order ?? 0;
    return orderA - orderB;
  });

  const fallbackStyle = {
    backgroundColor: null,
    foregroundColor: null,
    imageUrl: null,
  };

  return (
    <div className="w-full">
      <div className="flex flex-row flex-wrap gap-2 items-center justify-start">
        {/* RENDER CURRENT ITEM BADGES */}
        {sortedTags && sortedTags.length > 0 ? (
          sortedTags.map((tag) => (
            <TagBadge
              key={tag}
              tag={tag}
              style={styleMap[tag] || fallbackStyle}
              readOnly={readOnly}
              onRemove={handleRemoveTag}
            />
          ))
        ) : (
          <span className="text-xs text-base-content/50 italic">No tags</span>
        )}

        {/* REUSABLE INPUT SUB-COMPONENT */}
        {!readOnly && (
          <AddUserTag
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
