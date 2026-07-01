/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
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
import type { ExportJsonMetadata, ExportRow } from './ExportListButton';

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

  useEffect(() => {
    setPageIndex(0);
    setCursors([null]);
  }, [
    user?.uid,
    selectedTags,
    startWithNameFilter,
    nameContainsTokens,
    itemNameClientFilter,
  ]);

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

  const { data: allItemsData } = useGetAllUserItemsQuery(
    {
      userId: user?.uid || '',
      tags: selectedTags.length ? selectedTags : undefined,
      limit: undefined,
      startAfter: undefined,
      startWithNameFilter: startWithNameFilter || undefined,
      nameContainsTokens: nameContainsTokens || undefined,
    },
    { skip: !user?.uid }
  );
  // console.log('Fetched itemsData for MyItemsListAll:', itemsData, totalCount);
  const items = (itemsData?.items || []).filter((item) =>
    item.name.toLowerCase().includes(itemNameClientFilter.toLowerCase())
  );
  const allFilteredItems = (allItemsData?.items || []).filter((item) =>
    item.name.toLowerCase().includes(itemNameClientFilter.toLowerCase())
  );
  const pageInfo = itemsData?.pageInfo;

  const toExportRow = (item: {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    collectionId?: string;
    isPublic: boolean;
    createdAt: string;
    updatedAt?: string;
    metadata?: {
      imageFolder?: { id?: string; name?: string };
      previewImage?: { id?: string; name?: string };
    };
  }): ExportRow => ({
    id: item.id,
    title: item.name,
    description: item.description || '',
    tags: item.tags || [],
    collectionId: item.collectionId || '',
    visibility: item.isPublic ? 'public' : 'private',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt || '',
    imageFolderId: item.metadata?.imageFolder?.id || '',
    imageFolderName: item.metadata?.imageFolder?.name || '',
    previewImageId: item.metadata?.previewImage?.id || '',
    previewImageName: item.metadata?.previewImage?.name || '',
  });

  const exportVisibleRows = items.map(toExportRow);
  const exportAllRows = allFilteredItems.map(toExportRow);

  const hasExportFilters =
    selectedTags.length > 0 ||
    Boolean(startWithNameFilter) ||
    Boolean(nameContainsTokens) ||
    Boolean(itemNameClientFilter);

  const exportAppliedFilters: Record<string, unknown> = {
    ...(selectedTags.length > 0 ? { tags: selectedTags } : {}),
    ...(startWithNameFilter ? { startsWith: startWithNameFilter } : {}),
    ...(nameContainsTokens ? { containsTokens: nameContainsTokens } : {}),
    ...(itemNameClientFilter ? { clientNameContains: itemNameClientFilter } : {}),
  };

  const exportJsonMetadata: ExportJsonMetadata = {
    listContext: {
      type: 'all',
      isSparseList: false,
      visibility: 'mixed',
    },
    isFiltered: hasExportFilters,
    appliedFilters: exportAppliedFilters,
    pagination: {
      page: pageIndex + 1,
      limit: isAll ? 'all' : pageSize || null,
    },
  };

  useEffect(() => {
    if (!pageInfo?.endCursor) return;

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
        bulkTagsToUpdate={bulkTagsToUpdate}
        userTags={userTags}
        onBulkTagsToUpdateChange={setBulkTagsToUpdate}
        onBulkTagsUpdate={runBulkTagsUpdate}
        onBulkDelete={runBulkDelete}
        bulkActionsDisabled={deleteProgress.active}
        isBulkDeleting={isDeleting}
        exportVisibleRows={exportVisibleRows}
        exportAllRows={exportAllRows}
        exportBaseFileName="all-items"
        exportFieldOrder={[
          'title',
          'description',
          'tags',
          'collectionId',
          'visibility',
          'createdAt',
          'updatedAt',
          'imageFolderId',
          'imageFolderName',
          'previewImageId',
          'previewImageName',
          'id',
        ]}
        exportFieldLabels={{
          title: 'Title',
          description: 'Description',
          tags: 'Tags',
          collectionId: 'Collection ID',
          visibility: 'Visibility',
          createdAt: 'Created At',
          updatedAt: 'Updated At',
          imageFolderId: 'Image Folder ID',
          imageFolderName: 'Image Folder Name',
          previewImageId: 'Preview Image ID',
          previewImageName: 'Preview Image Name',
          id: 'Item ID',
        }}
        exportJsonMetadata={exportJsonMetadata}
      />
    </div>
  );
}

export default MyItemsListAll;
