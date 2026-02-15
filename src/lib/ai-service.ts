/**
 * AI Service Layer
 *
 * Direct browser-to-provider API calls (BYOK model).
 * No intermediary servers - maximum privacy.
 */

import type { AIConfig } from './ai-config';
import type { Location, Vehicle, TripSettings, TripSummary } from '../types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * System prompt for trip planning context
 */
function getTripPlanningSystemPrompt(context?: TripContext): string {
  const base = `You are a helpful road trip planning assistant. You help users plan road trips, suggest stops, optimize routes, and provide travel advice.

Keep responses concise and actionable. Use emoji sparingly for visual interest.

When suggesting locations, include:
- Name and brief description
- Why it's worth visiting
- Estimated time to spend there

For route optimization, consider:
- Driving time limits (ideally 8 hours/day max)
- Fuel stops based on vehicle range
- Meal times and rest breaks
- Weather conditions if known
- Budget constraints if mentioned`;

  if (context) {
    return `${base}

Current Trip Context:
${context.locations ? `- Route: ${context.locations.map(l => l.name || 'TBD').join(' → ')}` : ''}
${context.vehicle ? `- Vehicle: ${context.vehicle.year} ${context.vehicle.make} ${context.vehicle.model}` : ''}
${context.settings ? `- Travelers: ${context.settings.numTravelers} people, ${context.settings.numDrivers} driver(s)` : ''}
${context.settings ? `- Max driving: ${context.settings.maxDriveHours} hours/day` : ''}
${context.summary ? `- Total distance: ${context.summary.totalDistanceKm.toFixed(0)} km` : ''}
${context.summary ? `- Estimated fuel cost: $${context.summary.totalFuelCost.toFixed(2)}` : ''}`;
  }

  return base;
}

export interface TripContext {
  locations?: Location[];
  vehicle?: Vehicle;
  settings?: TripSettings;
  summary?: TripSummary;
}

/**
 * Send a chat message to the AI provider
 */
export async function sendChatMessage(
  config: AIConfig,
  messages: ChatMessage[],
  context?: TripContext
): Promise<AIResponse> {
  const systemPrompt = getTripPlanningSystemPrompt(context);

  try {
    switch (config.provider) {
      case 'openai':
        return await callOpenAI(config, systemPrompt, messages);
      case 'anthropic':
        return await callAnthropic(config, systemPrompt, messages);
      case 'google':
        return await callGoogle(config, systemPrompt, messages);
      default:
        return { success: false, message: '', error: 'Unknown provider' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: '', error: message };
  }
}

/**
 * OpenAI API call
 */
async function callOpenAI(
  config: AIConfig,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<AIResponse> {
  const endpoint = config.customEndpoint || 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    success: true,
    message: data.choices[0]?.message?.content || '',
  };
}

/**
 * Anthropic API call
 */
async function callAnthropic(
  config: AIConfig,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<AIResponse> {
  const endpoint = config.customEndpoint || 'https://api.anthropic.com/v1/messages';

  // Convert messages to Anthropic format
  const anthropicMessages = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model || 'claude-sonnet-4-5-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: anthropicMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    success: true,
    message: data.content[0]?.text || '',
  };
}

/**
 * Google AI (Gemini) API call
 */
async function callGoogle(
  config: AIConfig,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<AIResponse> {
  const model = config.model || 'gemini-1.5-flash';
  const endpoint = config.customEndpoint ||
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

  // Convert to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    success: true,
    message: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
  };
}

/**
 * Test API connection
 */
export async function testConnection(config: AIConfig): Promise<{ success: boolean; message: string }> {
  const testMessages: ChatMessage[] = [
    { role: 'user', content: 'Say "Connection successful!" in exactly 2 words.' },
  ];

  const response = await sendChatMessage(config, testMessages);

  if (response.success) {
    return { success: true, message: 'Connection successful! Your API key is working.' };
  }

  return { success: false, message: response.error || 'Connection failed' };
}

/**
 * Generate trip suggestions using AI
 */
export async function generateTripSuggestions(
  config: AIConfig,
  naturalLanguageInput: string,
  context?: TripContext
): Promise<AIResponse> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `Based on this trip description, suggest waypoints and stops:

"${naturalLanguageInput}"

Please respond with a JSON object containing:
{
  "suggestedRoute": ["City 1", "City 2", ...],
  "reasoning": "Brief explanation",
  "highlights": ["Point of interest 1", "Point of interest 2", ...],
  "estimatedDays": number,
  "tips": ["Tip 1", "Tip 2", ...]
}`,
    },
  ];

  return sendChatMessage(config, messages, context);
}

/**
 * Get AI advice for current trip
 */
export async function getTripAdvice(
  config: AIConfig,
  question: string,
  context: TripContext
): Promise<AIResponse> {
  const messages: ChatMessage[] = [
    { role: 'user', content: question },
  ];

  return sendChatMessage(config, messages, context);
}

export interface ParsedTripData {
  locations: Array<{ name: string; type: 'origin' | 'destination' | 'waypoint' }>;
  departureDate?: string;
  numTravelers?: number;
  numDrivers?: number;
  maxDriveHours?: number;
  preferences?: {
    avoidTolls?: boolean;
    scenicMode?: boolean;
    budgetFriendly?: boolean;
  };
  reasoning?: string;
}

/**
 * Parse natural language trip description into structured data
 */
export async function parseNaturalLanguageTrip(
  config: AIConfig,
  description: string
): Promise<{ success: boolean; data?: ParsedTripData; error?: string }> {
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: `Parse this trip description into structured data:

"${description}"

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "locations": [
    {"name": "City Name", "type": "origin"},
    {"name": "City Name", "type": "waypoint"},
    {"name": "City Name", "type": "destination"}
  ],
  "departureDate": "YYYY-MM-DD or null",
  "numTravelers": number or null,
  "numDrivers": number or null,
  "maxDriveHours": number or null,
  "preferences": {
    "avoidTolls": boolean,
    "scenicMode": boolean,
    "budgetFriendly": boolean
  },
  "reasoning": "Brief explanation of your interpretation"
}

Rules:
- Extract origin and destination from the description
- Add waypoints for notable stops mentioned
- Infer dates if mentioned (e.g., "5 days" = 5 days from today)
- Extract traveler count if mentioned
- Detect preferences like "scenic", "avoid highways", "budget"
- Use null for fields not mentioned
- Be smart about interpreting the user's intent`,
    },
  ];

  try {
    const response = await sendChatMessage(config, messages);

    if (!response.success) {
      return { success: false, error: response.error };
    }

    // Parse the JSON response
    // Remove markdown code blocks if present
    let jsonText = response.message.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
    }

    const data = JSON.parse(jsonText) as ParsedTripData;

    return { success: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse response';
    return { success: false, error: message };
  }
}
