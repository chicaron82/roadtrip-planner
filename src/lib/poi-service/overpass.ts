import type { OverpassElement } from './types';
import { OVERPASS_API, MAX_RETRIES, RETRY_DELAY_MS } from './config';

/** Simple delay helper */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute Overpass API query with retry on 429 (rate limit).
 * Overpass public API has aggressive rate limiting — retries with
 * exponential backoff keep us friendly.
 */
export async function executeOverpassQuery(query: string): Promise<OverpassElement[]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(OVERPASS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (response.status === 429 && attempt < MAX_RETRIES) {
        // Exponential backoff with ±20% jitter to spread retries
        const base = RETRY_DELAY_MS * Math.pow(2, attempt);
        const jitter = base * 0.2 * (Math.random() - 0.5);
        const wait = Math.round(base + jitter);
        console.warn(`Overpass 429 rate limit — retrying in ${wait}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await delay(wait);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data = await response.json();
      return data.elements || [];
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        console.warn(`Overpass query failed, retrying... (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await delay(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      console.error('Overpass query failed after retries:', error);
      return [];
    }
  }
  return [];
}
