### Design Spec — Friendly Location Strings for MEE Search Surfaces

**Feature name**
Location String Sanitization / Friendly Display Names

**Purpose**
Ensure all user-facing location strings (search inputs, autocomplete dropdowns, and recent history) feel:

* human-readable
* premium and uncluttered
* stripped of administrative geocoder bloat (postal codes, counties, districts)

**Product goal**
MEE should present locations as destinations, not database coordinates.
A search experience supports that by turning:

* “Winnipeg, Division No. 11, Manitoba R3C, Canada”
into
* “Winnipeg, Manitoba”

This reduces cognitive load, prevents text-overflow issues on mobile surfaces, and maintains the “bougie,” editorial brand voice established in the Trip Title spec.

**North star**
The backend needs the coordinates; the user only needs the destination.
That means:

* we strictly separate the `rawGeocoderString` from the `friendlyDisplayName`
* the UI *only* consumes the friendly string
* routing and geocoding logic *only* consumes the raw ID/coordinates

**UX behavior**
**1. Search Autocomplete Dropdown**

* **Behavior:** As the user types, the returned results from the geocoding service must pass through a sanitization utility before rendering in the list.
* **Display:** * Primary text: `City` or `Point of Interest`
* Secondary text (smaller, muted): `State/Province, Country`



**2. Active Search Input Field**

* **Behavior:** When a user selects a dropdown item, the input field populates with the `friendlyDisplayName`, not the raw string.
* **Locked State:** Once validated, this clean string becomes the basis for the `Destination` variable used in the "Step 1" Trip Title auto-generation.

**3. Recent Searches / History**

* **Behavior:** History cards must render the clean, sanitized string to keep the UI visually balanced.

**Canonical data rules**
**Store:**

* `placeId` (or coordinates) - *Used for routing*
* `rawAddress` - *Used as fallback/backend truth*
* `displayDestination` - *Used exclusively for UI rendering*

**Formatting guidance (The Sanitization Rules)**
**What to Strip (The "Bloat" List):**

* Postal codes / ZIP codes
* County names (e.g., "Thunder Bay District", "Los Angeles County")
* Census divisions (e.g., "Division No. 11")
* Redundant country tags if within a localized context (optional, based on product preference)

**Examples:**

* *Raw:* `123 Main St, Winnipeg, MB R3C 1A3, Canada`
* *Clean:* `123 Main St, Winnipeg, MB`


* *Raw:* `Thunder Bay, Thunder Bay District, ON P7B 6B3, Canada`
* *Clean:* `Thunder Bay, Ontario`


* *Raw:* `Banff National Park, Improvement District No. 9, AB, Canada`
* *Clean:* `Banff National Park, Alberta`



**Guardrails**

* **Do not** mutate the underlying `placeId` or coordinate data when stripping strings.
* **Do not** strip strings so aggressively that disambiguation is lost (e.g., keep the state/province to separate "London, Ontario" from "London, UK").
* **Do** apply this filter universally across all top-of-funnel search surfaces.
* **Do** ensure this outputs the exact string that Step 1 consumes for `Your MEE time in [destination]`.

**Definition of done**
This feature is done when:

* a parsing utility function successfully strips postal codes and administrative districts from raw geocoder outputs.
* autocomplete dropdowns, the main search input, and history cards render the sanitized string.
* the clean string successfully passes into the canonical trip state to feed the Trip Title feature.