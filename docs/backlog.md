# Roadtrip Planner — Backlog & Future Ideas

## Budget

### Soft Category Sanity Checks
*Noted: Mar 8 2026*

The bank model is intentionally cap-free — no per-category hard limits.
But there's a gap: it won't flag when hotel cost is clearly unrealistic for a destination
(e.g. $3,600 hotel on a trip budgeted at $100/night) because there are no category bounds.

**Idea:** Optional "sanity check" mode — soft hints (not warnings) when a single
category looks way out of proportion to a reasonable baseline. Not a hard cap, just:
*"Hotels are eating 80% of your bank — you may want to shop around."*

Distinguish from the current actionable tip (which only fires when bank goes negative).
This would fire proactively, even when trip is still in-budget overall.

Could be: a secondary info-level notice on the budget card, or a note on the PDF summary page.

---
