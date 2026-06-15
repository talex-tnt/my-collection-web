import { useState } from 'react';
import {
  FiEdit2 as FiEdit,
  FiTrash2 as FiTrash,
  FiRefreshCw as RefreshCw,
} from 'react-icons/fi';

// Hook imported to resolve item counters using Firestore server aggregation
import {
  useDeleteUserWishlistMutation,
  useGetUserWishesCountQuery,
  useInjectWishlistIdIntoWishesMutation,
  useUpdateUserWishlistMutation,
} from '../api/firestore/firestoreApi';

export interface WishlistType {
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

interface WishlistProps {
  wishlist: WishlistType;
  userId: string;
  isPublicWishlist: boolean;
  readOnly: boolean;
  onUpdate: ReturnType<typeof useUpdateUserWishlistMutation>[0];
  onDelete: ReturnType<typeof useDeleteUserWishlistMutation>[0];
  onSelect?: (wishlist: WishlistType) => void;
}

function Wishlist({
  wishlist,
  userId,
  isPublicWishlist,
  readOnly,
  onUpdate,
  onDelete,
  onSelect,
}: WishlistProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(wishlist.name);
  const [editDesc, setEditDesc] = useState(wishlist.description || '');

  // Fetch the real count of items belonging specifically to this wishlist via getCountFromServer()
  const { data: realItemCount = 0, isLoading: isLoadingCount } =
    useGetUserWishesCountQuery(
      {
        userId,
        isPublicWish: isPublicWishlist,
        wishlistId: wishlist.id,
      },
      { skip: !userId || !wishlist.id }
    );

  const [injectWishlistId] = useInjectWishlistIdIntoWishesMutation();

  const handleSave = async () => {
    if (readOnly) return;
    if (
      editName.trim() === wishlist.name &&
      editDesc.trim() === (wishlist.description || '')
    ) {
      setIsEditing(false);
      return;
    }
    if (!editName.trim()) return;

    try {
      await onUpdate({
        id: wishlist.id,
        userId,
        isPublicWishlist,
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
      setEditName(wishlist.name);
      setEditDesc(wishlist.description || '');
      setIsEditing(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (readOnly) return;
    if (window.confirm(`Delete wishlist "${wishlist.name}"?`)) {
      try {
        await onDelete({
          id: wishlist.id,
          userId,
          isPublicWishlist,
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
      // Invalidate the getUserItemsCountQuery cache for this wishlist to trigger a refetch of the real count from Firestore
      injectWishlistId({
        userId,
        isPublicWish: isPublicWishlist,
        wishlistId: wishlist.id,
      }).unwrap();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      onClick={() => !isEditing && onSelect?.(wishlist)}
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
              <span>{wishlist.name}</span>

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
              {wishlist.description || (
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
export default Wishlist;
