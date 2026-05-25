import { useNavigate } from 'react-router-dom';
import type { Collection } from '../api/firestore/services/misc/userCollections';
import CollectionsList from './CollectionsList';

function CollectorCollections({ userId }: { userId: string }) {
  const navigate = useNavigate();

  const onCollectionClick = (collection: Collection) => {
    // Navigates relatively to the current path (e.g., /dashboard -> /dashboard/123)
    navigate(collection.id);
  };
  return (
    <CollectionsList
      userId={userId}
      isPublicCollection={true}
      onCollectionClick={onCollectionClick}
      readOnly
    />
  );
}

export default CollectorCollections;
