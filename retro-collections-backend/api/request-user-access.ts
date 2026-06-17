import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Resend } from 'resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const originHeader = req.headers['origin'];
  
  // 1. Dynamic CORS Whitelist Configuration from consolidated env vars
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

  // Instantly handle browser preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // This endpoint strictly handles incoming access request payload initializations
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 2. Authorization Header Validation
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization token.' });
    }

    const token = authHeader.split('Bearer ')[1];
    const { message } = req.body;

    if (message && typeof message === 'string' && message.length > 500) {
      return res.status(400).json({ error: 'Message exceeds the maximum limit of 500 characters.' });
    }

    // 3. Normalized Environment Values (No downstream fallback conditional logic)
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return res.status(500).json({ error: 'Resend API key configuration is missing for this environment.' });
    }

    const resend = new Resend(resendApiKey);

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Access Gate <onboarding@resend.dev>';
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;

    if (!adminEmail) {
      return res.status(500).json({ error: 'Admin notification email configuration is missing for this environment.' });
    }

    // 4. Firebase Application Named Context Initializations
    const serviceAccount = { projectId, clientEmail, privateKey };
    
    // We name the app context via VERCEL_ENV if available ('production', 'preview', 'development')
    const appName = process.env.VERCEL_ENV || 'default-app';
    const activeApps = getApps();
    const existingApp = activeApps.find(app => app.name === appName);
    
    const currentApp = existingApp || initializeApp({ credential: cert(serviceAccount) }, appName);
    const authInstance = getAuth(currentApp);
    const dbInstance = getFirestore(currentApp);

    const runtimeConfigRef = dbInstance.doc('main/config/public/runtime');
    const runtimeConfigDoc = await runtimeConfigRef.get();
    const runtimeData = runtimeConfigDoc.data() as { dataFolder?: string } | undefined;
    const dataFolder =
      typeof runtimeData?.dataFolder === 'string' && runtimeData.dataFolder.trim().length > 0
        ? runtimeData.dataFolder.trim()
        : 'default';

    // 5. Requesting Identity Validation via JWT Decode
    const decodedToken = await authInstance.verifyIdToken(token);
    const { uid, email, name } = decodedToken;

    if (!email) {
      return res.status(400).json({ error: 'The authenticated Google account must have a valid email address.' });
    }

    // Generate local timestamp tracking metrics (YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0];

    // 6. Security & Safeguard Check: System Daily Rate Limiting
    const dailyLogRef = dbInstance.collection('system_logs').doc(todayStr);
    const dailyLogDoc = await dailyLogRef.get();
    
    if (dailyLogDoc.exists && (dailyLogDoc.data()?.count >= 5)) {
      return res.status(429).json({ 
        error: 'The maximum number of daily registration requests for the system has been reached. Please try again tomorrow.' 
      });
    }

    // 7. Double-Submission Check: Prevent Duplicated Requests
    const userRequestRef = dbInstance
      .collection('main')
      .doc('data')
      .collection(dataFolder)
      .doc('private')
      .collection('users-access-requests')
      .doc(uid);
    const userRequestDoc = await userRequestRef.get();

    if (userRequestDoc.exists) {
      return res.status(400).json({ error: 'You have already submitted an access request. It is currently pending evaluation.' });
    }

    // 8. Atomic Pipeline Operations: Commit user log and increment rate metric data
    const batch = dbInstance.batch();
    
    batch.set(userRequestRef, {
      uid,
      name: name || 'Anonymous User',
      email,
      message: message || '',
      status: 'pending',
      environment: appName,
      createdAt: FieldValue.serverTimestamp()
    });

    batch.set(dailyLogRef, { 
      count: FieldValue.increment(1) 
    }, { merge: true });

    await batch.commit();

    // 9. Dispatch Alert Email to Admin via Resend
    await resend.emails.send({
      from: fromEmail, 
      to: adminEmail,
      subject: `[${appName.toUpperCase()}] New Access Request from ${name || email}`,
      html: `
        <h2>New Access Request Pending</h2>
        <p>An unregistered user has requested access to the platform.</p>
        <hr />
        <p><strong>Name:</strong> ${name || 'N/A'}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Firebase UID:</strong> ${uid}</p>
        <p><strong>Environment:</strong> ${appName}</p>
        <p><strong>User Message:</strong></p>
        <blockquote style="background: #f9f9f9; padding: 10px; border-left: 3px solid #ccc;">
          ${message ? message.replace(/\n/g, '<br>') : '<i>No message provided.</i>'}
        </blockquote>
        <hr />
        <p>Log in to your admin console to approve this user.</p>
      `,
    });

    return res.status(200).json({ 
      message: 'Your access request has been successfully recorded. The administrator has been notified.' 
    });

  } catch (error: any) {
    console.error('Operational server failure during access request processing:', error);
    
    if (error.code && error.code.startsWith('auth/')) {
      return res.status(401).json({ error: 'Invalid/expired token signature authentication parameters.' });
    }

    return res.status(500).json({ 
      error: 'Structural processing errors or configuration mismatch on the server.' 
    });
  }
}