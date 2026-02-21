/**
 * Style Presets — shareable travel style snapshots
 *
 * A preset captures how you travel: nightly hotel budget, daily food spend.
 * Built on top of adaptive defaults but given a name and shareable via URL.
 *
 * Share flow: "Make my MEE time, your MEE time." → ?style=<base64>
 *
 * 💚 Built by Chicharon · My Experience Engine
 */

export interface StylePreset {
  id: string;
  /** Human-readable name — shown to the recipient as "X's Style" */
  name: string;
  /** Creator's handle — used in share copy */
  creatorName: string;
  hotelPricePerNight: number;
  mealPricePerDay: number;
  /** Optional flavour text shown on the share card */
  description?: string;
  /** Whether this is a built-in (not user-generated) preset */
  builtin?: boolean;
}

// ─── Built-in presets ─────────────────────────────────────────────────────────

/**
 * Chicharon's Classic — the anchor. 18 years of road-tested defaults.
 * Always available. Cannot be overwritten.
 */
export const CHICHARON_CLASSIC: StylePreset = {
  id: 'chicharon-classic',
  name: "Chicharon's Classic",
  creatorName: 'Chicharon',
  hotelPricePerNight: 150,
  mealPricePerDay: 50,
  description: '18 years of bad ideas that turned out great.',
  builtin: true,
};

export const BUILTIN_PRESETS: StylePreset[] = [CHICHARON_CLASSIC];

// ─── Encode / Decode (URL-safe base64 JSON) ───────────────────────────────────

const PRESET_PARAM = 'style';

interface PresetPayload {
  v: 1;
  id: string;
  n: string;   // name
  cn: string;  // creatorName
  h: number;   // hotelPricePerNight
  m: number;   // mealPricePerDay
  d?: string;  // description (optional)
}

export const encodePreset = (preset: StylePreset): string => {
  const payload: PresetPayload = {
    v: 1,
    id: preset.id,
    n: preset.name,
    cn: preset.creatorName,
    h: preset.hotelPricePerNight,
    m: preset.mealPricePerDay,
    d: preset.description,
  };
  try {
    return btoa(JSON.stringify(payload));
  } catch {
    return '';
  }
};

export const decodePreset = (encoded: string): StylePreset | null => {
  try {
    const payload = JSON.parse(atob(encoded)) as PresetPayload;
    if (payload.v !== 1 || !payload.id || !payload.n) return null;
    return {
      id: payload.id,
      name: payload.n,
      creatorName: payload.cn ?? 'Traveller',
      hotelPricePerNight: Number(payload.h) || 150,
      mealPricePerDay: Number(payload.m) || 50,
      description: payload.d,
    };
  } catch {
    return null;
  }
};

// ─── URL helpers ──────────────────────────────────────────────────────────────

/** Parse a ?style= preset from the current URL. Returns null if absent/invalid. */
export const parsePresetFromURL = (): StylePreset | null => {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(PRESET_PARAM);
    if (!raw) return null;
    return decodePreset(raw);
  } catch {
    return null;
  }
};

/** Build a shareable URL with the preset encoded as ?style=… */
export const buildShareURL = (preset: StylePreset): string => {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set(PRESET_PARAM, encodePreset(preset));
  return url.toString();
};

/** Copy share URL to clipboard. Returns true on success. */
export const copyPresetShareURL = async (preset: StylePreset): Promise<boolean> => {
  const url = buildShareURL(preset);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
};
