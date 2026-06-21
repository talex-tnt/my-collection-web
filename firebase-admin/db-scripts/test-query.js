const admin = require('firebase-admin');
const fs = require('fs');

const env = process.env.ENV;

let key = null;

if (env === 'dev') {
  console.log('Using dev service account');

  key = JSON.parse(fs.readFileSync('./retro-collections-dev.json', 'utf8'));
} else if (env === 'prod') {
  console.log('Using prod service account');

  key = JSON.parse(fs.readFileSync('./retro-collections-prod.json', 'utf8'));
} else {
  console.error("Invalid ENV value. Must be 'dev' or 'prod'.");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();
(async () => {
  const q = db
    .collection('collections')
    .where('userId', '==', 'dummy')
    .orderBy('createdAt', 'desc');
  console.log('query built');
  try {
    const s = await q.limit(1).get();
    console.log('snapshot size', s.size);
  } catch (e) {
    console.error('ERROR');
    console.error(e.toString());
    console.error(e.stack);
    process.exit(1);
  }
})();
