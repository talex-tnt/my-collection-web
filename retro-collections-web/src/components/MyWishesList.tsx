import { useMemo, useState } from 'react';
import {
  useGetUserWishesQuery,
  useGetUserWishesCountQuery,
} from '../api/firestore/firestoreApi';
import { FiEdit as FiLock, FiEdit2 as FiUnlock } from 'react-icons/fi';
import MyWishListItem from './MyWishListItem';
import ExportListButton, {
  type ExportJsonMetadata,
  type ExportRow,
} from './ExportListButton';

interface MyWishesListProps {
  user: { uid: string } | null;
  wishNameClientFilter: string;
  selectedWishTags: string[];
  isPublicWish: boolean;
  startWithNameFilter: string;
  nameContainsTokens: string;
  wishlistId?: string;
  wishlistName?: string;
}

function MyWishesList({
  user,
  wishNameClientFilter,
  selectedWishTags,
  isPublicWish,
  startWithNameFilter,
  nameContainsTokens,
  wishlistId,
  wishlistName,
}: MyWishesListProps) {
  const [editing, setEditing] = useState(false);

  const { data: totalCount = 0 } = useGetUserWishesCountQuery(
    {
      userId: user?.uid || '',
      tags: selectedWishTags.length ? selectedWishTags : undefined,
      startWithNameFilter: startWithNameFilter || undefined,
      nameContainsTokens: nameContainsTokens || undefined,
      isPublicWish,
      wishlistId,
    },
    {
      skip: !user?.uid,
    }
  );

  const {
    data: wishesData,
    isLoading,
    error,
  } = useGetUserWishesQuery(
    {
      userId: user?.uid || '',
      tags: selectedWishTags.length ? selectedWishTags : undefined,
      isPublicWish,
      startWithNameFilter: startWithNameFilter || undefined,
      nameContainsTokens: nameContainsTokens || undefined,
      wishlistId,
    },
    { skip: !user?.uid }
  );

  const wishes = (wishesData?.wishes || []).filter((wish) =>
    wish.name.toLowerCase().includes(wishNameClientFilter.toLowerCase())
  );

  const allWishes = wishesData?.wishes || [];

  const toExportRow = (wish: {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    wishlistId?: string;
    isPublic: boolean;
    createdAt: string;
    updatedAt?: string;
    metadata?: {
      imageFolder?: { id?: string; name?: string };
      previewImage?: { id?: string; name?: string };
    };
  }): ExportRow => ({
    id: wish.id,
    title: wish.name,
    description: wish.description || '',
    tags: wish.tags || [],
    wishlistId: wish.wishlistId || '',
    visibility: wish.isPublic ? 'public' : 'private',
    createdAt: wish.createdAt,
    updatedAt: wish.updatedAt || '',
    imageFolderId: wish.metadata?.imageFolder?.id || '',
    imageFolderName: wish.metadata?.imageFolder?.name || '',
    previewImageId: wish.metadata?.previewImage?.id || '',
    previewImageName: wish.metadata?.previewImage?.name || '',
  });

  const exportVisibleRows = useMemo(() => wishes.map(toExportRow), [wishes]);
  const exportAllRows = useMemo(() => allWishes.map(toExportRow), [allWishes]);

  const hasExportFilters =
    selectedWishTags.length > 0 ||
    Boolean(startWithNameFilter) ||
    Boolean(nameContainsTokens) ||
    Boolean(wishNameClientFilter);

  const exportAppliedFilters: Record<string, unknown> = {
    ...(selectedWishTags.length > 0 ? { tags: selectedWishTags } : {}),
    ...(startWithNameFilter ? { startsWith: startWithNameFilter } : {}),
    ...(nameContainsTokens ? { containsTokens: nameContainsTokens } : {}),
    ...(wishNameClientFilter ? { clientNameContains: wishNameClientFilter } : {}),
  };

  const exportJsonMetadata: ExportJsonMetadata = {
    listContext: {
      type: wishlistId ? 'wishlist' : 'spare',
      wishlist: wishlistId ? { id: wishlistId, name: wishlistName } : undefined,
      isSparseList: !wishlistId,
      visibility: isPublicWish ? 'public' : 'private',
    },
    isFiltered: hasExportFilters,
    appliedFilters: exportAppliedFilters,
    pagination: {
      page: 1,
      limit: 'all',
    },
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex items-center justify-between gap-2">
          <h2 className="card-title">Wishes ({totalCount})</h2>
          <div className="flex items-center gap-2">
            <button
              className={`btn btn-xs ${editing ? 'btn-primary' : ''}`}
              onClick={() => setEditing((previous) => !previous)}
              title={editing ? 'Disable editing' : 'Enable editing'}
            >
              {editing ? (
                <FiUnlock className="inline-block m-1" title="Editing" />
              ) : (
                <FiLock className="inline-block m-1" title="Reading" />
              )}
            </button>
            <ExportListButton
              entityLabel="wishes"
              visibleRows={exportVisibleRows}
              allRows={exportAllRows}
              defaultBaseName={wishlistName || 'wishes'}
              jsonMetadata={exportJsonMetadata}
              fieldOrder={[
                'title',
                'description',
                'tags',
                'wishlistId',
                'visibility',
                'createdAt',
                'updatedAt',
                'imageFolderId',
                'imageFolderName',
                'previewImageId',
                'previewImageName',
                'id',
              ]}
              fieldLabels={{
                title: 'Title',
                description: 'Description',
                tags: 'Tags',
                wishlistId: 'Wishlist ID',
                visibility: 'Visibility',
                createdAt: 'Created At',
                updatedAt: 'Updated At',
                imageFolderId: 'Image Folder ID',
                imageFolderName: 'Image Folder Name',
                previewImageId: 'Preview Image ID',
                previewImageName: 'Preview Image Name',
                id: 'Wish ID',
              }}
            />
          </div>
        </div>
        {error ? (
          <div className="alert alert-error">Error loading wishes</div>
        ) : null}
        {isLoading ? <div className="alert alert-info">Loading...</div> : null}
        {!isLoading && wishes.length === 0 ? (
          <div className="alert alert-info">No wishes found</div>
        ) : null}
        <div className="space-y-2">
          {wishes.map((wish) => (
            <MyWishListItem
              key={wish.id}
              wish={wish}
              userId={user?.uid || ''}
              showTags
              isPublicWish={isPublicWish}
              wishlistId={wishlistId}
              readonly={!editing}
              showPreview
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default MyWishesList;
