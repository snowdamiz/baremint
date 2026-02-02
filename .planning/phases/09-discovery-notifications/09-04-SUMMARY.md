---
phase: 09-discovery-notifications
plan: 04
subsystem: notifications, api, ui
tags: [notifications, polling, webhook, fan-out, drizzle, lucide-react]

# Dependency graph
requires:
  - phase: 09-02
    provides: search and discovery foundation
  - phase: 06-token-trading
    provides: trade table and Helius webhook handler
  - phase: 04-content-infrastructure
    provides: post publish route
provides:
  - notification database table with indexes
  - server-side fan-out to token holders on trades and content publishes
  - notification API routes (list, count, mark-as-read)
  - notification bell with unread badge and dropdown
  - full notifications page at /dashboard/notifications
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Polling-based notification count with jitter (25-35s interval)"
    - "Fan-out capped at 1000 holders per event for MVP"
    - "txSignature-based deduplication for webhook-triggered notifications"
    - "Non-fatal notification creation (try/catch or .catch() wrappers)"

key-files:
  created:
    - lib/notifications/create.ts
    - app/api/notifications/route.ts
    - app/api/notifications/count/route.ts
    - components/notifications/notification-bell.tsx
    - components/notifications/notification-dropdown.tsx
    - components/notifications/notification-item.tsx
    - hooks/use-notification-count.ts
    - app/(dashboard)/dashboard/notifications/page.tsx
  modified:
    - lib/db/schema.ts
    - app/api/webhooks/helius/route.ts
    - app/api/posts/[id]/publish/route.ts
    - app/(dashboard)/layout.tsx

key-decisions:
  - "Polling with jitter (25-35s) for notification count instead of WebSocket/SSE for MVP simplicity"
  - "Fan-out capped at 1000 holders to prevent unbounded notification inserts"
  - "Non-fatal notification creation so trade confirmation and post publish never fail due to notification errors"

patterns-established:
  - "Notification fan-out: query distinct buyers from trade table, batch insert notifications"
  - "Deduplication: check txSignature before inserting webhook-triggered notifications"

# Metrics
duration: 3.5min
completed: 2026-02-02
---

# Phase 9 Plan 4: In-App Notifications Summary

**Notification system with database fan-out to token holders on trades/publishes, polling bell badge, dropdown, and full page**

## Performance

- **Duration:** 3.5 min
- **Started:** 2026-02-02T03:39:04Z
- **Completed:** 2026-02-02T03:42:37Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Notification table with user_unread and tx_signature indexes for efficient queries
- Server-side fan-out creates notifications for token holders when trades confirm (DISC-05) or content publishes (DISC-04)
- Deduplication by txSignature prevents duplicate notifications from webhook retries
- Notification bell in sidebar header shows unread count badge with 30s polling
- Dropdown shows recent notifications with mark-all-read
- Full /dashboard/notifications page with pagination and empty state

## Task Commits

Each task was committed atomically:

1. **Task 1: Notification schema, creation helper, and API routes** - `93ca5a2` (feat)
2. **Task 2: Wire notifications into webhooks/publish, add bell UI** - `36a9a47` (feat)

## Files Created/Modified
- `lib/db/schema.ts` - Added notification table with indexes
- `lib/notifications/create.ts` - notifyTokenHolders and notifyTokenHoldersByCreator fan-out helpers
- `app/api/notifications/route.ts` - GET list with pagination, PATCH mark-as-read
- `app/api/notifications/count/route.ts` - GET unread count for authenticated user
- `app/api/webhooks/helius/route.ts` - Added notification fan-out after trade confirmation
- `app/api/posts/[id]/publish/route.ts` - Added notification fan-out after post publish
- `hooks/use-notification-count.ts` - Polling hook with jitter for unread count
- `components/notifications/notification-bell.tsx` - Bell icon with red unread badge and dropdown toggle
- `components/notifications/notification-dropdown.tsx` - Recent notifications popover with mark-all-read
- `components/notifications/notification-item.tsx` - Single notification with type icons and relative time
- `app/(dashboard)/layout.tsx` - Added NotificationBell in sidebar header and mobile, added Notifications nav item
- `app/(dashboard)/dashboard/notifications/page.tsx` - Full notifications page with pagination

## Decisions Made
- Polling with jitter (25-35s) for notification count instead of WebSocket/SSE -- simpler for MVP
- Fan-out capped at 1000 holders to prevent unbounded inserts
- Non-fatal notification creation wrapped in try/catch so trade/publish operations never fail due to notification errors
- Mobile notification bell placed as a top-right element above main content area

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 9 is now complete (all 4 plans executed)
- Full discovery and notification system operational
- Project is feature-complete for MVP

---
*Phase: 09-discovery-notifications*
*Completed: 2026-02-02*
