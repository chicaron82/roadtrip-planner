# Deferred Decisions

Decisions that have been consciously deferred — documented so they don't get lost.

---

## OSRM Public Server Dependency

**Date deferred:** 2026-03-09
**Priority:** High — production risk

### Problem

The app calls `https://router.project-osrm.org/route/v1/driving/` — the public OSRM demo server. This is shared public infrastructure not suitable for sustained production traffic. If OSRM goes down or rate-limits the app, the entire routing feature fails silently (15s timeout, `console.warn` fallback only). No user-facing guidance is shown.

### Proposed Solution (Option A — Recommended)

Keep OSRM as primary. Add **GraphHopper** (free tier: 15k req/day) or **OpenRouteService** (free tier: 2k/day) as a hot-standby fallback. If OSRM times out or errors, the orchestrator retries once on the fallback before surfacing a user-facing error. Transparent to the user.

Implementation scope:
- `src/lib/api.ts` — add fallback provider, retry logic
- No changes to `trip-orchestrator.ts` or any hooks
- Requires storing an API key client-side (env var via Vite)

### Alternative (Option B — Keyless)

Keep OSRM as the only provider but add: proper retry logic (1 retry with exponential backoff), a clear user-facing error with a "Try again" button, and a status message explaining what failed. No new dependency, but OSRM downtime still means zero routing.

### Why Deferred

Decision pending on whether to introduce an API key dependency. Revisit when OSRM reliability becomes a practical concern in production.
