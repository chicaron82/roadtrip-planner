import type { TripDay } from '../types';
import { formatCurrency } from './trip-print-formatters';

// ── Hotel card HTML builder ──────────────────────────────────────────────────

export function buildHotelHTML(day: TripDay): string {
  const overnight = day.overnight;
  if (!overnight) return '';

  return `
    <div class="hotel-card">
      <div class="hotel-name">🔑 ${overnight.hotelName || 'Overnight Stay'}</div>
      ${overnight.address ? `<div class="hotel-detail">📍 ${overnight.address}</div>` : ''}
      <div class="hotel-detail">
        💵 ${formatCurrency(overnight.cost)}
        ${overnight.roomsNeeded > 1 ? ` (${overnight.roomsNeeded} rooms)` : ''}
        ${overnight.checkIn ? ` • Check-in: ${overnight.checkIn}` : ''}
        ${overnight.checkOut ? ` • Check-out: ${overnight.checkOut}` : ''}
      </div>
      ${overnight.amenities?.length ? `<div class="hotel-detail">🛏️ ${overnight.amenities.join(', ')}</div>` : ''}
      ${overnight.notes ? `<div class="hotel-detail">📝 ${overnight.notes}</div>` : ''}
    </div>
  `;
}
