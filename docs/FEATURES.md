# My Experience Engine — Feature List

> Built by a non-coder using AI. Every feature below exists in working code.

---

## Three Entry Modes

The app opens to a landing screen with three distinct modes. Each mode is a different way into the same engine.

**Plan Mode**
You know where you're going. Build the full trip — route, waypoints, budget, preferences — and get a complete day-by-day itinerary with real cost estimates.

**Adventure Mode**
You know what you have to spend and how many days you have. The engine finds real destinations you can actually reach and afford, then builds the trip for you.

**Estimate Mode**
Route and crew already decided. Just want a realistic cost breakdown before you commit. Get low/mid/high ranges per category and per person.

---

## Route Planning (Step 1)

- **Fuzzy location search** — Photon (typo-tolerant) with Nominatim fallback
- **Unlimited waypoints** — add as many stops as you want between origin and destination
- **Drag to reorder** — reorder waypoints in the list
- **Waypoint intents** — for each waypoint, check fuel, meal, or overnight to tell the engine exactly what you're doing there
- **Round trip mode** — toggle to mirror the return leg automatically
- **Eager route preview** — the map shows a preview polyline the moment you pick origin + destination, before you even calculate
- **Map click to add stops** — click anywhere on the map to add that location as a waypoint
- **Arrive-by time** — set a target arrival time and the engine works backward to suggest a departure

---

## Vehicle Setup (Step 2)

- **Custom vehicle entry** — year, make, model, city/highway fuel economy, tank size
- **Vehicle garage** — save and reload multiple vehicles (localStorage)
- **Metric and imperial** — L/100km or MPG, litres or gallons, km or miles
- **Preset vehicle cards** — quick-select common vehicle types (sedan, SUV, truck, hybrid) with sensible defaults

---

## Trip Settings (Step 2)

- **Departure date and time**
- **Number of travelers** (1–8)
- **Named drivers** — name each driver individually, used in rotation assignments and the printed itinerary
- **Number of drivers** — engine distributes driving time across the crew
- **Daily driving limit** — set max hours per day; engine auto-splits multi-day trips
- **Stop frequency** — conservative / balanced / aggressive; controls how often fuel and rest stops fire
- **Accommodation type** — hotel / camping / Airbnb / friends / other
- **Hotel tier** — budget / regular / premium
- **Avoid tolls** — route avoids toll roads
- **Avoid border crossings** — keeps the route in-country
- **Scenic mode** — prefers slower, more interesting roads
- **Trip style preferences** — scenic / family / budget / foodie; affects pacing and suggestions
- **Budget mode** — open (no budget) or plan-to-budget
- **Budget input** — total trip budget with live remaining tracker
- **Budget profiles** — balanced / foodie / scenic / custom; shifts how budget is split across categories
- **Save custom budget profiles** — name and reuse your preferred allocation setups
- **Currency** — CAD or USD throughout

---

## Route Calculation Engine

- **OSRM routing** — real road routing (not straight-line), respects toll/border/scenic preferences
- **Multi-segment routing** — waypoints produce multiple route segments, each with accurate distance and driving time
- **Arrival times** — calculated for every stop based on departure + driving time + accumulated stop time
- **Weather fetch** — pulls weather data for each segment endpoint (used for timezone and packing context)
- **Day splitting** — automatically divides the route into driving days based on max daily hours
- **Multi-day support** — overnight splits, hotel cost per day, per-day budget tracking
- **Round trip logic** — outbound + return legs, midpoint detection, return fuel reset in simulation
- **Regional fuel pricing** — different gas prices per province/state, not a flat rate
- **Regional hotel cost multipliers** — BC costs more than Manitoba; engine knows this
- **Real fuel consumption math** — city/highway blend per segment, not a flat average

---

## Smart Stop Simulation

The engine runs a physics-based simulation of the drive, tracking fuel level, driving hours, and time of day to decide when and where stops should happen. It does not guess — it calculates.

- **Fuel stops** — fires when tank would run dangerously low, safe range is exceeded, or comfort interval has elapsed
- **Comfort refuel** — top-up stop before you actually need it, at a real town, based on driving time preference
- **Rest breaks** — fires after configurable hours behind the wheel
- **Meal stops** — detects when the drive crosses a lunch (noon) or dinner (6 PM) window
- **Fuel + meal combos** — when a fuel stop lands during a meal window, the engine combines them into one 45-minute stop instead of two separate ones
- **Meal absorbs fuel** — if you're already eating for 45 min at noon, a fuel stop within 5 hours gets pulled forward and combined. You were already parked
- **Overnight stops** — fires when daily drive limit is hit; resets state to next-morning departure
- **Intent-aware simulation** — when you declare a fuel/meal at a waypoint, the engine adjusts its internal state so it doesn't generate a duplicate stop nearby
- **Deduplication** — engine stops and user-declared intent stops are deduplicated so you never see two fuel stops at the same location
- **En-route stops for long legs** — for segments too long for one tank, the engine places mid-segment fuel stops at real highway towns
- **Hub snapping** — stops snap to the nearest real city within 140km instead of landing at "km 341 of the highway"
- **Self-learning hub cache** — 130+ pre-seeded highway cities, grows as you plan more trips. Runs on a 3-tier lookup: local cache → POI density analysis → Nominatim fallback. Frequently used discoveries get promoted to permanent status
- **Destination grace zone** — suppresses unnecessary fuel stops within 50km of the final destination
- **Timezone-aware** — meal and stop times are stamped in the correct local timezone as you cross provincial/state lines
- **Round trip fuel reset** — simulates refueling at the destination before the return leg

---

## Trip Health & Feasibility

- **Feasibility engine** — rates the trip: looks good / heads up / rough / not recommended
- **Late arrival detection** — warns if any day ends after 10 PM
- **Early departure detection** — flags if a day starts before 4 AM
- **Compressed morning check** — catches the gap between days (arrive midnight, leave 6 AM = problem even if neither day triggers individually)
- **Long uninterrupted stretch warning** — flags legs that push the crew hard with no break
- **Trip difficulty score** — 0–100 score with emoji label (Easy / Moderate / Challenging / Brutal) and breakdown of contributing factors
- **Confidence score** — how confident the engine is in the calculation given the trip parameters
- **Trip highlights** — auto-generated highlights like "longest day" and "toughest leg"
- **Smart pacing suggestions** — plain-language tips about driver swaps, rest timing, and departure tweaks
- **Optimal departure suggestion** — the engine checks whether shifting your departure time by 30–90 minutes would land a fuel+lunch combo at a major highway city instead of a standalone stop mid-nowhere

---

## Budget System

- **Full cost breakdown** — fuel, accommodation, food, miscellaneous per day and total
- **Per-person costs** — splits total across traveler count
- **Budget remaining tracker** — live counter vs your declared budget
- **Budget sensitivity analysis** — see how costs change if gas prices go up, you add a night, or you upgrade hotels
- **Budget distribution bar** — visual breakdown of where the money goes
- **Category details** — expandable per-category view

---

## Itinerary View

- **Day-by-day timeline** — chronological events for each driving day
- **Drive segments** — each leg shows distance, duration, and fuel cost
- **Stop cards** — fuel, meal, rest, overnight, and combo stop cards with full context
- **Fuel gauge** — visual E–F tank indicator on every fuel stop card, shows fill type (topup vs full)
- **Spare gas warning** — sparse-stretch warning when a long leg has limited services
- **Overnight editor** — set hotel name, accommodation type, cost per night for each overnight stop
- **Activity editor** — add activities at each stop with category tags
- **Stop duration picker** — adjust dwell time on any stop
- **Flexible days / free days** — mark days as flex or free for unplanned time
- **Accept/dismiss suggestions** — each smart stop suggestion can be accepted (adds to plan) or dismissed
- **Smart pacing panel** — pacing suggestions visible in context of the itinerary
- **Running spend tracker** — cumulative trip spend updates as you scroll through days
- **Driver stats panel** — per-driver km, time, and segment count when multi-driver is set
- **Driver swap suggestions** — tells you which driver should take the wheel at which fuel stop
- **Daily budget card** — per-day cost breakdown inside the itinerary

---

## Map

- **Animated route polyline** — the route draws itself on load
- **Day-by-day color coding** — each driving day is a different color on the map
- **Fuel stop layer** — projected fuel stop pins displayed on the map
- **POI popup** — click a point of interest pin to see name, category, and details
- **Ghost car** — live car position marker that moves along the route in real time during an active trip, calculated via binary search + linear interpolation on the timeline
- **GPS arrival snap** — when you tap "arrived" during a live trip, the ghost car re-anchors to your actual GPS position
- **Google Maps export** — open the current route in Google Maps with one click

---

## POI Discovery ("Make This Trip Legendary")

- **Overpass API queries** — fetches real points of interest along the route from OpenStreetMap data
- **Multi-category support** — viewpoints, restaurants, museums, parks, historic sites, and more
- **Per-category loading state** — categories stream in as they load, not a single all-or-nothing wait
- **Ranked suggestions** — POIs ranked by score (detour cost, category weight, OSM rating)
- **Discovery tiers**:
  - 🔥 No-Brainer — high value, minimal detour
  - 👀 Worth the Detour — great if you have time
  - 🤷 If You Have Time — cool but not essential
- **Wikipedia links** — extracted from OSM tags when available
- **Dismiss and save** — dismiss POIs you don't want, save ones you do
- **Add to route** — add a POI directly as a waypoint from the discovery panel
- **Time budget filtering** — greedy knapsack algorithm limits suggestions to what actually fits in your available time

---

## Adventure Mode

- **Budget-first discovery** — input total budget, days, travelers, accommodation tier → engine finds real destinations
- **Curated destination database** — 30+ hand-picked destinations across Canada and the US, each with category, tags, photos, and descriptions
- **Preference filtering** — filter by scenic / family / budget / foodie
- **Max distance preview** — shows how far your budget can realistically take you before you even search
- **Round trip option** — adventure mode supports round trip calculation
- **Chicharon's Challenges** — pre-built trip challenges with difficulty ratings (easy / moderate / hard / legendary). Load a challenge to try to match the pacing

---

## Style Presets

- **Frugal** — conservative stops, budget accommodation, lower spend defaults
- **Balanced** — middle-of-the-road defaults
- **Comfort** — premium hotels, more rest stops, relaxed pacing
- **Chicharon Classic** — the house preset, tuned for Canadian highway road trips
- **Adaptive defaults** — the engine watches your past trips and nudges defaults toward your actual behavior over time (stop frequency, hotel tier, daily km)

---

## Route Strategy Picker

When the engine calculates a long trip, it evaluates multiple route strategies and lets you pick:

- **Fewest stops** — push harder, fewer interruptions
- **Most comfortable** — extra rest, more stops
- **Best combo timing** — optimized to hit fuel+meal combos at real cities

---

## Trip Journal (Live Mode)

Activate when you're actually on the road, not just planning.

- **Journal entries per stop** — notes, photos, star rating, highlight flag
- **Highlight reason** — mark a stop as a trip highlight with a reason ("best poutine of my life")
- **Photo capture** — attach photos from your device camera or library, with captions
- **Quick capture** — one-tap memory capture from anywhere on the route, GPS-tagged if available
- **Trip recap card** — auto-generated trip recap at the end
- **Journal fullscreen overlay** — distraction-free journaling view
- **Arrived button** — tap when you arrive at each stop to advance the journal and sync the ghost car
- **Export as HTML** — download your complete trip journal as a printable HTML file with photos

---

## Print / PDF Export

- **Cover page** — route summary, budget health, feasibility status, packing warnings, crew roster
- **Day-by-day pages** — full itinerary for each driving day
- **Per-day budget** — running trip spend visible on each day
- **Driver roster** — each driver's total km, time, and fuel stop swap assignments
- **Stop details** — every fuel, meal, rest, and overnight stop with timing and cost
- **Opens in new tab** — browser print dialog handles PDF export

---

## Share & Templates

- **Share as Template** — export your trip as a JSON file with route, settings, vehicle, recommendations, and journal highlights
- **Import a Template** — load someone else's template to pre-fill the planner
- **Fork lineage** — templates track their ancestry (original → fork → fork of fork)
- **URL sharing** — trip state encoded in the URL for direct link sharing
- **Recommendation notes** — template authors can attach per-location tips that appear when someone loads the template

---

## Settings & Preferences

- **Persistent storage** — trip state, vehicle garage, budget profiles, and hub cache all survive page reloads (localStorage)
- **Full reset** — one-button "start over" that clears all state cleanly
- **Mode switching** — switch between Plan / Adventure / Estimate without losing your work

---

## Under the Hood (for your dev buddy)

| Layer | What it does |
|-------|-------------|
| OSRM | Real road routing |
| Photon / Nominatim | Location search and reverse geocoding |
| Overpass API | POI data from OpenStreetMap |
| Open-Meteo | Weather forecasts per segment endpoint |
| React 19 + TypeScript | UI, strict mode |
| Vite | Build tool |
| Tailwind CSS | Styling |
| Leaflet / React Leaflet | Maps |
| Radix UI | Accessible component primitives |
| Vitest + Testing Library | 1,997+ assertions across 105 test files |
| Zero backend | Everything runs in the browser. No server, no database, no auth |

The entire engine — routing, simulation, budget math, feasibility, POI ranking, hub cache, driver rotation, journal export — is pure TypeScript in `src/lib/`. No frameworks, no dependencies beyond the project stack. Every feature was built through conversation.
