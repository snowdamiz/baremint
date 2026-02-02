---
phase: 05-token-gated-content
verified: 2026-02-01T23:54:36Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Create a hold-gated post with token threshold"
    expected: "Post composer shows access level selection step, validates threshold, and publishes successfully. Post is marked as hold_gated in database with correct threshold and creatorTokenId."
    why_human: "UI flow and database state require manual inspection"
  - test: "View gated post as unauthorized viewer"
    expected: "Viewer sees blurred media placeholder with lock overlay and 'Hold X tokens to unlock' message. Unlock button opens dialog showing balance comparison (0 / threshold). Original media URLs are NOT in browser network tab."
    why_human: "Visual rendering, security validation (network tab inspection)"
  - test: "View gated post as authorized viewer (with tokens)"
    expected: "Viewer sees full content via presigned URLs (images) or signed playback tokens (video). Content loads and plays normally. Presigned URLs expire after 5 minutes."
    why_human: "Real-time token balance check, presigned URL generation, expiration behavior"
  - test: "Token balance caching"
    expected: "First access triggers Helius RPC call and caches balance in database. Second access within 60s uses cached value (no RPC call). After 60s, cache refreshes."
    why_human: "Cache timing behavior and RPC call frequency require monitoring"
  - test: "Blur placeholder quality"
    expected: "Blurred placeholders are heavily obscured (no detail visible) but recognizable as content type (image vs video). Blur variant is publicly accessible without auth."
    why_human: "Visual quality assessment and security validation"
---

# Phase 5: Token-Gated Content Verification Report

**Phase Goal:** Viewers holding sufficient creator tokens can access gated content; others see a locked placeholder  
**Verified:** 2026-02-01T23:54:36Z  
**Status:** human_needed  
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Creator can set a post's access level to public, hold-gated, or burn-gated when publishing | ✓ VERIFIED | Post composer has two-step flow (compose → access). Access level step shows three radio options (public, hold_gated, burn_gated) with proper UI and validation. Publish API validates enum and stores in DB. |
| 2 | Creator can set the token hold threshold required to view gated content | ✓ VERIFIED | Access level step shows threshold input field when gated access selected. Validates positive BigInt before publish. Stored in `post.tokenThreshold` column. |
| 3 | Viewer holding enough tokens sees gated content normally; viewer without enough tokens sees a blurred placeholder with "Hold X tokens to unlock" | ✓ VERIFIED | Gated media API (`/api/content/[postId]/media`) calls `checkContentAccess()` to compare viewer balance vs threshold. Authorized → presigned URLs/signed tokens. Unauthorized → blur URLs only with lock overlay. PostCard renders locked/unlocked states correctly. |
| 4 | Access is verified server-side at content request time (not cached from login) | ✓ VERIFIED | Every request to `/api/content/[postId]/media` calls `checkContentAccess()` which queries `getCachedTokenBalance()` (60s TTL cache, fresh RPC on miss). No session-level access caching. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/db/schema.ts` | accessLevel, tokenThreshold, creatorTokenId columns on post; tokenBalanceCache table | ✓ VERIFIED | Lines 167-169: accessLevel (default "public"), tokenThreshold (nullable string), creatorTokenId (FK). Lines 227-242: tokenBalanceCache table with unique index on (walletAddress, mintAddress). |
| `app/api/posts/[id]/publish/route.ts` | Validates accessLevel params, requires token for gated posts | ✓ VERIFIED | Lines 9-14: Zod schema validates accessLevel enum. Lines 56-95: Checks threshold, validates BigInt, looks up creator token, passes to publishPost(). 112 lines total — substantive. |
| `components/content/post-composer.tsx` | Access level selection step before publishing | ✓ VERIFIED | Lines 28, 47-71: PublishStep type, ACCESS_LEVEL_OPTIONS array. Lines 83-86: State for publishStep, accessLevel, tokenThreshold. Lines 313-352: handleGoToAccessStep saves draft first. Lines 545-648: Access level step UI with radio cards and threshold input. 653 lines total — substantive. |
| `lib/solana/token-balance.ts` | getTokenBalance via Helius RPC | ✓ VERIFIED | Lines 16-72: Full implementation with JSON-RPC getTokenAccountsByOwner, sums account balances, returns BigInt. Exports getTokenBalance. 73 lines — substantive. |
| `lib/content/access-control.ts` | getCachedTokenBalance with 60s TTL, checkContentAccess | ✓ VERIFIED | Lines 21-67: getCachedTokenBalance with cache query, age check (60s TTL), upsert on miss. Lines 81-128: checkContentAccess compares balance vs threshold. Both exported. 129 lines — substantive. |
| `lib/media/image-processing.ts` | Blur variant generation | ✓ VERIFIED | Lines 120-135: Generates blur variant (resize 40px → blur(20) → resize 400px → webp) and uploads to R2. Blur always generated for all images. 143 lines — substantive. |
| `lib/media/signed-urls.ts` | generateSignedImageUrl, generateSignedPlaybackToken | ✓ VERIFIED | Lines 16-34: generateSignedImageUrl using S3 presigned URLs (5min default). Lines 48-65: generateSignedPlaybackToken using Mux JWT (15min default). Lines 77-92: getR2KeyFromPublicUrl helper. All exported. 93 lines — substantive. |
| `lib/mux/client.ts` | JWT signing key configuration | ✓ VERIFIED | Lines 26-39: Reads MUX_SIGNING_KEY_ID and MUX_PRIVATE_KEY, decodes base64, passes to Mux constructor. 51 lines — substantive. |
| `app/api/webhooks/mux/route.ts` | Video blur generation on asset.ready | ✓ VERIFIED | Lines 112-143: Fetches Mux thumbnail, applies Sharp blur pipeline (same as images), uploads to R2, stores in media.variants.blur. Non-fatal on error. 238 lines — substantive. |
| `app/api/content/[postId]/media/route.ts` | Gated content API with presigned URLs for authorized, blur for unauthorized | ✓ VERIFIED | Lines 26-204: Full implementation. Public posts → media as-is. Gated posts → checkContentAccess(). Authorized → generateSignedImageUrl (lines 127-134) or generateSignedPlaybackToken (lines 145-157). Unauthorized → blurUrl only (lines 186-203). CRITICAL comment on line 23 confirms no URL leaking. 205 lines — substantive. |
| `app/api/token-balance/route.ts` | Token balance API endpoint | ✓ VERIFIED | Lines 17-74: Full GET handler. Requires auth, looks up wallet, fetches token mint, calls getCachedTokenBalance, returns balance. 75 lines — substantive. |
| `components/content/unlock-dialog.tsx` | Unlock dialog with balance comparison | ✓ VERIFIED | Lines 14-108: Full dialog component. Shows accessLevel explanation, balance comparison (lines 58-74), progress bar, success message if enough tokens, placeholder buttons (Buy/Burn with coming-soon toasts per spec). 109 lines — substantive. |
| `components/content/post-card.tsx` | Locked/unlocked states, blur overlay, Unlock button | ✓ VERIFIED | Lines 76-123: LockedMediaOverlay component with blur image and lock overlay. Lines 218-219: isLocked check. Lines 309-323: Locked media rendering. Lines 326-340: Unlocked media rendering. Lines 343-354: Unlock button. Lines 360-370: UnlockDialog integration. 374 lines — substantive. |
| `components/content/post-feed.tsx` | Lazy gated media fetching | ✓ VERIFIED | Lines 58-66: fetchGatedMedia function. Lines 84-105: fetchGatedMediaForPosts batch fetcher. Lines 143-151: Calls fetchGatedMediaForPosts on feed load. Lines 256-286: renderPostCard merges gated data with post data. 378 lines — substantive. |

**All 14 artifacts verified:** Exist, are substantive (15-653 lines each), and have correct exports/functionality.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `components/content/post-composer.tsx` | `app/api/posts/[id]/publish/route.ts` | POST with accessLevel and tokenThreshold | ✓ WIRED | Lines 367-376 in composer: fetch POST with { accessLevel, tokenThreshold }. Lines 9-14, 53, 97-100 in route: Zod parse, validation, pass to publishPost(). |
| `app/api/posts/[id]/publish/route.ts` | `lib/db/schema.ts` | Update post with accessLevel, tokenThreshold, creatorTokenId | ✓ WIRED | Lines 97-100 in route: calls publishPost() with options. Lines 126-136 in post-queries: sets accessLevel, tokenThreshold, creatorTokenId on post record. |
| `lib/content/access-control.ts` | `lib/solana/token-balance.ts` | getCachedTokenBalance calls getTokenBalance on cache miss | ✓ WIRED | Line 4: imports getTokenBalance. Line 45: calls getTokenBalance() when cache stale/miss. |
| `lib/content/access-control.ts` | `lib/db/schema.ts` | Reads/writes tokenBalanceCache table | ✓ WIRED | Line 2: imports tokenBalanceCache. Lines 26-35: queries cache. Lines 49-64: upserts cache with onConflictDoUpdate. |
| `lib/media/image-processing.ts` | R2 storage | uploadToR2 for blur variant | ✓ WIRED | Line 134: await uploadToR2(blurKey, blurBuffer, "image/webp"). Lines 45-64: uploadToR2 implementation using S3 client. |
| `app/api/content/[postId]/media/route.ts` | `lib/content/access-control.ts` | checkContentAccess for authorization | ✓ WIRED | Line 8: imports checkContentAccess. Lines 91-98: calls with postData and viewer wallet. Returns hasAccess boolean used on line 111. |
| `app/api/content/[postId]/media/route.ts` | `lib/media/signed-urls.ts` | generateSignedImageUrl and generateSignedPlaybackToken | ✓ WIRED | Lines 10-11: imports both functions. Line 132: generateSignedImageUrl(key) for each variant. Line 148: generateSignedPlaybackToken(playbackId) for video. |
| `components/content/post-card.tsx` | `app/api/content/[postId]/media/route.ts` | fetch for media URLs when gated | ✓ WIRED | Via post-feed: Line 60 in post-feed calls `/api/content/${postId}/media`. Lines 256-286 merge response into post data passed to PostCard. |
| `components/content/post-card.tsx` | `components/content/unlock-dialog.tsx` | Opens dialog on Unlock button | ✓ WIRED | Line 10: imports UnlockDialog. Line 210: unlockOpen state. Line 346: Unlock button sets unlockOpen(true). Lines 360-370: renders UnlockDialog with isOpen={unlockOpen}. |

**All 9 key links verified:** Imports present, function calls executed, data flows correctly.

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| CONT-04: Token-gated content (hold) | ✓ SATISFIED | All supporting truths verified. Hold-gated posts work end-to-end. |
| CONT-05: Token-gated content (burn) | ✓ SATISFIED | Schema and UI support burn_gated. Access control treats burn_gated same as hold_gated (balance check). Burn transaction execution deferred to Phase 7. |
| TOKN-05: Token balance verification | ✓ SATISFIED | Helius RPC integration, 60s TTL cache, server-side access checks all verified. |

**All 3 requirements satisfied** by verified truths and artifacts.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/content/unlock-dialog.tsx` | 87, 96 | "coming soon" toast placeholders | ℹ️ Info | Expected — buy/burn actions deferred to Phases 6 and 7 per plan. Buttons look functional but show informative toast. |

**No blockers.** The "coming soon" placeholders are intentional per Phase 05-03 plan ("buttons should look functional/real but just show the coming-soon toast").

### Human Verification Required

#### 1. Create and publish a hold-gated post

**Test:** As a creator with a launched token, create a post with media, click Publish, select "Hold-Gated" access level, set threshold to 1000, and publish. Check database post record.

**Expected:** 
- Post composer shows access level selection step with three radio options
- Threshold input appears when hold_gated selected
- Publish succeeds and closes composer
- Database `post` record has `accessLevel = "hold_gated"`, `tokenThreshold = "1000"`, `creatorTokenId` set to creator's token ID

**Why human:** UI flow, form validation behavior, and database state require manual inspection.

#### 2. View gated post as unauthorized viewer (no tokens)

**Test:** Log in as a different user who does NOT hold the creator's tokens. Navigate to the creator's profile and view the gated post. Click "Unlock" button. Open browser DevTools Network tab and inspect `/api/content/[postId]/media` response.

**Expected:**
- Post text/caption is visible
- Media shows heavily blurred placeholder with semi-transparent dark overlay
- Lock icon and text "Hold 1000 $TICKER to unlock" visible on overlay
- Unlock button present below media
- Unlock dialog shows balance comparison "0 / 1000 $TICKER" with empty progress bar
- Buy and Burn buttons show "coming soon" toast
- Network tab shows media API response contains ONLY `blurUrl` — NO `variants` object, NO `muxPlaybackId`

**Why human:** Visual rendering quality, security validation (confirming no URL leaks in network traffic), interactive dialog behavior.

#### 3. View gated post as authorized viewer (with tokens)

**Test:** Use a test account that holds >= 1000 of the creator's tokens (or use the creator's own account if they have tokens). View the gated post. Check that media loads and plays.

**Expected:**
- Post text visible
- Media displays normally (images load, videos play)
- No blur overlay or lock indicator
- No Unlock button
- Images load via presigned S3 URLs (check network tab — URLs should have query params like `X-Amz-Signature`)
- Videos play via Mux with signed tokens (check MuxPlayer props in React DevTools)
- Presigned URLs expire after 5 minutes (reload page after 5min — should get new signed URLs)

**Why human:** Real-time access control (requires actual token balance on Solana devnet), presigned URL generation and expiration behavior, video playback with signed tokens.

#### 4. Token balance caching behavior

**Test:** As a viewer with tokens, view a gated post. Check server logs or database for Helius RPC call and cache entry. Within 60 seconds, refresh the page and view the same post again. After 60 seconds, refresh again.

**Expected:**
- First view: Server calls Helius RPC (`getTokenAccountsByOwner`), inserts/updates `tokenBalanceCache` table with current timestamp
- Second view (< 60s later): Cache hit, no RPC call (check server logs)
- Third view (> 60s later): Cache stale, new RPC call, cache updated with new timestamp

**Why human:** Cache timing behavior and RPC call frequency require server-side monitoring and log inspection.

#### 5. Blur placeholder visual quality

**Test:** Upload images and videos to a gated post. View blur placeholders as unauthorized user. Download blur variant from network tab and inspect.

**Expected:**
- Blur placeholders are heavily obscured — no detail or text should be readable
- Placeholder should still be recognizable as an image vs video thumbnail (general shape/color)
- Blur variant URL is publicly accessible (can open in incognito without login)
- Blur quality consistent across images and videos

**Why human:** Visual quality assessment is subjective and requires human judgment. Security validation that blur doesn't leak content details.

---

## Summary

**Phase 5 goal ACHIEVED** based on automated verification. All 4 success criteria truths are verified:

1. ✓ Creator can set access level (public/hold_gated/burn_gated) and threshold when publishing
2. ✓ Viewer with tokens sees gated content via presigned URLs/signed tokens
3. ✓ Viewer without tokens sees blurred placeholders with lock overlay
4. ✓ Access verification happens server-side at request time with 60s cached balance

**Infrastructure complete:**
- Database schema extended (accessLevel, tokenThreshold, creatorTokenId, tokenBalanceCache)
- Token balance verification via Helius RPC with DB-backed TTL cache
- Blur variant generation for all images and videos
- Presigned R2 GET URLs for authorized image access
- Mux signed playback tokens for authorized video access
- Gated content API correctly bifurcates authorized vs unauthorized responses
- Post composer has two-step publish flow with access level selection
- Post card renders locked/unlocked states
- Unlock dialog shows balance comparison with placeholder buy/burn buttons

**No gaps found.** All automated checks passed. No blocker anti-patterns.

**Requires human verification** to confirm:
- UI flows work as expected
- Visual rendering quality (blur placeholders, lock overlays)
- Security validation (original URLs never leak to unauthorized viewers)
- Real-time access control with actual Solana token balances
- Presigned URL and cache expiration timing

**Ready for user acceptance testing.**

---

_Verified: 2026-02-01T23:54:36Z_  
_Verifier: Claude (gsd-verifier)_
