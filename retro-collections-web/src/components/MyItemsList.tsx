import { useState, useEffect } from 'react';
import {
  useGetUserItemsQuery,
  useGetUserItemsCountQuery,
  useBatchDeleteUserItemsMutation,
  useGetPublicUserTagsQuery,
  useUpdateUserItemMutation,
} from '../api/firestore/firestoreApi';

import { useSettingsUIPageSize } from '../utils/hooks';
import MyItemsListMarkup from './MyItemsListMarkup';
import BulkDeleteFeedbackToast from './BulkDeleteFeedbackToast';
import SelectTags from './SelectTags';

interface Cursor {
  createdAt: string;
  id: string;
}

interface MyItemsListProps {
  user: { uid: string } | null;
  itemNameClientFilter: string;
  selectedTags: string[];
  isPublicItem: boolean;
  startWithNameFilter: string;
  nameContainsTokens: string;
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

interface SelectedItem {
  id: string;
  tags: string[];
}

function MyItemsList({
  user,
  collectionId,
  itemNameClientFilter,
  selectedTags,
  isPublicItem,
  startWithNameFilter,
  nameContainsTokens,
}: MyItemsListProps) {
  const [pageSize, setPageSize, pageOptions] = useSettingsUIPageSize();

  const [showTags, setShowTags] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [editing, setEditing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [bulkTagsToUpdate, setBulkTagsToUpdate] = useState<string[]>([]);
  const [progressLabel, setProgressLabel] = useState('Deleting items...');
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
  const [updateUserItem] = useUpdateUserItemMutation();

  const { data: userTags = [] } = useGetPublicUserTagsQuery(
    { userId: user?.uid || '' },
    { skip: !user?.uid }
  );

  const [pageIndex, setPageIndex] = useState(0);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageIndex]);
  const [cursors, setCursors] = useState<(Cursor | null)[]>([null]);

  const currentCursor = cursors[pageIndex];
  const isAll = pageSize === 'all';

  const { data: totalCount = 0 } = useGetUserItemsCountQuery(
    {
      userId: user?.uid || '',
      tags: selectedTags.length ? selectedTags : undefined,
      startWithNameFilter: startWithNameFilter || undefined,
      nameContainsTokens: nameContainsTokens || undefined,
      isPublicItem,
      collectionId,
    },
    {
      skip: !user?.uid,
    }
  );

  const {
    data: itemsData,
    isLoading,
    error,
  } = useGetUserItemsQuery(
    {
      userId: user?.uid || '',
      tags: selectedTags.length ? selectedTags : undefined,
      isPublicItem,
      limit: isAll ? undefined : pageSize,
      startAfter: currentCursor,
      startWithNameFilter: startWithNameFilter || undefined,
      nameContainsTokens: nameContainsTokens || undefined,
      collectionId,
    },
    { skip: !user?.uid }
  );

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
          tags: item.tags || [],
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
    if (!user?.uid || selectedItemIds.length === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the ${selectedItemIds.length} selected item(s)?`
    );
    if (!confirmDelete) return;

    const normalizedCollectionId = collectionId?.trim() || undefined;
    setProgressLabel('Deleting items...');

    setDeleteProgress({
      active: true,
      completed: 0,
      total: selectedItemIds.length,
    });
    setBulkDeleteNotice({ type: null, message: '' });

    try {
      const result = await batchDeleteUserItems({
        itemIds: selectedItemIds,
        userId: user.uid,
        isPublicItem,
        collectionId: normalizedCollectionId,
      }).unwrap();

      setDeleteProgress((prev) => ({
        ...prev,
        completed: selectedItemIds.length,
      }));
      setSelectedItems([]);
      setBulkDeleteNotice({
        type: 'success',
        message: `Deleted ${result.deletedCount} item(s) successfully.`,
      });
    } catch {
      setBulkDeleteNotice({
        type: 'error',
        message: 'Failed to delete selected items. Please try again.',
      });
    } finally {
      setDeleteProgress((prev) => ({
        ...prev,
        active: false,
      }));
    }
  };

  const handleBulkTagsUpdate = async (mode: 'add' | 'remove') => {
    if (
      !user?.uid ||
      selectedItems.length === 0 ||
      bulkTagsToUpdate.length === 0
    )
      return;

    const actionLabel = mode === 'add' ? 'add' : 'remove';
    const confirmUpdate = window.confirm(
      `Are you sure you want to ${actionLabel} ${bulkTagsToUpdate.length} tag(s) on ${selectedItems.length} selected item(s)?`
    );
    if (!confirmUpdate) return;

    const normalizedCollectionId = collectionId?.trim() || undefined;
    const tagsSet = new Set(
      bulkTagsToUpdate.map((tag) => tag.trim()).filter(Boolean)
    );
    if (tagsSet.size === 0) return;

    const tagsToApply = Array.from(tagsSet);
    const totalItems = selectedItems.length;
    let completedItems = 0;
    let updatedItems = 0;
    const failedIds = new Set<string>();

    setProgressLabel('Updating tags...');
    setDeleteProgress({
      active: true,
      completed: 0,
      total: totalItems,
    });
    setBulkDeleteNotice({ type: null, message: '' });

    for (const item of selectedItems) {
      const currentTags = item.tags || [];
      const nextTags =
        mode === 'add'
          ? Array.from(new Set([...currentTags, ...tagsToApply]))
          : currentTags.filter((tag) => !tagsSet.has(tag));

      try {
        if (nextTags.join('|') !== currentTags.join('|')) {
          await updateUserItem({
            id: item.id,
            userId: user.uid,
            isPublicItem,
            collectionId: normalizedCollectionId,
            updates: { tags: nextTags },
          }).unwrap();
        }
        updatedItems++;
      } catch {
        failedIds.add(item.id);
      } finally {
        completedItems++;
        setDeleteProgress((prev) => ({
          ...prev,
          completed: Math.min(completedItems, totalItems),
        }));
      }
    }

    if (failedIds.size > 0) {
      setBulkDeleteNotice({
        type: 'error',
        message: `Updated ${updatedItems}/${totalItems} item(s). ${failedIds.size} item(s) failed.`,
      });
    } else {
      setBulkDeleteNotice({
        type: 'success',
        message: `Updated tags on ${updatedItems} item(s) successfully.`,
      });
      setBulkTagsToUpdate([]);
    }

    setSelectedItems((prev) =>
      prev.map((item) => {
        if (failedIds.has(item.id)) {
          return item;
        }
        const nextTags =
          mode === 'add'
            ? Array.from(new Set([...(item.tags || []), ...tagsToApply]))
            : (item.tags || []).filter((tag) => !tagsSet.has(tag));
        return {
          ...item,
          tags: nextTags,
        };
      })
    );

    setDeleteProgress((prev) => ({
      ...prev,
      active: false,
    }));
  };

  return (
    <div className="space-y-4">
      <BulkDeleteFeedbackToast
        deleteProgress={deleteProgress}
        bulkDeleteNotice={bulkDeleteNotice}
        progressLabel={progressLabel}
        onDismiss={() => setBulkDeleteNotice({ type: null, message: '' })}
      />

      {editing && selectedItemIds.length > 0 && (
        <div className="alert alert-warning shadow-lg flex flex-col lg:flex-row gap-3 lg:justify-between lg:items-center py-2 px-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">
              {selectedItemIds.length} item(s) selected
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs opacity-70">Tags to modify:</span>
              <SelectTags
                selectedTags={bulkTagsToUpdate}
                userTags={userTags}
                onSelectedTagsChange={setBulkTagsToUpdate}
              />
              {bulkTagsToUpdate.length === 0 && (
                <span className="text-xs opacity-70">
                  Click + to choose tags
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleBulkTagsUpdate('add')}
              disabled={deleteProgress.active || bulkTagsToUpdate.length === 0}
            >
              Add Tags
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handleBulkTagsUpdate('remove')}
              disabled={deleteProgress.active || bulkTagsToUpdate.length === 0}
            >
              Remove Tags
            </button>
            <button
              className={`btn btn-error btn-sm ${isDeleting ? 'loading' : ''}`}
              onClick={handleBulkDelete}
              disabled={isDeleting || deleteProgress.active}
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      <MyItemsListMarkup
        user={user}
        collectionId={collectionId}
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

export default MyItemsList;
