# Roadtrip Planner v2: Bougie Edition - Roadmap

## Overview

Transform the roadtrip planner from a "quick trip tool" into a **power user's dream** for detailed, multi-day road trip planning with budget precision.

**Target User**: People who make detailed itineraries (like the 2025 Winnipeg → Toronto plan) and want to automate the tedious parts while keeping full control.

**Philosophy**: "Quick Mode" for casual users, "Advanced Mode" for bougie planners.

---

## Phase 0: Technical Debt & Refactoring - COMPLETE

### Problem: App.tsx was 1,405 lines (now 507 lines - 64% reduction)

### Completed Refactoring

```text
src/
├── hooks/
│   ├── useTripCalculation.ts   # Route calculation, fuel stops, overnight prompts
│   ├── useJournal.ts           # Journal state, startJournal, updateActiveJournal
│   ├── usePOI.ts               # POI suggestions, map markers, category toggling
│   └── useWizard.ts            # Step navigation, validation, completion tracking
├── contexts/
│   └── TripContext.tsx         # Shared state (locations, vehicle, settings, summary)
├── components/Steps/
│   ├── Step1Content.tsx        # Location inputs, round trip, date/time
│   ├── Step2Content.tsx        # Vehicle form, travelers, budget
│   └── Step3Content.tsx        # Results, timeline, journal mode
```

### Refactor Tasks - ALL COMPLETE

- [x] **Extract useTripCalculation hook** (200 lines)
  - handleCalculate (route calculation)
  - calculateArrivalTimes logic
  - Round trip segment duplication
  - Overnight stop prompts

- [x] **Extract useJournal hook** (75 lines)
  - activeJournal state
  - startJournal, updateActiveJournal
  - Load active journal on mount

- [x] **Extract usePOI hook** (140 lines)
  - poiSuggestions state
  - markerCategories
  - fetchRoutePOIs logic

- [x] **Extract useWizard hook** (80 lines)
  - planningStep navigation
  - Validation (canProceedFromStep1/2)
  - completedSteps tracking

- [x] **Create TripContext** (170 lines)
  - locations, vehicle, settings, summary
  - Helper functions (updateLocation, addWaypoint, etc.)
  - Eliminates prop drilling

- [x] **Step Components extracted**
  - Step1Content (165 lines)
  - Step2Content (320 lines)
  - Step3Content (135 lines)

### Testing Infrastructure - COMPLETE

- [x] Vitest setup with React Testing Library
- [x] 70 tests passing (calculations + budget)
- [x] Test coverage for core functions

### Success Criteria - MET
- App.tsx: 507 lines (target was <300, but clean composition)
- Custom hooks: all under 200 lines
- Context eliminates prop drilling

---

## Phase 1: Mode Toggle & Foundation

### 1.1 Quick Mode vs Advanced Mode Toggle

**UI**: Toggle in settings or wizard header
- **Quick Mode** (default): Current 3-step wizard
- **Advanced Mode**: Unlocks power features

**Implementation**:
- Add `advancedMode: boolean` to settings
- Conditionally render advanced features
- Persist preference in localStorage

### 1.2 Settings Persistence Improvements

- Save all settings to localStorage (not just vehicle)
- "Remember my preferences" toggle
- Reset to defaults option

---

## Phase 2: Hotel Intelligence Layer

### 2.1 Hotel Search Integration

**API Options** (in order of preference):
1. **Google Places API** - Best data, costs money
2. **Booking.com Affiliate API** - Free for affiliates
3. **OpenStreetMap Overpass** - Free but limited data

**Features**:
- Search hotels near overnight stops
- Show: name, price, rating, distance from route
- Filter by: price range, rating, amenities

### 2.2 Hotel Amenity Display

Pull and display:
- Complimentary breakfast (with start time)
- Pool (indoor/outdoor)
- Parking (free/paid)
- Pet-friendly
- WiFi

**UI**: Amenity badges on overnight stop cards

### 2.3 Hotel Booking Integration (Stretch)

- "Book Now" links to Booking.com/Hotels.com
- Affiliate revenue possibility

---

## Phase 3: Driver & Passenger Management

### 3.1 Driver Rotation Scheduler

**Settings**:
- Number of drivers (1-4)
- Max driving time per stint (default: 2 hours)
- Preferred rotation points (fuel stops, rest stops)

**Algorithm**:
- Track cumulative driving time per driver
- Suggest rotation at fuel stops
- Show current driver in timeline

**UI**:
- Driver badge on each segment: "🚗 Driver 1"
- Rotation indicator: "🔄 Driver swap"
- Stats: "Driver 1: 4.5 hrs | Driver 2: 3.2 hrs"

### 3.2 Passenger Waypoints

**New waypoint types**:
- `pickup` - Add passenger
- `dropoff` - Remove passenger

**Features**:
- Track passenger count per segment
- Recalculate per-person costs when passengers change
- Timeline shows: "👤 Picked up Sarah" / "👋 Dropped off Sarah"

**Use case**: "Pick up friend in Beausejour, drop them off on return"

---

## Phase 4: Fuel Stop Enhancements

### 4.1 Fuel Stop Types

**Categories**:
- 🚨 **Critical** (tank < 10%) - Must stop
- ⛽ **Recommended** (tank < 25%) - Should stop
- ⚡ **Top-Off** (optional) - Pre-parking partial fill

**UI**: Different colors/icons for each type

### 4.2 Fuel Price Integration

**API Options**:
1. **GasBuddy API** - Real-time prices (may need partnership)
2. **Manual entry** - User inputs local gas prices
3. **Regional averages** - Estimate by province/state

**Features**:
- Show price at each suggested fuel stop
- "Cheapest gas on route" highlight
- Update cost estimates with real prices

### 4.3 EV Charging Stops (Stretch)

- Integration with PlugShare or OpenChargeMap
- Show charging time estimates
- Battery range calculations

---

## Phase 5: Themed Route Builder

### 5.1 Create Themed Loop

**Use case**: "Great Canadian EuroTrip" - towns named after European cities

**Features**:
- Name the theme
- Add waypoints with:
  - Location
  - Time window (10:30 AM - 12:00 PM)
  - Activity description
  - Category (🍽️ Meal | 📸 Photo | 🏛️ Attraction | ☕ Break)
- Reorder waypoints
- Calculate total loop time/distance

### 5.2 Theme Templates

**Pre-built themes**:
- "Scenic Overlooks" - Viewpoints along route
- "Food Crawl" - Best local restaurants
- "Historical Sites" - Museums and landmarks
- "Quirky Towns" - Oddly named places (Dildo, Come By Chance, etc.)

**User-created themes**:
- Save and share themed routes
- Import from JSON template

### 5.3 Theme Discovery (Stretch)

- AI-powered theme suggestions based on route
- "Find interesting stops along this route"
- Categories: nature, food, history, quirky

---

## Phase 6: Flexible Day Planning

### 6.1 TBD Day Support

**New day type**: "Flexible Day"

**Features**:
- Add multiple options for the day
- Each option shows: distance, cost, time
- Compare options side-by-side
- Lock in choice later or keep open

**UI**: Day card with "Option A | Option B | Option C" tabs

### 6.2 Out-of-Pocket Tracking

**Two expense modes**:
- 💳 **Budgeted** - Counted in trip budget
- 💵 **Out-of-pocket** - Tracked separately

**Use cases**:
- Day trips paid by someone else
- Reimbursable expenses
- Splitting costs with friends

**UI**: Toggle per expense + separate totals

---

## Phase 7: Activity Time Windows

### 7.1 Stop Duration & Activity Planning

**Enhanced stops**:
- Time window: "10:30 AM - 12:00 PM"
- Activity description: "Visit Covent Garden Market for lunch"
- Planned duration vs. actual tracking

**Auto-adjust**: If you linger, subsequent times shift

### 7.2 Activity Categories

- 🍽️ Meal
- 📸 Photo op
- 🏛️ Attraction
- ☕ Break
- 🛒 Shopping
- ⛽ Fuel (existing)
- 🏨 Overnight (existing)

---

## Phase 8: Export & Sharing Enhancements

### 8.1 PDF Export (Proper)

**Current**: HTML export, user prints to PDF
**Target**: Direct PDF generation with:
- Embedded photos
- Day-by-day layout matching manual plan format
- Budget summaries per day
- Map snapshots

**Library**: jsPDF + html2canvas or @react-pdf/renderer

### 8.2 Shareable Templates

**Current**: JSON export
**Target**:
- Hosted template links (if you add a backend)
- QR code generation for sharing
- Import from URL

### 8.3 Calendar Integration (Stretch)

- Export to Google Calendar / iCal
- Each stop as a calendar event
- Include location and notes

---

## Implementation Priority

### Must Have (Fall Trip Ready)

1. ~~Phase 0: Refactor App.tsx~~ - DONE
2. Phase 5.1: Themed Route Builder (for Dildo tour) - NEXT
3. Phase 6.1: TBD Day Support
4. Phase 7.1: Activity Time Windows

### Should Have

5. Phase 3.1: Driver Rotation
6. Phase 4.1: Fuel Stop Types
7. Phase 6.2: Out-of-Pocket Tracking

### Nice to Have

8. Phase 2: Hotel Intelligence
9. Phase 3.2: Passenger Waypoints
10. Phase 8.1: Proper PDF Export

### Stretch Goals

11. Phase 4.3: EV Charging
12. Phase 5.3: AI Theme Discovery
13. Phase 8.3: Calendar Integration

---

## Fall Trip: Eastern Canada Test Case

**Trip Details**:
- Destination: Newfoundland (easternmost Canada)
- Duration: 4 days
- Budget: $1,500
- Must-see: Dildo, NL + oddly named towns

**Themed Route**: "Newfoundland Oddities Tour"
1. Dildo
2. Heart's Content
3. Come By Chance
4. Happy Adventure
5. Witless Bay
6. Leading Tickles
7. Joe Batt's Arm
8. Blow Me Down

**Test Scenarios**:
- Create themed loop for Day 1-2
- Add "Free Day" with options (Gros Morne vs. local)
- Track out-of-pocket expenses
- Export as shareable template

---

## Technical Notes

### State Management After Refactor

```typescript
// TripContext.tsx
interface TripState {
  locations: Location[];
  settings: TripSettings;
  summary: TripSummary | null;
  vehicle: Vehicle;
}

// Hooks return focused slices
const useTripPlanner = () => {
  const { locations, setLocations, summary, setSummary } = useTripContext();
  // ... route calculation logic
  return { locations, addWaypoint, removeWaypoint, calculateRoute };
};
```

### Feature Flags

```typescript
// For gradual rollout
const FEATURES = {
  advancedMode: true,
  themedRoutes: true,
  driverRotation: false, // Not yet implemented
  hotelSearch: false,    // Not yet implemented
};
```

### Testing Strategy

- Unit tests for calculation functions (budget, fuel, time)
- Integration tests for hooks
- E2E test: Plan Newfoundland trip end-to-end

---

## Timeline Estimate

| Phase | Effort | Target |
|-------|--------|--------|
| Phase 0: Refactor | 2-3 days | Before new features |
| Phase 5.1: Themed Routes | 1-2 days | For fall trip |
| Phase 6.1: TBD Days | 1 day | For fall trip |
| Phase 7.1: Time Windows | 1 day | For fall trip |
| Phase 3.1: Driver Rotation | 1 day | Nice to have |
| Phase 4.1: Fuel Types | 0.5 day | Quick win |
| Phase 6.2: Out-of-Pocket | 0.5 day | Quick win |

**Total for "Fall Trip Ready"**: ~5-7 days of focused work

---

## Success Metrics

1. **Code Health**: App.tsx < 300 lines
2. **Feature Parity**: Can recreate 2025 Winnipeg plan in-app
3. **Usability**: Plan Newfoundland trip entirely in-app
4. **Export Quality**: PDF matches manual plan format
5. **Bougie Factor**: Makes you feel fancy using it
