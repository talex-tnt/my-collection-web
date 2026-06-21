import 'dotenv/config';

import admin from 'firebase-admin';

import fs from 'fs';

const env = process.env.ENV;

let serviceAccount = null;

if (env === 'dev') {
  console.log('Using dev service account');

  serviceAccount = JSON.parse(
    fs.readFileSync('./retro-collections-dev.json', 'utf8')
  );
} else if (env === 'prod') {
  console.log('Using prod service account');

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

const uid = process.env.ADMIN_UID;

if (!uid) {
  console.error('Missing ADMIN_UID env variable');
  process.exit(1);
}

await admin.auth().setCustomUserClaims(uid, {
  admin: true,
});

console.log(`Admin set for UID: ${uid}`);
process.exit();
