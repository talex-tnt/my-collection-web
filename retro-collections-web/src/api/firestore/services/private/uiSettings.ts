import { doc, getDoc, setDoc } from 'firebase/firestore';

import type { FirestoreBuilder } from '../../types/firestoreBuilder';
import { createFirestoreApiError } from '../../errorLogger';
import { db } from '../../../../lib/firebase';
import { resolveDataCollectionPath } from '../../runtimeConfig';

const visibility = 'private' as const;

export interface UISettingsRecord {
  userId: string;
  collapseImages: boolean;
  enableImageProxy?: boolean;
  defaultListPageSize?: number;
  desktopPreviewImageSize?: number;
  mobilePreviewImageSize?: number;
}

interface FirestoreUISettingsDoc {
  collapseImages?: boolean;
  enableImageProxy?: boolean;
  defaultListPageSize?: number;
  desktopPreviewImageSize?: number;
  mobilePreviewImageSize?: number;
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
          const defaultPayload = {
            collapseImages: false,
            enableImageProxy: true,
            defaultListPageSize: 10,
            desktopPreviewImageSize: 300,
            mobilePreviewImageSize: 200,
          };
          await setDoc(docRef, defaultPayload, { merge: true });

          snap = await getDoc(docRef);
        }

        const data = snap.data() as FirestoreUISettingsDoc;

        return {
          data: {
            userId,
            collapseImages: data.collapseImages !== false,
            enableImageProxy: data.enableImageProxy !== false,
            defaultListPageSize: data.defaultListPageSize ?? 10,
            desktopPreviewImageSize: data.desktopPreviewImageSize ?? 300,
            mobilePreviewImageSize: data.mobilePreviewImageSize ?? 200,
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
      enableImageProxy?: boolean;
      defaultListPageSize?: number;
      desktopPreviewImageSize?: number;
      mobilePreviewImageSize?: number;
    }
  >({
    async queryFn({
      userId,
      collapseImages,
      enableImageProxy,
      defaultListPageSize,
      desktopPreviewImageSize,
      mobilePreviewImageSize,
    }) {
      const path = await resolveDataCollectionPath({
        visibility,
        resourceType: 'users',
      });

      const requestPayload = {
        collapseImages,
        enableImageProxy,
        defaultListPageSize,
        desktopPreviewImageSize,
        mobilePreviewImageSize,
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
