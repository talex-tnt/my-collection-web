import { configureStore } from '@reduxjs/toolkit';
import { firestoreApi } from '../api/firestore/firestoreApi';
import { retroCollectionsApi } from '../api/retro-collections/retroCollectionsApi';
import { driveApi } from '../api/google-drive/googleDriveApi';
import { driveWriteApi } from '../api/google-drive/googleDriveWriteApi';
import { wikipediaApi } from '../api/wikipedia/wikipediaApi';
import { rawgApi } from '../api/games/rawgApi';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    [firestoreApi.reducerPath]: firestoreApi.reducer,
    [retroCollectionsApi.reducerPath]: retroCollectionsApi.reducer,
    [driveApi.reducerPath]: driveApi.reducer,
    [driveWriteApi.reducerPath]: driveWriteApi.reducer,
    [wikipediaApi.reducerPath]: wikipediaApi.reducer,
    [rawgApi.reducerPath]: rawgApi.reducer,
    auth: authReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
        ignoredPaths: ['firestoreApi.queries', 'retroCollectionsApi.queries'],
      },
    })
      .concat(firestoreApi.middleware)
      .concat(retroCollectionsApi.middleware)
      .concat(driveApi.middleware)
      .concat(driveWriteApi.middleware)
      .concat(wikipediaApi.middleware)
      .concat(rawgApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
