/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from 'react';
import { useGetPublicItemsQuery } from '../api/retro-collections/retroCollectionsApi';
import CollectorListItem from './CollectorListItem';
import { ExpandableMotion } from './ExpandableMotion';
import CollectorExpandedItem from './CollectorExpandedItem';
import { useSettingsUIPageSize } from '../utils/hooks';
import { FiEye, FiEyeOff, FiTag, FiImage } from 'react-icons/fi';

interface Cursor {
  createdAt: string;
  id: string;
  updatedAt?: string;
  nameLowercase?: string;
  docPath?: string;
}

interface CollectorPublicItemsListProps {
  userId?: string;
  itemNameClientFilter: string;
  selectedTags: string[];
  startWithNameFilter: string;
  nameContainsTokens: string;
}

function CollectorPublicItemsList({
  userId,
  itemNameClientFilter,
  selectedTags,
  startWithNameFilter,
  nameContainsTokens,
}: CollectorPublicItemsListProps) {
  const [_pageSize, setPageSize, _pageOptions] = useSettingsUIPageSize();
  const [showTags, setShowTags] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<(Cursor | null)[]>([null]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pageIndex]);

  useEffect(() => {
    setPageIndex(0);
    setCursors([null]);
  }, [
    userId,
    selectedTags,
    startWithNameFilter,
    nameContainsTokens,
    itemNameClientFilter,
  ]);

  const pageOptions = _pageOptions
    .filter((n: number | string) => n !== 'all')
    .filter((n) => n < 50);

  const pageSize =
    _pageSize === 'all' ? pageOptions[_pageSize.length - 1] : _pageSize;

  const currentCursor = cursors[pageIndex];
  const limit = pageSize;
  const {
    data: itemsData,
    isLoading,
    error,
  } = useGetPublicItemsQuery(
    {
      userId: userId || '',
      tags: selectedTags.length ? selectedTags : undefined,
      limit,
      startAfter: currentCursor,
      startWithNameFilter: startWithNameFilter || undefined,
      nameContainsTokens: nameContainsTokens || undefined,
      sortBy: 'updatedAt',
    },
    { skip: !userId || !limit }
  );

  const items = (itemsData?.items || []).filter((item) =>
    item.name.toLowerCase().includes(itemNameClientFilter.toLowerCase())
  );
  const totalCount = itemsData?.totalCount || 0;
  const pageInfo = itemsData?.pageInfo;

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

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body space-y-4 px-0 sm:px-4 pb-0 sm:pb-6">
        <div className="flex flex-row justify-between gap-2 px-4 sm:px-0">
          <h2 className="card-title">Collectibles ({totalCount})</h2>

          <div className="flex flex-row gap-2">
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
          </div>
        </div>

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
                  <CollectorExpandedItem
                    {...props}
                    key={`expanded-${item.id}`}
                  />
                )}
              >
                <CollectorListItem
                  key={item.id}
                  item={item}
                  showTags={showTags}
                  showPreview={showPreview}
                />
              </ExpandableMotion>
            ))
          )}
        </div>

        <div className="sticky bottom-0 z-10 bg-base-100 py-3 border-t border-base-200 sm:border-t-0 sm:relative sm:z-auto sm:bg-transparent sm:py-0 flex flex-col gap-3 pt-2 px-4 sm:px-0">
          <div className="flex justify-end gap-2 items-center">
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
            </select>

            <button
              className="btn btn-xs"
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              disabled={pageIndex === 0}
            >
              Prev
            </button>
            <span className="text-xs">Page {pageIndex + 1}</span>
            <button
              className="btn btn-xs"
              onClick={() => {
                if (!pageInfo?.hasNextPage) return;
                setPageIndex((p) => p + 1);
              }}
              disabled={!pageInfo?.hasNextPage}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CollectorPublicItemsList;
