import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  type Timestamp,
  updateDoc,
} from 'firebase/firestore';

import { auth, db } from '../lib/firebase';
import { useIsAdmin } from '../hooks';

const env = import.meta.env.VITE_ENV;

import {
  useGetAuthorizedUsersQuery,
  useAddAuthorizedUserMutation,
  useRemoveAuthorizedUserMutation,
} from '../api/firestore/firestoreApi';
import { resolveDataCollectionPath } from '../api/firestore/runtimeConfig';

import { useManageUserClaimsMutation } from '../api/retro-collections/retroCollectionsApi';

function Admin() {
  type AccessRequest = {
    id: string;
    uid: string;
    email: string;
    status: string;
    createdAt: Timestamp | null;
  };

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
  const [pendingRequests, setPendingRequests] = useState<AccessRequest[]>([]);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(
    null
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!currentUser || !isAdmin) {
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const requestsPath = await resolveDataCollectionPath({
          visibility: 'private',
          resourceType: 'users-access-requests',
        });
        if (cancelled) {
          return;
        }

        const requestsRef = collection(db, requestsPath);
        unsubscribe = onSnapshot(
          requestsRef,
          (snapshot) => {
            const requests = snapshot.docs
              .map((requestDoc) => {
                const data = requestDoc.data() as {
                  uid?: string;
                  email?: string;
                  status?: string;
                  createdAt?: Timestamp | null;
                };

                return {
                  id: requestDoc.id,
                  uid: data.uid || requestDoc.id,
                  email: (data.email || '').toLowerCase(),
                  status: data.status || 'unknown',
                  createdAt: data.createdAt || null,
                };
              })
              .filter((request) => request.status === 'pending');

            setPendingRequests(requests);
          },
          (snapshotError) => {
            console.error(
              'Failed to load pending access requests:',
              snapshotError
            );
          }
        );
      } catch (error) {
        console.error('Failed to resolve pending requests path:', error);
      }
    })();

    return () => {
      cancelled = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, isAdmin]);

  const pendingRequestEmails = new Set(
    pendingRequests.map((request) => request.email)
  );

  const visibleAuthorizedUsers = authorizedUsers.filter(
    (authorizedUser) =>
      !pendingRequestEmails.has((authorizedUser.id || '').toLowerCase())
  );

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
        env,
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
        env,
        enable: false,
      }).unwrap();
      await removeUser(email).unwrap();

      setSuccess(`${email} removed successfully`);
    } catch (err) {
      console.error(err);
      setError('Failed to remove user');
    }
  };

  const approveAccessRequest = async (request: AccessRequest) => {
    if (!request.email) {
      setError('Cannot approve request without user email');
      return;
    }

    try {
      setError('');
      setSuccess('');
      setApprovingRequestId(request.id);

      await manageUserClaims({
        emailToManage: request.email,
        env,
        enable: true,
      }).unwrap();

      await addUser(request.email).unwrap();

      const requestsPath = await resolveDataCollectionPath({
        visibility: 'private',
        resourceType: 'users-access-requests',
      });

      await updateDoc(doc(db, requestsPath, request.id), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: currentUser?.email || null,
      });

      setSuccess(`Request approved for ${request.email}`);
    } catch (approveError) {
      console.error('Failed to approve request:', approveError);
      setError('Failed to approve request');
    } finally {
      setApprovingRequestId(null);
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
            {pendingRequests.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  Pending Access Requests ({pendingRequests.length})
                </h3>
                <div className="space-y-2">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-lg border border-warning/40 bg-warning/10 p-3"
                    >
                      <p className="font-medium">
                        {request.email || request.uid}
                      </p>
                      <p className="text-sm text-base-content/70">
                        Status: {request.status}
                      </p>
                      <p className="text-sm text-base-content/70">
                        Requested at:{' '}
                        {request.createdAt
                          ? request.createdAt.toDate().toLocaleString()
                          : 'pending timestamp'}
                      </p>
                      <div className="mt-2 flex justify-end">
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => approveAccessRequest(request)}
                          disabled={approvingRequestId === request.id}
                        >
                          {approvingRequestId === request.id
                            ? 'Approving...'
                            : 'Approve'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h3 className="text-lg font-semibold">
              Authorized Users ({visibleAuthorizedUsers.length})
            </h3>

            {isLoading ? (
              <div className="alert alert-info">Loading...</div>
            ) : visibleAuthorizedUsers.length === 0 ? (
              <div className="alert alert-info">No authorized users yet</div>
            ) : (
              <div className="space-y-2">
                {visibleAuthorizedUsers.map((user) => (
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
