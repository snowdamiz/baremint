---
phase: 07-burn-to-unlock-premium-content
plan: 02
subsystem: ui
tags: [react, burn, unlock, dialog, composer, content-gating]

# Dependency graph
requires:
  - phase: 07-01
    provides: "Burn API endpoints (GET/POST /api/burn/[postId]), contentUnlock table, checkContentAccess with burn support"
  - phase: 05-token-gated-content
    provides: "UnlockDialog, PostCard, PostFeed with gated media infrastructure"
provides:
  - "Real burn-to-unlock dialog with quote fetching, fee breakdown, and execution"
  - "Post composer burn_gated mode without manual threshold input"
  - "Immediate content unlock after burn via gatedData refresh"
affects: [08-discovery, 09-mobile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Burn quote fetch on dialog open with cancel-safe useEffect"
    - "Multi-step dialog flow (quote -> confirming -> success) via useState"
    - "BigInt token/SOL formatting helpers for display"
    - "Callback-based content refresh: PostFeed -> PostCard -> UnlockDialog -> onUnlocked"

key-files:
  modified:
    - components/content/unlock-dialog.tsx
    - components/content/post-composer.tsx
    - components/content/post-card.tsx
    - components/content/post-feed.tsx

key-decisions:
  - "Burn cost displayed via formatTokenAmount (divide by 10^6) and formatSolAmount (divide by 10^9)"
  - "Hold-gated Buy button navigates via window.location.href to /trade/{creatorTokenId}"
  - "burn_gated posts use on-chain burn price, no per-post tokenThreshold needed"

patterns-established:
  - "Multi-step dialog pattern: useState<DialogStep> with conditional rendering per step"
  - "Content refresh after unlock: onUnlocked callback chain through component tree"

# Metrics
duration: 3min
completed: 2026-02-02
---

# Phase 7 Plan 2: Burn-to-Unlock Frontend Summary

**Real burn-to-unlock dialog with quote/fee display, burn execution with loading states, and immediate content refresh after successful burn**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-02T02:07:20Z
- **Completed:** 2026-02-02T02:10:20Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced placeholder "coming soon" toasts with real burn execution flow
- Burn dialog shows token cost and SOL fee breakdown from on-chain quote
- Content unlocks immediately after successful burn without page refresh
- Post composer hides threshold input for burn_gated, shows informational text instead

## Task Commits

Each task was committed atomically:

1. **Task 1: Unlock dialog burn execution flow** - `04bb0a9` (feat)
2. **Task 2: Post composer, card, and feed updates for burn_gated** - `d75afd5` (feat)

## Files Created/Modified
- `components/content/unlock-dialog.tsx` - Rewritten with burn quote fetch, fee breakdown, multi-step burn flow
- `components/content/post-composer.tsx` - burn_gated hides threshold input, shows info text
- `components/content/post-card.tsx` - Passes postId and onUnlocked to UnlockDialog
- `components/content/post-feed.tsx` - handlePostUnlocked re-fetches gated media for unlocked post

## Decisions Made
- Burn cost formatted by dividing BigInt by 10^6 (tokens) and 10^9 (SOL lamports)
- Hold-gated "Buy Tokens" navigates to trade page via window.location.href
- burn_gated posts do not require tokenThreshold -- burn cost comes from on-chain burn_sol_price
- mintAddress for trade link fetched from burn quote response (not passed as prop)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Burn-to-unlock feature complete end-to-end: backend API (07-01) + frontend UI (07-02)
- Phase 7 complete, ready for Phase 8 (Discovery/Feed)

---
*Phase: 07-burn-to-unlock-premium-content*
*Completed: 2026-02-02*
