# Roadtrip Planner (MEE) — docs/

> **What this folder is:** an idea-drop **inbox**, not a backlog. The crew riffs MEE ideas and
> design intent away from the computer and drops them here so they're easy to reference. The *code*
> is the deliverable; a drop only points at it. MEE is design-forward, so most drops are `spec-`
> (fuller design intent) — see [CONVENTIONS.md](CONVENTIONS.md).
>
> **The `archive/` is already implemented** — nothing in it is open work. Every spec in there was
> built and frequently **evolved past** what was written.
>
> ⚠️ **The archives are history, not documentation.** Where a doc and the code disagree, **the code
> is the source of truth.** Don't read an archived spec as the current design.
>
> **Structure:** top level holds the **meta** files + **open drops** (live `status`) + **living
> reference**. Shipped drops live under `archive/` in four buckets. New drops follow
> [CONVENTIONS.md](CONVENTIONS.md) — copy [TICKET_TEMPLATE.md](TICKET_TEMPLATE.md).

> **This README tracks open work + reference only — it does *not* catalog what shipped.** Shipped
> drops are stamped in their frontmatter, and the narrative lives in the
> **[chicharons blog](../../chicharons-kitchen/)**. The archive summaries below are bucket-level
> pointers, not a per-ship ledger.

---

## 📥 Open

- [spec-backend-integration.md](spec-backend-integration.md) — **OPEN, blocked on a hosting call.**
  The MEE Supabase backend (Tier 1+2, no accounts), fully scoped. Shelved on the free-tier 2-project
  cap (Fleet Garage + Nanay's hold both slots); unblock = free a slot / paid plan / different host
  (Neon, etc.). The kitchen's one open MEE item — stays here until it's stamped shipped. Tracked on
  the flagged-not-fixed board.

## 📖 Living reference (not history — current lookups)

- [FEATURES.md](FEATURES.md) — the MEE feature catalog.
- [console-commands.md](console-commands.md) — dev/console command reference.

## 🗄️ archive/ — history (all shipped or evolved past; code is truth)

- **[archive/design-specs/](archive/design-specs/)** (32) — the MEE design language and feature
  specs: the four-beat arc, Voilà reveal, fullscreen glass, editorial voice, trip-title/location
  strings, board renderer, EV planning, icebreaker/workshop, map-as-story, and the rest. The design
  intent behind what shipped; the live design is in the code.
- **[archive/kitchen-tickets/](archive/kitchen-tickets/)** (16) — dated implementation tickets
  (Mar–Apr 2026: wiring & tests, back button, print/budget, blog migration, borderless glass, voilà
  polish, sketch round-trip, …) plus the ticket-ordering / consolidation planning docs.
- **[archive/audits-and-backlogs/](archive/audits-and-backlogs/)** (8) — coverage/state audits, the
  repo review, and spent backlogs (food-roadtrip mode, unified landing, deferred, master backlog).
- **[archive/misc/](archive/misc/)** (5) — binary `.docx` specs and other non-markdown formats
  (consolidated spec, fuel-gauge spec, coverage audit, EV planning v2, design-evolution board)
  that can't be indexed inline.
