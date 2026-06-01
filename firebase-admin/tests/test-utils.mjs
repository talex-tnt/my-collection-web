import 'dotenv/config';

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import admin from 'firebase-admin';

import { deleteApp, initializeApp as initializeClientApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithCustomToken,
  signOut,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  collection,
  deleteDoc,
  documentId,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  setDoc,
  terminate,
  serverTimestamp,
  where,
  Timestamp,
} from 'firebase/firestore';

export const RULES_TARGET = process.env.RULES_TARGET ?? 'emulator';
export const ENV = process.env.ENV ?? 'dev';
export const TEST_ROOT = 'test';
export const TEST_DATA_FOLDER = 'default';
export const TEST_CONFIG_PATH = `${TEST_ROOT}/config/public/runtime`;

export const joinPath = (...segments) => segments.filter(Boolean).join('/');

export const getPublicResourcePath = (folder, resourceType) =>
  joinPath(TEST_ROOT, 'data', folder, 'public', resourceType);

export const getPublicResourceDocPath = (folder, resourceType, docId) =>
  joinPath(getPublicResourcePath(folder, resourceType), docId);

export const getPrivateResourcePath = (folder, resourceType) =>
  joinPath(TEST_ROOT, 'data', folder, 'private', resourceType);

export const getPrivateResourceDocPath = (folder, resourceType, docId) =>
  joinPath(getPrivateResourcePath(folder, resourceType), docId);

export const getAuthorizedUsersPath = (folder) =>
  getPrivateResourcePath(folder, 'authorized-users');

const FIREBASE_WEB_CONFIGS = {
  dev: {
    apiKey: 'AIzaSyB4YnIk0kbBTKDiHOgXpVOaYIxLdchItzQ',
    authDomain: 'retro-collections-dev.firebaseapp.com',
    projectId: 'retro-collections-dev',
    storageBucket: 'retro-collections-dev.firebasestorage.app',
    messagingSenderId: '473822754233',
    appId: '1:473822754233:web:0de2e6930818d3a2ea7268',
  },
  prod: {
    apiKey: 'AIzaSyCD8zIM4SOBkLIzzLpZuagq688BwXfohDg',
    authDomain: 'retro-collections-prod.firebaseapp.com',
    projectId: 'retro-collections-prod',
    storageBucket: 'retro-collections-prod.firebasestorage.app',
    messagingSenderId: '509856353620',
    appId: '1:509856353620:web:6bac6b42759eb94a4e0cc1',
  },
};

const SERVICE_ACCOUNT_FILES = {
  dev: 'retro-collections-dev.json',
  prod: 'retro-collections-prod.json',
};

const firebaseConfig = FIREBASE_WEB_CONFIGS[ENV];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const suiteLockPath = path.join(ROOT_DIR, '.rules-test-suite-lock');
export const createAdminApp = (appNameSuffix = '') => {
  const serviceAccountFile = SERVICE_ACCOUNT_FILES[ENV];
  const serviceAccountPath = path.join(ROOT_DIR, serviceAccountFile);

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Missing service account file: ${serviceAccountPath}`);
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, 'utf8')
  );

  return admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
      projectId: firebaseConfig.projectId,
    },
    `rules-test-admin-${ENV}${appNameSuffix ? `-${appNameSuffix}` : ''}`
  );
};

export const getAdminDb = (adminApp) => admin.firestore(adminApp);
export const getAdminAuth = (adminApp) => admin.auth(adminApp);

export const buildClientContext = async (adminApp, { uid, claims = {} }) => {
  const appName = `rules-client-collections-${uid}-${Date.now()}-${Math.random()}`;
  const app = initializeClientApp(firebaseConfig, appName);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const defaultClaims =
    TEST_ROOT === 'test' ? { enabled: true, tester: true } : { enabled: true };
  const mergedClaims = { ...defaultClaims, ...claims };

  if (RULES_TARGET === 'emulator') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }

  const customToken = await getAdminAuth(adminApp).createCustomToken(
    uid,
    mergedClaims
  );
  await signInWithCustomToken(auth, customToken);

  return {
    db,
    cleanup: async () => {
      await signOut(auth).catch(() => undefined);
      await terminate(db).catch(() => undefined);
      await deleteApp(app).catch(() => undefined);
    },
  };
};

export const buildUnauthenticatedClientContext = async () => {
  const appName = `rules-client-collections-unauth-${Date.now()}-${Math.random()}`;
  const app = initializeClientApp(firebaseConfig, appName);
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (RULES_TARGET === 'emulator') {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }

  return {
    db,
    cleanup: async () => {
      await signOut(auth).catch(() => undefined);
      await terminate(db).catch(() => undefined);
      await deleteApp(app).catch(() => undefined);
    },
  };
};

export const expectFailedPrecondition = async (promise) => {
  await assert.rejects(promise, (error) => {
    const message = String(error?.message ?? '');
    const code = String(error?.code ?? '');

    return (
      code.includes('failed-precondition') ||
      message.includes('failed-precondition') ||
      message.includes('The query requires an index')
    );
  });
};

export const acquireSuiteLock = async () => {
  while (true) {
    try {
      fs.mkdirSync(suiteLockPath);
      break;
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  return () => {
    fs.rmSync(suiteLockPath, { recursive: true, force: true });
  };
};

export const cleanupTestDocs = async (adminApp, extraDocPaths = []) => {
  if (RULES_TARGET === 'emulator') {
    const response = await fetch(
      `http://127.0.0.1:8080/emulator/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      throw new Error(`Failed to clear emulator: ${response.status}`);
    }
    return;
  }

  try {
    await getAdminDb(adminApp).doc(TEST_CONFIG_PATH).delete();
  } catch (e) {
    // Ignore
  }

  for (const docPath of extraDocPaths) {
    try {
      await getAdminDb(adminApp).doc(docPath).delete();
    } catch (e) {
      // Ignore missing paths in live cleanup
    }
  }
};

export const expectPermissionDenied = async (promise) => {
  await assert.rejects(promise, (error) => {
    const message = String(error?.message ?? '');
    const code = String(error?.code ?? '');
    return (
      code.includes('permission-denied') ||
      message.includes('Missing or insufficient permissions') ||
      message.includes('permission-denied') ||
      message.includes('PERMISSION_DENIED')
    );
  });
};
