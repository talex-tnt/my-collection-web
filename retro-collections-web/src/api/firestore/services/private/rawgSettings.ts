import { doc, getDoc, setDoc } from 'firebase/firestore';

import type { FirestoreBuilder } from '../../types/firestoreBuilder';
import { createFirestoreApiError } from '../../errorLogger';
import { db } from '../../../../lib/firebase';
import { resolveDataCollectionPath } from '../../runtimeConfig';

const visibility = 'private' as const;

export interface RawgSettingsRecord {
  userId: string;
  enableSuggestions: boolean;
}

interface FirestoreRawgSettingsDoc {
  enableSuggestions?: boolean;
}

const getRawgSettingsEndpoints = (builder: FirestoreBuilder) => ({
  getRawgSettings: builder.query<RawgSettingsRecord, string>({
    keepUnusedDataFor: 60 * 60, // 1h cache
    async queryFn(userId) {
      const path = await resolveDataCollectionPath({
        visibility,
        resourceType: 'users',
      });

      const context = {
        apiEndpoint: 'getRawgSettings',
        operation: 'GET' as const,
        firebaseFunc: 'getDoc',
        path,
        segmentPaths: [userId, 'settings', 'rawg'],
      };

      try {
        const docRef = doc(db, path, ...context.segmentPaths);
        let snap = await getDoc(docRef);

        if (!snap.exists()) {
          const defaultPayload = { enableSuggestions: true };

          await setDoc(docRef, defaultPayload, { merge: true });

          snap = await getDoc(docRef);
        }

        const data = snap.data() as FirestoreRawgSettingsDoc;

        return {
          data: {
            userId,
            enableSuggestions: data.enableSuggestions !== false,
          },
        };
      } catch (error) {
        return { error: createFirestoreApiError(context, error) };
      }
    },
    providesTags: (_result, _error, userId) => [
      { type: 'RawgSettings' as const, id: userId },
    ],
  }),

  updateRawgSettings: builder.mutation<
    void,
    {
      userId: string;
      enableSuggestions: boolean;
    }
  >({
    async queryFn({ userId, enableSuggestions }) {
      const path = await resolveDataCollectionPath({
        visibility,
        resourceType: 'users',
      });

      const requestPayload = {
        enableSuggestions,
      };

      const context = {
        apiEndpoint: 'updateRawgSettings',
        operation: 'UPDATE' as const,
        firebaseFunc: 'setDoc',
        path,
        segmentPaths: [userId, 'settings', 'rawg'],
        requestPayload,
      };

      try {
        const docRef = doc(db, path, ...context.segmentPaths);

        await setDoc(docRef, requestPayload, { merge: true });

        return {
          data: undefined,
        };
      } catch (error) {
        return { error: createFirestoreApiError(context, error) };
      }
    },
    invalidatesTags: (_result, _error, { userId }) => [
      { type: 'RawgSettings' as const, id: userId },
    ],
  }),
});

export default getRawgSettingsEndpoints;
