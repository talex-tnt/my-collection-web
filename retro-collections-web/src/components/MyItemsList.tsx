import { useState, useEffect, useMemo } from 'react';
import {
  useGetUserItemsQuery,
  useGetUserItemsCountQuery,
  useBatchDeleteUserItemsMutation,
  useGetPublicUserTagsQuery,
  useUpdateUserItemMutation,
  useCreateUserItemMutation,
  useGetUserCollectionsQuery,
  useCreatePublicUserTagMutation,
} from '../api/firestore/firestoreApi';
import {
  useBulkDeleteItems,
  useBulkUpdateItemTags,
  useBulkCopyItems,
  type BulkDeleteNotice,
  type BulkSelectableItem,
  type DeleteProgress,
} from '../hooks';
import type { Item } from '../api/firestore/services/misc/userItems';

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
  const [selectedItems, setSelectedItems] = useState<BulkSelectableItem[]>([]);
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
  const [createUserItem] = useCreateUserItemMutation();
  const [createPublicUserTag] = useCreatePublicUserTagMutation();
  const normalizedCollectionId = collectionId?.trim() || undefined;

  const createItemForBulkCopy = (args: {
    userId: string;
    name: string;
    description?: string;
    tags?: string[];
    metadata?: Item['metadata'];
    isPublicItem: boolean;
    collectionId?: string;
  }) => createUserItem(args as Parameters<typeof createUserItem>[0]);

  const { data: privateCollectionsData } = useGetUserCollectionsQuery(
    { userId: user?.uid || '', isPublicCollection: false },
    { skip: !user?.uid }
  );

  const { data: publicCollectionsData } = useGetUserCollectionsQuery(
    { userId: user?.uid || '', isPublicCollection: true },
    { skip: !user?.uid }
  );

  const destinationCollections = useMemo(
    () => [
      ...(privateCollectionsData?.collections || []).map((collection) => ({
        ...collection,
        isPublicCollection: false,
      })),
      ...(publicCollectionsData?.collections || []).map((collection) => ({
        ...collection,
        isPublicCollection: true,
      })),
    ].filter(
      (collection) =>
        !(
          collection.id === normalizedCollectionId &&
          collection.isPublicCollection === isPublicItem
        )
    ),
    [
      privateCollectionsData?.collections,
      publicCollectionsData?.collections,
      normalizedCollectionId,
      isPublicItem,
    ]
  );

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
  const { runBulkDelete } = useBulkDeleteItems({
    userId: user?.uid,
    selectedItems,
    setSelectedItems,
    batchDeleteUserItems,
    isDeleting,
    setProgressLabel,
    setDeleteProgress,
    setBulkDeleteNotice,
    defaultScope: {
      isPublicItem,
      collectionId: normalizedCollectionId,
    },
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
    defaultScope: {
      isPublicItem,
      collectionId: normalizedCollectionId,
    },
  });

  const { runBulkCopy } = useBulkCopyItems({
    userId: user?.uid,
    selectedItems,
    setSelectedItems,
    createUserItem: createItemForBulkCopy,
    updateUserItem,
    batchDeleteUserItems,
    createUserTag: createPublicUserTag,
    setProgressLabel,
    setDeleteProgress,
    setBulkDeleteNotice,
    defaultScope: {
      isPublicItem,
      collectionId: normalizedCollectionId,
    },
  });

  const handleSelectionChange = (selectedIds: string[]) => {
    const currentItemsById = new Map<string, BulkSelectableItem>(
      items.map((item) => [
        item.id,
        {
          id: item.id,
          tags: item.tags || [],
          name: item.name,
          description: item.description,
          metadata: item.metadata,
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
        bulkTagsToUpdate={bulkTagsToUpdate}
        userTags={userTags}
        onBulkTagsToUpdateChange={setBulkTagsToUpdate}
        onBulkTagsUpdate={runBulkTagsUpdate}
        onBulkDelete={runBulkDelete}
        onBulkCopy={runBulkCopy}
        destinationCollections={destinationCollections}
        currentCollectionId={normalizedCollectionId}
        currentIsPublicItem={isPublicItem}
        bulkActionsDisabled={deleteProgress.active}
        isBulkDeleting={isDeleting}
      />
    </div>
  );
}

export default MyItemsList;
