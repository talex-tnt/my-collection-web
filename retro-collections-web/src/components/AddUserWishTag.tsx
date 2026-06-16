import { useEffect, useRef, useState } from 'react';
import {
  useCreatePublicUserTagMutation,
  useUpdateUserWishMutation,
} from '../api/firestore/firestoreApi';
import type { UserTag } from '../api/firestore/services/public/userTags';
import SelectTag from './SelectTag';

interface AddUserWishTagProps {
  userId: string;
  wishId?: string;
  wishlistId?: string;
  isPublicWish: boolean;
  assignedTags: string[];
  userTags: UserTag[];
  onTagsChange?: (tags: string[]) => void;
  onError: (message: string | null) => void;
}

export default function AddUserWishTag({
  userId,
  wishId,
  wishlistId,
  isPublicWish,
  assignedTags,
  userTags,
  onTagsChange,
  onError,
}: AddUserWishTagProps) {
  const [createTag] = useCreatePublicUserTagMutation();
  const [updateWish] = useUpdateUserWishMutation();

  const [newTag, setNewTag] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowAddTag(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = async (tagValue?: string) => {
    onError(null);

    const tag = (tagValue || newTag).trim();
    if (!tag) return;

    const tagExists = userTags.some(
      (userTag) => userTag.id.toLowerCase() === tag.toLowerCase()
    );

    try {
      if (!tagExists) {
        await createTag({ userId, tag }).unwrap();
      }

      if (!assignedTags.includes(tag)) {
        const updatedTags = [...assignedTags, tag];

        if (wishId) {
          await updateWish({
            id: wishId,
            userId,
            updates: { tags: updatedTags },
            isPublicWish,
            wishlistId,
          }).unwrap();
        }

        onTagsChange?.(updatedTags);
      }

      setNewTag('');
      setShowAddTag(false);
    } catch (err: unknown) {
      onError((err as { message?: string })?.message || 'Failed to add tag');
    }
  };

  const unassignedSuggestions = userTags.filter(
    (userTag) =>
      !assignedTags.includes(userTag.id) &&
      userTag.id.toLowerCase().includes(newTag.toLowerCase())
  );

  if (showAddTag) {
    return (
      <div ref={containerRef} className="relative inline-block text-left">
        <SelectTag
          inputValue={newTag}
          onInputChange={setNewTag}
          suggestions={unassignedSuggestions}
          onTagSelected={handleAddTag}
          onEnterPress={() => handleAddTag()}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-xs btn-circle btn-outline flex items-center justify-center"
      aria-label="Add tag"
      onClick={() => setShowAddTag(true)}
      tabIndex={0}
    >
      <span className="text-lg leading-none h-5">+</span>
    </button>
  );
}
