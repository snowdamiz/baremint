---
phase: 05-token-gated-content
plan: 01
subsystem: database, api, ui
tags: [drizzle, zod, token-gating, access-control, bigint]

# Dependency graph
requires:
  - phase: 04-content-infrastructure
    provides: post table, publish API, post composer component
  - phase: 03-creator-onboarding
    provides: creatorToken table for FK reference
provides:
  - accessLevel, tokenThreshold, creatorTokenId columns on post table
  - tokenBalanceCache table with wallet+mint unique index
  - Publish API with zod validation of access level and BigInt threshold
  - Two-step post composer flow (compose -> access level selection)
affects: [05-02 (gating enforcement), 05-03 (signed video playback)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step publish flow: compose content -> select access level"
    - "BigInt stored as text string (matching amountLamports pattern)"
    - "Gated posts require launched token (creatorToken FK)"

key-files:
  created: []
  modified:
    - lib/db/schema.ts
    - lib/content/post-queries.ts
    - app/api/posts/[id]/publish/route.ts
    - components/content/post-composer.tsx

key-decisions:
  - "Access level defaults to public; gated requires threshold + launched token"
  - "Token threshold stored as text (BigInt string) matching existing amountLamports pattern"
  - "Two-step dialog flow reuses same dialog (compose step -> access step) instead of separate modal"

patterns-established:
  - "Access level enum: public | hold_gated | burn_gated"
  - "tokenBalanceCache table for caching on-chain balance lookups"

# Metrics
duration: 3min
completed: 2026-02-01
---

# Phase 5 Plan 1: Token-Gated Content Schema & Publish Flow Summary

**Post access level columns (public/hold/burn-gated) with zod-validated publish API and two-step composer dialog**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-01T23:36:26Z
- **Completed:** 2026-02-01T23:39:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended post table with accessLevel, tokenThreshold, and creatorTokenId columns
- Added tokenBalanceCache table with unique index on (walletAddress, mintAddress)
- Publish API validates access level enum, BigInt threshold, and requires launched token for gated content
- Post composer now has two-step flow: compose content then select access level before publishing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend database schema** - `cad76d0` (feat)
2. **Task 2: Update publish API and post composer** - `34dd88e` (feat)

## Files Created/Modified
- `lib/db/schema.ts` - Added accessLevel/tokenThreshold/creatorTokenId to post; added tokenBalanceCache table
- `lib/content/post-queries.ts` - publishPost accepts options param; getPublishedPosts includes new columns
- `app/api/posts/[id]/publish/route.ts` - Zod body validation, BigInt check, creatorToken lookup for gated posts
- `components/content/post-composer.tsx` - Two-step dialog with access level cards, threshold input, back navigation

## Decisions Made
- Access level defaults to public; gated requires threshold + launched token (403 if no token)
- Token threshold stored as text (BigInt string) matching existing amountLamports pattern from withdrawal table
- Two-step dialog flow reuses same dialog instead of separate modal (compose -> access step)
- Drizzle schema push succeeded against live database

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required for this plan. (Mux signing keys listed in plan frontmatter are needed for plan 03, not this plan.)

## Next Phase Readiness
- Schema and publish flow ready for plan 02 (gating enforcement/access checks)
- tokenBalanceCache table ready for on-chain balance caching logic
- Access level data flows end-to-end from UI through API to database

---
*Phase: 05-token-gated-content*
*Completed: 2026-02-01*
