import { generateStoryCard } from './story-card';

const APP_URL = 'https://myexperienceengine.com';

export function buildShareCaption(notes?: string): string {
  const parts: string[] = [];
  if (notes?.trim()) parts.push(notes.trim());
  parts.push(`🗺️ My Experience Engine | ${APP_URL}`);
  return parts.join('\n');
}

/** Returns 'shared' (native share sheet), 'copied' (clipboard fallback), or 'cancelled' */
export async function shareStop(
  stopName: string,
  notes?: string,
  photoDataUrl?: string
): Promise<'shared' | 'copied' | 'cancelled'> {
  const caption = buildShareCaption(notes);

  // Try Web Share API with story card image
  if (navigator.share) {
    try {
      const cardBlob = await generateStoryCard(stopName, notes, photoDataUrl);
      const cardFile = new File([cardBlob], `${stopName}-story.jpg`, { type: 'image/jpeg' });

      if (navigator.canShare?.({ files: [cardFile] })) {
        await navigator.share({ files: [cardFile], text: caption });
        return 'shared';
      }

      // File share unsupported — try text-only share
      await navigator.share({ text: caption, url: APP_URL });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // Fall through to clipboard
    }
  }

  // Fallback: copy caption to clipboard
  await navigator.clipboard.writeText(caption);
  return 'copied';
}
