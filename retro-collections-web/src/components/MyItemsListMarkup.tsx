import { useEffect, useRef, useState } from 'react';
import MyListItem from './MyListItem';
import { ExpandableMotion } from './ExpandableMotion';
import MyExpandedItem from './MyExpandedItem';
import SelectTags from './SelectTags';
import {
  FiEdit as FiLock,
  FiEdit2 as FiUnlock,
  FiEye,
  FiEyeOff,
  FiTag,
  FiImage,
  FiTrash2,
  FiLayers,
  FiChevronDown,
} from 'react-icons/fi';
import type {
  Item,
  PaginationCursor,
} from '../api/firestore/services/misc/userItems';
import type { Collection } from '../api/firestore/services/misc/userCollections';
import type { UserTag } from '../api/firestore/services/public/userTags';
import type { FirestoreApiError } from '../api/firestore/errorLogger';
import type { SerializedError } from '@reduxjs/toolkit';

interface Cursor {
  createdAt: string;
  id: string;
}

interface MyItemsListMarkupProps {
  user: { uid: string } | null;
  collectionId?: string;
  setShowTags: React.Dispatch<React.SetStateAction<boolean>>;
  setShowPreview: React.Dispatch<React.SetStateAction<boolean>>;
  showTags: boolean;
  showPreview: boolean;
  editing: boolean;
  setEditing: React.Dispatch<React.SetStateAction<boolean>>;
  items: Item[];
  isLoading: boolean;
  error: FirestoreApiError | SerializedError | undefined;
  pageIndex: number;
  setPageIndex: React.Dispatch<React.SetStateAction<number>>;
  pageInfo:
    | {
        endCursor: PaginationCursor | null;
        hasNextPage: boolean;
      }
    | undefined;
  pageSize: number | 'all' | undefined;
  setPageSize: React.Dispatch<React.SetStateAction<number | 'all' | undefined>>;
  pageOptions: (number | 'all')[];
  isAll: boolean;
  totalCount: number;
  setCursors: React.Dispatch<React.SetStateAction<(Cursor | null)[]>>;
  selectedItemIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  bulkTagsToUpdate?: string[];
  userTags?: UserTag[];
  onBulkTagsToUpdateChange?: (tags: string[]) => void;
  onBulkTagsUpdate?: (mode: 'add' | 'remove') => void | Promise<void>;
  onBulkDelete?: () => void | Promise<void>;
  onBulkCopy?: (target: {
    collectionId: string;
    isPublicItem: boolean;
  }) => void | Promise<void>;
  destinationCollections?: Array<Collection & { isPublicCollection: boolean }>;
  currentCollectionId?: string;
  currentIsPublicItem?: boolean;
  bulkActionsDisabled?: boolean;
  isBulkDeleting?: boolean;
}

function MyItemsListMarkup({
  user,
  collectionId,
  totalCount,
  setShowTags,
  setShowPreview,
  editing,
  setEditing,
  showTags,
  showPreview,
  items,
  isLoading,
  error,
  pageIndex,
  setPageIndex,
  pageInfo,
  pageSize,
  setPageSize,
  pageOptions,
  isAll,
  setCursors,
  selectedItemIds = [],
  onSelectionChange = () => {},
  bulkTagsToUpdate = [],
  userTags = [],
  onBulkTagsToUpdateChange,
  onBulkTagsUpdate,
  onBulkDelete,
  onBulkCopy,
  destinationCollections = [],
  currentCollectionId,
  currentIsPublicItem,
  bulkActionsDisabled = false,
  isBulkDeleting = false,
}: MyItemsListMarkupProps) {
  const tagActionsDropdownRef = useRef<HTMLDetailsElement | null>(null);
  const [copyTargetCollectionId, setCopyTargetCollectionId] = useState('');

  const makeDestinationKey = (collection: {
    id: string;
    isPublicCollection: boolean;
  }) => `${collection.isPublicCollection ? 'public' : 'private'}::${collection.id}`;

  const availableCopyCollections = destinationCollections.filter(
    (collection) =>
      !(
        collection.id === currentCollectionId &&
        collection.isPublicCollection === currentIsPublicItem
      )
  );

  useEffect(() => {
    if (availableCopyCollections.length === 0) {
      setCopyTargetCollectionId('');
      return;
    }

    setCopyTargetCollectionId((prev) => {
      if (
        prev &&
        availableCopyCollections.some(
          (collection) => makeDestinationKey(collection) === prev
        )
      ) {
        return prev;
      }
      return makeDestinationKey(availableCopyCollections[0]);
    });
  }, [availableCopyCollections]);
  const visibleItemsCount = items.length;
  const selectedVisibleItems = items.filter((item) =>
    selectedItemIds.includes(item.id)
  );
  const isAllVisibleSelected =
    visibleItemsCount > 0 && selectedVisibleItems.length === visibleItemsCount;
  const isSomeVisibleSelected =
    selectedVisibleItems.length > 0 &&
    selectedVisibleItems.length < visibleItemsCount;

  const handleToggleSelectAll = () => {
    if (isAllVisibleSelected) {
      const visibleIds = items.map((i) => i.id);
      onSelectionChange(
        selectedItemIds.filter((id) => !visibleIds.includes(id))
      );
    } else {
      const newSelections = [...selectedItemIds];
      items.forEach((item) => {
        if (!newSelections.includes(item.id)) {
          newSelections.push(item.id);
        }
      });
      onSelectionChange(newSelections);
    }
  };

  const handleToggleSelectItem = (itemId: string) => {
    if (selectedItemIds.includes(itemId)) {
      onSelectionChange(selectedItemIds.filter((id) => id !== itemId));
    } else {
      onSelectionChange([...selectedItemIds, itemId]);
    }
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body space-y-4 px-0 sm:px-4 pb-0 sm:pb-6">
        {/* HEADER */}
        <div className="flex flex-row justify-between gap-2 px-4 sm:px-0">
          <div className="flex items-center gap-3">
            {editing && !isLoading && !error && items.length > 0 && (
              <input
                type="checkbox"
                className="checkbox checkbox-sm checkbox-primary"
                checked={isAllVisibleSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isSomeVisibleSelected;
                }}
                onChange={handleToggleSelectAll}
              />
            )}
            <h2 className="card-title">My Collectibles ({totalCount})</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-xs"
              onClick={() => setShowTags((v) => !v)}
            >
              {showTags ? (
                <>
                  <FiTag className="w-4 h-4" /> <FiEyeOff className="w-4 h-4" />
                </>
              ) : (
                <>
                  <FiTag className="w-4 h-4" /> <FiEye className="w-4 h-4" />
                </>
              )}
            </button>
            <button
              className="btn btn-xs"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? (
                <>
                  <FiImage className="w-4 h-4" />{' '}
                  <FiEyeOff className="w-4 h-4" />
                </>
              ) : (
                <>
                  <FiImage className="w-4 h-4" /> <FiEye className="w-4 h-4" />
                </>
              )}
            </button>
            <button
              className={`btn btn-xs ${editing ? 'btn-primary' : ''}`}
              onClick={() => {
                setEditing((v) => !v);
                if (editing) onSelectionChange([]);
              }}
            >
              {editing ? (
                <>
                  <FiUnlock className="inline-block m-1" title="Editing" />
                </>
              ) : (
                <>
                  <FiLock className="inline-block m-1" title="Reading" />
                </>
              )}
            </button>
          </div>
        </div>

        {editing && selectedItemIds.length > 0 && (
          <div className="alert alert-warning shadow-lg flex flex-col lg:flex-row gap-3 lg:justify-between lg:items-center py-2 px-2 ml-2 mr-2 sm:ml-8 sm:mr-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">
                {selectedItemIds.length} item(s) selected
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <details ref={tagActionsDropdownRef} className="dropdown">
                  <summary
                    className={`btn btn-secondary btn-sm text-base-content ${bulkActionsDisabled || bulkTagsToUpdate.length === 0 ? 'btn-disabled opacity-60' : ''}`}
                    aria-label="Tag actions"
                    title="Tag actions"
                    aria-disabled={
                      bulkActionsDisabled || bulkTagsToUpdate.length === 0
                    }
                    onClick={(event) => {
                      if (
                        bulkActionsDisabled ||
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
                          tagActionsDropdownRef.current?.removeAttribute(
                            'open'
                          );
                          void onBulkTagsUpdate?.('add');
                        }}
                        disabled={
                          bulkActionsDisabled || bulkTagsToUpdate.length === 0
                        }
                      >
                        Bulk Add Tags
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          tagActionsDropdownRef.current?.removeAttribute(
                            'open'
                          );
                          void onBulkTagsUpdate?.('remove');
                        }}
                        disabled={
                          bulkActionsDisabled || bulkTagsToUpdate.length === 0
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
                  onSelectedTagsChange={(nextTags) => {
                    onBulkTagsToUpdateChange?.(nextTags);
                  }}
                />
                {bulkTagsToUpdate.length === 0 && (
                  <span className="text-xs opacity-70">Select Tags</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                className="select select-bordered select-sm min-w-[10rem]"
                value={copyTargetCollectionId}
                onChange={(event) => setCopyTargetCollectionId(event.target.value)}
                disabled={bulkActionsDisabled || availableCopyCollections.length === 0}
              >
                {availableCopyCollections.length === 0 ? (
                  <option value="">No destination collections</option>
                ) : (
                  availableCopyCollections.map((collection) => (
                    <option
                      key={makeDestinationKey(collection)}
                      value={makeDestinationKey(collection)}
                    >
                      {collection.name} ({collection.isPublicCollection ? 'Public' : 'Private'})
                    </option>
                  ))
                )}
              </select>
              <button
                className="btn btn-info btn-sm"
                onClick={() => {
                  if (!copyTargetCollectionId) return;
                  const selectedTarget = availableCopyCollections.find(
                    (collection) =>
                      makeDestinationKey(collection) === copyTargetCollectionId
                  );
                  if (!selectedTarget) return;
                  void onBulkCopy?.({
                    collectionId: selectedTarget.id,
                    isPublicItem: selectedTarget.isPublicCollection,
                  });
                }}
                disabled={
                  bulkActionsDisabled ||
                  availableCopyCollections.length === 0 ||
                  !copyTargetCollectionId
                }
                title="Copy selected items to another collection"
                aria-label="Copy selected items"
              >
                Copy
              </button>
              {availableCopyCollections.length === 0 && (
                <span className="text-xs opacity-70">
                  Create another collection to enable copy
                </span>
              )}
              <button
                className={`btn btn-error btn-sm btn-square text-base-content ${isBulkDeleting ? 'loading' : ''}`}
                onClick={() => {
                  void onBulkDelete?.();
                }}
                disabled={isBulkDeleting || bulkActionsDisabled}
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

        {/* LIST */}
        <div className="space-y-2">
          {error ? (
            <div className="alert alert-error">Error loading items</div>
          ) : isLoading ? (
            <div className="alert alert-info">Loading...</div>
          ) : items.length === 0 ? (
            <div className="alert alert-info">No items found</div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 sm:px-0"
              >
                {editing && (
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary flex-shrink-0"
                    checked={selectedItemIds.includes(item.id)}
                    onChange={() => handleToggleSelectItem(item.id)}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <ExpandableMotion
                    key={item.id}
                    renderExpanded={(props) => (
                      <MyExpandedItem
                        {...props}
                        isPublicItem={item.isPublic}
                        key={`expanded-${item.id}`}
                      />
                    )}
                  >
                    <MyListItem
                      readonly={!editing}
                      key={item.id}
                      item={item}
                      isPublicItem={item.isPublic}
                      userId={user?.uid || ''}
                      showTags={showTags}
                      collectionId={collectionId}
                      showPreview={showPreview}
                    />
                  </ExpandableMotion>
                </div>
              </div>
            ))
          )}
        </div>

        {/* PAGINATION */}
        {/* MODIFIED: 
          - Added `sticky bottom-0 z-10` to stick to the mobile viewport.
          - Added `bg-base-100 py-3` to mask list items scrolling underneath.
          - Added `sm:relative sm:z-auto sm:bg-transparent sm:py-0` to restore standard desktop flow behavior.
          - Added a subtle border-t on mobile for clear UI separation.
        */}
        <div className="sticky bottom-0 z-10 bg-base-100 py-3 border-t border-base-200 sm:border-t-0 sm:relative sm:z-auto sm:bg-transparent sm:py-0 flex flex-col gap-3 pt-2 px-4 sm:px-0">
          {/* NAVIGATION */}
          <div className="flex justify-end gap-2 items-center">
            {/* PAGE SIZE SELECT */}
            <label className="text-xs opacity-70">Items per page:</label>
            <select
              className="select select-xs select-bordered w-20"
              value={pageSize}
              onChange={(e) => {
                const val =
                  e.target.value === 'all' ? 'all' : Number(e.target.value);

                setPageSize(val as number | 'all');
                setPageIndex(0);
                setCursors([null]);
                onSelectionChange([]);
              }}
            >
              {pageOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value="all">All</option>
            </select>

            <button
              className="btn btn-xs"
              onClick={() => {
                setPageIndex((p) => Math.max(0, p - 1));
                onSelectionChange([]);
              }}
              disabled={pageIndex === 0 || isAll}
            >
              Prev
            </button>
            <span className="text-xs">Page {pageIndex + 1}</span>
            <button
              className="btn btn-xs"
              onClick={() => {
                if (isAll) return;
                if (!pageInfo?.hasNextPage) return;
                setPageIndex((p) => p + 1);
                onSelectionChange([]);
              }}
              disabled={isAll || !pageInfo?.hasNextPage}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MyItemsListMarkup;
