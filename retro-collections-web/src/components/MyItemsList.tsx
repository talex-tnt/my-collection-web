import { useState, useEffect } from 'react';
import {
  useGetUserItemsQuery,
  useGetUserItemsCountQuery,
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
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
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

  const handleBulkDelete = async () => {
    if (!user?.uid || selectedItemIds.length === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the ${selectedItemIds.length} selected item(s)?`
    );
    if (!confirmDelete) return;

    const normalizedCollectionId = collectionId?.trim() || undefined;

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
      setSelectedItemIds([]);
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

  return (
    <div className="space-y-4">
      <BulkDeleteFeedbackToast
        deleteProgress={deleteProgress}
        bulkDeleteNotice={bulkDeleteNotice}
        onDismiss={() => setBulkDeleteNotice({ type: null, message: '' })}
      />

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
        onSelectionChange={setSelectedItemIds}
      />
    </div>
  );
}

export default MyItemsList;
