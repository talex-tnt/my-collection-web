import { useState, useMemo } from 'react';

import {
  useGetUserCollectionsQuery,
  useCreateUserCollectionMutation,
  useUpdateUserCollectionMutation,
  useDeleteUserCollectionMutation,
} from '../api/firestore/firestoreApi';
import CollapsePanel from './CollapsePanel';
import { type CollectionType } from './Collection';
import Collection from './Collection';

interface CollectionsListProps {
  userId: string;
  isPublicCollection: boolean;
  readOnly?: boolean;
  onCollectionClick?: (collection: CollectionType) => void;
}

// 1. Define sort options
type SortOption = 'name-az' | 'name-za' | 'newest' | 'oldest';

function CollectionsList({
  userId,
  isPublicCollection,
  readOnly = false,
  onCollectionClick,
}: CollectionsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name-az');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const {
    data: collectionsData,
    isLoading,
    error,
  } = useGetUserCollectionsQuery(
    {
      userId: userId || '',
      isPublicCollection,
    },
    { skip: !userId }
  );

  const [createCollection] = useCreateUserCollectionMutation();
  const [updateCollection] = useUpdateUserCollectionMutation();
  const [deleteCollection] = useDeleteUserCollectionMutation();

  // 3. MODIFIED: Enhanced useMemo to handle client-side filtering AND sorting
  const filteredAndSortedCollections = useMemo(() => {
    const collections = collectionsData?.collections || [];

    // Filter first
    const filtered = collections.filter((col) =>
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
  }, [collectionsData?.collections, searchTerm, sortBy]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || readOnly || !userId) return;

    try {
      await createCollection({
        userId: userId,
        isPublicCollection,
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
        <CollapsePanel title="Create New Collection">
          <form
            onSubmit={handleCreate}
            className="flex flex-col md:flex-row gap-2"
          >
            <input
              type="text"
              placeholder="Collection Name"
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
        title={`My Collections (${collectionsData?.collections.length || 0})`}
        className="collapse-open bg-base-100"
      >
        {/* 4. MODIFIED: Repositioned inputs into a grid flex layout for desktop and mobile alignment */}
        <div className="flex flex-row gap-2 mb-4 w-full max-w-xl">
          <input
            type="text"
            placeholder="Search collection by name..."
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
          <div className="alert alert-error">Error loading collections</div>
        ) : isLoading ? (
          <div className="alert alert-info">Loading...</div>
        ) : filteredAndSortedCollections.length === 0 ? (
          <div className="alert alert-info">No collections found</div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredAndSortedCollections.map((collection) => (
              <Collection
                key={collection.id}
                collection={collection}
                userId={userId || ''}
                isPublicCollection={isPublicCollection}
                readOnly={readOnly}
                onUpdate={updateCollection}
                onDelete={deleteCollection}
                onSelect={onCollectionClick}
              />
            ))}
          </div>
        )}
      </CollapsePanel>
    </div>
  );
}

export default CollectionsList;
