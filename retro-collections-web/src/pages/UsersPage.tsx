import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';

import {
  useGetUsersQuery,
  useGetPrivateUsersQuery,
} from '../api/firestore/firestoreApi';
import { useIsAdmin } from '../hooks';
import type { PrivateUserRecord } from '../api/firestore/services/private/users';

interface PublicUserRecord {
  id: string;
  name?: string;
  nickname?: string;
}

type UserRecord = PublicUserRecord & PrivateUserRecord;

function UserRow({
  user,
  onSelect,
}: {
  user: UserRecord;
  onSelect: () => void;
}) {
  return (
    <tr className="cursor-pointer hover:bg-base-200" onClick={onSelect}>
      <td>{user.email || '—'}</td>
      <td>{user.name || '—'}</td>
      <td>
        {user.nickname ? (
          <span className="badge badge-outline">@{user.nickname}</span>
        ) : (
          '—'
        )}
      </td>
      <td>
        {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '—'}
      </td>
    </tr>
  );
}

function UsersPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const isAdmin = useIsAdmin(currentUser);

  const { data: publicUsers = [], isLoading: isPublicUsersLoading } =
    useGetUsersQuery(undefined, {
      skip: !currentUser || !isAdmin,
    });

  const { data: privateUsers = [], isLoading: isPrivateUsersLoading } =
    useGetPrivateUsersQuery(undefined, {
      skip: !currentUser || !isAdmin,
    });

  const privateUsersById = useMemo<Record<string, PrivateUserRecord>>(
    () =>
      privateUsers.reduce<Record<string, PrivateUserRecord>>(
        (accumulator, user) => {
          accumulator[user.id] = user;
          return accumulator;
        },
        {}
      ),
    [privateUsers]
  );

  const users = useMemo<UserRecord[]>(
    () =>
      publicUsers.map((user) => ({
        ...user,
        ...privateUsersById[user.id],
      })),
    [privateUsersById, publicUsers]
  );

  const isLoading = isPublicUsersLoading || isPrivateUsersLoading;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return unsubscribe;
  }, []);

  if (!isAdmin) {
    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Users</h2>
          <p className="text-base-content/70">
            Only admin can view the users list.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Registered Users</h2>
          <p className="text-base-content/70">
            All users collected from Firestore.
          </p>
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          {isLoading ? (
            <div className="alert alert-info">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="alert alert-info">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Nickname</th>
                    <th>Last Login</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onSelect={() =>
                        navigate(`/collectors/${user.id}/collectibles`)
                      }
                    />
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

export default UsersPage;
