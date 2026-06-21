const fs = require('fs');
const crypto = require('crypto');

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

const header = { alg: 'RS256', typ: 'JWT' };
const now = Math.floor(Date.now() / 1000);
const claimSet = {
  iss: key.client_email,
  scope: 'https://www.googleapis.com/auth/datastore',
  aud: 'https://oauth2.googleapis.com/token',
  exp: now + 3600,
  iat: now,
};
const base64url = (obj) =>
  Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const unsigned = `${base64url(header)}.${base64url(claimSet)}`;
const sign = crypto
  .createSign('RSA-SHA256')
  .update(unsigned)
  .sign(key.private_key, 'base64');
const jwt = `${unsigned}.${sign.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
(async () => {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson.access_token;
  for (const collectionGroup of ['collections', 'items']) {
    const idxRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/retro-collection-495607/databases/(default)/collectionGroups/${collectionGroup}/indexes`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    console.log('collectionGroup', collectionGroup, 'status', idxRes.status);
    console.log(await idxRes.text());
  }
})();
