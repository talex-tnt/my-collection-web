import { useNavigate } from 'react-router-dom';

import { useGetPublicUsersQuery } from '../api/firestore/firestoreApi';

function CollectorsPage() {
  const navigate = useNavigate();

  const { data: users = [], isLoading } = useGetPublicUsersQuery();

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Collectors</h2>
          <p className="text-base-content/70">
            Browse collectors who have set their profile to public.
          </p>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          {isLoading ? (
            <div className="alert alert-info">Loading collectors...</div>
          ) : users.length === 0 ? (
            <div className="alert alert-info">No public collectors found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Nickname</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="cursor-pointer hover:bg-base-200"
                      onClick={() => navigate(`/collectors/${user.id}`)}
                    >
                      <td>{user.name || '—'}</td>
                      <td>
                        {user.nickname ? (
                          <span className="badge badge-outline">
                            @{user.nickname}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CollectorsPage;
