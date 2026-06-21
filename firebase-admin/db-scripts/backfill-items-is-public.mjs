import 'dotenv/config';

import admin from 'firebase-admin';
import fs from 'node:fs';

const env = process.env.ENV;
const dryRun = process.argv.includes('--dry-run');

let serviceAccount = null;

if (env === 'dev') {
  serviceAccount = JSON.parse(
    fs.readFileSync('./retro-collections-dev.json', 'utf8')
  );
} else if (env === 'prod') {
  serviceAccount = JSON.parse(
    fs.readFileSync('./retro-collections-prod.json', 'utf8')
  );
} else {
  console.error("Invalid ENV value. Must be 'dev' or 'prod'.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const BATCH_LIMIT = 400;

const inferIsPublicFromPath = (docPath) => docPath.includes('/public/');

const snapshot = await db.collectionGroup('items').get();

let processedCount = 0;
let updatedCount = 0;
let skippedCount = 0;
let committedBatches = 0;
let batchCount = 0;
let batch = db.batch();

for (const docSnap of snapshot.docs) {
  processedCount += 1;

  const inferredIsPublic = inferIsPublicFromPath(docSnap.ref.path);
  const currentIsPublic = docSnap.get('isPublic');

  if (currentIsPublic === inferredIsPublic) {
    skippedCount += 1;
    continue;
  }

  updatedCount += 1;

  if (dryRun) {
    continue;
  }

  batch.set(
    docSnap.ref,
    {
      isPublic: inferredIsPublic,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  batchCount += 1;

  if (batchCount >= BATCH_LIMIT) {
    await batch.commit();
    committedBatches += 1;
    batch = db.batch();
    batchCount = 0;
  }
}

if (!dryRun && batchCount > 0) {
  await batch.commit();
  committedBatches += 1;
}

console.log(
  JSON.stringify(
    {
      env,
      dryRun,
      processedCount,
      updatedCount,
      skippedCount,
      committedBatches,
    },
    null,
    2
  )
);

process.exit(0);
