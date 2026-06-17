import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const originHeader = req.headers['origin'];
  
  // 1. Dynamic CORS configuration driven by Vercel environment targets
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
    // 2. Authorization Header verification
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization token.' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Removed 'env' parameter since Vercel automatically routes to the right project keys
    const { uidToManage, emailToManage } = req.body;

    if (!uidToManage && !emailToManage) {
      return res.status(400).json({ error: 'Missing target identifier. Provide either uidToManage or emailToManage.' });
    }

    // 3. Simplified Firebase initialization using unified environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    const serviceAccount = { projectId, clientEmail, privateKey };

    // Use a single Firebase app instance per environment (separated at deployment time)
    const appName = process.env.VERCEL_ENV || 'default-app';
    const activeApps = getApps();
    const existingApp = activeApps.find(app => app.name === appName);
    
    const currentApp = existingApp || initializeApp({ credential: cert(serviceAccount) }, appName);
    const authInstance = getAuth(currentApp);

    // 4. Administrator status identity check
    const decodedToken = await authInstance.verifyIdToken(token);
    if (!decodedToken.admin) {
      return res.status(403).json({ error: 'Access Denied. Administrator privileges required.' });
    }

    let finalUid = uidToManage;
    let targetUser;

    try {
      if (emailToManage && typeof emailToManage === 'string') {
        targetUser = await authInstance.getUserByEmail(emailToManage);
        finalUid = targetUser.uid;
      } else if (uidToManage && typeof uidToManage === 'string') {
        targetUser = await authInstance.getUser(uidToManage);
      } else {
        return res.status(400).json({ error: 'Invalid format for uidToManage or emailToManage.' });
      }
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        return res.status(404).json({ error: 'The requested target user could not be found.' });
      }
      throw authError;
    }

    const currentClaims = targetUser.customClaims || {};
    let targetStateMessage = '';

    // 5. Manage target custom claims states
    if (req.method === 'POST') {
      await authInstance.setCustomUserClaims(finalUid, {
        ...currentClaims,
        enabled: true,
      });
      targetStateMessage = `User profile status initialized to enabled in ${appName}.`;
    } else if (req.method === 'DELETE') {
      const updatedClaims = { ...currentClaims };
      delete updatedClaims.enabled;
      
      await authInstance.setCustomUserClaims(finalUid, updatedClaims);
      targetStateMessage = `User profile configuration cleared and disabled in ${appName}.`;
    }

    return res.status(200).json({ message: targetStateMessage, uid: finalUid });

  } catch (error: any) {
    console.error('Operational server failure tracking trace:', error);
    
    if (error.code && error.code.startsWith('auth/')) {
      return res.status(401).json({ error: 'Invalid/expired token signature authentication parameters.' });
    }

    return res.status(500).json({ 
      error: 'Structural processing errors or configuration mismatch on the server.' 
    });
  }
}