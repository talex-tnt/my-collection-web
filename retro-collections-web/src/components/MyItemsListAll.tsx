import { useState, useEffect } from 'react';
import {
  useGetAllUserItemsCountQuery,
  useGetAllUserItemsQuery,
  useBatchDeleteUserItemsMutation,
} from '../api/firestore/firestoreApi';

import { useSettingsUIPageSize } from '../utils/hooks';
import MyItemsListMarkup from './MyItemsListMarkup';
import BulkDeleteFeedbackToast from './BulkDeleteFeedbackToast';

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

interface SelectedItem {
  id: string;
  isPublicItem: boolean;
  collectionId?: string;
}

interface DeleteProgress {
  active: boolean;
  completed: number;
  total: number;
}

interface BulkDeleteNotice {
  type: 'success' | 'error' | null;
  message: string;
}

const normalizeCollectionId = (collectionId?: string) => {
  const normalized = collectionId?.trim();
  if (!normalized || normalized === 'null' || normalized === 'undefined') {
    return undefined;
  }
  return normalized;
};

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

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [deleteProgress, setDeleteProgress] = useState<DeleteProgress>({
    active: false,
    completed: 0,
    total: 0,
  });
  const [bulkDeleteNotice, setBulkDeleteNotice] = useState<BulkDeleteNotice>({
    type: null,
    message: '',
  });

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

  useEffect(() => {
    if (bulkDeleteNotice.type !== 'success') return;

    const timeoutId = window.setTimeout(() => {
      setBulkDeleteNotice({ type: null, message: '' });
    }, 3500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [bulkDeleteNotice.type]);

  const selectedItemIds = selectedItems.map((item) => item.id);

  const handleSelectionChange = (selectedIds: string[]) => {
    const currentItemsById = new Map<string, SelectedItem>(
      items.map((item) => [
        item.id,
        {
          id: item.id,
          isPublicItem: item.isPublic,
          collectionId: normalizeCollectionId(item.collectionId),
        },
      ])
    );

    setSelectedItems((previous) => {
      const previousById = new Map(previous.map((item) => [item.id, item]));

      return selectedIds
        .map((id) => currentItemsById.get(id) || previousById.get(id))
        .filter((item): item is SelectedItem => Boolean(item));
    });
  };

  const handleBulkDelete = async () => {
    if (!user?.uid || selectedItems.length === 0) return;

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
        const normalizedCollectionId = normalizeCollectionId(item.collectionId);
        const key = `${item.isPublicItem ? 'public' : 'private'}::${
          normalizedCollectionId || ''
        }`;

        const existing = groups.get(key);
        if (existing) {
          existing.itemIds.push(item.id);
          return;
        }

        groups.set(key, {
          itemIds: [item.id],
          isPublicItem: item.isPublicItem,
          collectionId: normalizedCollectionId,
        });
      });

      const groupedRequests = Array.from(groups.values());
      const totalItems = selectedItems.length;
      let completedItems = 0;
      let deletedItems = 0;
      const failedItemIds = new Set<string>();

      setDeleteProgress({
        active: true,
        completed: 0,
        total: totalItems,
      });
      setBulkDeleteNotice({
        type: null,
        message: '',
      });

      for (const group of groupedRequests) {
        try {
          const result = await batchDeleteUserItems({
            itemIds: group.itemIds,
            userId: user.uid,
            isPublicItem: group.isPublicItem,
            collectionId: group.collectionId,
          }).unwrap();
          deletedItems += result.deletedCount;
        } catch {
          group.itemIds.forEach((id) => failedItemIds.add(id));
        } finally {
          completedItems += group.itemIds.length;
          setDeleteProgress((prev) => ({
            ...prev,
            completed: Math.min(completedItems, totalItems),
          }));
        }
      }

      if (failedItemIds.size > 0) {
        setBulkDeleteNotice({
          type: 'error',
          message: `Deleted ${deletedItems}/${totalItems} item(s). ${failedItemIds.size} item(s) failed.`,
        });
      } else {
        setBulkDeleteNotice({
          type: 'success',
          message: `Deleted ${deletedItems} item(s) successfully.`,
        });
      }

      setSelectedItems((prev) =>
        prev.filter((item) => failedItemIds.has(item.id))
      );
    } catch (err) {
      console.error('Failed to complete batch deletion request:', err);
      setBulkDeleteNotice({
        type: 'error',
        message: 'Bulk delete failed before completion. Please try again.',
      });
    } finally {
      setDeleteProgress((prev) => ({
        ...prev,
        active: false,
      }));
    }
  };

  return (
    <div className="space-y-4">
      {(deleteProgress.active || bulkDeleteNotice.type) && (
        <BulkDeleteFeedbackToast
          deleteProgress={deleteProgress}
          bulkDeleteNotice={bulkDeleteNotice}
          onDismiss={() => setBulkDeleteNotice({ type: null, message: '' })}
        />
      )}

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
            disabled={isDeleting || deleteProgress.active}
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
        onSelectionChange={handleSelectionChange}
      />
    </div>
  );
}

export default MyItemsListAll;
