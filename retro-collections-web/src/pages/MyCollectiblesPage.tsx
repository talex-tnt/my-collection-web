import { useNavigate } from 'react-router-dom'; // 1. Import the navigation hook
import { useCurrentUser } from '../utils/hooks';
import MyItemsAllGrouped from '../components/MyItemsAllGrouped';

function MyCollectiblesPage() {
  const user = useCurrentUser();
  const navigate = useNavigate(); // 2. Initialize the navigate function

  if (!user) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">My Items</h2>
          <p>Please log in to manage your items.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Page header with title and shortcut navigation */}
      <div className="flex justify-between items-center border-b pb-4 border-base-300">
        <h1 className="text-2xl font-bold ml-2">My Collectibles</h1>

        {/* Shortcut button to switch to Collections */}
        <button
          onClick={() => navigate('/my-collections')}
          className="btn btn-outline btn-primary btn-sm sm:btn-md gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm0 5.25h.007v.008H3.75V12Zm0 5.25h.007v.008H3.75v-.008Z"
            />
          </svg>
          Check Collections
        </button>
      </div>

      {/* Main layout with filters and items list */}
      <MyItemsAllGrouped user={user} />
    </div>
  );
}

export default MyCollectiblesPage;
