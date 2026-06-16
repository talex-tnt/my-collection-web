import {
  useDeleteUserWishMutation,
  useGetUserWishesQuery,
  useGetUserWishesCountQuery,
} from '../api/firestore/firestoreApi';

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

  const [deleteWish, { isLoading: isDeleting }] = useDeleteUserWishMutation();

  const wishes = (wishesData?.wishes || []).filter((wish) =>
    wish.name.toLowerCase().includes(wishNameClientFilter.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (!user?.uid) return;
    await deleteWish({
      id,
      userId: user.uid,
      isPublicWish,
      wishlistId,
    }).unwrap();
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Wishes ({totalCount})</h2>
        {error ? (
          <div className="alert alert-error">Error loading wishes</div>
        ) : null}
        {isLoading ? <div className="alert alert-info">Loading...</div> : null}
        {!isLoading && wishes.length === 0 ? (
          <div className="alert alert-info">No wishes found</div>
        ) : null}
        <div className="space-y-2">
          {wishes.map((wish) => (
            <div
              key={wish.id}
              className="flex items-center justify-between rounded-lg bg-base-200 p-3"
            >
              <div>
                <div className="font-semibold">{wish.name}</div>
                {wish.description ? (
                  <div className="text-xs opacity-70">{wish.description}</div>
                ) : null}
              </div>
              <button
                className="btn btn-xs btn-error"
                disabled={isDeleting}
                onClick={() => void handleDelete(wish.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MyWishesList;
