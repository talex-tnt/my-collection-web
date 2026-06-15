import { useState, useEffect, useRef } from 'react';
import {
  useGetAllUserItemsCountQuery,
  useGetAllUserItemsQuery,
  useBatchDeleteUserItemsMutation,
  useGetPublicUserTagsQuery,
  useUpdateUserItemMutation,
} from '../api/firestore/firestoreApi';
import {
  useBulkDeleteItems,
  useBulkUpdateItemTags,
  type BulkDeleteNotice,
  type BulkSelectableItem,
  type DeleteProgress,
} from '../hooks';

import { useSettingsUIPageSize } from '../utils/hooks';
import MyItemsListMarkup from './MyItemsListMarkup';
import BulkDeleteFeedbackToast from './BulkDeleteFeedbackToast';
import SelectTags from './SelectTags';
import { FiTag, FiTrash2, FiLayers, FiChevronDown } from 'react-icons/fi';

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
  const [bulkTagsToUpdate, setBulkTagsToUpdate] = useState<string[]>([]);
  const [progressLabel, setProgressLabel] = useState('Deleting items...');

  const [selectedItems, setSelectedItems] = useState<BulkSelectableItem[]>([]);
  const [deleteProgress, setDeleteProgress] = useState<DeleteProgress>({
    active: false,
    completed: 0,
    total: 0,
  });
  const [bulkDeleteNotice, setBulkDeleteNotice] = useState<BulkDeleteNotice>({
    type: null,
    message: '',
  });
  const tagActionsDropdownRef = useRef<HTMLDetailsElement | null>(null);

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
  const { runBulkDelete } = useBulkDeleteItems({
    userId: user?.uid,
    selectedItems,
    setSelectedItems,
    batchDeleteUserItems,
    isDeleting,
    setProgressLabel,
    setDeleteProgress,
    setBulkDeleteNotice,
    groupByItemScope: true,
  });

  const { runBulkTagsUpdate } = useBulkUpdateItemTags({
    userId: user?.uid,
    selectedItems,
    setSelectedItems,
    bulkTagsToUpdate,
    setBulkTagsToUpdate,
    updateUserItem,
    setProgressLabel,
    setDeleteProgress,
    setBulkDeleteNotice,
    groupByItemScope: true,
  });

  const handleSelectionChange = (selectedIds: string[]) => {
    const currentItemsById = new Map<string, BulkSelectableItem>(
      items.map((item) => [
        item.id,
        {
          id: item.id,
          isPublicItem: item.isPublic,
          collectionId: normalizeCollectionId(item.collectionId),
          tags: item.tags || [],
        },
      ])
    );

    setSelectedItems((previous) => {
      const previousById = new Map(previous.map((item) => [item.id, item]));

      return selectedIds
        .map((id) => currentItemsById.get(id) || previousById.get(id))
        .filter((item): item is BulkSelectableItem => Boolean(item));
    });
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
              <details ref={tagActionsDropdownRef} className="dropdown">
                <summary
                  className={`btn btn-secondary btn-sm text-base-content ${deleteProgress.active || bulkTagsToUpdate.length === 0 ? 'btn-disabled opacity-60' : ''}`}
                  aria-label="Tag actions"
                  title="Tag actions"
                  aria-disabled={
                    deleteProgress.active || bulkTagsToUpdate.length === 0
                  }
                  onClick={(event) => {
                    if (
                      deleteProgress.active ||
                      bulkTagsToUpdate.length === 0
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  <FiTag className="h-4 w-4" />
                  <FiChevronDown className="h-3.5 w-3.5" />
                </summary>
                <ul className="menu dropdown-content bg-base-100 rounded-box z-20 mt-2 w-40 p-2 shadow border border-base-300">
                  <li>
                    <button
                      onClick={() => {
                        tagActionsDropdownRef.current?.removeAttribute('open');
                        void runBulkTagsUpdate('add');
                      }}
                      disabled={
                        deleteProgress.active || bulkTagsToUpdate.length === 0
                      }
                    >
                      Bulk Add Tags
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        tagActionsDropdownRef.current?.removeAttribute('open');
                        void runBulkTagsUpdate('remove');
                      }}
                      disabled={
                        deleteProgress.active || bulkTagsToUpdate.length === 0
                      }
                    >
                      Bulk Remove Tags
                    </button>
                  </li>
                </ul>
              </details>
              <SelectTags
                selectedTags={bulkTagsToUpdate}
                userTags={userTags}
                onSelectedTagsChange={setBulkTagsToUpdate}
              />
              {bulkTagsToUpdate.length === 0 && (
                <span className="text-xs opacity-70">Select Tags </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`btn btn-error btn-sm btn-square text-base-content ${isDeleting ? 'loading' : ''}`}
              onClick={() => {
                void runBulkDelete();
              }}
              disabled={isDeleting || deleteProgress.active}
              title="Delete selected items"
              aria-label="Delete selected items"
            >
              <span className="relative inline-flex h-4 w-4 items-center justify-center">
                <FiTrash2 className="h-4 w-4" />
                <FiLayers className="h-3 w-3 absolute -right-1.5 -top-1.5 bg-base-100 rounded-full p-[1px]" />
              </span>
            </button>
          </div>
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
