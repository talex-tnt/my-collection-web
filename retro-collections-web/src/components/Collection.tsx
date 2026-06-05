import { useState } from 'react';
import {
  FiEdit2 as FiEdit,
  FiTrash2 as FiTrash,
  FiRefreshCw as RefreshCw,
} from 'react-icons/fi';

// Hook imported to resolve item counters using Firestore server aggregation
import {
  useDeleteUserCollectionMutation,
  useGetUserItemsCountQuery,
  useInjectCollectionIdIntoItemsMutation,
  useUpdateUserCollectionMutation,
} from '../api/firestore/firestoreApi';

export interface CollectionType {
  id: string;
  name: string;
  userId: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  tags?: string[];
  itemsCount?: number;
  items?: unknown[];
}

interface CollectionProps {
  collection: CollectionType;
  userId: string;
  isPublicCollection: boolean;
  readOnly: boolean;
  onUpdate: ReturnType<typeof useUpdateUserCollectionMutation>[0];
  onDelete: ReturnType<typeof useDeleteUserCollectionMutation>[0];
  onSelect?: (collection: CollectionType) => void;
}

function Collection({
  collection,
  userId,
  isPublicCollection,
  readOnly,
  onUpdate,
  onDelete,
  onSelect,
}: CollectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(collection.name);
  const [editDesc, setEditDesc] = useState(collection.description || '');

  // Fetch the real count of items belonging specifically to this collection via getCountFromServer()
  const { data: realItemCount = 0, isLoading: isLoadingCount } =
    useGetUserItemsCountQuery(
      {
        userId,
        isPublicItem: isPublicCollection,
        collectionId: collection.id,
      },
      { skip: !userId || !collection.id }
    );

  const [injectCollectionId] = useInjectCollectionIdIntoItemsMutation();

  const handleSave = async () => {
    if (readOnly) return;
    if (
      editName.trim() === collection.name &&
      editDesc.trim() === (collection.description || '')
    ) {
      setIsEditing(false);
      return;
    }
    if (!editName.trim()) return;

    try {
      await onUpdate({
        id: collection.id,
        userId,
        isPublicCollection,
        updates: {
          name: editName.trim(),
          description: editDesc.trim(),
        },
      }).unwrap();
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(collection.name);
      setEditDesc(collection.description || '');
      setIsEditing(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    if (window.confirm(`Delete collection "${collection.name}"?`)) {
      try {
        await onDelete({
          id: collection.id,
          userId,
          isPublicCollection,
        }).unwrap();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleSync = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Invalidate the getUserItemsCountQuery cache for this collection to trigger a refetch of the real count from Firestore
      injectCollectionId({
        userId,
        isPublicItem: isPublicCollection,
        collectionId: collection.id,
      }).unwrap();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      onClick={() => !isEditing && onSelect?.(collection)}
      className={`flex items-center justify-between p-3 bg-base-200 rounded-lg hover:bg-base-300 transition-colors group ${
        isEditing ? 'cursor-default' : 'cursor-pointer'
      }`}
    >
      <div className="flex-1 min-w-0 pr-4 select-none">
        {isEditing ? (
          <div
            className="flex flex-col gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={editName}
              maxLength={100}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input input-xs input-bordered w-full max-w-xs focus:input-primary"
              autoFocus
            />
            <input
              type="text"
              value={editDesc}
              maxLength={1000}
              onChange={(e) => setEditDesc(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input input-xs input-bordered w-full max-w-md"
              placeholder="Description..."
            />
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn btn-xs btn-success">
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="btn btn-xs btn-ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Flex container prevents formatting linebreaks between name and counter */}
            <div className="font-bold truncate text-sm flex items-center gap-1.5">
              <span>{collection.name}</span>

              {/* Show a mini loading spinner while the API fetches the real item counter */}
              {isLoadingCount ? (
                <span className="loading loading-spinner loading-xs opacity-30"></span>
              ) : (
                <span className="text-xs font-normal opacity-50 whitespace-nowrap">
                  ({realItemCount})
                </span>
              )}
            </div>
            <div className="text-xs opacity-60 truncate">
              {collection.description || (
                <span className="italic opacity-40">No description</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!readOnly && !isEditing && (
          <>
            <button
              onClick={handleEditClick}
              className="btn btn-xs btn-secondary btn-ghost group-hover:opacity-100"
            >
              <FiEdit className="h-5 w-5" />
            </button>

            <button
              onClick={handleDelete}
              className="btn btn-xs btn-error btn-ghost group-hover:opacity-100"
            >
              <FiTrash className="h-5 w-5" />
            </button>
            <button
              onClick={handleSync}
              className="btn btn-xs btn-error btn-ghost group-hover:opacity-100"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
export default Collection;
