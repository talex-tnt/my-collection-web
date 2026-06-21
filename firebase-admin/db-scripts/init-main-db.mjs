import 'dotenv/config';

import admin from 'firebase-admin';
import fs from 'node:fs';

const env = process.env.ENV;

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

const MAIN_ENV_DOC = 'main';
const DEFAULT_FOLDER = 'default';

const rootEnvRef = db.collection(MAIN_ENV_DOC);

const configCol = rootEnvRef.doc('config').collection('public');
const dataCol = rootEnvRef.doc('data').collection(DEFAULT_FOLDER);

// Clear everything except the runtime config we (re)create below.
// This is a dev-environment initializer; it intentionally wipes data.
if (typeof db.recursiveDelete === 'function') {
  await db.recursiveDelete(dataCol);
  await db.recursiveDelete(configCol);
} else {
  // Fallback: delete only the known docs we used previously.
  // (Full recursive delete requires Firestore recursiveDelete support.)
  await configCol
    .doc('runtime')
    .delete()
    .catch(() => undefined);
  await dataCol
    .doc('public')
    .delete()
    .catch(() => undefined);
}

// Runtime config doc (admin writable, authenticated readable in rules)
await configCol.doc('runtime').set(
  {
    dataFolder: DEFAULT_FOLDER,
    initializedAt: admin.firestore.FieldValue.serverTimestamp(),
  },
  { merge: true }
);

console.log(
  `Initialized main/config/public/runtime with dataFolder=${DEFAULT_FOLDER} and cleared main/data/${DEFAULT_FOLDER}/**`
);
process.exit(0);
