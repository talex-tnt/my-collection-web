import { useNavigate } from 'react-router-dom';
import type { Collection } from '../api/firestore/services/misc/userCollections';
import MyCollectionsList from './MyCollectionsList';
import type { User } from 'firebase/auth/web-extension';

function MyCollections({
  user,
  isPublicCollection,
}: {
  user: User;
  isPublicCollection: boolean;
}) {
  const navigate = useNavigate();

  const onCollectionClick = (collection: Collection) => {
    // Navigates relatively to the current path (e.g., /dashboard -> /dashboard/123)
    navigate(collection.id);
  };

  return (
    <MyCollectionsList
      user={user}
      isPublicCollection={isPublicCollection}
      onCollectionClick={onCollectionClick}
    />
  );
}

export default MyCollections;
