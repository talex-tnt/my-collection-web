import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

    // Convert headers to standard Web API format
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

    // Safely wrap the Node stream into a Web-compatible request payload
    const webRequest = new Request(`https://${req.headers.host}${req.url}`, {
      method: req.method,
      headers: webHeaders,
      body: toReadableStream(req),
      // @ts-ignore - Required for node fetch environments handling streams
      duplex: 'half',
    });

    const formData = await webRequest.formData();
    const parentFolderId = formData.get('parentFolderId') as string;
    const imageFiles = formData.getAll('images') as File[];
    
    const optionalTagsInput = formData.get('optionalTags') as string;
    const inputTags = optionalTagsInput 
      ? optionalTagsInput.split(',').map(t => t.trim()).filter(Boolean) 
      : [];

    if (!parentFolderId || imageFiles.length === 0) {
      return res.status(400).json({ error: 'Missing parentFolderId or images dataset.' });
    }

    const imageParts = await Promise.all(
      imageFiles.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        return {
          inlineData: {
            data: Buffer.from(arrayBuffer).toString('base64'),
            mimeType: file.type,
          },
        };
      })
    );

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        suggestedTitle: {
          type: Type.STRING,
          description: 'A concise, professional folder title for the product (max 40 characters), without punctuation or forbidden characters like slashes.',
        },
        descriptionEn: {
          type: Type.STRING,
          description: 'A comprehensive commercial and technical description of the product written in English.',
        },
        productTags: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'A list of relevant product tags. Evaluate the optional input tags provided, filtering out irrelevant ones and expanding the list with new accurate tags found from the images.',
        },
      },
      required: ['suggestedTitle', 'descriptionEn', 'productTags'],
    };

    const promptText = `Analyze these product images. 
    1. Propose a clean folder title.
    2. Provide a descriptive text in English.
    3. Review this list of optional input tags: [${inputTags.join(', ')}]. Filter out any tag that does not match the product, keep the valid ones, and add new highly relevant tags based on the images.`;

    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [...imageParts, promptText],
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      },
    });

    const aiResultParsed = JSON.parse(aiResponse.text || '{}');
    
    let suggestedTitle = aiResultParsed.suggestedTitle || 'unnamed-product';
    suggestedTitle = suggestedTitle.replace(/[\n\r\t]/g, '').replace(/[\\/:*?"<>|]/g, '');

    const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${parentFolderId}'+in+parents+and+mimeType='application/vnd.google-apps.folder'+and+trashed=false&fields=files(name)`;
    const driveResponse = await fetch(driveUrl, {
      headers: { Authorization: `Bearer ${driveToken}` },
    });

    if (!driveResponse.ok) {
      return res.status(500).json({ error: 'Failed to verify directories on Google Drive.' });
    }

    const driveData = await driveResponse.json();
    const existingFolderNames = new Set(
      (driveData.files || []).map((f: { name: string }) => f.name.toLowerCase())
    );

    let finalTitle = suggestedTitle;
    let counter = 1;
    while (existingFolderNames.has(finalTitle.toLowerCase())) {
      finalTitle = `${suggestedTitle} - ${counter}`;
      counter++;
    }

    return res.status(200).json({
      suggestedTitle: finalTitle,
      descriptionEn: aiResultParsed.descriptionEn || '',
      productTags: aiResultParsed.productTags || [],
    });

  } catch (error: any) {
   console.error('Error executing vision operations serverless task:', error);

    let clientMessage = 'Internal server processing exception.';
    
    // Check if the error message is a serialized Google API error string
    if (error?.message && typeof error.message === 'string') {
      try {
        const parsedMessage = JSON.parse(error.message);
        if (parsedMessage?.error?.message) {
          clientMessage = parsedMessage.error.message;
        }
      } catch {
        // Fallback if error.message is regular text
        clientMessage = error.message;
      }
    } else if (error?.statusText) {
      clientMessage = error.statusText;
    }

    return res.status(500).json({ 
      error: clientMessage 
    });
  }
}