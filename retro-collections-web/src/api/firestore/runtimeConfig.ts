import { doc, getDoc } from 'firebase/firestore';

import { db } from '../../lib/firebase';

export interface RuntimeConfig {
  dataFolder: string;
}

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  dataFolder: 'default',
};

let runtimeConfig: RuntimeConfig = DEFAULT_RUNTIME_CONFIG;
let runtimeConfigLoaded = false;
let runtimeConfigLoadPromise: Promise<RuntimeConfig> | null = null;

const normalizeRuntimeConfig = (
  data: Partial<RuntimeConfig> | undefined
): RuntimeConfig => ({
  dataFolder:
    typeof data?.dataFolder === 'string' && data.dataFolder.trim().length > 0
      ? data.dataFolder
      : DEFAULT_RUNTIME_CONFIG.dataFolder,
});

export const getRuntimeConfigDocPath = () => 'main/config/public/runtime';

export const getRuntimeConfig = () => runtimeConfig;

export const loadRuntimeConfig = async (): Promise<RuntimeConfig> => {
  if (runtimeConfigLoaded) {
    return runtimeConfig;
  }

  if (!runtimeConfigLoadPromise) {
    runtimeConfigLoadPromise = (async () => {
      try {
        const snapshot = await getDoc(doc(db, getRuntimeConfigDocPath()));
        runtimeConfig = snapshot.exists()
          ? normalizeRuntimeConfig(snapshot.data() as Partial<RuntimeConfig>)
          : DEFAULT_RUNTIME_CONFIG;
      } catch {
        runtimeConfig = DEFAULT_RUNTIME_CONFIG;
      }

      runtimeConfigLoaded = true;
      return runtimeConfig;
    })().finally(() => {
      runtimeConfigLoadPromise = null;
    });
  }

  return runtimeConfigLoadPromise;
};

export const resolveDataCollectionPath = async ({
  visibility,
  resourceType,
}: {
  visibility: string;
  resourceType: string;
}) => {
  const { dataFolder } = await loadRuntimeConfig();
  return `main/data/${dataFolder}/${visibility}/${resourceType}`;
};

export const getUserCollectionPath = async ({
  visibility,
  resourceType,
  userId,
  collectionId,
  wishlistId,
}: {
  visibility: string;
  resourceType: string;
  userId: string;
  collectionId?: string;
  wishlistId?: string;
}) => {
  const parentSegment = collectionId
    ? `collections/${collectionId}/`
    : wishlistId
      ? `wishlists/${wishlistId}/`
      : '';

  return `${await resolveDataCollectionPath({ visibility, resourceType: 'users' })}/${userId}/${parentSegment}${resourceType}`;
};
