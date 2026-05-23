import { doc, getDoc, setDoc } from 'firebase/firestore';

import type { FirestoreBuilder } from '../../types/firestoreBuilder';
import { createFirestoreApiError } from '../../errorLogger';
import { db } from '../../../../lib/firebase';
import { resolveDataCollectionPath } from '../../runtimeConfig';

const visibility = 'private' as const;

export interface WikipediaSettingsRecord {
  userId: string;
  enableSuggestions: boolean;
}

interface FirestoreWikipediaSettingsDoc {
  enableSuggestions?: boolean;
}

const getWikipediaSettingsEndpoints = (builder: FirestoreBuilder) => ({
  keepUnusedDataFor: 60 * 60, // 1h cache
  getWikipediaSettings: builder.query<WikipediaSettingsRecord, string>({
    async queryFn(userId) {
      const path = await resolveDataCollectionPath({
        visibility,
        resourceType: 'users',
      });

      const context = {
        apiEndpoint: 'getWikipediaSettings',
        operation: 'GET' as const,
        firebaseFunc: 'getDoc',
        path,
        segmentPaths: [userId, 'settings', 'wikipedia'],
      };

      try {
        const docRef = doc(db, path, ...context.segmentPaths);
        let snap = await getDoc(docRef);

        if (!snap.exists()) {
          const defaultPayload = { enableSuggestions: true };

          await setDoc(docRef, defaultPayload, { merge: true });

          snap = await getDoc(docRef);
        }

        const data = snap.data() as FirestoreWikipediaSettingsDoc;

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
      { type: 'WikipediaSettings' as const, id: userId },
    ],
  }),

  updateWikipediaSettings: builder.mutation<
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
        apiEndpoint: 'updateWikipediaSettings',
        operation: 'UPDATE' as const,
        firebaseFunc: 'setDoc',
        path,
        segmentPaths: [userId, 'settings', 'wikipedia'],
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
      { type: 'WikipediaSettings' as const, id: userId },
    ],
  }),
});

export default getWikipediaSettingsEndpoints;
