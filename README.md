# The Experience Engine 🗺️

> **Road trips worth remembering.**

A full-featured road trip planner built for people who actually drive. Plan routes, estimate real costs, track driver rotation, discover stops along the way, and journal your trip as it happens — all in one app.

---

## What It Does

### Planning (Estimate & Plan Modes)

- **3-step wizard** — Route → Vehicle → Results. Each step builds on the last.
- **Interactive map** — Leaflet + OpenStreetMap with animated route drawing. Click the map to add stops directly.
- **Multi-stop routing** — Drag-and-drop waypoints, add/remove stops freely, powered by OSRM.
- **Smart cost estimation** — Fuel cost calculated from your actual vehicle's L/100km, current gas prices, and route distance. Hotel, meals, and misc broken out by day.
- **Day-by-day budget tracking** — Trip automatically split into driving days based on your max daily drive hours.
- **Driver rotation** — With multiple drivers, the itinerary assigns segments fairly. Rotates at fuel stops; falls back to time-based even split when fuel stops are infrequent.
- **Strategic fuel stops** — Calculates where you'll need to fuel up based on tank size and route.
- **Weather per segment** — Pulls forecast data for each stop.
- **Feasibility banners** — Warns when a day's drive looks brutal (distance, hours, timing).
- **Route options** — Avoid tolls, stay in-country (border avoidance), scenic mode.

### Chicharon's Challenges

Pre-loaded real road trips — actual routes driven by the creator, with real stats:

- **The Canadian EuroTrip** *(Cruiser)* — Winnipeg → Burlington Loop, 6 days, ~4,900 km
- **End of Summer** *(Iron Driver)* — Winnipeg → US South Loop, 10 days, ~8,500 km
- **The Eastern US Gauntlet** *(Chicharon's Gauntlet)* — Winnipeg → East Coast Loop, 12 days, ~6,800 km
- Plus extended variants and more coming

Load a challenge and compare your estimated costs against the historical par. Can you match the pace?

### Vehicle Garage

- Save and manage multiple vehicles
- Presets for common cars (Camry, F-150, Civic, etc.)
- Custom fuel economy (city/hwy mix), tank size, fuel type
- Set a default vehicle for quick planning

### Trip Journal *(Journal Mode)*

Confirm your plan to unlock a travel journal for the actual trip:

- **Auto-tagged stops** — Journal entries are linked to route segments automatically
- **Photo captures** — Upload and caption photos at each stop
- **GPS coordinates** — Auto-requests device location when logging a memory; coordinates are saved and linked in the export
- **Day headers** — Journal organized by driving day with titles and notes
- **HTML export** — Full printable trip journal with all memories, GPS links, and route details

### Other Features

- **Favorites** — Star locations to save and reuse across trips
- **Adventure Mode** — Alternative planning with different pacing philosophy
- **Google Maps export** — Open your full route in Google Maps
- **Share URL** — Trip state serialized to URL for easy sharing
- **Trip history** — Recently calculated trips for quick reference
- **One-Way / Round Trip** — Toggle; round trips mirror the outbound leg

---

## Tech Stack

| Layer | Tech |
| --- | --- |
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS |
| Map | Leaflet + React Leaflet |
| Routing | OSRM (Open Source Routing Machine) |
| Geocoding | Nominatim (OpenStreetMap) |
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
├── components/
│   ├── Landing/        # Landing screen & mode selection
│   ├── Map/            # Leaflet map, animated polyline, POI popups
│   ├── Settings/       # Route preferences, vehicle forms
│   ├── Steps/          # Step 1/2/3 content panels
│   ├── Trip/           # Core trip UI — itinerary, journal, summary, challenges
│   ├── UI/             # Reusable primitives (Button, Dialog, StepIndicator, etc.)
│   └── Vehicle/        # Vehicle garage & presets
├── contexts/           # TripContext — shared state (locations, vehicle, settings, summary)
├── hooks/              # useTripCalculation, useJournal, usePOI, useWizard, useAddedStops
├── lib/                # All business logic
│   ├── api.ts          # OSRM routing + Nominatim geocoding
│   ├── border-avoidance.ts
│   ├── budget.ts       # Day splitting, cost breakdown
│   ├── calculations.ts # Fuel, costs, arrival times, fuel stop strategy
│   ├── challenges.ts   # Chicharon's Challenges data
│   ├── driver-rotation.ts
│   ├── feasibility.ts  # Route health checks
│   ├── segment-analyzer.ts
│   ├── stop-suggestions.ts
│   └── ...
└── types/              # TypeScript definitions
```

---

## Notes

- All routing and geocoding uses free, open-source services (OSRM public server, Nominatim). No API keys required.
- The OSRM public demo server is rate-limited — for production use, consider self-hosting.
- Budget figures in Chicharon's Challenges are historical trivia only. Gas and hotel prices vary by era and region — the real competition is route pacing.

---

Built with love. 💚
