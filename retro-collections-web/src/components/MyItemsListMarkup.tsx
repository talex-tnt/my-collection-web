import MyListItem from './MyListItem';
import { ExpandableMotion } from './ExpandableMotion';
import MyExpandedItem from './MyExpandedItem';
import {
  FiLock,
  FiUnlock,
  FiEye,
  FiEyeOff,
  FiTag,
  FiImage,
} from 'react-icons/fi';
import type {
  Item,
  PaginationCursor,
} from '../api/firestore/services/misc/userItems';
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
}: MyItemsListMarkupProps) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body space-y-4 px-0 sm:px-4 pb-0 sm:pb-6">
        {/* HEADER */}
        <div className="flex flex-row justify-between gap-2 px-4 sm:px-0">
          <h2 className="card-title">My Collectibles ({totalCount})</h2>
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
              className="btn btn-xs"
              onClick={() => setEditing((v) => !v)}
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
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
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
