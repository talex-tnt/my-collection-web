import { useState, useEffect } from 'react';
import {
  useGetUserItemsQuery,
  useGetUserItemsCountQuery,
} from '../api/firestore/firestoreApi';

import MyListItem from './MyListItem';
import { ExpandableMotion } from './ExpandableMotion';
import MyExpandedItem from './MyExpandedItem';
import { FiLock, FiUnlock, FiEye, FiEyeOff } from 'react-icons/fi';

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
  const [showTags, setShowTags] = useState(true);
  const [editing, setEditing] = useState(false);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number | 'all'>(25);

  const [cursors, setCursors] = useState<(Cursor | null)[]>([null]);

  const currentCursor = cursors[pageIndex];
  const isAll = pageSize === 'all';

  // Total count (optional UI use)
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

  // Store cursor for next page
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

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body space-y-4">
        {/* HEADER */}
        <div className="flex flex-row md:justify-between gap-2">
          <h2 className="card-title">My Collectibles ({totalCount})</h2>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-xs"
              onClick={() => setShowTags((v) => !v)}
            >
              {showTags ? (
                <>
                  <FiEye className="inline-block m-1" title="Hide Tags" />
                  Tags
                </>
              ) : (
                <>
                  <FiEyeOff className="inline-block m-1" title="Show Tags" />
                  Tags
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
                  <MyExpandedItem {...props} key={`expanded-${item.id}`} />
                )}
              >
                <MyListItem
                  readonly={!editing}
                  key={item.id}
                  item={item}
                  userId={user?.uid || ''}
                  showTags={showTags}
                  isPublicItem={isPublicItem}
                  collectionId={collectionId}
                />
              </ExpandableMotion>
            ))
          )}
        </div>

        {/* PAGINATION */}
        <div className="flex flex-col gap-3 pt-2">
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
              {[1, 2, 3, 5, 10, 25].map((n) => (
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

export default MyItemsList;
