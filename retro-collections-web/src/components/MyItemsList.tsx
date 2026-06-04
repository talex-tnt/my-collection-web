import { useState, useEffect } from 'react';
import {
  useGetUserItemsQuery,
  useGetUserItemsCountQuery,
} from '../api/firestore/firestoreApi';

import { useSettingsUIPageSize } from '../utils/hooks';
import MyItemsListMarkup from './MyItemsListMarkup';

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

  return (
    <MyItemsListMarkup
      user={user}
      collectionId={collectionId}
      totalCount={totalCount}
      isPublicItem={isPublicItem}
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
    />
  );
}

export default MyItemsList;
