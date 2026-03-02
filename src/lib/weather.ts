import type { WeatherData } from '../types';

// WMO Weather interpretation codes (http://www.wmo.int/pages/prog/www/IMOP/WMO306/WMO306_vI-1/306_vI_1_Code.pdf)
export function getWeatherLabel(code: number): string {
  const codes: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    95: 'Thunderstorm',
  };
  return codes[code] || 'Unknown';
}

export function getWeatherEmoji(code: number): string {
    if (code === 0) return '☀️';
    if (code >= 1 && code <= 3) return '⛅';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 95) return '⛈️';
    return '🌡️';
}

const weatherCache = new Map<string, WeatherData>();

export async function fetchWeather(lat: number, lng: number, date?: string): Promise<WeatherData | null> {
    // Round to 1 decimal place (~11km resolution) to group nearby stops into the same cache entry
    const cacheKey = `${Math.round(lat * 10) / 10},${Math.round(lng * 10) / 10}|${date || 'none'}`;
    if (weatherCache.has(cacheKey)) {
        return weatherCache.get(cacheKey)!;
    }

    try {
        const params = new URLSearchParams({
            latitude: lat.toString(),
            longitude: lng.toString(),
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
            timezone: 'auto',
        });

        if (date) {
            params.append('start_date', date);
            params.append('end_date', date);
        }

        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
        const data = await response.json();

        if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
            return null;
        }

        const result: WeatherData = {
            temperatureMax: data.daily.temperature_2m_max[0],
            temperatureMin: data.daily.temperature_2m_min[0],
            precipitationProb: data.daily.precipitation_probability_max[0],
            weatherCode: data.daily.weather_code[0],
            timezone: data.timezone,
            timezoneAbbr: data.timezone_abbreviation,
        };

        // Cache the successful result
        weatherCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error("Failed to fetch weather:", error);
        return null;
    }
}
