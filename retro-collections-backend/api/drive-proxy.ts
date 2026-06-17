import type { VercelRequest, VercelResponse } from '@vercel/node';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id, sz } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing Google Drive File ID' });
  }

  const size = typeof sz === 'string' ? sz : 'w400';

  try {
    // 2. Fetch the target thumbnail asset directly from Google Drive
    const googleUrl = `https://drive.google.com/thumbnail?id=${id}&sz=${size}`;
    const response = await fetch(googleUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch from Google Drive' });
    }

    // 3. Process the binary payload and stream back the image asset
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=43200');

    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ error: 'Internal Server Error', details: String(error) });
  }
}