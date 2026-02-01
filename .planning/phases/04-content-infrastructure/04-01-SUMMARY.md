---
phase: 04-content-infrastructure
plan: 01
subsystem: database, api
tags: [drizzle, postgres, posts, crud, draft, publish, moderation, content-pipeline]

# Dependency graph
requires:
  - phase: 03-creator-onboarding
    provides: creatorProfile table and auth pattern
provides:
  - post, media, moderationAction, creatorStrike database tables
  - Post CRUD API (create draft, update, publish, list, delete)
  - Reusable post query functions in lib/content/post-queries.ts
affects: [04-02 media upload, 04-03 moderation pipeline, 04-04 feed, 04-05 gating]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status-driven content pipeline (draft -> processing -> published -> under_review -> removed)"
    - "Soft-delete for legal compliance (status=removed, never hard delete)"
    - "Reusable query module pattern (lib/content/post-queries.ts)"

key-files:
  created:
    - lib/content/post-queries.ts
    - app/api/posts/route.ts
    - app/api/posts/[id]/route.ts
    - app/api/posts/[id]/publish/route.ts
  modified:
    - lib/db/schema.ts

key-decisions:
  - "Soft-delete posts (status=removed) for legal compliance -- never hard delete"
  - "Text-only posts publish immediately; posts with media check all media ready status"
  - "Draft visibility restricted to owner; published posts are public"

patterns-established:
  - "Content query module: lib/content/post-queries.ts isolates DB logic from route handlers"
  - "Status-driven pipeline: all content flows through draft -> published with intermediate states"

# Metrics
duration: 3min
completed: 2026-02-01
---

# Phase 4 Plan 1: Content Schema & Post CRUD Summary

**Post/media/moderation/strike tables with status-driven pipeline and text post CRUD API supporting draft auto-save and publish flow**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-01T22:31:01Z
- **Completed:** 2026-02-01T22:33:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Four content tables (post, media, moderationAction, creatorStrike) with status-driven fields and proper FK relationships
- Complete post CRUD API: create draft, update draft (auto-save), publish, list, get single, soft-delete
- Publish endpoint handles both text-only (immediate publish) and media posts (checks all media ready)
- Auth and ownership verification on all mutation endpoints

## Task Commits

Each task was committed atomically:

1. **Task 1: Add content tables to database schema** - `8d327ba` (feat)
2. **Task 2: Create post CRUD API with draft auto-save and publish** - `5423209` (feat)

## Files Created/Modified
- `lib/db/schema.ts` - Added post, media, moderationAction, creatorStrike tables with jsonb import
- `lib/content/post-queries.ts` - Reusable query functions: createDraftPost, updateDraftPost, publishPost, getPublishedPosts, getCreatorDrafts, getPostById, deletePost
- `app/api/posts/route.ts` - POST create draft, GET list posts (published public, drafts owner-only)
- `app/api/posts/[id]/route.ts` - GET single post, PATCH update draft, DELETE soft-remove
- `app/api/posts/[id]/publish/route.ts` - POST publish transition (text-only immediate, media checks status)

## Decisions Made
- Soft-delete posts (status="removed") instead of hard delete for legal compliance
- Text-only posts publish immediately to "published" status; posts with media go to "processing" and check if all media is "ready"
- Draft visibility restricted to owner via creator profile ID check; published posts are public
- Removed unused `sql` import from drizzle-orm (clean unused import)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Content tables ready for media upload pipeline (plan 04-02)
- Moderation tables ready for CSAM scanning pipeline (plan 04-03)
- Post CRUD API ready for feed rendering (plan 04-04)
- Post query module provides reusable functions for all downstream plans

---
*Phase: 04-content-infrastructure*
*Completed: 2026-02-01*
