import { useState, useRef, useEffect } from 'react';
import {
  useCreatePublicUserTagMutation,
  useUpdateUserItemMutation,
} from '../api/firestore/firestoreApi';
import type { UserTag } from '../api/firestore/services/public/userTags';

interface AddTagInputProps {
  userId: string;
  itemId?: string;
  collectionId?: string;
  isPublicItem: boolean;
  assignedTags: string[];
  userTags: UserTag[];
  onTagsChange?: (tags: string[]) => void;
  onError: (message: string | null) => void;
}

export default function AddTagInput({
  userId,
  itemId,
  collectionId,
  isPublicItem,
  assignedTags,
  userTags,
  onTagsChange,
  onError,
}: AddTagInputProps) {
  const [createTag] = useCreatePublicUserTagMutation();
  const [updateItem] = useUpdateUserItemMutation();

  const [newTag, setNewTag] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking anywhere outside of this component
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

  const handleAddTag = async (tagValue?: string) => {
    onError(null);

    const tag = (tagValue || newTag).trim();
    if (!tag) return;

    const tagExists = userTags.some(
      (t) => t.id.toLowerCase() === tag.toLowerCase()
    );

    try {
      // Only hit the Firestore database tag list if the tag doesn't exist globally yet
      if (!tagExists) {
        await createTag({ userId, tag }).unwrap();
      }

      // Update local item tags array if it isn't assigned yet
      if (!assignedTags.includes(tag)) {
        const updatedTags = [...assignedTags, tag];

        // Only trigger item document update if we are working on an existing item profile
        if (itemId) {
          await updateItem({
            id: itemId,
            userId,
            updates: { tags: updatedTags },
            isPublicItem,
            collectionId,
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

  // Intercept keydown event to override standard form submission triggers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Stop parent <form onSubmit> execution hook
      handleAddTag(); // Trigger our custom tag validation sequence instead
    }
  };

  // Filters dropdown items to a single column matching the query string
  const unassignedSuggestions = userTags.filter(
    (t) =>
      !assignedTags.includes(t.id) &&
      t.id.toLowerCase().includes(newTag.toLowerCase())
  );

  if (showAddTag) {
    return (
      <div ref={containerRef} className="relative inline-block text-left">
        {/* Changed wrapper from a <form> to a simple block div to eliminate nested form validation warnings */}
        <div className="flex gap-2 items-center">
          <input
            type="text"
            className="input input-xs input-bordered"
            placeholder="Add tag"
            value={newTag}
            autoFocus
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleKeyDown} // Intercepts the Enter keypress safely
          />
        </div>

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
                        backgroundColor: tagStyle.backgroundColor || undefined,
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
