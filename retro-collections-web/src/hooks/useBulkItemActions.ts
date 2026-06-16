import type { Dispatch, SetStateAction } from 'react';
import type { Item } from '../api/firestore/services/misc/userItems';

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
  name?: string;
  description?: string;
  metadata?: Item['metadata'];
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

type CreateItemMutation = (args: {
  userId: string;
  name: string;
  description?: string;
  tags?: string[];
  metadata?: Item['metadata'];
  isPublicItem: boolean;
  collectionId?: string;
}) => {
  unwrap: () => Promise<Item>;
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

interface UseBulkCopyItemsParams extends SharedActionState {
  userId?: string;
  selectedItems: BulkSelectableItem[];
  setSelectedItems: Dispatch<SetStateAction<BulkSelectableItem[]>>;
  createUserItem: CreateItemMutation;
  updateUserItem: UpdateItemMutation;
  batchDeleteUserItems: BatchDeleteMutation;
  createUserTag?: (args: { userId: string; tag: string }) => {
    unwrap: () => Promise<unknown>;
  };
  defaultScope?: ScopeInfo;
  groupByItemScope?: boolean;
}

interface BulkCopyDestination {
  collectionId: string;
  isPublicItem: boolean;
}

const formatCopyTag = () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `copied-at-${yy}${mm}${dd}:${hh}${mi}${ss}`;
};

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

export const useBulkCopyItems = ({
  userId,
  selectedItems,
  setSelectedItems,
  createUserItem,
  updateUserItem,
  batchDeleteUserItems,
  createUserTag,
  setProgressLabel,
  setDeleteProgress,
  setBulkDeleteNotice,
  defaultScope,
  groupByItemScope,
}: UseBulkCopyItemsParams) => {
  const runBulkCopy = async ({
    collectionId: targetCollectionId,
    isPublicItem: targetIsPublicItem,
  }: BulkCopyDestination) => {
    if (!userId || selectedItems.length === 0) return;

    const trimmedTargetCollectionId = normalizeCollectionId(targetCollectionId);
    if (!trimmedTargetCollectionId) {
      setBulkDeleteNotice({
        type: 'error',
        message: 'Please select a destination collection before copying.',
      });
      return;
    }

    const firstScope = resolveScope(selectedItems[0], defaultScope, groupByItemScope);
    if (!firstScope) {
      setBulkDeleteNotice({
        type: 'error',
        message: 'Unable to resolve source collection scope.',
      });
      return;
    }

    const copyTag = formatCopyTag();
    const totalItems = selectedItems.length;
    let completedItems = 0;
    const copiedIds: string[] = [];
    let tagRegistered = false;

    setDeleteProgress({ active: true, completed: 0, total: totalItems });
    setBulkDeleteNotice({ type: null, message: '' });

    try {
      // Register the copy tag in user tags so it becomes selectable in tag pickers.
      if (createUserTag) {
        try {
          await createUserTag({ userId, tag: copyTag }).unwrap();
          tagRegistered = true;
        } catch {
          tagRegistered = false;
        }
      }

      // Phase 1: copy items first. This avoids mutating originals when destination writes fail.
      completedItems = 0;
      setDeleteProgress({ active: true, completed: 0, total: totalItems });
      setProgressLabel('Copying items...');

      for (const item of selectedItems) {
        if (!item.name || !item.name.trim()) {
          throw new Error('One or more selected items have no valid name.');
        }

        const tagsForCopy = Array.from(new Set([...(item.tags || []), copyTag]));
        const created = await createUserItem({
          userId,
          name: item.name,
          description: item.description,
          metadata: item.metadata,
          tags: tagsForCopy,
          isPublicItem: targetIsPublicItem,
          collectionId: trimmedTargetCollectionId,
        }).unwrap();

        copiedIds.push(created.id);

        completedItems++;
        setDeleteProgress((prev) => ({
          ...prev,
          completed: Math.min(completedItems, totalItems),
        }));
      }

      // Phase 2: apply the same copy tag to originals once copy succeeds
      completedItems = 0;
      setDeleteProgress({ active: true, completed: 0, total: totalItems });
      setProgressLabel(`Tagging originals (${copyTag})...`);
      for (const item of selectedItems) {
        const scope = resolveScope(item, defaultScope, groupByItemScope);
        if (!scope) {
          throw new Error('Invalid source scope while tagging originals.');
        }

        const tagged = Array.from(new Set([...(item.tags || []), copyTag]));
        await updateUserItem({
          id: item.id,
          userId,
          isPublicItem: scope.isPublicItem,
          collectionId: scope.collectionId,
          updates: { tags: tagged },
        }).unwrap();

        completedItems++;
        setDeleteProgress((prev) => ({
          ...prev,
          completed: Math.min(completedItems, totalItems),
        }));
      }

      // Phase 3: optional delete originals
      const shouldDeleteOriginals = window.confirm(
        `Copied ${copiedIds.length} item(s). Do you want to delete the original items?`
      );

      let originalsDeleted = 0;
      if (shouldDeleteOriginals) {
        setProgressLabel('Deleting original items...');
        const deleteResult = await batchDeleteUserItems({
          itemIds: selectedItems.map((item) => item.id),
          userId,
          isPublicItem: firstScope.isPublicItem,
          collectionId: firstScope.collectionId,
        }).unwrap();
        originalsDeleted = deleteResult.deletedCount;
      }

      // Phase 4: optional cleanup tag from copies
      const shouldCleanupCopies = window.confirm(
        `Copy completed with tag ${copyTag}. Remove this tag from copied items?`
      );
      if (shouldCleanupCopies) {
        setProgressLabel('Removing copy tag from copied items...');
        for (let i = 0; i < copiedIds.length; i++) {
          await updateUserItem({
            id: copiedIds[i],
            userId,
            isPublicItem: targetIsPublicItem,
            collectionId: trimmedTargetCollectionId,
            updates: {
              tags: (selectedItems[i]?.tags || []).filter((tag) => tag !== copyTag),
            },
          }).unwrap();
        }
      }

      // Phase 5: optional cleanup tag from originals (only if kept)
      if (!shouldDeleteOriginals) {
        const shouldCleanupOriginals = window.confirm(
          `Do you want to remove tag ${copyTag} from original items as well?`
        );

        if (shouldCleanupOriginals) {
          setProgressLabel('Removing copy tag from original items...');
          for (const item of selectedItems) {
            await updateUserItem({
              id: item.id,
              userId,
              isPublicItem: firstScope.isPublicItem,
              collectionId: firstScope.collectionId,
              updates: {
                tags: (item.tags || []).filter((tag) => tag !== copyTag),
              },
            }).unwrap();
          }
        }
      }

      setBulkDeleteNotice({
        type: 'success',
        message: `Copied ${copiedIds.length} item(s) successfully.${
          shouldDeleteOriginals
            ? ` Deleted originals: ${originalsDeleted}.`
            : ' Originals kept.'
        }${
          createUserTag && !tagRegistered
            ? ' Copy tag was not registered in tags list.'
            : ''
        }`,
      });
      setSelectedItems([]);
    } catch (error) {
      const errorText =
        (typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : '') + JSON.stringify(error || {});

      const isPermissionDenied =
        errorText.includes('permission-denied') ||
        errorText.includes('Missing or insufficient permissions');

      setBulkDeleteNotice({
        type: 'error',
        message: isPermissionDenied
          ? 'Copy failed: destination write is blocked by Firestore rules for this visibility/collection.'
          : 'Copy operation failed. No further actions were applied.',
      });
    } finally {
      setDeleteProgress((prev) => ({ ...prev, active: false }));
    }
  };

  return { runBulkCopy };
};
