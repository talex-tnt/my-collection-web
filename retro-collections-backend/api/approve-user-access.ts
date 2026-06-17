import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const originHeader = req.headers['origin'];

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [];

  const isAllowedOrigin = !!originHeader && allowedOrigins.includes(originHeader);

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', originHeader);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json({ error: 'Missing or malformed Authorization token.' });
    }

    const token = authHeader.split('Bearer ')[1];
    const { uidToManage, emailToManage } = req.body as {
      uidToManage?: string;
      emailToManage?: string;
    };

    if (!uidToManage && !emailToManage) {
      return res.status(400).json({
        error: 'Missing target identifier. Provide either uidToManage or emailToManage.',
      });
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    const serviceAccount = { projectId, clientEmail, privateKey };

    const appName = process.env.VERCEL_ENV || 'default-app';
    const activeApps = getApps();
    const existingApp = activeApps.find((app) => app.name === appName);

    const currentApp =
      existingApp || initializeApp({ credential: cert(serviceAccount) }, appName);
    const authInstance = getAuth(currentApp);
    const dbInstance = getFirestore(currentApp);

    const decodedToken = await authInstance.verifyIdToken(token);
    if (!decodedToken.admin) {
      return res
        .status(403)
        .json({ error: 'Access Denied. Administrator privileges required.' });
    }

    let targetUser;
    if (emailToManage && typeof emailToManage === 'string') {
      targetUser = await authInstance.getUserByEmail(emailToManage);
    } else if (uidToManage && typeof uidToManage === 'string') {
      targetUser = await authInstance.getUser(uidToManage);
    } else {
      return res.status(400).json({
        error: 'Invalid format for uidToManage or emailToManage.',
      });
    }

    const runtimeConfigRef = dbInstance.doc('main/config/public/runtime');
    const runtimeConfigDoc = await runtimeConfigRef.get();
    const runtimeData = runtimeConfigDoc.data() as { dataFolder?: string } | undefined;
    const dataFolder =
      typeof runtimeData?.dataFolder === 'string' && runtimeData.dataFolder.trim().length > 0
        ? runtimeData.dataFolder.trim()
        : 'default';

    const finalUid = targetUser.uid;
    const normalizedEmail = (targetUser.email || emailToManage || '').toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({
        error: 'Target user has no valid email and cannot be added to authorized-users.',
      });
    }

    const currentClaims = targetUser.customClaims || {};
    await authInstance.setCustomUserClaims(finalUid, {
      ...currentClaims,
      enabled: true,
    });

    const authorizedUserRef = dbInstance
      .collection('main')
      .doc('data')
      .collection(dataFolder)
      .doc('private')
      .collection('authorized-users')
      .doc(normalizedEmail);

    const accessRequestRef = dbInstance
      .collection('main')
      .doc('data')
      .collection(dataFolder)
      .doc('private')
      .collection('users-access-requests')
      .doc(finalUid);

    const requestSnapshot = await accessRequestRef.get();

    const batch = dbInstance.batch();
    batch.set(
      authorizedUserRef,
      {
        addedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (requestSnapshot.exists) {
      batch.delete(accessRequestRef);
    }

    await batch.commit();

    return res.status(200).json({
      message: `User ${normalizedEmail} approved and enabled in ${appName}.`,
      uid: finalUid,
      email: normalizedEmail,
      pendingRequestRemoved: requestSnapshot.exists,
    });
  } catch (error: any) {
    console.error('Operational server failure during approval flow:', error);

    if (error.code && error.code.startsWith('auth/')) {
      return res
        .status(401)
        .json({ error: 'Invalid/expired token signature authentication parameters.' });
    }

    return res.status(500).json({
      error: 'Structural processing errors or configuration mismatch on the server.',
    });
  }
}
