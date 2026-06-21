import 'dotenv/config';

import admin from 'firebase-admin';
import fs from 'node:fs';

const env = process.env.ENV;
const shouldApply = process.argv.includes('--apply');
const overwrite = process.argv.includes('--overwrite');
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));

const parseLimit = (argValue) => {
  if (!argValue) return null;
  const raw = Number(argValue.split('=')[1]);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.floor(raw);
};

const limit = parseLimit(limitArg);

let serviceAccount = null;

if (env === 'dev') {
  serviceAccount = JSON.parse(fs.readFileSync('./retro-collections-dev.json', 'utf8'));
} else if (env === 'prod') {
  serviceAccount = JSON.parse(fs.readFileSync('./retro-collections-prod.json', 'utf8'));
} else {
  console.error("Invalid ENV value. Must be 'dev' or 'prod'.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const BATCH_LIMIT = 400;

const toWishesPath = (sourcePath) => {
  const segments = sourcePath.split('/');
  const index = segments.findIndex((segment) => segment === 'whishes');

  if (index === -1) {
    return null;
  }

  const nextSegments = [...segments];
  nextSegments[index] = 'wishes';
  return nextSegments.join('/');
};

const sourceSnapshot = await db.collectionGroup('whishes').get();

let scannedCount = 0;
let candidateCount = 0;
let skippedInvalidPathCount = 0;
let skippedExistingCount = 0;
let copiedCount = 0;
let committedBatches = 0;
let batchCount = 0;
let batch = db.batch();

for (const docSnap of sourceSnapshot.docs) {
  scannedCount += 1;

  if (limit && candidateCount >= limit) {
    break;
  }

  const sourcePath = docSnap.ref.path;
  const targetPath = toWishesPath(sourcePath);

  if (!targetPath || targetPath === sourcePath) {
    skippedInvalidPathCount += 1;
    continue;
  }

  candidateCount += 1;

  const targetRef = db.doc(targetPath);
  let targetExists = false;

  if (!overwrite) {
    const targetSnap = await targetRef.get();
    targetExists = targetSnap.exists;
  }

  if (targetExists) {
    skippedExistingCount += 1;
    continue;
  }

  copiedCount += 1;

  if (!shouldApply) {
    continue;
  }

  batch.set(targetRef, docSnap.data(), { merge: overwrite });
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
      overwrite,
      limit,
      scannedCount,
      candidateCount,
      copiedCount,
      skippedExistingCount,
      skippedInvalidPathCount,
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
