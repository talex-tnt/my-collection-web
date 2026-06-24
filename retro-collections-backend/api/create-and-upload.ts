import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to convert Vercel's Node request stream into a Web standard ReadableStream
function toReadableStream(req: VercelRequest): ReadableStream {
  return new ReadableStream({
    start(controller) {
      req.on('data', (chunk) => controller.enqueue(chunk));
      req.on('end', () => controller.close());
      req.on('error', (err) => controller.error(err));
    },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const originHeader = req.headers['origin'];
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [];

  const isAllowedOrigin = !!originHeader && (allowedOrigins.includes(originHeader) || originHeader.includes('localhost:'));

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', originHeader!);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, X-Drive-Token'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const driveToken = req.headers['x-drive-token'] as string;
    if (!driveToken) {
      return res.status(401).json({ error: 'Missing Google Drive Access Token.' });
    }

    const webHeaders = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((v) => webHeaders.append(key, v));
        } else {
          webHeaders.set(key, value);
        }
      }
    });

    const webRequest = new Request(`https://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: webHeaders,
      body: toReadableStream(req),
      // @ts-ignore
      duplex: 'half',
    });

    const formData = await webRequest.formData();
    const parentFolderId = formData.get('parentFolderId') as string;
    const newFolderName = formData.get('newFolderName') as string;
    const imageFiles = formData.getAll('images') as File[];

    if (!parentFolderId || !newFolderName || imageFiles.length === 0) {
      return res.status(400).json({ error: 'Missing parentFolderId, newFolderName or images dataset.' });
    }

    // 1. Create the new directory inside the parent target folder
    const createFolderUrl = 'https://www.googleapis.com/drive/v3/files';
    const folderMetadata = {
      name: newFolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    };

    const folderResponse = await fetch(createFolderUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${driveToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(folderMetadata),
    });

    if (!folderResponse.ok) {
      const errorText = await folderResponse.text();
      throw new Error(`Google Drive folder creation failed: ${errorText}`);
    }

    const folderData = (await folderResponse.json()) as { id: string };
    const createdFolderId = folderData.id;

    // Standard Web encoder to handle the string parts
    const encoder = new TextEncoder();

    // 2. Upload images sequentially into the newly created folder and return their drive details
    const uploadedFiles = await Promise.all(
      imageFiles.map(async (file, index) => {
        const arrayBuffer = await file.arrayBuffer();
        const fileBytes = new Uint8Array(arrayBuffer);

        const extension = file.name.split('.').pop() || 'jpeg';
        const finalFileName = index === 0 ? `Preview.${extension}` : file.name;

        const boundary = '----VercelUploadBoundaryProcess';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;

        const metadataPart = JSON.stringify({
          name: finalFileName,
          parents: [createdFolderId],
        });

        // Encode strings directly into Web-standard Uint8Arrays
        const headerBytes = encoder.encode(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + metadataPart);
        const midBytes = encoder.encode('\r\n' + delimiter + `Content-Type: ${file.type}\r\n\r\n`);
        const footerBytes = encoder.encode(closeDelimiter);

        // Calculate combined byte size
        const totalLength = headerBytes.length + midBytes.length + fileBytes.length + footerBytes.length;
        const webBody = new Uint8Array(totalLength);

        // Assemble the multipart data using standard Uint8Array allocations
        let offset = 0;
        webBody.set(headerBytes, offset); offset += headerBytes.length;
        webBody.set(midBytes, offset);    offset += midBytes.length;
        webBody.set(fileBytes, offset);   offset += fileBytes.length;
        webBody.set(footerBytes, offset);

        const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${driveToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: webBody,
        });

        if (!uploadResponse.ok) {
          const uploadErrorText = await uploadResponse.text();
          throw new Error(`Failed uploading file ${file.name}: ${uploadErrorText}`);
        }

        // Fixed: Parse the body response JSON to extract the newly created Drive File metadata block
        const fileData = (await uploadResponse.json()) as { id: string; name: string };
        return {
          id: fileData.id,
          name: fileData.name,
        };
      })
    );

    // Fixed: Return folderId along with the array of uploaded file identities 
    return res.status(200).json({
      folderId: createdFolderId,
      files: uploadedFiles,
    });

  } catch (error: unknown) {
    console.error('Error executing drive creation and upload serverless task:', error);

    let clientMessage = 'Internal server processing exception.';
    const err = error as { message?: string; statusText?: string };

    if (err?.message && typeof err.message === 'string') {
      try {
        const parsedMessage = JSON.parse(err.message);
        if (parsedMessage?.error?.message) {
          clientMessage = parsedMessage.error.message;
        }
      } catch {
        clientMessage = err.message;
      }
    } else if (err?.statusText) {
      clientMessage = err.statusText;
    }

    return res.status(500).json({ 
      error: clientMessage 
    });
  }
}