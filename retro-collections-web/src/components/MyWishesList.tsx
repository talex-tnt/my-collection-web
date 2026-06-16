import { useState } from 'react';
import {
  useGetUserWishesQuery,
  useGetUserWishesCountQuery,
} from '../api/firestore/firestoreApi';
import { FiEdit as FiLock, FiEdit2 as FiUnlock } from 'react-icons/fi';
import MyWishListItem from './MyWishListItem';

interface MyWishesListProps {
  user: { uid: string } | null;
  wishNameClientFilter: string;
  selectedWishTags: string[];
  isPublicWish: boolean;
  startWithNameFilter: string;
  nameContainsTokens: string;
  wishlistId?: string;
}

function MyWishesList({
  user,
  wishNameClientFilter,
  selectedWishTags,
  isPublicWish,
  startWithNameFilter,
  nameContainsTokens,
  wishlistId,
}: MyWishesListProps) {
  const [editing, setEditing] = useState(false);

  const { data: totalCount = 0 } = useGetUserWishesCountQuery(
    {
      userId: user?.uid || '',
      tags: selectedWishTags.length ? selectedWishTags : undefined,
      startWithNameFilter: startWithNameFilter || undefined,
      nameContainsTokens: nameContainsTokens || undefined,
      isPublicWish,
      wishlistId,
    },
    {
      skip: !user?.uid,
    }
  );

  const {
    data: wishesData,
    isLoading,
    error,
  } = useGetUserWishesQuery(
    {
      userId: user?.uid || '',
      tags: selectedWishTags.length ? selectedWishTags : undefined,
      isPublicWish,
      startWithNameFilter: startWithNameFilter || undefined,
      nameContainsTokens: nameContainsTokens || undefined,
      wishlistId,
    },
    { skip: !user?.uid }
  );

  const wishes = (wishesData?.wishes || []).filter((wish) =>
    wish.name.toLowerCase().includes(wishNameClientFilter.toLowerCase())
  );

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex items-center justify-between gap-2">
          <h2 className="card-title">Wishes ({totalCount})</h2>
          <button
            className={`btn btn-xs ${editing ? 'btn-primary' : ''}`}
            onClick={() => setEditing((previous) => !previous)}
            title={editing ? 'Disable editing' : 'Enable editing'}
          >
            {editing ? (
              <FiUnlock className="inline-block m-1" title="Editing" />
            ) : (
              <FiLock className="inline-block m-1" title="Reading" />
            )}
          </button>
        </div>
        {error ? (
          <div className="alert alert-error">Error loading wishes</div>
        ) : null}
        {isLoading ? <div className="alert alert-info">Loading...</div> : null}
        {!isLoading && wishes.length === 0 ? (
          <div className="alert alert-info">No wishes found</div>
        ) : null}
        <div className="space-y-2">
          {wishes.map((wish) => (
            <MyWishListItem
              key={wish.id}
              wish={wish}
              userId={user?.uid || ''}
              showTags
              isPublicWish={isPublicWish}
              wishlistId={wishlistId}
              readonly={!editing}
              showPreview
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default MyWishesList;
