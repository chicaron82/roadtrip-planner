/**
 * AI Configuration & Secure Key Storage
 *
 * BYOK (Bring Your Own Key) - Keys stored locally, never sent to our servers.
 * All API calls go directly from browser to the AI provider.
 */

export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface AIConfig {
  enabled: boolean;
  provider: AIProvider;
  apiKey: string;
  model: string;
  // Optional custom endpoint for enterprise users
  customEndpoint?: string;
}

const STORAGE_KEY = 'roadtrip_ai_config';

// Simple obfuscation (not encryption - keys are client-side anyway)
// This just prevents casual inspection of localStorage
function obfuscate(text: string): string {
  return btoa(text.split('').reverse().join(''));
}

function deobfuscate(text: string): string {
  try {
    return atob(text).split('').reverse().join('');
  } catch {
    return '';
  }
}

export const DEFAULT_MODELS: Record<AIProvider, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-sonnet-4-5-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
};

export const PROVIDER_INFO: Record<AIProvider, { name: string; emoji: string; docsUrl: string; keyUrl: string }> = {
  openai: {
    name: 'OpenAI',
    emoji: '🤖',
    docsUrl: 'https://platform.openai.com/docs',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    name: 'Anthropic',
    emoji: '🧠',
    docsUrl: 'https://docs.anthropic.com',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  google: {
    name: 'Google AI',
    emoji: '✨',
    docsUrl: 'https://ai.google.dev/docs',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
};

export function getAIConfig(): AIConfig | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      apiKey: deobfuscate(parsed.apiKey || ''),
    };
  } catch {
    return null;
  }
}

export function saveAIConfig(config: AIConfig): void {
  const toStore = {
    ...config,
    apiKey: obfuscate(config.apiKey),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
}

export function clearAIConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function isAIEnabled(): boolean {
  const config = getAIConfig();
  return config?.enabled === true && !!config.apiKey;
}

/**
 * Validate API key format (basic check)
 */
export function validateApiKey(provider: AIProvider, key: string): { valid: boolean; message: string } {
  if (!key.trim()) {
    return { valid: false, message: 'API key is required' };
  }

  switch (provider) {
    case 'openai':
      if (!key.startsWith('sk-')) {
        return { valid: false, message: 'OpenAI keys should start with "sk-"' };
      }
      break;
    case 'anthropic':
      if (!key.startsWith('sk-ant-')) {
        return { valid: false, message: 'Anthropic keys should start with "sk-ant-"' };
      }
      break;
    case 'google':
      if (key.length < 30) {
        return { valid: false, message: 'Google AI key appears too short' };
      }
      break;
  }

  return { valid: true, message: 'Key format looks valid' };
}
