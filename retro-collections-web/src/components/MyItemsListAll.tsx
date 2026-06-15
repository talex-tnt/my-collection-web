import { useState, useEffect } from 'react';
import {
  useGetAllUserItemsCountQuery,
  useGetAllUserItemsQuery,
  useBatchDeleteUserItemsMutation,
} from '../api/firestore/firestoreApi';

import { useSettingsUIPageSize } from '../utils/hooks';
import MyItemsListMarkup from './MyItemsListMarkup';

interface Cursor {
  createdAt: string;
  id: string;
}

interface MyItemsListProps {
  user: { uid: string } | null;
  itemNameClientFilter: string;
  selectedTags: string[];
  startWithNameFilter: string;
  nameContainsTokens: string;
}

function MyItemsListAll({
  user,
  itemNameClientFilter,
  selectedTags,
  startWithNameFilter,
  nameContainsTokens,
}: MyItemsListProps) {
  const [pageSize, setPageSize, pageOptions] = useSettingsUIPageSize();

  const [showTags, setShowTags] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [editing, setEditing] = useState(false);

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const [batchDeleteUserItems, { isLoading: isDeleting }] =
    useBatchDeleteUserItemsMutation();

  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageIndex]);
  const [cursors, setCursors] = useState<(Cursor | null)[]>([null]);

  const currentCursor = cursors[pageIndex];
  const isAll = pageSize === 'all';

  const { data: totalCount = 0 } = useGetAllUserItemsCountQuery(
    {
      userId: user?.uid || '',
      tags: selectedTags.length ? selectedTags : undefined,
      startWithNameFilter: startWithNameFilter || undefined,
      nameContainsTokens: nameContainsTokens || undefined,
    },
    {
      skip: !user?.uid,
    }
  );

  const {
    data: itemsData,
    isLoading,
    error,
  } = useGetAllUserItemsQuery(
    {
      userId: user?.uid || '',
      tags: selectedTags.length ? selectedTags : undefined,
      limit: isAll ? undefined : pageSize,
      startAfter: currentCursor,
      startWithNameFilter: startWithNameFilter || undefined,
      nameContainsTokens: nameContainsTokens || undefined,
    },
    { skip: !user?.uid }
  );
  // console.log('Fetched itemsData for MyItemsListAll:', itemsData, totalCount);
  const items = (itemsData?.items || []).filter((item) =>
    item.name.toLowerCase().includes(itemNameClientFilter.toLowerCase())
  );
  const pageInfo = itemsData?.pageInfo;

  useEffect(() => {
    if (!pageInfo?.endCursor) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCursors((prev) => {
      const next = [...prev];
      if (Number.isInteger(pageIndex) && pageInfo.endCursor) {
        next[pageIndex + 1] = pageInfo.endCursor as Cursor;
      }
      return next;
    });
  }, [pageInfo?.endCursor, pageIndex]);

  const handleBulkDelete = async () => {
    if (!user?.uid || selectedItemIds.length === 0) return;

    const selectedItems = items.filter((item) =>
      selectedItemIds.includes(item.id)
    );

    if (selectedItems.length === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the ${selectedItems.length} selected item(s)?`
    );
    if (!confirmDelete) return;

    try {
      const groups = new Map<
        string,
        { itemIds: string[]; isPublicItem: boolean; collectionId?: string }
      >();

      selectedItems.forEach((item) => {
        const key = `${item.isPublic ? 'public' : 'private'}::${
          item.collectionId || ''
        }`;

        const existing = groups.get(key);
        if (existing) {
          existing.itemIds.push(item.id);
          return;
        }

        groups.set(key, {
          itemIds: [item.id],
          isPublicItem: item.isPublic,
          collectionId: item.collectionId,
        });
      });

      await Promise.all(
        Array.from(groups.values()).map((group) =>
          batchDeleteUserItems({
            itemIds: group.itemIds,
            userId: user.uid,
            isPublicItem: group.isPublicItem,
            collectionId: group.collectionId,
          }).unwrap()
        )
      );

      setSelectedItemIds([]);
    } catch (err) {
      console.error('Failed to complete batch deletion request:', err);
    }
  };

  return (
    <div className="space-y-4">
      {editing && selectedItemIds.length > 0 && (
        <div className="alert alert-warning shadow-lg flex flex-row justify-between items-center py-2 px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {selectedItemIds.length} item(s) selected
            </span>
          </div>
          <button
            className={`btn btn-error btn-sm ${isDeleting ? 'loading' : ''}`}
            onClick={handleBulkDelete}
            disabled={isDeleting}
          >
            Delete Selected
          </button>
        </div>
      )}

      <MyItemsListMarkup
        user={user}
        collectionId={undefined}
        totalCount={totalCount}
        setShowTags={setShowTags}
        setShowPreview={setShowPreview}
        editing={editing}
        setEditing={setEditing}
        showTags={showTags}
        showPreview={showPreview}
        items={items}
        isLoading={isLoading}
        error={error}
        pageIndex={pageIndex}
        setPageIndex={setPageIndex}
        pageInfo={pageInfo}
        pageSize={pageSize}
        setPageSize={setPageSize}
        pageOptions={pageOptions}
        isAll={isAll}
        setCursors={setCursors}
        selectedItemIds={selectedItemIds}
        onSelectionChange={setSelectedItemIds}
      />
    </div>
  );
}

export default MyItemsListAll;
