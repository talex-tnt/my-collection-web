import { useState, useMemo } from 'react';

import {
  useGetUserWishlistsQuery,
  useCreateUserWishlistMutation,
  useUpdateUserWishlistMutation,
  useDeleteUserWishlistMutation,
} from '../api/firestore/firestoreApi';
import CollapsePanel from './CollapsePanel';
import { type WishlistType } from './Wishlist';
import Wishlist from './Wishlist';

interface WishlistsListProps {
  userId: string;
  isPublicWishlist: boolean;
  readOnly?: boolean;
  onWishlistClick?: (wishlist: WishlistType) => void;
}

// 1. Define sort options
type SortOption = 'name-az' | 'name-za' | 'newest' | 'oldest';

function WishlistsList({
  userId,
  isPublicWishlist,
  readOnly = false,
  onWishlistClick,
}: WishlistsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-az');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const {
    data: wishlistsData,
    isLoading,
    error,
  } = useGetUserWishlistsQuery(
    {
      userId: userId || '',
      isPublicWishlist,
    },
    { skip: !userId }
  );

  const [createWishlist] = useCreateUserWishlistMutation();
  const [updateWishlist] = useUpdateUserWishlistMutation();
  const [deleteWishlist] = useDeleteUserWishlistMutation();

  // 3. MODIFIED: Enhanced useMemo to handle client-side filtering AND sorting
  const filteredAndSortedWishlists = useMemo(() => {
    const wishlists = wishlistsData?.wishlists || [];

    // Filter first
    const filtered = wishlists.filter((col) =>
      col.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort the filtered results
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name-az') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name-za') {
        return b.name.localeCompare(a.name);
      }

      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      if (sortBy === 'newest') {
        return dateB - dateA; // Descending
      }
      if (sortBy === 'oldest') {
        return dateA - dateB; // Ascending
      }

      return 0;
    });
  }, [wishlistsData?.wishlists, searchTerm, sortBy]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || readOnly || !userId) return;

    try {
      await createWishlist({
        userId: userId,
        isPublicWishlist,
        name: newName.trim(),
        description: newDesc.trim(),
      }).unwrap();

      setNewName('');
      setNewDesc('');

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-2">
      {/* REUSABLE COLLAPSIBLE PANEL FOR CREATION */}
      {!readOnly && (
        <CollapsePanel title="Create New Wishlist">
          <form
            onSubmit={handleCreate}
            className="flex flex-col md:flex-row gap-2"
          >
            <input
              type="text"
              placeholder="Wishlist Name"
              maxLength={100}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="input input-sm input-bordered"
              required
            />
            <input
              type="text"
              placeholder="Description (Optional)"
              maxLength={1000}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="input input-sm input-bordered w-full"
            />
            <button type="submit" className="btn btn-sm btn-primary">
              Add
            </button>
          </form>
        </CollapsePanel>
      )}

      {/* COLLECTIONS MANAGEMENT LIST */}
      <CollapsePanel
        title={`${readOnly ? 'Wishlists' : 'My Wishlists'} (${wishlistsData?.wishlists.length || 0})`}
        open
      >
        {/* 4. MODIFIED: Repositioned inputs into a grid flex layout for desktop and mobile alignment */}
        <div className="flex flex-row gap-2 mb-4 w-full max-w-xl">
          <input
            type="text"
            placeholder="Search wishlist by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input input-sm input-bordered flex-grow"
          />

          {/* 5. ADDED: Sorting Selection dropdown menu element */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="select select-sm select-bordered w-36 shrink-0"
          >
            <option value="name-az">Name (Asc.)</option>
            <option value="name-za">Name (Desc.)</option>
            <option value="newest">Most Recent</option>
            <option value="oldest">Least Recent</option>
          </select>
        </div>

        {error ? (
          <div className="alert alert-error">Error loading wishlists</div>
        ) : isLoading ? (
          <div className="alert alert-info">Loading...</div>
        ) : filteredAndSortedWishlists.length === 0 ? (
          <div className="alert alert-info">No wishlists found</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredAndSortedWishlists.map((wishlist) => (
              <Wishlist
                key={wishlist.id}
                wishlist={wishlist}
                userId={userId || ''}
                isPublicWishlist={isPublicWishlist}
                readOnly={readOnly}
                onUpdate={updateWishlist}
                onDelete={deleteWishlist}
                onSelect={onWishlistClick}
              />
            ))}
          </div>
        )}
      </CollapsePanel>
    </div>
  );
}

export default WishlistsList;
