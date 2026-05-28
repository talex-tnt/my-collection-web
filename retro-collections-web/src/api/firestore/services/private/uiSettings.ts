import { doc, getDoc, setDoc } from 'firebase/firestore';

import type { FirestoreBuilder } from '../../types/firestoreBuilder';
import { createFirestoreApiError } from '../../errorLogger';
import { db } from '../../../../lib/firebase';
import { resolveDataCollectionPath } from '../../runtimeConfig';

const visibility = 'private' as const;

export interface UISettingsRecord {
  userId: string;
  collapseImages: boolean;
}

interface FirestoreUISettingsDoc {
  collapseImages?: boolean;
}

const getUISettingsEndpoints = (builder: FirestoreBuilder) => ({
  getUISettings: builder.query<UISettingsRecord, string>({
    keepUnusedDataFor: 60 * 60, // 1h cache
    async queryFn(userId) {
      const path = await resolveDataCollectionPath({
        visibility,
        resourceType: 'users',
      });

      const context = {
        apiEndpoint: 'getUISettings',
        operation: 'GET' as const,
        firebaseFunc: 'getDoc',
        path,
        segmentPaths: [userId, 'settings', 'ui'],
      };

      try {
        const docRef = doc(db, path, ...context.segmentPaths);
        let snap = await getDoc(docRef);

        if (!snap.exists()) {
          const defaultPayload = { collapseImages: false };

          await setDoc(docRef, defaultPayload, { merge: true });

          snap = await getDoc(docRef);
        }

        const data = snap.data() as FirestoreUISettingsDoc;

        return {
          data: {
            userId,
            collapseImages: data.collapseImages !== false,
          },
        };
      } catch (error) {
        return { error: createFirestoreApiError(context, error) };
      }
    },
    providesTags: (_result, _error, userId) => [
      { type: 'UISettings' as const, id: userId },
    ],
  }),

  updateUISettings: builder.mutation<
    void,
    {
      userId: string;
      collapseImages: boolean;
    }
  >({
    async queryFn({ userId, collapseImages }) {
      const path = await resolveDataCollectionPath({
        visibility,
        resourceType: 'users',
      });

      const requestPayload = {
        collapseImages,
      };

      const context = {
        apiEndpoint: 'updateUISettings',
        operation: 'UPDATE' as const,
        firebaseFunc: 'setDoc',
        path,
        segmentPaths: [userId, 'settings', 'ui'],
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
      { type: 'UISettings' as const, id: userId },
    ],
  }),
});

export default getUISettingsEndpoints;
