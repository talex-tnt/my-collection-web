import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization token.' });
    }

    const token = authHeader.split('Bearer ')[1];
    const { uidToManage, env } = req.body;

    if (!uidToManage || typeof uidToManage !== 'string') {
      return res.status(400).json({ error: 'Missing target user UID.' });
    }

    const isProdSelection = env === 'prod';
    
    const projectId = isProdSelection ? process.env.FIREBASE_PROJECT_ID_PROD : process.env.FIREBASE_PROJECT_ID_DEV;
    const clientEmail = isProdSelection ? process.env.FIREBASE_CLIENT_EMAIL_PROD : process.env.FIREBASE_CLIENT_EMAIL_DEV;
    const privateKey = isProdSelection 
      ? process.env.FIREBASE_PRIVATE_KEY_PROD?.replace(/\\n/g, '\n')
      : process.env.FIREBASE_PRIVATE_KEY_DEV?.replace(/\\n/g, '\n');

    const serviceAccount = { projectId, clientEmail, privateKey };

    const appName = isProdSelection ? 'prod-app' : 'dev-app';
    const activeApps = getApps();
    const existingApp = activeApps.find(app => app.name === appName);
    
    const currentApp = existingApp || initializeApp({ credential: cert(serviceAccount) }, appName);
    const authInstance = getAuth(currentApp);

    const decodedToken = await authInstance.verifyIdToken(token);

    if (!decodedToken.admin) {
      return res.status(403).json({ error: 'Access Denied. Administrator privileges required.' });
    }

    const targetUser = await authInstance.getUser(uidToManage);
    const currentClaims = targetUser.customClaims || {};

    let targetStateMessage = '';

    if (req.method === 'POST') {
      await authInstance.setCustomUserClaims(uidToManage, {
        ...currentClaims,
        enabled: true,
      });
      targetStateMessage = `User profile status initialized to enabled in ${appName}.`;
    } else if (req.method === 'DELETE') {
      const updatedClaims = { ...currentClaims };
      delete updatedClaims.enabled;
      
      await authInstance.setCustomUserClaims(uidToManage, updatedClaims);
      targetStateMessage = `User profile configuration cleared and disabled in ${appName}.`;
    }

    return res.status(200).json({ message: targetStateMessage, uid: uidToManage });

  } catch (error) {
    console.error('Operational server failure tracking trace:', error);
    return res.status(401).json({ 
      error: 'Invalid/expired token signature authentication parameters, or structural processing errors.' 
    });
  }
}