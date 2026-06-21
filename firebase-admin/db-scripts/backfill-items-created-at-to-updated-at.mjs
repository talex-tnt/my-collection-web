import 'dotenv/config';

import admin from 'firebase-admin';
import fs from 'node:fs';

const env = process.env.ENV;
const shouldApply = process.argv.includes('--apply');
const force = process.argv.includes('--force');

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
const snapshot = await db.collectionGroup('items').get();

let scannedCount = 0;
let candidateCount = 0;
let updatedCount = 0;
let skippedMissingCreatedAtCount = 0;
let skippedAlreadyEqualCount = 0;
let batchCount = 0;
let committedBatches = 0;
let batch = db.batch();

for (const docSnap of snapshot.docs) {
  scannedCount += 1;

  const createdAt = docSnap.get('createdAt');
  const currentUpdatedAt = docSnap.get('updatedAt');

  if (!(createdAt instanceof admin.firestore.Timestamp)) {
    skippedMissingCreatedAtCount += 1;
    continue;
  }

  const alreadyEqual =
    currentUpdatedAt instanceof admin.firestore.Timestamp &&
    currentUpdatedAt.isEqual(createdAt);

  if (!force && alreadyEqual) {
    skippedAlreadyEqualCount += 1;
    continue;
  }

  candidateCount += 1;

  if (!shouldApply) {
    continue;
  }

  batch.set(
    docSnap.ref,
    {
      updatedAt: createdAt,
    },
    { merge: true }
  );

  updatedCount += 1;
  batchCount += 1;

  if (batchCount >= BATCH_LIMIT) {
    await batch.commit();
    committedBatches += 1;
    batch = db.batch();
    batchCount = 0;
  }
}

if (shouldApply && batchCount > 0) {
  await batch.commit();
  committedBatches += 1;
}

console.log(
  JSON.stringify(
    {
      env,
      mode: shouldApply ? 'apply' : 'dry-run',
      force,
      scannedCount,
      candidateCount,
      updatedCount,
      skippedMissingCreatedAtCount,
      skippedAlreadyEqualCount,
      committedBatches,
    },
    null,
    2
  )
);

if (!shouldApply) {
  console.log('Dry-run completed. Re-run with --apply to execute writes.');
}

process.exit(0);
