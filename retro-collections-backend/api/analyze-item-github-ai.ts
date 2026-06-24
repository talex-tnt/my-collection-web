import type { VercelRequest, VercelResponse } from '@vercel/node';
import ModelClient from '@azure-rest/ai-inference';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Initialize the GitHub Models client directly with options
const githubToken = process.env.GITHUB_TOKEN || '';
const client = ModelClient(
  'https://models.inference.ai.azure.com',
  { key: githubToken }
);

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

    // Map files to standard data URL layout required by OpenAI-compatible vision schemas
    const imageMessageContent = await Promise.all(
      imageFiles.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const base64String = Buffer.from(arrayBuffer).toString('base64');
        return {
          type: 'image_url' as const,
          image_url: {
            url: `data:${file.type};base64,${base64String}`,
          },
        };
      })
    );

    // Structure JSON response definition conforming to JSON Schema format
    const jsonResponseSchema = {
      type: 'object',
      properties: {
        suggestedTitle: {
          type: 'string',
          description: 'A concise, professional folder title for the product (max 40 characters), without punctuation or forbidden characters like slashes.',
        },
        descriptionEn: {
          type: 'string',
          description: 'A very short description of the physical product written in English highlighting key unique or rare features visible only in the image layout.',
        },
        productTags: {
          type: 'array',
          items: { type: 'string' },
          description: 'A list of evaluated, refined lowercase tags matching the format rules.',
        },
      },
      required: ['suggestedTitle', 'descriptionEn', 'productTags'],
      additionalProperties: false
    };

    const promptText = `Analyze these product images. 
    1. Propose a clean folder title.
    2. Provide a descriptive text in English.
    3. Review this list of optional input tags: [${inputTags.join(', ')}]. Filter out any tag that does not match the product, keep the valid ones, and add new highly relevant tags based on the images.`;

    // Trigger execution targeting GPT-4o on GitHub's endpoint
    const response = await client.path('/chat/completions').post({
      body: {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              ...imageMessageContent,
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'product_analysis_schema',
            schema: jsonResponseSchema,
            strict: true
          }
        },
      },
    });

    if (response.status !== '200') {
      throw new Error((response.body as any)?.error?.message || `GitHub Models client returned error status code: ${response.status}`);
    }

    const aiResultParsed = JSON.parse((response.body as any).choices[0].message.content || '{}');
    
    let suggestedTitle = aiResultParsed.suggestedTitle || 'unnamed-product';
    suggestedTitle = suggestedTitle.replace(/[\n\r\t]/g, '').replace(/[\\/:*?"<>|]/g, '');

    // Duplicate verification sequence looking up structural names against Google Drive directory states
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
    console.error('Error executing GitHub vision operations serverless task:', error);
    return res.status(500).json({ 
      error: error?.message || 'Internal server processing exception.' 
    });
  }
}