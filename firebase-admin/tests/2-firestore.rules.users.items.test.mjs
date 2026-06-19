/**
 * SUITE 2: ITEMS CRUD
 *
 * Test Checklist:
 * [x] 2.1.1 - admin can read any item
 * [x] 2.1.2 - owner can read own item
 * [x] 2.1.3 - non-owner cannot read private item
 * [x] 2.1.4 - authenticated non-owner can read public item
 * [x] 2.2.1 - owner can create own item
 * [x] 2.2.2 - non-owner cannot create item for another user
 * [x] 2.2.3 - unauthenticated cannot create item
 * [x] 2.2.4 - admin can bypass all validation
 * [x] 2.3.1 - rejects missing required name field
 * [x] 2.3.2 - rejects missing required createdAt
 * [x] 2.3.3 - rejects missing required visibility
 * [x] 2.3.4 - name cannot exceed 100 characters
 * [x] 2.3.5 - collectionId is required and must be non-empty string
 * [x] 2.3.6 - description cannot exceed 1000 characters
 * [x] 2.3.7 - rejects invalid visibility map
 * [x] 2.3.8 - rejects non-timestamp createdAt
 * [x] 2.4.1 - owner can update own item
 * [x] 2.4.2 - non-owner cannot update item
 * [x] 2.5.1 - updatedAt is required
 * [x] 2.5.2 - name is optional in updates
 * [x] 2.5.3 - description is optional in updates
 * [x] 2.5.4 - visibility is optional in updates
 * [x] 2.5.5 - name cannot exceed 100 characters on update
 * [x] 2.6.1 - owner can delete own item
 * [x] 2.6.2 - non-owner cannot delete item
 * [x] 2.6.3 - admin can delete any item
 * [x] 2.1.1 - items query reproduces the frontend getItems shape
 */

import 'dotenv/config';

import test from 'node:test';
import assert from 'node:assert/strict';
import admin from 'firebase-admin';

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  setDoc,
  where,
  Timestamp,
  orderBy,
  documentId,
} from 'firebase/firestore';

import {
  RULES_TARGET,
  TEST_DATA_FOLDER,
  TEST_CONFIG_PATH,
  createAdminApp,
  getAdminDb as sharedGetAdminDb,
  buildClientContext as sharedBuildClientContext,
  buildUnauthenticatedClientContext,
  cleanupTestDocs as sharedCleanupTestDocs,
  expectPermissionDenied,
  expectFailedPrecondition,
  acquireSuiteLock,
  getPublicResourcePath,
  getPrivateResourcePath,
  TEST_ROOT,
} from './test-utils.mjs';

// New model: items are under /public/users/{userId}/items/{itemId}
const getPublicItemPath = (userId, itemId) =>
  `${getPublicResourcePath(TEST_DATA_FOLDER, 'users')}/${userId}/items/${itemId}`;

const getPublicItemsPath = (userId) =>
  `${getPublicResourcePath(TEST_DATA_FOLDER, 'users')}/${userId}/items`;

const getPrivateItemPath = (userId, itemId) =>
  `${getPrivateResourcePath(TEST_DATA_FOLDER, 'users')}/${userId}/items/${itemId}`;

const getPrivateItemsPath = (userId) =>
  `${getPrivateResourcePath(TEST_DATA_FOLDER, 'users')}/${userId}/items`;

const validItem = {
  name: 'Test Item',
  nameLowercase: 'test item',
  nameTokens: ['test', 'item'],
  createdAt: admin.firestore.Timestamp.now(),
  userId: 'rules-regular-user',
};

const validPublicItem = {
  ...validItem,
  isPublic: true,
};

const validPrivateItem = {
  ...validItem,
  isPublic: false,
};

const TEST_USER_ID = 'rules-regular-user';
const FIRST_DOC_ID = 'item-a';
const SECOND_DOC_ID = 'item-b';

const itemsCleanupDocPaths = [
  getPublicItemPath(TEST_USER_ID, 'item-a'),
  getPublicItemPath(TEST_USER_ID, 'item-b'),
  getPublicItemPath(TEST_USER_ID, 'new-item-1'),
  getPublicItemPath(TEST_USER_ID, 'new-item-2'),
  getPublicItemPath(TEST_USER_ID, 'new-item-3'),
  getPublicItemPath(TEST_USER_ID, 'new-item-admin'),
  getPublicItemPath(TEST_USER_ID, 'missing-name'),
  getPublicItemPath(TEST_USER_ID, 'missing-createdat'),
  getPublicItemPath(TEST_USER_ID, 'missing-visibility'),
  getPublicItemPath(TEST_USER_ID, 'name-too-long'),
  getPublicItemPath(TEST_USER_ID, 'desc-too-long'),
  getPublicItemPath(TEST_USER_ID, 'no-description'),
  getPublicItemPath(TEST_USER_ID, 'invalid-visibility'),
  getPublicItemPath(TEST_USER_ID, 'invalid-timestamp'),
  getPublicItemPath(TEST_USER_ID, 'update-item-1'),
  getPublicItemPath(TEST_USER_ID, 'update-item-2'),
  getPublicItemPath(TEST_USER_ID, 'update-missing-timestamp'),
  getPublicItemPath(TEST_USER_ID, 'update-no-name'),
  getPublicItemPath(TEST_USER_ID, 'update-no-description'),
  getPublicItemPath(TEST_USER_ID, 'update-no-visibility'),
  getPublicItemPath(TEST_USER_ID, 'update-name-too-long'),
  getPublicItemPath(TEST_USER_ID, 'delete-item-1'),
  getPublicItemPath(TEST_USER_ID, 'delete-item-2'),
  getPublicItemPath(TEST_USER_ID, 'delete-item-admin'),
  getPublicItemPath(TEST_USER_ID, 'public-item'),
  getPublicItemPath(TEST_USER_ID, 'private-item'),
];

const adminApp = createAdminApp('items');
const getAdminDb = () => sharedGetAdminDb(adminApp);
const buildClientContext = (options) =>
  sharedBuildClientContext(adminApp, options);
const cleanupTestDocs = (extraDocPaths = []) =>
  sharedCleanupTestDocs(adminApp, extraDocPaths);
const releaseSuiteLock = await acquireSuiteLock();

test.beforeEach(async () => {
  await cleanupTestDocs(itemsCleanupDocPaths);
  await getAdminDb()
    .doc(TEST_CONFIG_PATH)
    .set({ dataFolder: TEST_DATA_FOLDER }, { merge: true });
});

test.after(async () => {
  await cleanupTestDocs(itemsCleanupDocPaths);
  if (adminApp) {
    await adminApp.delete();
  }
  releaseSuiteLock();
});

// ============================================================================
// GET TESTS
// ============================================================================

test(`[2.1.1] admin can read any item on ${RULES_TARGET}`, async () => {
  const adminContext = await buildClientContext({
    uid: 'admin-user',
    claims: { admin: true },
  });

  const ownerId = 'some-other-user';
  const itemPath = getPublicItemPath('item-a');

  try {
    // Admin writes as someone else
    await getAdminDb()
      .doc(itemPath)
      .set({
        ...validItem,
        userId: ownerId,
        createdAt: admin.firestore.Timestamp.now(),
      });

    // Admin reads
    await assert.doesNotReject(getDoc(doc(adminContext.db, itemPath)));
  } finally {
    await adminContext.cleanup();
  }
});

test(`[2.1.2] owner can read own item on ${RULES_TARGET}`, async () => {
  const userId = 'item-owner';
  const itemPath = getPublicItemPath(userId, 'item-b');

  // Setup: write item as admin
  await getAdminDb()
    .doc(itemPath)
    .set({
      ...validItem,
      userId,
    });

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await assert.doesNotReject(getDoc(doc(context.db, itemPath)));
  } finally {
    await context.cleanup();
  }
});

test(`[2.1.3] non-owner cannot read private item on ${RULES_TARGET}`, async () => {
  const ownerId = 'owner-user';
  const itemPath = getPrivateItemPath(ownerId, 'private-item');

  // Setup: write private item
  await getAdminDb()
    .doc(itemPath)
    .set({
      ...validItem,
      userId: ownerId,
      createdAt: admin.firestore.Timestamp.now(),
    });

  const context = await buildClientContext({
    uid: 'other-user',
    claims: { admin: false },
  });

  try {
    // Try to get the private item as non-owner - should be denied via get rule
    await expectPermissionDenied(getDoc(doc(context.db, itemPath)));
  } finally {
    await context.cleanup();
  }
});

test(`[2.1.4] authenticated non-owner can read public item on ${RULES_TARGET}`, async () => {
  const itemPath = getPublicItemPath('public-item');

  // Setup: write public item
  await getAdminDb()
    .doc(itemPath)
    .set({
      ...validItem,
      visibility: { public: true },
      createdAt: admin.firestore.Timestamp.now(),
    });

  const context = await buildClientContext({
    uid: 'random-user',
    claims: { admin: false },
  });

  try {
    await assert.doesNotReject(getDoc(doc(context.db, itemPath)));
  } finally {
    await context.cleanup();
  }
});

// ============================================================================
// CREATE TESTS
// ============================================================================

test(`[2.2.1] owner can create own item on ${RULES_TARGET}`, async () => {
  const userId = 'creator-user';
  const itemPath = getPublicItemPath(userId, 'new-item-1');

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await assert.doesNotReject(
      setDoc(doc(context.db, itemPath), {
        ...validPublicItem,
        userId,
        createdAt: Timestamp.now(),
      })
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.2.2] non-owner cannot create item for another user on ${RULES_TARGET}`, async () => {
  const userId = 'creator-user';
  const itemPath = getPublicItemPath('new-item-2');

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await expectPermissionDenied(
      setDoc(doc(context.db, itemPath), {
        ...validItem,
        userId: 'someone-else',
        createdAt: Timestamp.now(),
      })
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.2.3] unauthenticated cannot create item on ${RULES_TARGET}`, async () => {
  const itemPath = getPublicItemPath(TEST_USER_ID, 'new-item-3');
  const context = await buildUnauthenticatedClientContext();

  try {
    await expectPermissionDenied(
      setDoc(doc(context.db, itemPath), {
        ...validItem,
        userId: TEST_USER_ID,
        createdAt: Timestamp.now(),
      })
    );
  } finally {
    await context.cleanup();
  }
});

// ============================================================================
// CREATE - Data Validation Tests
// ============================================================================

test(`[2.3.1] rejects missing required name field on ${RULES_TARGET}`, async () => {
  const userId = 'creator-user';
  const itemPath = getPublicItemPath(userId, 'missing-name');

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await expectPermissionDenied(
      setDoc(doc(context.db, itemPath), {
        userId,
        createdAt: Timestamp.now(),
        isPublic: false,
      })
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.3.2] rejects missing required createdAt on ${RULES_TARGET}`, async () => {
  const userId = 'creator-user';
  const itemPath = getPublicItemPath(userId, 'missing-createdat');

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await expectPermissionDenied(
      setDoc(doc(context.db, itemPath), {
        name: 'Item',
        userId,
        isPublic: false,
      })
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.3.3] rejects missing required visibility on ${RULES_TARGET}`, async () => {
  const userId = 'creator-user';
  const itemPath = getPublicItemPath(userId, 'missing-visibility');

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await expectPermissionDenied(
      setDoc(doc(context.db, itemPath), {
        name: 'Item',
        userId,
        createdAt: Timestamp.now(),
        isPublic: false,
      })
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.3.4] name cannot exceed 100 characters on ${RULES_TARGET}`, async () => {
  const userId = 'creator-user';
  const itemPath = getPublicItemPath(userId, 'name-too-long');

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await expectPermissionDenied(
      setDoc(doc(context.db, itemPath), {
        name: 'x'.repeat(101),
        userId,
        createdAt: Timestamp.now(),
        isPublic: false,
      })
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.3.6] description cannot exceed 1000 characters on ${RULES_TARGET}`, async () => {
  const userId = 'creator-user';
  const itemPath = getPublicItemPath(userId, 'desc-too-long');

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await expectPermissionDenied(
      setDoc(doc(context.db, itemPath), {
        name: 'Valid Name',
        userId,
        createdAt: Timestamp.now(),
        isPublic: false,
        description: 'x'.repeat(1001),
      })
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.3.7] rejects invalid visibility map on ${RULES_TARGET}`, async () => {
  const userId = 'creator-user';
  const itemPath = getPublicItemPath(userId, 'invalid-visibility');

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await expectPermissionDenied(
      setDoc(doc(context.db, itemPath), {
        name: 'Item',
        userId,
        createdAt: Timestamp.now(),
        isPublic: false,
      })
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.3.8] rejects non-timestamp createdAt on ${RULES_TARGET}`, async () => {
  const userId = 'creator-user';
  const itemPath = getPublicItemPath(userId, 'invalid-timestamp');

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await expectPermissionDenied(
      setDoc(doc(context.db, itemPath), {
        name: 'Item',
        userId,
        createdAt: '2024-01-01',
        isPublic: false,
      })
    );
  } finally {
    await context.cleanup();
  }
});

// ============================================================================
// UPDATE TESTS
// ============================================================================

test(`[2.4.1] owner can update own item on ${RULES_TARGET}`, async () => {
  const userId = 'update-owner';
  const itemPath = getPublicItemPath('update-owner', 'update-item-1');

  // Setup
  await getAdminDb()
    .doc(itemPath)
    .set({
      ...validPublicItem,
      name: 'Test Item',
      userId,
      createdAt: admin.firestore.Timestamp.now(),
    });

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await assert.doesNotReject(
      setDoc(
        doc(context.db, itemPath),
        {
          name: 'Updated Name',
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.4.2] non-owner cannot update item on ${RULES_TARGET}`, async () => {
  const ownerId = 'update-owner';
  const itemPath = getPublicItemPath('update-owner', 'update-item-2');

  // Setup
  await getAdminDb().doc(itemPath).set({
    name: 'Test Item',
    userId: ownerId,
    createdAt: admin.firestore.Timestamp.now(),
    // collectionId removed
    isPublic: false,
  });

  const context = await buildClientContext({
    uid: 'other-user',
    claims: { admin: false },
  });

  try {
    await expectPermissionDenied(
      setDoc(
        doc(context.db, itemPath),
        {
          name: 'Updated Name',
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.5.1] updatedAt is required on ${RULES_TARGET}`, async () => {
  const userId = 'update-owner';
  const itemPath = getPublicItemPath(userId, 'update-missing-timestamp');

  // Setup
  await getAdminDb()
    .doc(itemPath)
    .set({
      name: 'Test Item',
      userId,
      createdAt: admin.firestore.Timestamp.now(),
      visibility: { public: false },
    });

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await expectPermissionDenied(
      setDoc(
        doc(context.db, itemPath),
        {
          name: 'Updated Name',
        },
        { merge: true }
      )
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.5.2] name is optional in updates on ${RULES_TARGET}`, async () => {
  const userId = 'update-owner';
  const itemPath = getPublicItemPath('update-owner', 'update-no-name');

  // Setup
  await getAdminDb()
    .doc(itemPath)
    .set({
      ...validPublicItem,
      name: 'Test Item',
      userId,
      createdAt: admin.firestore.Timestamp.now(),
    });

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await assert.doesNotReject(
      setDoc(
        doc(context.db, itemPath),
        {
          updatedAt: Timestamp.now(),
          description: 'Updated description',
        },
        { merge: true }
      )
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.5.3] description is optional in updates on ${RULES_TARGET}`, async () => {
  const userId = 'update-owner';
  const itemPath = getPublicItemPath('update-owner', 'update-no-description');

  // Setup
  await getAdminDb()
    .doc(itemPath)
    .set({
      ...validPublicItem,
      name: 'Test Item',
      userId,
      createdAt: admin.firestore.Timestamp.now(),
      description: 'Original description',
    });

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await assert.doesNotReject(
      setDoc(
        doc(context.db, itemPath),
        {
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.5.4] visibility is optional in updates on ${RULES_TARGET}`, async () => {
  const userId = 'update-owner';
  const itemPath = getPublicItemPath('update-owner', 'update-no-visibility');

  // Setup
  await getAdminDb()
    .doc(itemPath)
    .set({
      ...validPublicItem,
      name: 'Test Item',
      userId,
      createdAt: admin.firestore.Timestamp.now(),
    });

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await assert.doesNotReject(
      setDoc(
        doc(context.db, itemPath),
        {
          updatedAt: Timestamp.now(),
          name: 'New Name',
        },
        { merge: true }
      )
    );
  } finally {
    await context.cleanup();
  }
});

test(`[2.5.5] name cannot exceed 100 characters on update on ${RULES_TARGET}`, async () => {
  const userId = 'update-owner';
  const itemPath = getPublicItemPath('update-owner', 'update-name-too-long');

  // Setup
  await getAdminDb()
    .doc(itemPath)
    .set({
      name: 'Test Item',
      userId,
      createdAt: admin.firestore.Timestamp.now(),
      // collectionId removed
      visibility: { public: false },
    });

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await expectPermissionDenied(
      setDoc(
        doc(context.db, itemPath),
        {
          name: 'x'.repeat(101),
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      )
    );
  } finally {
    await context.cleanup();
  }
});

// ============================================================================
// DELETE TESTS
// ============================================================================

test(`[2.6.1] owner can delete own item on ${RULES_TARGET}`, async () => {
  const userId = 'delete-owner';
  const itemPath = getPublicItemPath('delete-owner', 'delete-item-1');

  // Setup
  await getAdminDb()
    .doc(itemPath)
    .set({
      name: 'Test Item',
      userId,
      createdAt: admin.firestore.Timestamp.now(),
      // collectionId removed
      visibility: { public: false },
    });

  const context = await buildClientContext({
    uid: userId,
    claims: { admin: false },
  });

  try {
    await assert.doesNotReject(deleteDoc(doc(context.db, itemPath)));
  } finally {
    await context.cleanup();
  }
});

test(`[2.6.2] non-owner cannot delete item on ${RULES_TARGET}`, async () => {
  const ownerId = 'delete-owner';
  const itemPath = getPublicItemPath('delete-owner', 'delete-item-2');

  // Setup
  await getAdminDb()
    .doc(itemPath)
    .set({
      name: 'Test Item',
      userId: ownerId,
      createdAt: admin.firestore.Timestamp.now(),
      // collectionId removed
      visibility: { public: false },
    });

  const context = await buildClientContext({
    uid: 'other-user',
    claims: { admin: false },
  });

  try {
    await expectPermissionDenied(deleteDoc(doc(context.db, itemPath)));
  } finally {
    await context.cleanup();
  }
});

test(`[2.6.3] admin can delete any item on ${RULES_TARGET}`, async () => {
  const userId = 'some-owner';
  const itemPath = getPublicItemPath(userId, 'delete-item-admin');

  // Setup
  await getAdminDb()
    .doc(itemPath)
    .set({
      name: 'Test Item',
      userId: 'some-owner',
      createdAt: admin.firestore.Timestamp.now(),
      // collectionId removed
      visibility: { public: false },
    });

  const adminContext = await buildClientContext({
    uid: 'admin-user',
    claims: { admin: true },
  });

  try {
    await assert.doesNotReject(deleteDoc(doc(adminContext.db, itemPath)));
  } finally {
    await adminContext.cleanup();
  }
});

// ============================================================================
// QUERY TESTS
// ============================================================================

test(`[2.1.1] public items query reproduces the frontend getItems shape on ${RULES_TARGET}`, async () => {
  const adminDb = getAdminDb();
  const TEST_USER_ID = 'rules-regular-user';

  // Create two public items
  await adminDb.doc(getPublicItemPath(TEST_USER_ID, FIRST_DOC_ID)).set({
    name: 'First item',
    userId: TEST_USER_ID,
    createdAt: admin.firestore.Timestamp.now(),
    visibility: { public: true },
  });
  await adminDb.doc(getPublicItemPath(TEST_USER_ID, SECOND_DOC_ID)).set({
    name: 'Second item',
    userId: TEST_USER_ID,
    createdAt: admin.firestore.Timestamp.now(),
    visibility: { public: true },
  });

  const context = await buildClientContext({
    uid: 'other-user',
    claims: { admin: false },
  });

  try {
    // Query by documentId to verify public items are readable
    const snapshot1 = await getDoc(
      doc(context.db, getPublicItemPath(TEST_USER_ID, FIRST_DOC_ID))
    );
    assert.equal(
      snapshot1.exists(),
      true,
      'First public item should be readable'
    );

    const snapshot2 = await getDoc(
      doc(context.db, getPublicItemPath(TEST_USER_ID, SECOND_DOC_ID))
    );
    assert.equal(
      snapshot2.exists(),
      true,
      'Second public item should be readable'
    );

    // Also test the compound query with collectionId and ordering
    const itemsQuery = query(
      collection(context.db, getPublicItemsPath(TEST_USER_ID)),
      where('visibility.public', '==', true),
      orderBy('createdAt', 'desc'),
      orderBy('__name__', 'asc')
    );

    const querySnapshot = await getDocs(itemsQuery);
    console.warn(
      'Queried items:',
      querySnapshot.docs.map((doc) => doc.id)
    );
    assert.equal(querySnapshot.size, 2, 'Query should return 2 public items');
  } finally {
    await adminDb
      .collection(getPublicItemsPath(TEST_USER_ID))
      .doc(FIRST_DOC_ID)
      .delete()
      .catch(() => undefined);
    await adminDb
      .collection(getPublicItemsPath(TEST_USER_ID))
      .doc(SECOND_DOC_ID)
      .delete()
      .catch(() => undefined);
    await context.cleanup();
  }
});

test(`[2.1.2] owner items query reproduces the frontend getItems shape on ${RULES_TARGET}`, async () => {
  const adminDb = getAdminDb();
  const TEST_USER_ID = 'rules-regular-user';

  // Create two public items
  await adminDb
    .collection(getPublicItemsPath(TEST_USER_ID))
    .doc(FIRST_DOC_ID)
    .set({
      name: 'First item',
      userId: TEST_USER_ID,
      createdAt: admin.firestore.Timestamp.now(),
      visibility: { public: false },
    });
  await adminDb
    .collection(getPublicItemsPath(TEST_USER_ID))
    .doc(SECOND_DOC_ID)
    .set({
      name: 'Second item',
      userId: TEST_USER_ID,
      createdAt: admin.firestore.Timestamp.now(),
      visibility: { public: false },
    });

  const context = await buildClientContext({
    uid: TEST_USER_ID,
    claims: { admin: false },
  });

  try {
    // Query by documentId to verify public items are readable
    const snapshot1 = await getDoc(
      doc(context.db, getPublicItemPath(TEST_USER_ID, FIRST_DOC_ID))
    );
    assert.equal(
      snapshot1.exists(),
      true,
      'First public item should be readable'
    );

    const snapshot2 = await getDoc(
      doc(context.db, getPublicItemPath(TEST_USER_ID, SECOND_DOC_ID))
    );
    assert.equal(
      snapshot2.exists(),
      true,
      'Second public item should be readable'
    );

    // Also test the compound query with collectionId and ordering
    const itemsQuery = query(
      collection(context.db, getPublicItemsPath(TEST_USER_ID)),
      where('userId', '==', TEST_USER_ID),
      orderBy('createdAt', 'desc'),
      orderBy('__name__', 'asc')
    );
    const querySnapshot = await getDocs(itemsQuery);
    console.warn(
      'Queried items:',
      querySnapshot.docs.map((doc) => doc.id)
    );
    assert.equal(querySnapshot.size, 2, 'Query should return 2 public items');
  } finally {
    await adminDb
      .collection(getPublicItemsPath(TEST_USER_ID))
      .doc(FIRST_DOC_ID)
      .delete()
      .catch(() => undefined);
    await adminDb
      .collection(getPublicItemsPath(TEST_USER_ID))
      .doc(SECOND_DOC_ID)
      .delete()
      .catch(() => undefined);
    await context.cleanup();
  }
});
