import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  getFirestore,
  FieldPath,
  Timestamp,
  type Query,
} from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';

type SortBy = 'createdAt' | 'updatedAt' | 'name';

type Cursor = {
  id: string;
  docPath?: string;
  createdAt?: string;
  updatedAt?: string;
  nameLowercase?: string;
};

type PublicItem = {
  id: string;
  name: string;
  userId: string;
  collectionId?: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  tags?: string[];
  metadata?: {
    imageFolder?: unknown;
    previewImage?: unknown;
  };
  isPublic: boolean;
};

type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const getClientIp = (req: VercelRequest): string => {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
};

const enforceRateLimit = async ({
  db,
  requesterUid,
  ip,
}: {
  db: FirebaseFirestore.Firestore;
  requesterUid: string;
  ip: string;
}): Promise<RateLimitDecision> => {
  const windowSeconds = parsePositiveInt(
    process.env.PUBLIC_ITEMS_RATE_LIMIT_WINDOW_SECONDS,
    60
  );
  const maxRequests = parsePositiveInt(
    process.env.PUBLIC_ITEMS_RATE_LIMIT_MAX_REQUESTS,
    60
  );

  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;
  const bucketStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const bucketId = new Date(bucketStartMs).toISOString();

  const keyHash = createHash('sha256')
    .update(`${requesterUid}:${ip}`)
    .digest('hex')
    .slice(0, 24);

  const rateLimitRef = db
    .collection('system')
    .doc('rateLimits')
    .collection('getPublicItems')
    .doc(`${bucketId}_${keyHash}`);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(rateLimitRef);
    const currentCount = snap.exists
      ? Number((snap.data() as { count?: number }).count || 0)
      : 0;

    if (currentCount >= maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucketStartMs + windowMs - nowMs) / 1000)
      );
      return { allowed: false as const, retryAfterSeconds };
    }

    const nextCount = currentCount + 1;
    tx.set(
      rateLimitRef,
      {
        keyHash,
        requesterUid,
        count: nextCount,
        windowStart: Timestamp.fromMillis(bucketStartMs),
        expiresAt: Timestamp.fromMillis(bucketStartMs + windowMs * 2),
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );

    return {
      allowed: true as const,
      remaining: Math.max(0, maxRequests - nextCount),
    };
  });

  return result;
};

const tokenizeName = (name: string): string[] =>
  Array.from(new Set(name.trim().toLowerCase().split(/\s+/).filter(Boolean)));

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const parseTags = (rawTags: unknown): string[] => {
  if (Array.isArray(rawTags)) {
    return rawTags
      .flatMap((entry) => (typeof entry === 'string' ? entry.split(',') : []))
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  if (typeof rawTags === 'string') {
    return rawTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
};

const parseCursor = (rawCursor: unknown): Cursor | null => {
  if (typeof rawCursor !== 'string' || rawCursor.trim().length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawCursor) as Cursor;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.id !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const parseLimit = (rawLimit: unknown): number | undefined => {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(Math.floor(parsed), 100);
};

const mapItem = (docSnap: FirebaseFirestore.QueryDocumentSnapshot): PublicItem => {
  const data = docSnap.data() as {
    name: string;
    userId: string;
    collectionId?: string;
    createdAt?: Timestamp;
    updatedAt?: Timestamp;
    description?: string;
    tags?: string[];
    metadata?: {
      imageFolder?: unknown;
      previewImage?: unknown;
    };
    isPublic?: boolean;
  };

  return {
    id: docSnap.id,
    name: data.name,
    userId: data.userId,
    collectionId: data.collectionId,
    createdAt: data.createdAt?.toDate().toISOString() ?? '',
    updatedAt: data.updatedAt?.toDate().toISOString(),
    description: data.description,
    tags: data.tags || [],
    metadata: data.metadata,
    isPublic: data.isPublic === true,
  };
};

const applyCursor = (
  db: FirebaseFirestore.Firestore,
  queryRef: Query,
  sortBy: SortBy,
  prefix: string | undefined,
  startAfterCursor: Cursor
): Query => {
  const cursorDocRef = startAfterCursor.docPath
    ? db.doc(startAfterCursor.docPath)
    : db.collection('_invalid').doc(startAfterCursor.id);

  if (prefix || sortBy === 'name') {
    return queryRef.startAfter(startAfterCursor.nameLowercase ?? '', cursorDocRef);
  }

  if (sortBy === 'createdAt') {
    return queryRef.startAfter(
      Timestamp.fromDate(new Date(startAfterCursor.createdAt || new Date(0).toISOString())),
      cursorDocRef
    );
  }

  return queryRef.startAfter(
    Timestamp.fromDate(
      new Date(startAfterCursor.updatedAt || startAfterCursor.createdAt || new Date(0).toISOString())
    ),
    cursorDocRef
  );
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const originHeader = req.headers.origin;
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [];
  const isAllowedOrigin = !!originHeader && allowedOrigins.includes(originHeader);

  res.setHeader('Access-Control-Allow-Origin', isAllowedOrigin ? originHeader : 'null');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization token.' });
    }

    const token = authHeader.split('Bearer ')[1];

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      return res.status(500).json({ error: 'Missing Firebase service account configuration.' });
    }

    const appName = process.env.VERCEL_ENV || 'default-app';
    const existingApp = getApps().find((app) => app.name === appName);
    const app =
      existingApp ||
      initializeApp(
        {
          credential: cert({ projectId, clientEmail, privateKey }),
        },
        appName
      );

    const auth = getAuth(app);
    const decodedToken = await auth.verifyIdToken(token);

    const db = getFirestore(app);
    const requesterUid = decodedToken.uid;
    const clientIp = getClientIp(req);

    const rateLimitDecision = await enforceRateLimit({
      db,
      requesterUid,
      ip: clientIp,
    });

    if (!rateLimitDecision.allowed) {
      res.setHeader('Retry-After', String(rateLimitDecision.retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many requests. Please retry later.',
        retryAfterSeconds: rateLimitDecision.retryAfterSeconds,
      });
    }

    res.setHeader('X-RateLimit-Remaining', String(rateLimitDecision.remaining));

    const userId = toStringOrUndefined(req.query.userId);
    if (!userId) {
      return res.status(400).json({ error: 'Missing required userId parameter.' });
    }

    const tags = parseTags(req.query.tags);
    const startWithNameFilter = toStringOrUndefined(req.query.startWithNameFilter)?.toLowerCase();
    const nameContainsTokens = toStringOrUndefined(req.query.nameContainsTokens);
    const sortBy = (toStringOrUndefined(req.query.sortBy) || 'updatedAt') as SortBy;
    const limit = Math.min(parseLimit(req.query.limit) ?? 25, 25);
    const cursor = parseCursor(req.query.startAfter);

    let queryRef: Query = db.collectionGroup('items');
    queryRef = queryRef.where('userId', '==', userId).where('isPublic', '==', true);

    if (tags.length) {
      queryRef = queryRef.where('tags', 'array-contains-any', tags.slice(0, 10));
    }

    if (nameContainsTokens) {
      const tokens = tokenizeName(nameContainsTokens);
      if (tokens.length) {
        queryRef = queryRef.where('nameTokens', 'array-contains', tokens[0]);
      }
    }

    if (startWithNameFilter) {
      queryRef = queryRef
        .where('nameLowercase', '>=', startWithNameFilter)
        .where('nameLowercase', '<=', `${startWithNameFilter}\uf8ff`)
        .orderBy('nameLowercase', 'asc');
    } else if (sortBy === 'name') {
      queryRef = queryRef.orderBy('nameLowercase', 'asc');
    } else if (sortBy === 'createdAt') {
      queryRef = queryRef.orderBy('createdAt', 'desc');
    } else {
      queryRef = queryRef.orderBy('updatedAt', 'desc');
    }

    queryRef = queryRef.orderBy(FieldPath.documentId(), 'asc');

    if (cursor) {
      queryRef = applyCursor(db, queryRef, sortBy, startWithNameFilter, cursor);
    }

    const countSnapshot = await queryRef.count().get();
    const totalCount = countSnapshot.data().count;

    const listQuery = limit ? queryRef.limit(limit + 1) : queryRef;
    const listSnapshot = await listQuery.get();

    const rawDocs = listSnapshot.docs;
    const hasNextPage = limit ? rawDocs.length > limit : false;
    const pagedDocs = hasNextPage ? rawDocs.slice(0, limit) : rawDocs;
    const items = pagedDocs.map(mapItem);

    const lastDoc = pagedDocs[pagedDocs.length - 1];
    const lastItem = items[items.length - 1];

    return res.status(200).json({
      items,
      totalCount,
      pageInfo: {
        endCursor:
          lastDoc && lastItem
            ? {
                id: lastItem.id,
                docPath: lastDoc.ref.path,
                createdAt: lastItem.createdAt,
                updatedAt: lastItem.updatedAt,
                nameLowercase: lastItem.name.toLowerCase(),
              }
            : null,
        hasNextPage,
      },
    });
  } catch (error: any) {
    if (error?.code?.startsWith?.('auth/')) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }

    console.error('get-public-items endpoint failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
