/**
 * ═══════════════════════════════════════════════════════════
 * MY EXPERIENCE ENGINE — MODE CONFIGURATION
 * Constants for the Landing Screen mode cards & route map
 * ═══════════════════════════════════════════════════════════
 */
import type { TripMode } from '../../types';

export interface RouteDot {
  label: string;
  x: number;
  y: number;
}

export interface ModeConfig {
  icon: string;
  heading: string;
  sub: string;
  cta: string;
  accentColor: string;
  glowColor: string;
  borderColor: string;
  tag: string;
  tagColor: string;
  description: string;
  stats: string[];
}

/** Animated route dots for the background SVG map */
export const ROUTE_DOTS: RouteDot[] = [
  { label: 'Vancouver', x: 5, y: 55 },
  { label: 'Banff', x: 12, y: 42 },
  { label: 'Winnipeg', x: 22, y: 52 },
  { label: 'Thunder Bay', x: 38, y: 44 },
  { label: 'Sudbury', x: 58, y: 46 },
  { label: 'Toronto', x: 70, y: 52 },
  { label: 'Montreal', x: 83, y: 44 },
  { label: 'Tofino', x: 4, y: 48 },
];

/** Configuration for the three trip modes */
export const MODE_CONFIG: Record<TripMode, ModeConfig> = {
  plan: {
    icon: '📋',
    heading: "I Know Where\nI'm Going",
    sub: 'Route locked. Let\'s build the perfect trip.',
    cta: 'Start Planning',
    accentColor: '#22C55E',
    glowColor: 'rgba(34, 197, 94, 0.3)',
    borderColor: 'rgba(34, 197, 94, 0.6)',
    tag: 'PLAN MODE',
    tagColor: '#BBF7D0',
    description: 'Full control over your route, budget, and every stop along the way.',
    stats: ['Drag & drop waypoints', 'Smart budget tools', 'Real cost estimates'],
  },
  adventure: {
    icon: '🧭',
    heading: 'Surprise Me',
    sub: "What fits my time + budget? Let me find out.",
    cta: 'Find My Adventure',
    accentColor: '#F59E0B',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    borderColor: 'rgba(245, 158, 11, 0.6)',
    tag: 'ADVENTURE MODE',
    tagColor: '#FDE68A',
    description: "You know what you have to spend. Let the road decide where you're going.",
    stats: ['Budget-first discovery', 'Curated destinations', 'Optimized for your wallet'],
  },
  estimate: {
    icon: '💰',
    heading: 'What Will It\nCost Me?',
    sub: "You know where you're going. Let's find out the price tag.",
    cta: 'Run My Estimate',
    accentColor: '#3B82F6',
    glowColor: 'rgba(59, 130, 246, 0.3)',
    borderColor: 'rgba(59, 130, 246, 0.6)',
    tag: 'ESTIMATE MODE',
    tagColor: '#BFDBFE',
    description: 'Route and party ready. Get a realistic cost breakdown before you commit.',
    stats: ['Fuel + hotel + food', 'Per-person breakdown', 'Range-based honesty'],
  },
};

/** Ordered mode keys for rendering */
export const MODE_ORDER: TripMode[] = ['plan', 'adventure', 'estimate'];
