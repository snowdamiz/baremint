---
phase: 05-token-gated-content
plan: 02
subsystem: api, media, auth
tags: [helius, solana, spl-token, sharp, blur, presigned-url, mux-jwt, r2, content-gating]

# Dependency graph
requires:
  - phase: 05-01
    provides: "tokenBalanceCache schema table, post accessLevel/tokenThreshold/creatorTokenId columns"
  - phase: 04-02
    provides: "image-processing.ts with processUploadedImage, uploadToR2"
  - phase: 04-03
    provides: "Mux client, webhook handler, media table with variants jsonb"
provides:
  - "getTokenBalance() for Helius RPC SPL token balance fetching"
  - "getCachedTokenBalance() with 60s DB-backed TTL cache"
  - "checkContentAccess() for post access determination"
  - "generateSignedImageUrl() for R2 presigned GET URLs"
  - "generateSignedPlaybackToken() for Mux JWT playback/thumbnail tokens"
  - "getR2KeyFromPublicUrl() helper for URL-to-key conversion"
  - "Blur variant generation for all images and videos"
affects: [05-03, feed-rendering, post-detail-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DB-backed cache with TTL for RPC call reduction"
    - "Two-pass blur: tiny resize -> blur -> upscale for fast blurred placeholders"
    - "Non-fatal blur generation in webhook (try/catch, continues on error)"

key-files:
  created:
    - lib/solana/token-balance.ts
    - lib/content/access-control.ts
    - lib/media/signed-urls.ts
  modified:
    - lib/media/image-processing.ts
    - lib/mux/client.ts
    - app/api/webhooks/mux/route.ts

key-decisions:
  - "Video blur generation is non-fatal -- errors logged but do not block asset.ready processing"
  - "Mux JWT signing keys are optional -- client works without them for non-gated video"
  - "MUX_PRIVATE_KEY stored as base64, decoded to ASCII at runtime"

patterns-established:
  - "Two-pass blur pipeline: 40px resize -> blur(20) -> 400px upscale -> WebP q60"
  - "Token balance cache: query DB first, fetch RPC on miss/stale, upsert on conflict"
  - "Signed URL pattern: check access -> generate time-limited URL/token -> serve"

# Metrics
duration: 3min
completed: 2026-02-01
---

# Phase 5 Plan 2: Token-Gated Content Backend Summary

**Helius RPC token balance checking with 60s DB cache, Sharp blur placeholders for images/videos, and R2 presigned URLs + Mux JWT tokens for authorized media access**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-01T23:42:17Z
- **Completed:** 2026-02-01T23:45:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Token balance verification via Helius RPC getTokenAccountsByOwner with BigInt summation
- Database-backed balance cache with 60-second TTL and upsert on unique wallet+mint index
- Content access control that compares cached balance against post tokenThreshold
- Blur variant generation for all images (sm/md/lg/blur pipeline)
- Video blur placeholders from Mux thumbnails on asset.ready webhook
- Presigned R2 GET URLs and Mux signed playback/thumbnail tokens for authorized access
- Mux client extended with optional JWT signing key configuration

## Task Commits

Each task was committed atomically:

1. **Task 1: Token balance fetching and cached access control** - `d656f63` (feat)
2. **Task 2: Blur placeholders, signed URLs, Mux JWT** - `5326bfe` (feat)

## Files Created/Modified
- `lib/solana/token-balance.ts` - Helius RPC getTokenAccountsByOwner for SPL token balances
- `lib/content/access-control.ts` - Cached balance checking and content access determination
- `lib/media/signed-urls.ts` - R2 presigned GET URLs and Mux signed playback tokens
- `lib/media/image-processing.ts` - Added blur variant to processUploadedImage
- `lib/mux/client.ts` - Added JWT signing key support (MUX_SIGNING_KEY_ID, MUX_PRIVATE_KEY)
- `app/api/webhooks/mux/route.ts` - Video blur placeholder generation on asset.ready

## Decisions Made
- Video blur generation is non-fatal in webhook handler (try/catch with logging) to avoid blocking asset.ready processing
- Mux JWT signing keys are optional -- client initializes without them for non-gated video scenarios
- MUX_PRIVATE_KEY stored as base64-encoded, decoded to ASCII at runtime for Mux SDK compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

New environment variables needed for gated video playback:
- `MUX_SIGNING_KEY_ID` - Mux signing key ID (create in Mux dashboard > Settings > Signing Keys)
- `MUX_PRIVATE_KEY` - Base64-encoded RSA private key from Mux signing key creation

## Next Phase Readiness
- All backend infrastructure for token-gated content is in place
- Ready for Plan 03: feed rendering with gated/ungated content display
- Blur placeholders available for both images and videos
- Signed URL/token generation ready for authorized access flow

---
*Phase: 05-token-gated-content*
*Completed: 2026-02-01*
