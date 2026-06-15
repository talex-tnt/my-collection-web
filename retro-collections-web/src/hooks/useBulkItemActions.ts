import type { Dispatch, SetStateAction } from 'react';

export interface DeleteProgress {
  active: boolean;
  completed: number;
  total: number;
}

export interface BulkDeleteNotice {
  type: 'success' | 'error' | null;
  message: string;
}

export interface BulkSelectableItem {
  id: string;
  tags: string[];
  isPublicItem?: boolean;
  collectionId?: string;
}

interface ScopeInfo {
  isPublicItem: boolean;
  collectionId?: string;
}

interface DeleteGroup extends ScopeInfo {
  itemIds: string[];
}

type BatchDeleteMutation = (args: {
  itemIds: string[];
  userId: string;
  isPublicItem: boolean;
  collectionId?: string;
}) => {
  unwrap: () => Promise<{ deletedCount: number }>;
};

type UpdateItemMutation = (args: {
  id: string;
  userId: string;
  isPublicItem: boolean;
  collectionId?: string;
  updates: { tags: string[] };
}) => {
  unwrap: () => Promise<unknown>;
};

interface SharedActionState {
  setProgressLabel: Dispatch<SetStateAction<string>>;
  setDeleteProgress: Dispatch<SetStateAction<DeleteProgress>>;
  setBulkDeleteNotice: Dispatch<SetStateAction<BulkDeleteNotice>>;
}

interface UseBulkDeleteItemsParams extends SharedActionState {
  userId?: string;
  selectedItems: BulkSelectableItem[];
  setSelectedItems: Dispatch<SetStateAction<BulkSelectableItem[]>>;
  batchDeleteUserItems: BatchDeleteMutation;
  isDeleting: boolean;
  defaultScope?: ScopeInfo;
  groupByItemScope?: boolean;
}

interface UseBulkUpdateItemTagsParams extends SharedActionState {
  userId?: string;
  selectedItems: BulkSelectableItem[];
  setSelectedItems: Dispatch<SetStateAction<BulkSelectableItem[]>>;
  bulkTagsToUpdate: string[];
  setBulkTagsToUpdate: Dispatch<SetStateAction<string[]>>;
  updateUserItem: UpdateItemMutation;
  defaultScope?: ScopeInfo;
  groupByItemScope?: boolean;
}

const normalizeCollectionId = (collectionId?: string) => {
  const normalized = collectionId?.trim();
  if (!normalized || normalized === 'null' || normalized === 'undefined') {
    return undefined;
  }
  return normalized;
};

const resolveScope = (
  item: BulkSelectableItem,
  defaultScope?: ScopeInfo,
  groupByItemScope?: boolean
): ScopeInfo | null => {
  if (groupByItemScope) {
    if (typeof item.isPublicItem !== 'boolean') {
      return null;
    }
    return {
      isPublicItem: item.isPublicItem,
      collectionId: normalizeCollectionId(item.collectionId),
    };
  }

  if (!defaultScope) {
    return null;
  }

  return {
    isPublicItem: defaultScope.isPublicItem,
    collectionId: normalizeCollectionId(defaultScope.collectionId),
  };
};

export const useBulkDeleteItems = ({
  userId,
  selectedItems,
  setSelectedItems,
  batchDeleteUserItems,
  isDeleting,
  setProgressLabel,
  setDeleteProgress,
  setBulkDeleteNotice,
  defaultScope,
  groupByItemScope,
}: UseBulkDeleteItemsParams) => {
  const runBulkDelete = async () => {
    if (!userId || selectedItems.length === 0) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete the ${selectedItems.length} selected item(s)?`
    );
    if (!confirmDelete) return;

    setProgressLabel('Deleting items...');

    const groups = new Map<string, DeleteGroup>();

    selectedItems.forEach((item) => {
      const scope = resolveScope(item, defaultScope, groupByItemScope);
      if (!scope) return;

      const key = `${scope.isPublicItem ? 'public' : 'private'}::${
        scope.collectionId || ''
      }`;

      const existing = groups.get(key);
      if (existing) {
        existing.itemIds.push(item.id);
        return;
      }

      groups.set(key, {
        itemIds: [item.id],
        isPublicItem: scope.isPublicItem,
        collectionId: scope.collectionId,
      });
    });

    const groupedRequests = Array.from(groups.values());
    if (groupedRequests.length === 0) return;

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

    try {
      for (const group of groupedRequests) {
        try {
          const result = await batchDeleteUserItems({
            itemIds: group.itemIds,
            userId,
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
    } catch {
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

  return {
    isDeleting,
    runBulkDelete,
  };
};

export const useBulkUpdateItemTags = ({
  userId,
  selectedItems,
  setSelectedItems,
  bulkTagsToUpdate,
  setBulkTagsToUpdate,
  updateUserItem,
  setProgressLabel,
  setDeleteProgress,
  setBulkDeleteNotice,
  defaultScope,
  groupByItemScope,
}: UseBulkUpdateItemTagsParams) => {
  const runBulkTagsUpdate = async (mode: 'add' | 'remove') => {
    if (!userId || selectedItems.length === 0 || bulkTagsToUpdate.length === 0)
      return;

    const actionLabel = mode === 'add' ? 'add' : 'remove';
    const confirmUpdate = window.confirm(
      `Are you sure you want to ${actionLabel} ${bulkTagsToUpdate.length} tag(s) on ${selectedItems.length} selected item(s)?`
    );
    if (!confirmUpdate) return;

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
      const scope = resolveScope(item, defaultScope, groupByItemScope);
      if (!scope) {
        failedIds.add(item.id);
        completedItems++;
        setDeleteProgress((prev) => ({
          ...prev,
          completed: Math.min(completedItems, totalItems),
        }));
        continue;
      }

      const currentTags = item.tags || [];
      const nextTags =
        mode === 'add'
          ? Array.from(new Set([...currentTags, ...tagsToApply]))
          : currentTags.filter((tag) => !tagsSet.has(tag));

      try {
        if (nextTags.join('|') !== currentTags.join('|')) {
          await updateUserItem({
            id: item.id,
            userId,
            isPublicItem: scope.isPublicItem,
            collectionId: scope.collectionId,
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

  return {
    runBulkTagsUpdate,
  };
};
