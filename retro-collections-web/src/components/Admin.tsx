import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';

import { auth } from '../lib/firebase';
import { useIsAdmin } from '../hooks';
const env = import.meta.env.VITE_ENV;

import {
  useGetAuthorizedUsersQuery,
  useAddAuthorizedUserMutation,
  useRemoveAuthorizedUserMutation,
} from '../api/firestore/firestoreApi';

import { useManageUserClaimsMutation } from '../api/retro-collections/retroCollectionsApi';

function Admin() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const isAdmin = useIsAdmin(currentUser);

  const { data: authorizedUsers = [], isLoading } = useGetAuthorizedUsersQuery(
    undefined,
    {
      skip: !currentUser || !isAdmin,
    }
  );

  const [addUser] = useAddAuthorizedUserMutation();
  const [removeUser] = useRemoveAuthorizedUserMutation();
  const [manageUserClaims] = useManageUserClaimsMutation();

  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return unsubscribe;
  }, []);

  // const updateClaimsForCurrentUser = async () => {
  //   if (!currentUser) return;

  //   try {
  //     setError('');
  //     setSuccess('');

  //     const response = await manageUserClaims({
  //       // uidToManage: currentUser.uid,
  //       emailToManage: 'axlsd83@gmail.com2', //currentUser.email || '',
  //       env: env === 'production' ? 'prod' : 'dev',
  //       enable: true,
  //     }).unwrap();

  //     if (response.success) {
  //       setSuccess('Claims updated successfully');
  //     } else {
  //       setError('Failed to update claims: ' + response.message);
  //     }
  //   } catch (err) {
  //     console.error(err);
  //     setError('Error updating claims');
  //   }
  // };

  const addAuthorizedUser = async () => {
    if (!newEmail.trim()) {
      setError('Please enter an email');
      return;
    }

    try {
      setError('');
      setSuccess('');

      await manageUserClaims({
        emailToManage: newEmail,
        env: env === 'production' ? 'prod' : 'dev',
        enable: true,
      }).unwrap();
      await addUser(newEmail).unwrap();

      setNewEmail('');
      setSuccess(`${newEmail} added successfully`);
    } catch (err) {
      console.error(err);
      setError('Failed to add user');
    }
  };

  const removeAuthorizedUser = async (email: string) => {
    try {
      setError('');
      setSuccess('');

      await manageUserClaims({
        emailToManage: email,
        env: env === 'production' ? 'prod' : 'dev',
        enable: false,
      }).unwrap();
      await removeUser(email).unwrap();

      setSuccess(`${email} removed successfully`);
    } catch (err) {
      console.error(err);
      setError('Failed to remove user');
    }
  };

  if (!currentUser || !isAdmin) {
    return null;
  }

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Admin Panel</h2>
        <p>Manage authorized users</p>

        <p className="text-sm text-base-content/70">
          Admin email: <strong>{currentUser.email}</strong>
        </p>

        {error && <div className="alert alert-error shadow-lg">{error}</div>}

        {success && (
          <div className="alert alert-success shadow-lg">{success}</div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* ADD USER */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Add New User</h3>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                className="input input-bordered w-full"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value?.toLowerCase())}
                placeholder="Enter email"
              />

              <button className="btn btn-secondary" onClick={addAuthorizedUser}>
                Add User
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => removeAuthorizedUser(newEmail)}
              >
                Remove
              </button>
            </div>
          </div>

          {/* LIST USERS */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Authorized Users ({authorizedUsers.length})
            </h3>

            {isLoading ? (
              <div className="alert alert-info">Loading...</div>
            ) : authorizedUsers.length === 0 ? (
              <div className="alert alert-info">No authorized users yet</div>
            ) : (
              <div className="space-y-2">
                {authorizedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-2 rounded-lg border border-base-300 bg-base-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>{user.id}</span>

                    <button
                      className="btn btn-error btn-sm"
                      onClick={() => removeAuthorizedUser(user.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Admin;
