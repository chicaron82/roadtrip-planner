# `src/lib/` — Business Logic

All pure computation, external API calls, and domain services. No React, no hooks, no UI.

---

## Groupings

### Core Math & Calculation
| File | Owns |
|---|---|
| `calculations.ts` | Fuel cost, haversine distance, driving time, cost-per-km |
| `unit-conversions.ts` | km↔mi, L/100km↔mpg, weighted economy across segments |
| `trip-constants.ts` | Shared numeric constants (speed assumptions, safety buffers, etc.) |
| `constants.ts` | App-wide literal constants |
| `utils.ts` | Generic pure utilities (clamp, round, groupBy, etc.) |

### Route & Geometry
| File | Owns |
|---|---|
| `api.ts` | OSRM routing, Nominatim geocoding, Overpass POI fetches |
| `route-geocoder.ts` | Geometry interpolation — `interpolateRoutePosition(km)` → `[lat,lng]` |
| `flatten-driving-segments.ts` | Expands round-trip midpoint segments for simulation |
| `border-avoidance.ts` | Route geometry filtering to stay in-country |
| `trip-timezone.ts` | Longitude → IANA timezone → abbreviation lookup |

### Stop Simulation Engine
| File | Owns |
|---|---|
| `stop-suggestions/` | **Full pipeline** — see [`stop-suggestions/README.md`](stop-suggestions/README.md) |
| `stop-suggestion-types.ts` | Shared types for `SuggestedStop`, `StopSuggestionConfig` |
| `stop-consolidator.ts` | Deduplication + combo-stop merger (post-simulation) |
| `fuel-stops.ts` | Strategic fill-up calculator (tank math + safety buffer) |
| `fuel-stop-snapper.ts` | Snaps a km-position to the nearest real hub city name |
| `stop-display-helpers.ts` | Formatting helpers for stop cards |

### Highway Hub Cache
| File | Owns |
|---|---|
| `hub-cache.ts` | Self-learning cache with LRU eviction + cross-tab sync |
| `hub-seed-data.ts` | 70+ pre-seeded corridor cities (Trans-Canada, I-94, I-90, etc.) |
| `hub-poi-analysis.ts` | Runtime POI-density check to qualify a location as a highway hub |

### Budget Pipeline
| File | Owns |
|---|---|
| `budget/` | **Full pipeline** — see [`budget/README.md`](budget/README.md) |
| `storage-budget.ts` | Budget persistence to localStorage |
| `regional-costs.ts` | Province/state gas & hotel price data |

### Smart Timeline
| File | Owns |
|---|---|
| `trip-timeline.ts` | Builds `TimedEvent[]` from `TripDay[]` — the full chronological event list |
| `trip-timeline-helpers.ts` | Pure utilities: `formatTime`, `formatDuration`, `classifyStops` |
| `timeline-simulation.ts` | Simulates clock progression through the timeline for ghost car |
| `weather-ui-utils.ts` | Weather code → CSS gradient + hex color (used by SmartTimeline drive lines) |

### Feasibility & Analysis
| File | Owns |
|---|---|
| `feasibility/` | Route feasibility score + per-warning severity classification |
| `segment-analyzer.ts` | Per-segment warnings: timezone jumps, border crossings, pacing issues |
| `trip-analyzer.ts` | High-level trip health: difficulty score, confidence rating |
| `pacing-suggestions-builder.ts` | Constructs human-readable pacing suggestion strings |

### Planning & Strategy
| File | Owns |
|---|---|
| `trip-strategy-selector.ts` | Builds alternative route strategies (avoid tolls, scenic, etc.) |
| `driver-rotation.ts` | Multi-driver segment assignment with fair rotation |
| `outbound-departure-optimizer.ts` | Suggests earliest/latest viable departure times |
| `return-departure-optimizer.ts` | Same for return leg |
| `overnight-snapper.ts` | Snaps overnight stops to real hub cities |
| `estimate-service.ts` | Lightweight estimation mode (no full OSRM simulation) |
| `adventure-service.ts` | Adventure mode destination selection + budget building |
| `trip-calculation-helpers.ts` | Extracted helpers from `useTripCalculation` (buildRoundTripSegments, etc.) |

### POI (Points of Interest)
| File | Owns |
|---|---|
| `poi-service/` | Overpass API fetching + raw result parsing |
| `poi-ranking.ts` | Composite score: proximity + category + OSM popularity + timing fit |
| `poi.ts` | POI utility functions |
| `discovery-engine.ts` | Orchestrates POI fetch → rank → bucket into Along the Way / Destination |

### Templates, Challenges & Sharing
| File | Owns |
|---|---|
| `template-validator.ts` | JSON schema validation for imported trip templates |
| `challenges.ts` | Chicharon's Challenges data (historical trip records + par stats) |
| `share-utils.ts` | Web Share API + clipboard fallback |
| `url.ts` | Trip state → compact URL serialization + deserialization |

### Journal & Export
| File | Owns |
|---|---|
| `journal-storage/` | Journal persistence: entries, photos, GPS coords |
| `journal-export.ts` | HTML + print export builder |
| `trip-print-builders.ts` | DOM structure builder for printable trip report |
| `trip-print-styles.ts` | Inline styles for print output |
| `story-card.ts` | Per-stop narrative card generation for recap |

### User Profile & Settings
| File | Owns |
|---|---|
| `user-profile.ts` | Adaptive defaults — learns from past trips (avg km/day, hotel preference) |
| `style-presets.ts` | Frugal / Balanced / Comfort presets + URL sharing |
| `vehicles.ts` | Vehicle presets + fuel economy lookup |
| `storage.ts` | General localStorage helpers (history, settings, garage) |
| `storage-garage.ts` | Vehicle garage persistence |
| `validate-inputs.ts` | Input validation utilities |
| `weather.ts` | Weather forecast fetch + caching |
| `toast.ts` | Toast notification helpers |

---

## Rules

- **No React imports.** Everything here is plain TypeScript. If it needs `useState`, it belongs in `src/hooks/`.
- **No cross-cutting concerns.** Each subdirectory owns its pipeline end-to-end. don't import `budget/` from `stop-suggestions/`.
- **Test coverage expected.** Every non-trivial file in `lib/` has a corresponding `.test.ts`.
