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
          description: `
          A concise, professional folder title for the product (max 40 characters), 
          without punctuation or forbidden characters like slashes.
          If the product is a special version, you can add that to the title.`,
        },
        descriptionEn: {
            type: 'string',
            description: `
            A very short description of the physical product written in English. 
            It should be clear, very concise, highlighting key features such as imperfections, serial number/code, special versions, 
            and other notable characteristics that are not ordinary for that production (something unique or rare compare to other copies of the same product). 
            If the product is a media software, do not include information on the software itself but only on the physical media (e.g., disc, cartridge, etc.).
            IMPORTANT: The description should be about what's on the picture and not about what is supposed to be in that product in general.
            Keep it short and to the point, avoiding unnecessary details that not uniquely identify the product. 
            E.g. avoid adding text that is in the product itself, unless it is short like the serial number or a special edition name. 
            Avoid adding information that is not visible in the images provided.`,
        },
        productTags: {
          type: 'array',
          items: { type: 'string' },
          description: `A list of relevant product tags. 
          Evaluate the optional input tags provided, 
          filtering out irrelevant ones and expanding the list with new accurate tags found from the images. 
          Tags should be concise, lowercase, and relevant. 
          Avoid new categories of tags, if in the input list there is PS4 and P55 is missing then you can add PS5 since it is the same category. 
          Avoid adding redundant tags such as "videogame" if "game" is already present. 
          Avoid adding tags that are too generic or not directly related to the product. 
          Avoid adding tags that are the same as the title of the product, or "playstation 4" if the input already has "PS4", 
          or the genre of the product.
          If tags such as ita, eng, fr, de, es, pt are present in the input list, they should be kept as they are. Do not add new duplicate language tags under different formats (e.g., "english" or "en" for "eng").
          Do NOT add the product's name or brand as a tag.
          If a game is a special edition, you can add a tag for that (e.g., "special edition", "limited edition", "collector's edition", etc.).
          If a game is associated with a specific platform publisher, make sure to set or add tag for that (e.g., "sony", "microsoft", "nintendo", etc.).
          Max 2 new tags can be added (that are not present in the input tags), and they should be highly relevant to the product.`,

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