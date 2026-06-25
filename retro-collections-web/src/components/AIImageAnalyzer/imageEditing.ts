import type { Area } from 'react-easy-crop';

const createImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = url;
  });
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const rotatedBounds = (
  width: number,
  height: number,
  rotation: number
): { width: number; height: number } => {
  const radians = toRadians(rotation);
  return {
    width:
      Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
    height:
      Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height),
  };
};

export const createEditedImageFile = async ({
  imageSrc,
  pixelCrop,
  rotation,
  fileName,
  mimeType,
}: {
  imageSrc: string;
  pixelCrop: Area;
  rotation: number;
  fileName: string;
  mimeType?: string;
}): Promise<File> => {
  const image = await createImage(imageSrc);
  const bounds = rotatedBounds(image.width, image.height, rotation);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context is not available.');
  }

  canvas.width = bounds.width;
  canvas.height = bounds.height;

  ctx.translate(bounds.width / 2, bounds.height / 2);
  ctx.rotate(toRadians(rotation));
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  const cropCanvas = document.createElement('canvas');
  const cropCtx = cropCanvas.getContext('2d');

  if (!cropCtx) {
    throw new Error('Crop canvas context is not available.');
  }

  cropCanvas.width = Math.max(1, Math.round(pixelCrop.width));
  cropCanvas.height = Math.max(1, Math.round(pixelCrop.height));

  cropCtx.drawImage(
    canvas,
    Math.round(pixelCrop.x),
    Math.round(pixelCrop.y),
    Math.round(pixelCrop.width),
    Math.round(pixelCrop.height),
    0,
    0,
    Math.round(pixelCrop.width),
    Math.round(pixelCrop.height)
  );

  const outputType = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

  const blob = await new Promise<Blob | null>((resolve) => {
    cropCanvas.toBlob(resolve, outputType, 0.92);
  });

  if (!blob) {
    throw new Error('Unable to export edited image.');
  }

  return new File([blob], fileName, {
    type: blob.type || outputType,
    lastModified: Date.now(),
  });
};
