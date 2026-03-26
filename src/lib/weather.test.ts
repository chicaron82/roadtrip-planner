import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWeatherLabel, getWeatherEmoji, fetchWeather } from './weather';

const mockMeteoResponse = {
  timezone: "GMT",
  timezone_abbreviation: "GMT",
  daily: {
    time: ["2026-03-26"],
    weather_code: [51],
    temperature_2m_max: [18.5],
    temperature_2m_min: [8.2],
    precipitation_probability_max: [45]
  }
};

describe('Weather Engine (Open-Meteo Integration)', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });
    
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('getWeatherLabel', () => {
        it('returns correctly mapped labels for known WMO codes', () => {
            expect(getWeatherLabel(0)).toBe('Clear sky');
            expect(getWeatherLabel(71)).toBe('Slight snow');
            expect(getWeatherLabel(95)).toBe('Thunderstorm');
        });

        it('returns Unknown for unmapped codes', () => {
            expect(getWeatherLabel(999)).toBe('Unknown');
            expect(getWeatherLabel(-1)).toBe('Unknown');
        });
    });

    describe('getWeatherEmoji', () => {
        it('returns correct emoji classifications', () => {
            expect(getWeatherEmoji(0)).toBe('☀️');
            expect(getWeatherEmoji(2)).toBe('⛅');
            expect(getWeatherEmoji(45)).toBe('🌫️');
            expect(getWeatherEmoji(61)).toBe('🌧️');
            expect(getWeatherEmoji(75)).toBe('❄️');
            expect(getWeatherEmoji(95)).toBe('⛈️');
        });

        it('returns a generic thermometer emoji for unknown codes', () => {
            expect(getWeatherEmoji(80)).toBe('🌡️'); // 80 is omitted from specific if statements
        });
    });

    describe('fetchWeather', () => {
        it('resolves and maps the API response successfully', async () => {
            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue(mockMeteoResponse)
            };
            vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

            const result = await fetchWeather(43.6, -79.3, '2026-03-26');
            
            expect(result).not.toBeNull();
            expect(result?.temperatureMax).toBe(18.5);
            expect(result?.weatherCode).toBe(51);
            expect(result?.precipitationProb).toBe(45);
            
            // Verify URL params
            const fetchCallUrl = vi.mocked(fetch).mock.calls[0][0] as string;
            expect(fetchCallUrl).toContain('latitude=43.6');
            expect(fetchCallUrl).toContain('longitude=-79.3');
            expect(fetchCallUrl).toContain('start_date=2026-03-26');
            expect(fetchCallUrl).toContain('end_date=2026-03-26');
        });

        it('does not send start/end date if date is omitted', async () => {
            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue(mockMeteoResponse)
            };
            vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

            await fetchWeather(43.6, -79.3); // unique params to avoid cache map key collision
            
            // 2nd call since the first one was cached
            const fetchCallUrl = vi.mocked(fetch).mock.calls[0][0] as string;
            expect(fetchCallUrl).not.toContain('start_date');
            expect(fetchCallUrl).not.toContain('end_date');
        });

        it('returns null if response is not ok (e.g., 400 or 500)', async () => {
            const mockResponse = { ok: false };
            vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

            // Give it slightly different coords to bypass cache map
            const result = await fetchWeather(45.0, -75.0);
            expect(result).toBeNull();
        });

        it('returns null if daily array is missing from payload', async () => {
            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue({ timezone: "GMT" }) // No daily node
            };
            vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

            const result = await fetchWeather(46.0, -74.0);
            expect(result).toBeNull();
        });

        it('returns null and swallows the error if network fails (DOMException)', async () => {
            // Suppress the console.error for this specific test so it doesn't pollute vitest runner output
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

            const result = await fetchWeather(47.0, -73.0);
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith("Failed to fetch weather:", expect.any(Error));
            consoleSpy.mockRestore();
        });
        
        it('bypasses the network call entirely for cached requests', async () => {
            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue(mockMeteoResponse)
            };
            vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

            // Notice we use exactly identical lat, lng, and date twice
            await fetchWeather(50.0, -100.0, '2026-03-26');
            const cachedResult = await fetchWeather(50.0, -100.0, '2026-03-26');

            expect(cachedResult?.weatherCode).toBe(51);
            // Even though we requested weather twice, we expect fetch to only fire exactly once due to weatherCache.Map
            expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1); 
        });
    });
});
