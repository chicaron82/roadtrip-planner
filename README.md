# My Experience Engine 🗺️

> **Road trips worth remembering.**

A full-featured road trip planner built for people who actually drive. Plan routes, estimate real costs, get smart stop suggestions, discover places along the way, and journal your trip as it happens — all in one app, no API keys required.

---

## What It Does

### Planning (Estimate & Plan Modes)

- **3-step wizard** — Route → Vehicle → Results. Each step builds on the last.
- **Interactive map** — Leaflet + OpenStreetMap with animated route drawing. Click the map to add stops directly. A floating pill shows total distance and drive time as soon as the route loads.
- **Multi-stop routing** — Drag-and-drop waypoints, add/remove stops freely, powered by OSRM.
- **Smart cost estimation** — Fuel cost from your actual vehicle's L/100km, real gas prices, and route distance. Hotel, meals, and misc broken out by day.
- **Regional cost profiles** — Gas and hotel prices vary by province/state. The budgeter knows the difference between Manitoba and California.
- **Day-by-day budget tracking** — Trip auto-split into driving days based on your max daily drive hours. Dual-source fuel model: at-the-pump strategic stop costs are primary; per-km math is only used for the leg after the last fill.
- **Budget profiles** — Frugal / Balanced / Comfort presets, each with different assumptions for meals, hotels, and spending style. Full per-day override support.
- **Driver rotation** — Assigns segments fairly across multiple drivers. Rotates at fuel stops; falls back to time-based even split.
- **Route options** — Avoid tolls, border avoidance mode (stay in-country), scenic routing.
- **Feasibility banners** — Context-aware warnings for punishing drive days, departure time issues, and multi-driver pacing suggestions. Multi-day trips get per-day analysis, not a single-day panic banner. Each warning has an × button to acknowledge it session-wide; acknowledged warnings reset if trip parameters change.
- **Smart refinements** — Adjusting traveler count or driver count shows a delta comparison against the previous plan (distance, cost, drive time) directly in the trip summary.
- **Weather per segment** — Pulls forecast data for each destination.

### Smart Stop Engine

The stop suggestion system simulates the full drive in real-time to place stops where they actually make sense:

- **Strategic fuel stops** — Calculates fill-up points based on tank size, consumption, and a configurable safety buffer. Snaps stops to real city names (via the Hub Cache) instead of arbitrary km-marks.
- **En-route fuel stops** — For very long legs, places mid-drive fuel stops at the correct fractional position along the route.
- **Rest break scheduling** — Scheduled based on continuous hours on road, respecting your stop frequency preference (Minimal / Balanced / Frequent).
- **Meal stop detection** — Flags breakfast / lunch / dinner windows based on time of day. Suppresses end-of-trip meal stops on round trips arriving home.
- **Overnight split suggestions** — Detects when a leg is too long for a single day and proposes a split point.
- **Combo stop transparency** — When a fuel stop is silently absorbed into a nearby meal stop, the card shows "⛽ filling up while we eat" so the stop count in the itinerary makes sense.
- **Timezone-aware timing** — The simulation tracks timezone transitions along your route so stop times display in the correct local time.
- **Destination grace zone** — Suppresses unnecessary fuel stops within 50 km of the final destination.

### Highway Hub Cache 🏙️

A self-learning cache of major highway corridor cities used by the stop engine and Smart Timeline to replace "~515 km from Winnipeg" with "near Fargo, ND":

- **70+ pre-seeded cities** across Canadian and US corridors (Trans-Canada, I-94, I-90, I-75, I-95, BC, Ontario, Western US, Texas Triangle)
- **Runtime discovery** — Analyzes live Overpass POI density (gas stations + hotels) near a location; auto-adds new hubs to the cache when detected
- **Route pre-warming** — On first calculation, route waypoints are seeded as discovered hubs so subsequent lookups are instant
- **Quality filtering** — Rejects administrative placeholders ("Unorganized Territory", "Unnamed") at both read and write to keep the cache useful
- **Cross-tab sync** — Hubs discovered in one browser tab are immediately visible in other open tabs via a `storage` event listener
- **LRU eviction** — In-memory singleton keeps lookups near-instant across a trip calculation; async localStorage persistence doesn't block the UI
- **Three-tier resolution** — Cache hit → POI analysis → Nominatim fallback

### Smart Timeline

A visual chronological timeline of the full trip — every drive leg, stop, fuel fill, meal break, rest, overnight stay, and timezone change laid out against real wall-clock times:

- **Weather-reactive drive lines** — Each drive segment's connecting line picks up a colour gradient matching the forecast weather code (rain, snow, clear, etc.)
- **Mid-drive stop splitting** — A fuel stop at the 2-hour mark of a 4-hour drive produces two drive segments with the stop between them
- **Free day handling** — Overnight stops correctly advance the clock past free (non-driving) days
- **Round-trip destination dwell** — Shows a destination event at the turnaround point with correct clock advance
- **Ambient day/night mode** — The timeline border and background subtly shift between green (daytime) and indigo (overnight) as you scroll through the events
- **Failsafe distribution** — When timestamp math breaks down on extreme multi-timezone routes, stops are evenly distributed via route geometry instead of clumping

### Unified Journey Car 🚗

An animated car tracks your position in real time as you drive the route in journal mode:

- **Live car position** — Binary-search + lerp against the full route geometry, anchored to actual wall-clock time. The car smoothly moves along roads, not waypoints.
- **Arrival snap** — When you mark a stop as arrived, the device's GPS location is recorded once and the car jumps to the actual road position rather than the planned stop pin.
- **Parked car recap** — After the final stop is marked, the car settles into a "parked" state and a full trip recap card appears with highlights, budget variance, and a photo collage.
- **Wizard vs. trip mode** — The car component is mode-aware: in wizard mode it shows a planning preview; in journal mode it tracks the live trip.

### Discovery Engine (POI Suggestions)

Finds interesting stops near your route — viewpoints, attractions, parks, waterfalls, restaurants, and more:

- Ranked by composite score: proximity to route, category match, OSM popularity, and timing fit (does it land at a natural break window?)
- Suggestions grouped into *Along the Way* and *At Destination* buckets
- Dismissible, saveable to journal, or added as route waypoints

### Chicharon's Challenges 🏆

Pre-loaded real road trips with real stats — Chicharon's actual historical records:

| Challenge | Type | Distance |
|---|---|---|
| The Canadian EuroTrip | Cruiser | ~4,900 km, 6 days |
| End of Summer | Iron Driver | ~8,500 km, 10 days |
| The Eastern US Gauntlet | Chicharon's Gauntlet | ~6,800 km, 12 days |
| Extended variants | Varies | Harder routes of the above |

Load a challenge, set your starting city (auto-syncs from Step 1 or manually override), and compare estimated costs against the historical par.

### Vehicle Garage

- Save and manage multiple vehicles with full fuel economy, tank size, and fuel type settings
- Presets for common vehicles (Camry, F-150, Civic, Tacoma, and more)
- Set a default vehicle for quick planning

### Trip Templates & Sharing

- **Share URL** — Full trip state serialized to a compact URL. Share with passengers or bookmark for later.
- **Template system** — Export and import full trip configurations including locations, vehicle, and settings. Includes schema validation for safety.
- **Google Maps export** — Open your full multi-stop route directly in Google Maps.

### Trip Journal *(Journal Mode)*

Confirm your plan to unlock a travel journal for the actual trip:

- **Auto-tagged stops** — Journal entries linked to route segments automatically
- **Fresh-start lifecycle** — Completing a trip through the wizard always starts a new journal. Mid-trip page reloads restore the in-progress journal so you can pick up exactly where you left off.
- **Reset to re-drive** — The ↺ reset button clears all arrival statuses (preserving your notes and photos) so you can re-drive a familiar route and see the car move again.
- **Photo captures** — Upload and caption photos at each stop
- **GPS coordinates** — Auto-requests device location when logging a memory
- **Quick Capture dialog** — Fast one-tap capture at any point in the journey
- **Day headers** — Journal organized by driving day with notes and mood
- **HTML & print export** — Full printable trip journal with all memories, GPS links, and route details

### Mobile Experience

- **Google Maps-style bottom sheet** — Draggable sheet that snaps between peek / half / full states. Map stays full-screen underneath.
- **Trip stats in peek state** — Key numbers (distance, time, cost) visible without opening the sheet fully
- **Touch-optimized** — Smooth swipe gestures, snap physics, no-scrollbar carousels. Pull handle doesn't obscure content on portrait mobile.

### Other Features

- **Adventure Mode** — Alternative planning philosophy with different pacing and emphasis on stops over speed
- **Style presets** — Visual themes for the trip plan (Road Warrior, Scenic Cruiser, etc.)
- **Favorites** — Star locations to reuse across trips
- **Trip history** — Recently calculated trips for quick reference
- **One-Way / Round Trip** — Toggle; round trips mirror the outbound leg
- **Feasibility analysis** — Difficulty score and confidence rating based on distance, warnings, weather coverage, and trip structure

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Map | Leaflet + React Leaflet |
| Routing | OSRM (Open Source Routing Machine) |
| Geocoding | Nominatim (OpenStreetMap) |
| POI Data | Overpass API (OpenStreetMap) |
| Icons | Lucide React |
| UI Primitives | Radix UI |
| Testing | Vitest |
| Drag & Drop | dnd-kit |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

---

## Project Structure

```text
src/
├── app/                  # Authority layer — screen policy & board pattern
│   ├── app-screen-policy.ts    # Pure rules: what surface is active, what overlays show
│   ├── useAppBoard.ts          # Composes policy into a single typed board for the renderer
│   └── AppRenderer.tsx         # Reads the board, renders the active surface
├── components/
│   ├── App/              # Top-level shell (PlannerFullscreenShell, etc.)
│   ├── Icebreaker/       # Four-beat onboarding arc (estimate → shop → workshop → results)
│   ├── Landing/          # Landing screen & saved trip browser
│   ├── Map/              # Leaflet map, animated polyline, POI popups, route pill
│   ├── Settings/         # Route preferences, vehicle forms
│   ├── Steps/            # Step 1/2/3 content panels
│   ├── Trip/             # Core trip UI, organized by feature:
│   │   ├── Adventure/           # Adventure mode UI
│   │   ├── Budget/              # Budget picker, sensitivity, distribution bar
│   │   ├── Discovery/           # POI discovery panels
│   │   ├── Health/              # Feasibility banners, tradeoffs, arrival hero
│   │   ├── Itinerary/           # Day-by-day itinerary view
│   │   ├── Journal/             # Journal entry capture UI
│   │   ├── Location/            # Location entry & management
│   │   ├── POI/                 # POI suggestion & add UI
│   │   ├── Sharing/             # Share URL, MEE sharing, lineage display
│   │   ├── StepHelpers/         # Utility components for planning steps
│   │   ├── Timeline/            # Smart timeline visualization (weather-reactive)
│   │   └── Viewer/              # Result viewing modes
│   ├── UI/               # Reusable primitives (buttons, cards, collapsible sections)
│   ├── Vehicle/          # Vehicle garage & presets
│   ├── Voila/            # Trip reveal animation & share screen
│   └── Workshop/         # Template builder UI
├── contexts/             # React context providers
│   ├── PlannerContext.tsx       # Planner-wide state
│   └── TripContext.tsx          # Trip data state
├── hooks/                # Domain-grouped business logic hooks
│   ├── icebreaker/             # Onboarding arc orchestration
│   ├── journey/                # Journal, ghost car, arrival snap
│   ├── map/                    # Route geometry, marker rendering
│   ├── poi/                    # POI discovery & ranking
│   ├── session/                # Session lifecycle, voila flow, back-press
│   ├── trip/                   # Trip calculation, mode, loader, added stops
│   ├── ui/                     # Style presets, debounce, calculation messages
│   └── wizard/                 # Planning steps, step props, Step 3 pipeline
├── lib/                  # Pure business logic (~100 files, nearly 1:1 test coverage)
│   ├── adventure/              # Adventure mode logic
│   ├── budget/                 # Budget pipeline (dual-source fuel, day splits)
│   ├── canonical-updates/      # Canonical trip mutations (title seeds, scenario packs)
│   ├── feasibility/            # Route feasibility analysis & warnings
│   ├── journal-storage/        # IndexedDB persistence + export/import
│   ├── poi-service/            # Overpass POI fetching & ranking
│   ├── stop-suggestions/       # Stop simulation engine (fuel, rest, meals, overnight)
│   ├── trip-orchestrator/      # Trip-wide state mutation coordination
│   ├── hub-cache.ts            # Self-learning highway hub cache (cross-tab sync)
│   ├── trip-timeline.ts        # Smart Timeline event builder
│   ├── canonical-trip.ts       # Authoritative event timeline (single source of truth)
│   ├── regional-costs.ts       # Province/state gas & hotel price data
│   ├── driver-rotation.ts      # Multi-driver segment assignment
│   ├── calculations.ts         # Core math (fuel, cost, haversine, etc.)
│   └── ...                     # ~80 more modules (each with *.test.ts)
├── stores/               # Zustand stores
│   └── tripStore.ts
├── types/                # Domain-split TypeScript types
│   ├── core.ts                 # Location, Vehicle, TripSettings, budget primitives
│   ├── route.ts                # RouteSegment, TripDay, TripSummary, WeatherData
│   ├── poi.ts                  # POI, POISuggestion, ranking metadata
│   ├── journal.ts              # TripJournal, TripTemplate, JournalEntry
│   ├── adventure.ts            # AdventureConfig, AdventureDestination
│   └── challenge.ts            # TripChallenge, ChallengeDifficulty
└── test/                 # Test setup & fixtures
```

---

## Notes

- All routing, geocoding, and POI data use free, open-source services (OSRM, Nominatim, Overpass). **No API keys required.**
- The OSRM public demo server is rate-limited — for production use, consider self-hosting.
- Budget figures in Chicharon's Challenges are historical trivia only. Gas and hotel prices vary by era and region.

---

Built with love. 💚
