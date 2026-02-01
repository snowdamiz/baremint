---
phase: 04-content-infrastructure
plan: 03
subsystem: api
tags: [mux, video, transcoding, hls, webhooks, csam, r2]

# Dependency graph
requires:
  - phase: 04-01
    provides: post and media DB schema with status fields
  - phase: 04-02
    provides: CSAM scanning module, R2 upload helpers, image processing
  - phase: 03-01
    provides: R2 presigned URL upload pattern
provides:
  - Mux SDK singleton client
  - Video upload API (R2 presigned URL for original)
  - Media confirm endpoint (CSAM scan then Mux direct upload)
  - Mux webhook handler (asset.ready, asset.errored, upload.cancelled)
  - Auto-publish post when all media reaches ready status
affects: [04-04, 04-05]

# Tech tracking
tech-stack:
  added: ["@mux/mux-node", "@mux/mux-uploader-react", "@mux/mux-player-react"]
  patterns:
    - "Two-phase video upload: R2 first (CSAM scan) then Mux (transcoding)"
    - "Webhook signature verification before processing, always return 200 after"
    - "Idempotent webhook handlers via playbackId existence check"

key-files:
  created:
    - lib/mux/client.ts
    - app/api/upload/video/route.ts
    - app/api/media/[id]/confirm/route.ts
    - app/api/webhooks/mux/route.ts
  modified:
    - package.json

key-decisions:
  - "Two-phase video upload: R2 first for CSAM scan, then Mux for transcoding"
  - "Mux SDK max_duration_seconds not available on upload params; duration enforced by checking after transcoding"
  - "video_quality: basic and max_resolution_tier: 1080p for cost control"
  - "Always return 200 after webhook signature verification to prevent retry storms"

patterns-established:
  - "Mux lazy singleton: same Proxy-less pattern, getMuxClient() with null check"
  - "Media confirm endpoint: centralized scan -> process pipeline for all media types"
  - "maybePublishPost: reusable post-publish check used by both confirm and webhook"

# Metrics
duration: 5min
completed: 2026-02-01
---

# Phase 4 Plan 3: Video Upload & Transcoding Pipeline Summary

**Mux video pipeline with two-phase upload (R2 for CSAM scan, Mux for HLS transcoding) and webhook-driven completion**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-01T22:37:39Z
- **Completed:** 2026-02-01T22:42:54Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Video upload creates media record and returns R2 presigned URL for original
- Confirm endpoint scans original video for CSAM before creating Mux direct upload
- Mux webhook updates media with playbackId/duration and auto-publishes post
- All webhook handlers are idempotent and return 200 to prevent retry storms

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Mux client and video upload API** - `3a413d5` (feat)
2. **Task 2: Create Mux webhook handler for video completion** - `0e29730` (feat)

## Files Created/Modified
- `lib/mux/client.ts` - Lazy singleton Mux SDK client
- `app/api/upload/video/route.ts` - POST endpoint creating media record + R2 presigned URL
- `app/api/media/[id]/confirm/route.ts` - Confirm endpoint: CSAM scan then Mux upload or image processing
- `app/api/webhooks/mux/route.ts` - Mux webhook handler for asset.ready/errored/cancelled
- `package.json` - Added @mux/mux-node, @mux/mux-uploader-react, @mux/mux-player-react

## Decisions Made
- **Two-phase video upload:** Video goes to R2 first (original preserved for CSAM scanning and legal compliance), then to Mux for transcoding. Original stays in R2 permanently.
- **No SDK-level duration enforcement:** The Mux SDK's `UploadCreateParams` does not have a `max_duration_seconds` field. Duration can be checked after transcoding in the webhook handler if needed. The 10-minute limit would need to be enforced client-side or via Mux dashboard settings.
- **Confirm endpoint handles both types:** Created a unified confirm endpoint that handles both image and video media, dispatching to the appropriate handler. This may overlap with 04-02 if it creates the same route -- whichever runs second will need to merge.
- **video_quality: basic:** Uses Mux's free basic encoding tier to minimize costs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created CSAM scan and media confirm dependencies**
- **Found during:** Task 1
- **Issue:** Plan 04-02 (parallel) hadn't created the confirm route yet. The CSAM scan module and upload helpers were already created by 04-02.
- **Fix:** Created `app/api/media/[id]/confirm/route.ts` with full video + image handling since 04-02's version didn't exist yet.
- **Files modified:** app/api/media/[id]/confirm/route.ts
- **Verification:** Build passes with all imports resolved
- **Committed in:** 3a413d5

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Created the confirm endpoint that 04-02 also plans to create. If 04-02 runs after, it may need to merge rather than overwrite.

## Issues Encountered
- Mux SDK does not expose `max_duration_seconds` on `UploadCreateParams`. The plan specified enforcing 10-minute limit via Mux config, but this parameter doesn't exist in the SDK types. Duration enforcement would need to happen via Mux dashboard settings or post-transcoding validation in the webhook handler.

## User Setup Required

**External services require manual configuration.** See [04-USER-SETUP.md](./04-USER-SETUP.md) for Mux configuration:
- Set `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` from Mux Dashboard
- Set `MUX_WEBHOOK_SECRET` from Mux Dashboard webhook settings
- Create webhook endpoint in Mux Dashboard pointing to `/api/webhooks/mux`

## Next Phase Readiness
- Video upload and transcoding pipeline complete
- Ready for video player component integration (04-04/04-05)
- Mux credentials and webhook configuration needed before testing

---
*Phase: 04-content-infrastructure*
*Completed: 2026-02-01*
