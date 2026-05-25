import MyCollectionsList from './MyCollectionsList';
import type { User } from 'firebase/auth/web-extension';

function MyCollections({
  user,
  isPublicCollection,
}: {
  user: User;
  isPublicCollection: boolean;
}) {
  // return (
  //   <div className="flex flex-col items-center justify-center h-full p-8">
  //     <h2 className="text-2xl font-bold mb-4">Work In Progress</h2>
  //     <p className="text-base-content/60">
  //       This feature is under construction.

  //     </p>
  //   </div>
  // );
  return (
    <MyCollectionsList user={user} isPublicCollection={isPublicCollection} />
  );
}

export default MyCollections;
