import type { JournalPhoto } from '../../types';

const MAX_PHOTO_WIDTH = 1200;
const JPEG_QUALITY = 0.8;

/**
 * Compress an image file to a smaller data URL
 */
export async function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Scale down if too wide
        if (width > MAX_PHOTO_WIDTH) {
          height = (height * MAX_PHOTO_WIDTH) / width;
          width = MAX_PHOTO_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Create a JournalPhoto from a file
 */
export async function createPhotoFromFile(
  file: File,
  caption: string = ''
): Promise<JournalPhoto> {
  const dataUrl = await compressPhoto(file);

  return {
    id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    dataUrl,
    caption,
    timestamp: new Date(),
  };
}
