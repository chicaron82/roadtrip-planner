import { describe, it, expect } from 'vitest';
import { buildShareCaption } from './share-utils';

// ─── buildShareCaption ────────────────────────────────────────────────────────

describe('buildShareCaption', () => {
  const APP_URL_SNIPPET = 'myexperienceengine.com';

  it('includes the app URL when no notes are provided', () => {
    const caption = buildShareCaption();
    expect(caption).toContain(APP_URL_SNIPPET);
  });

  it('includes the app URL when notes are undefined', () => {
    const caption = buildShareCaption(undefined);
    expect(caption).toContain(APP_URL_SNIPPET);
  });

  it('includes trimmed notes before the URL line when notes are provided', () => {
    const caption = buildShareCaption('What a trip!');
    const lines = caption.split('\n');
    expect(lines[0]).toBe('What a trip!');
    expect(lines[1]).toContain(APP_URL_SNIPPET);
  });

  it('trims leading and trailing whitespace from notes', () => {
    const caption = buildShareCaption('  hello  ');
    const lines = caption.split('\n');
    expect(lines[0]).toBe('hello');
  });

  it('treats whitespace-only notes as no notes (no extra blank line)', () => {
    const caption = buildShareCaption('   ');
    // Should not prepend a blank first line — just the URL line
    expect(caption.startsWith('\n')).toBe(false);
    const lines = caption.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(APP_URL_SNIPPET);
  });

  it('treats empty string notes as no notes', () => {
    const caption = buildShareCaption('');
    const lines = caption.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(APP_URL_SNIPPET);
  });
});
