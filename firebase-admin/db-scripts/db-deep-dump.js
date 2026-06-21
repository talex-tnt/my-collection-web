const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const env = process.env.ENV;

const loadServiceAccount = () => {
  if (env === 'dev')
    return JSON.parse(fs.readFileSync('./retro-collections-dev.json', 'utf8'));
  if (env === 'prod')
    return JSON.parse(fs.readFileSync('./retro-collections-prod.json', 'utf8'));
  console.error("Invalid ENV value. Must be 'dev' or 'prod'.");
  process.exit(1);
};

// Fixed recursive function using listDocuments() to capture virtual/placeholder nodes
async function dumpCollection(collectionRef) {
  // CRITICAL FIX: listDocuments() finds ALL document IDs, even italicized/virtual ones
  const docRefs = await collectionRef.listDocuments();
  const collectionData = {};

  for (const docRef of docRefs) {
    const docId = docRef.id;
    const docSnap = await docRef.get();
    const subCollections = await docRef.listCollections();

    const docEntry = {};

    // Only map _data if the document actually contains fields
    if (docSnap.exists) {
      docEntry._data = docSnap.data();
    }

    // Process subcollections regardless of whether the parent document has data
    if (subCollections.length > 0) {
      docEntry._subcollections = {};
      for (const subCol of subCollections) {
        console.log(
          `   ↳ Digging into nested subcollection: "${subCol.id}" under doc: "${docId}"`
        );
        docEntry._subcollections[subCol.id] = await dumpCollection(subCol);
      }
    }

    // Only add to final dump if it has data OR has valid nested subcollections
    if (
      docSnap.exists ||
      (docEntry._subcollections &&
        Object.keys(docEntry._subcollections).length > 0)
    ) {
      collectionData[docId] = docEntry;
    }
  }

  return collectionData;
}

(async () => {
  try {
    const key = loadServiceAccount();
    const projectId = key.project_id;

    const app = initializeApp({ credential: cert(key) }, `deep-dump-${env}`);
    const db = getFirestore(app);

    console.log(
      `🚀 STARTING TRUE DEEP FIRESTORE DUMP for project: ${projectId} [ENV: ${env}]...`
    );

    const rootCollections = await db.listCollections();
    const finalDump = {};

    for (const col of rootCollections) {
      console.log(`📦 Extracting root collection: "${col.id}"...`);
      finalDump[col.id] = await dumpCollection(col);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `./firestore-deep-dump-${env}-${timestamp}.json`;

    fs.writeFileSync(fileName, JSON.stringify(finalDump, null, 2), 'utf8');

    console.log('\n=========================================');
    console.log(`🎉 TRUE DEEP DUMP COMPLETED SUCCESSFULLY!`);
    console.log(`📁 File saved: ${fileName}`);
    console.log('=========================================');
  } catch (error) {
    console.error('❌ Error during dump execution:', error);
    process.exit(1);
  }
})();
