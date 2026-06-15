import {
  useGetUserWishesCountQuery,
  useGetUserWishesQuery,
} from '../api/firestore/firestoreApi';

interface CollectorWishesListProps {
  userId?: string;
  wishNameClientFilter: string;
  selectedWishTags: string[];
  startWithNameFilter: string;
  nameContainsTokens: string;
  wishlistId?: string;
}

function CollectorWishesList({
  userId,
  wishNameClientFilter,
  selectedWishTags,
  startWithNameFilter,
  nameContainsTokens,
  wishlistId,
}: CollectorWishesListProps) {
  const { data: totalCount = 0 } = useGetUserWishesCountQuery(
    {
      userId: userId || '',
      tags: selectedWishTags.length ? selectedWishTags : undefined,
      startWithNameFilter: startWithNameFilter || undefined,
      nameContainsTokens: nameContainsTokens || undefined,
      isPublicWish: true,
      wishlistId: wishlistId || undefined,
    },
    { skip: !userId }
  );

  const {
    data: wishesData,
    isLoading,
    error,
  } = useGetUserWishesQuery(
    {
      userId: userId || '',
      tags: selectedWishTags.length ? selectedWishTags : undefined,
      isPublicWish: true,
      startWithNameFilter: startWithNameFilter || undefined,
      nameContainsTokens: nameContainsTokens || undefined,
      wishlistId: wishlistId || undefined,
    },
    { skip: !userId }
  );

  const wishes = (wishesData?.wishes || []).filter((wish) =>
    wish.name.toLowerCase().includes(wishNameClientFilter.toLowerCase())
  );

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Wishes ({totalCount})</h2>
        {error ? <div className="alert alert-error">Error loading wishes</div> : null}
        {isLoading ? <div className="alert alert-info">Loading...</div> : null}
        {!isLoading && wishes.length === 0 ? (
          <div className="alert alert-info">No wishes found</div>
        ) : null}
        <div className="space-y-2">
          {wishes.map((wish) => (
            <div key={wish.id} className="rounded-lg bg-base-200 p-3">
              <div className="font-semibold">{wish.name}</div>
              {wish.description ? (
                <div className="text-xs opacity-70">{wish.description}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CollectorWishesList;
