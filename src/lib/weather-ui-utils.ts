
/**
 * Maps an Open-Meteo weather code to a CSS gradient background.
 * Codes from: https://open-meteo.com/en/docs
 */
export function getWeatherGradientClass(weatherCode?: number): string {
  if (weatherCode === undefined) return 'bg-muted-foreground/20'; // Default gray line

  // Clear or mostly clear
  if (weatherCode <= 1) {
    return 'bg-gradient-to-b from-sky-300 to-sky-400';
  }
  
  // Partly cloudy or overcast
  if (weatherCode <= 3) {
    return 'bg-gradient-to-b from-sky-200 to-slate-300';
  }

  // Fog or rime fog
  if (weatherCode === 45 || weatherCode === 48) {
    return 'bg-gradient-to-b from-slate-200 to-slate-400';
  }

  // Drizzle or light rain
  if ((weatherCode >= 51 && weatherCode <= 55) || weatherCode === 61 || weatherCode === 80) {
    return 'bg-gradient-to-b from-slate-400 to-sky-600';
  }

  // Heavy rain or showers
  if (weatherCode === 63 || weatherCode === 65 || weatherCode === 81 || weatherCode === 82) {
    return 'bg-gradient-to-b from-slate-500 to-blue-700';
  }

  // Snow
  if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) {
    return 'bg-gradient-to-b from-slate-300 to-white';
  }

  // Thunderstorm
  if (weatherCode >= 95) {
    return 'bg-gradient-to-b from-slate-700 to-indigo-900';
  }

  return 'bg-muted-foreground/20'; // Fallback
}

/**
 * Maps an Open-Meteo weather code to a simple hex color for inline styles (e.g. SVG borders)
 */
export function getWeatherHexColor(weatherCode?: number): string {
    if (weatherCode === undefined) return '#cbd5e1'; // slate-300 fallback

    if (weatherCode <= 1) return '#38bdf8'; // sky-400
    if (weatherCode <= 3) return '#94a3b8'; // slate-400
    if (weatherCode === 45 || weatherCode === 48) return '#cbd5e1'; // slate-300
    if ((weatherCode >= 51 && weatherCode <= 55) || weatherCode === 61 || weatherCode === 80) return '#0284c7'; // sky-600
    if (weatherCode === 63 || weatherCode === 65 || weatherCode === 81 || weatherCode === 82) return '#1d4ed8'; // blue-700
    if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) return '#f1f5f9'; // slate-100
    if (weatherCode >= 95) return '#312e81'; // indigo-900
    
    return '#cbd5e1'; 
}
