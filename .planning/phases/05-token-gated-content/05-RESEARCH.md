# Phase 5: Token-Gated Content - Research

**Researched:** 2026-02-01
**Domain:** Content access control, server-side media gating, SPL token balance verification
**Confidence:** HIGH

## Summary

This phase adds token-gated content to the existing post/media infrastructure built in Phase 4. The core challenge is three-fold: (1) extending the publish flow to set access level and threshold, (2) generating server-side blurred placeholders so original media URLs are never exposed to unauthorized viewers, and (3) verifying token balances via Helius RPC before serving content.

The existing codebase already uses Sharp for image processing and `@aws-sdk/client-s3` for R2 interactions, both of which support the blur generation and presigned GET URL patterns needed. For video, Mux supports signed playback policies with JWT helpers built into `@mux/mux-node`. Token balance checks use the standard `getTokenAccountsByOwner` RPC method via the existing Helius RPC URL.

**Primary recommendation:** Generate blurred variants at image processing time (extending the existing `processUploadedImage` pipeline), use R2 presigned GET URLs for authorized image access, use Mux signed playback for authorized video access, and cache token balances server-side with a 60-second TTL using a simple DB-backed cache.

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sharp | ^0.34.5 | Server-side blur generation for image placeholders | Already used for responsive variant generation; blur is a native Sharp operation |
| @aws-sdk/client-s3 | ^3.980.0 | R2 presigned GET URLs for authorized image access | Already used for presigned PUT URLs; GetObjectCommand + getSignedUrl for reads |
| @aws-sdk/s3-request-presigner | ^3.980.0 | Signing presigned URLs | Already installed and used |
| @mux/mux-node | ^12.8.1 | Signed JWT playback tokens for gated video | Already installed; includes `jwt.signPlaybackId()` helper |
| drizzle-orm | ^0.45.1 | Schema extension for access levels, token balance cache | Already the project ORM |
| @solana/web3.js | ^1.98.4 | getTokenAccountsByOwner RPC calls | Already installed for Solana interactions |

### Supporting (No New Dependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| helius-sdk | ^2.1.0 | Already installed but raw RPC via fetch is simpler for token balance checks | Could use for convenience but direct JSON-RPC is more transparent |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB-backed token balance cache | Redis/Upstash | Adds infrastructure; DB cache is sufficient for v1 scale |
| Sharp blur at upload time | CSS blur + no original URL | CSS blur is bypassable client-side; user decision locks server-side approach |
| R2 presigned GET URLs | Cloudflare Access / WAF HMAC | Presigned URLs work with existing S3 SDK; WAF HMAC needs Pro plan |
| Mux signed playback | Mux webhook-based access | Signed playback is the Mux-recommended pattern for gated video |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
# Only new env vars required:
# MUX_SIGNING_KEY_ID - for signing video playback JWTs
# MUX_PRIVATE_KEY - RSA private key for JWT signing (base64 encoded)
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── content/
│   ├── post-queries.ts          # Existing - extend with access level fields
│   └── access-control.ts        # NEW - token balance checking + access verification
├── media/
│   ├── image-processing.ts      # Existing - extend with blur variant generation
│   └── signed-urls.ts           # NEW - R2 presigned GET URLs + Mux signed playback
├── solana/
│   └── token-balance.ts         # NEW - getTokenAccountsByOwner wrapper
└── db/
    ├── schema.ts                # Existing - extend with access level columns + cache table
    └── index.ts                 # Existing
app/api/
├── posts/
│   └── [id]/
│       └── publish/route.ts     # Existing - extend to accept accessLevel + threshold
├── content/
│   └── [postId]/
│       └── media/route.ts       # NEW - serves presigned URLs or blurred placeholders
└── token-balance/
    └── route.ts                 # NEW - returns cached balance for viewer + mint
components/content/
├── post-card.tsx                # Existing - extend with locked/unlocked states
├── post-composer.tsx            # Existing - add access level step before publish
└── unlock-dialog.tsx            # NEW - unlock prompt with balance info
```

### Pattern 1: Schema Extension for Access Control
**What:** Add access level and threshold columns to the `post` table, plus a token balance cache table.
**When to use:** For every gated content query.
**Example:**
```typescript
// Source: Existing schema.ts pattern
// Extend the post table:
export const post = pgTable("post", {
  // ... existing columns ...
  accessLevel: text("access_level").notNull().default("public"), // public | hold_gated | burn_gated
  tokenThreshold: text("token_threshold"), // bigint as string (like amountLamports pattern)
  creatorTokenId: text("creator_token_id").references(() => creatorToken.id), // which token gates this post
});

// New token balance cache table:
export const tokenBalanceCache = pgTable("token_balance_cache", {
  id: text("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  mintAddress: text("mint_address").notNull(),
  balance: text("balance").notNull(), // raw token amount as string
  checkedAt: timestamp("checked_at").notNull().defaultNow(),
});
// Add unique index on (walletAddress, mintAddress)
```

### Pattern 2: Blur Variant Generation at Upload Time
**What:** Generate a blurred placeholder variant during image processing, stored alongside responsive variants in R2.
**When to use:** For all content images (not just gated ones) -- avoids needing to re-process if a post's access level changes... but wait, access level is locked once published, so we can generate blur only for gated posts. However, generating for all posts is simpler and future-proof.
**Example:**
```typescript
// Source: Sharp API docs (https://sharp.pixelplumbing.com/api-operation#blur)
// Extend processUploadedImage in lib/media/image-processing.ts:

// After generating sm/md/lg variants, add blur variant:
const blurKey = `${keyDir}blur.webp`;
const blurBuffer = await sharp(imageBuffer)
  .resize(40, undefined, {          // Tiny size first (40px wide)
    fit: "inside",
    withoutEnlargement: true,
  })
  .blur(20)                          // Heavy Gaussian blur (sigma=20)
  .resize(400, undefined, {          // Scale back up to reasonable display size
    fit: "inside",
    withoutEnlargement: true,
    kernel: "cubic",                 // Smooth upscale
  })
  .webp({ quality: 60 })            // Lower quality is fine for blurred placeholder
  .toBuffer();

await uploadToR2(blurKey, blurBuffer, "image/webp");
variants["blur"] = `${cleanPublicUrl}/${blurKey}`;
```

### Pattern 3: R2 Presigned GET URLs for Authorized Image Access
**What:** Instead of serving public R2 URLs for gated content, serve short-lived presigned GET URLs only to authorized viewers.
**When to use:** When serving gated image content to a viewer who has passed token balance verification.
**Example:**
```typescript
// Source: Cloudflare R2 docs (https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
// New file: lib/media/signed-urls.ts

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "@/lib/storage/upload";

export async function generateSignedImageUrl(
  key: string,
  expiresInSeconds = 300, // 5 minutes
): Promise<string> {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET not configured");

  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
```

### Pattern 4: Mux Signed Playback for Gated Video
**What:** Use Mux signed playback JWTs to restrict video access. New gated assets use `signed` playback policy; existing public assets remain public.
**When to use:** For video content in gated posts.
**Example:**
```typescript
// Source: Mux docs (https://www.mux.com/docs/guides/secure-video-playback)
// Source: @mux/mux-node SDK (https://github.com/muxinc/mux-node-sdk)

import { getMuxClient } from "@/lib/mux/client";

// Mux client needs signing key config:
// new Mux({
//   tokenId, tokenSecret,
//   jwtSigningKey: process.env.MUX_SIGNING_KEY_ID,
//   jwtPrivateKey: Buffer.from(process.env.MUX_PRIVATE_KEY_BASE64, 'base64').toString('ascii'),
// })

export function generateSignedPlaybackToken(
  playbackId: string,
  expirationMinutes = 15,
): { playbackToken: string; thumbnailToken: string } {
  const mux = getMuxClient();

  const playbackToken = mux.jwt.signPlaybackId(playbackId, {
    type: "video",
    expiration: `${expirationMinutes}m`,
  });

  const thumbnailToken = mux.jwt.signPlaybackId(playbackId, {
    type: "thumbnail",
    expiration: `${expirationMinutes}m`,
  });

  return { playbackToken, thumbnailToken };
}
```

### Pattern 5: Token Balance Verification via Helius RPC
**What:** Check a wallet's SPL token balance for a specific mint using `getTokenAccountsByOwner` JSON-RPC method.
**When to use:** On content access verification and periodic cache refresh.
**Example:**
```typescript
// Source: Helius docs (https://www.helius.dev/docs/api-reference/rpc/http/gettokenaccountsbyowner)

export async function getTokenBalance(
  walletAddress: string,
  mintAddress: string,
): Promise<bigint> {
  const rpcUrl = process.env.HELIUS_RPC_URL;
  if (!rpcUrl) throw new Error("HELIUS_RPC_URL not configured");

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "1",
      method: "getTokenAccountsByOwner",
      params: [
        walletAddress,
        { mint: mintAddress },
        { encoding: "jsonParsed" },
      ],
    }),
  });

  const data = await response.json();
  const accounts = data?.result?.value ?? [];

  if (accounts.length === 0) return BigInt(0);

  // Sum all token accounts for this mint (typically just one)
  let total = BigInt(0);
  for (const account of accounts) {
    const amount = account?.account?.data?.parsed?.info?.tokenAmount?.amount;
    if (amount) total += BigInt(amount);
  }

  return total;
}
```

### Pattern 6: Token Balance Cache with TTL
**What:** Cache token balances in the database with a configurable TTL to reduce RPC calls.
**When to use:** On every content access check -- read from cache first, refresh if stale.
**Example:**
```typescript
// lib/content/access-control.ts

const BALANCE_CACHE_TTL_MS = 60_000; // 60 seconds

export async function getCachedTokenBalance(
  walletAddress: string,
  mintAddress: string,
): Promise<bigint> {
  // Check cache
  const cached = await db.query.tokenBalanceCache.findFirst({
    where: and(
      eq(tokenBalanceCache.walletAddress, walletAddress),
      eq(tokenBalanceCache.mintAddress, mintAddress),
    ),
  });

  if (cached) {
    const age = Date.now() - cached.checkedAt.getTime();
    if (age < BALANCE_CACHE_TTL_MS) {
      return BigInt(cached.balance);
    }
  }

  // Cache miss or stale -- fetch from chain
  const balance = await getTokenBalance(walletAddress, mintAddress);

  // Upsert cache
  await db
    .insert(tokenBalanceCache)
    .values({
      id: cached?.id ?? crypto.randomUUID(),
      walletAddress,
      mintAddress,
      balance: balance.toString(),
      checkedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [tokenBalanceCache.walletAddress, tokenBalanceCache.mintAddress],
      set: {
        balance: balance.toString(),
        checkedAt: new Date(),
      },
    });

  return balance;
}
```

### Anti-Patterns to Avoid
- **Client-side access control:** Never rely on CSS blur or client-side JS to hide content. The original media URL must never reach the client for gated content.
- **Checking balance on every request without caching:** RPC calls add latency and can hit rate limits. Use TTL-based caching.
- **Storing access level in the client only:** Access level and threshold must be in the database, checked server-side.
- **Public Mux playback IDs for gated video:** Once a public playback ID is known, anyone can access the video. Use signed playback policies for gated content.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing for Mux | Custom RS256 JWT signing | `mux.jwt.signPlaybackId()` from @mux/mux-node | SDK handles key format, claims, expiration correctly |
| R2 presigned URL signing | Custom AWS SigV4 implementation | `getSignedUrl()` from @aws-sdk/s3-request-presigner | Already used for uploads; same pattern for reads |
| Token balance parsing | Manual RPC response deserialization | Standard `jsonParsed` encoding from Helius RPC | Helius returns structured token amount with decimals |
| Image blur generation | Canvas-based server-side blur, ffmpeg blur | Sharp `.blur()` + `.resize()` | Sharp is already installed and used for image processing |
| Video blur placeholder | Server-side video frame extraction + blur | Mux thumbnail URL with blur applied by Sharp | Mux provides `image.mux.com/{id}/thumbnail.jpg`; fetch + blur with Sharp at upload time |

**Key insight:** Every tool needed for this phase is already in the project's dependency tree. No new packages are required. The patterns mirror existing upload/processing patterns -- just adding presigned GETs and blur variants alongside existing presigned PUTs and responsive variants.

## Common Pitfalls

### Pitfall 1: Exposing Original Media URLs to Unauthorized Viewers
**What goes wrong:** If you include original R2 URLs or public Mux playback IDs in the API response for gated posts, the client has the URL even if it's "hidden" in the UI.
**Why it happens:** Mixing authorized and unauthorized data in the same response payload.
**How to avoid:** Two separate code paths: (1) authorized viewers get presigned URLs / signed tokens, (2) unauthorized viewers get only the blur variant public URL and a lock indicator. Never include both in the same response.
**Warning signs:** The API returns original URLs alongside `isLocked: true`.

### Pitfall 2: Race Condition on Token Balance Drop
**What goes wrong:** Viewer loads a gated post page, balance check passes, viewer receives presigned URL valid for 5 minutes. Meanwhile their balance drops. They can still view content for the URL's remaining lifetime.
**Why it happens:** Presigned URLs are valid until expiration regardless of authorization state changes.
**How to avoid:** Keep presigned URL TTL short (5 minutes). Accept that there's an inherent window. This is a known tradeoff -- the user decision specifies "immediate revoke on next TTL check," meaning the next page load or API call will lock content, but already-issued URLs remain valid until expiration.
**Warning signs:** Very long presigned URL expiration (hours+).

### Pitfall 3: Mux Public vs Signed Playback ID Mismatch
**What goes wrong:** Existing Phase 4 videos are created with `playback_policies: ["public"]`. You can't retroactively make a public playback ID require signing.
**Why it happens:** Mux playback policies are set at asset creation time.
**How to avoid:** For Phase 5 gated posts, create new Mux assets with `playback_policies: ["signed"]`. For posts that are gated at publish time, the video upload flow should detect the access level and create the asset with the appropriate policy. Alternative: always create with `["signed"]` going forward and just skip token validation for public posts (slightly more overhead but architecturally cleaner).
**Warning signs:** Trying to sign a public playback ID -- it'll work but won't restrict access.

### Pitfall 4: Forgetting to Gate Mux Thumbnails
**What goes wrong:** Even if the video stream requires a signed token, the thumbnail at `image.mux.com/{id}/thumbnail.jpg` is public for public playback IDs. Gated video thumbnails could leak frame content.
**Why it happens:** Thumbnails and streams have independent access.
**How to avoid:** For gated videos, use the server-side blur approach for the thumbnail too. Generate a blurred placeholder at upload time by fetching the Mux thumbnail and applying Sharp blur, store it in R2. Or use signed playback with signed thumbnail tokens.
**Warning signs:** Unblurred video thumbnails visible on locked posts.

### Pitfall 5: Token Threshold as Number vs BigInt
**What goes wrong:** JavaScript `Number` loses precision for large token amounts. A threshold of `10000000000000000` (10^16) gets rounded.
**Why it happens:** SPL tokens can have up to 9 decimal places, making raw amounts very large integers.
**How to avoid:** Store thresholds as strings in the database (matching the existing `amountLamports` pattern in the `withdrawal` table). Use `BigInt` for all comparisons.
**Warning signs:** Using `parseInt` or `Number()` for token amounts.

### Pitfall 6: Blur Bypass via Image Variant URLs
**What goes wrong:** If public responsive variants (sm/md/lg) are stored at predictable URLs and the blur variant URL is served to unauthorized viewers, they can guess the non-blur URL pattern.
**Why it happens:** R2 public URL + predictable key pattern (e.g., replace `blur.webp` with `lg.webp`).
**How to avoid:** For gated posts, do NOT store responsive variants at public URLs. Instead, store them at the same R2 keys but only serve them via presigned GET URLs. The blur variant can be at a public URL (it's already obscured). Alternatively, make the R2 bucket private and use presigned URLs for ALL content access (simpler security model but more presigned URL generation).
**Warning signs:** Variant URLs following a guessable pattern for gated content.

## Code Examples

### Content Access Verification (Server-Side API Route)
```typescript
// Source: Combines existing patterns from app/api/posts/[id]/route.ts
// and new access control logic

export async function GET(
  req: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  // Get post with media
  const postData = await getPostById(postId);
  if (!postData || postData.status !== "published") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Public post -- return as-is with public URLs
  if (postData.accessLevel === "public") {
    return Response.json({ post: postData });
  }

  // Gated post -- check viewer's token balance
  if (!session) {
    return Response.json({
      post: {
        ...postData,
        media: postData.media.map(toLockedMedia),
        isLocked: true,
        requiredBalance: postData.tokenThreshold,
      },
    });
  }

  // Look up viewer's wallet
  const viewerWallet = await getWalletByUserId(session.user.id);
  if (!viewerWallet) {
    return Response.json({
      post: {
        ...postData,
        media: postData.media.map(toLockedMedia),
        isLocked: true,
        requiredBalance: postData.tokenThreshold,
        viewerBalance: "0",
      },
    });
  }

  // Check token balance (cached)
  const creatorTokenRecord = await getCreatorTokenByPostCreator(postData.creatorProfileId);
  const balance = await getCachedTokenBalance(
    viewerWallet.publicKey,
    creatorTokenRecord.mintAddress,
  );

  const threshold = BigInt(postData.tokenThreshold ?? "0");
  const hasAccess = balance >= threshold;

  if (hasAccess) {
    // Serve presigned URLs for images, signed tokens for video
    const authorizedMedia = await Promise.all(
      postData.media.map(m => toAuthorizedMedia(m)),
    );
    return Response.json({
      post: { ...postData, media: authorizedMedia, isLocked: false },
    });
  }

  return Response.json({
    post: {
      ...postData,
      media: postData.media.map(toLockedMedia),
      isLocked: true,
      requiredBalance: postData.tokenThreshold,
      viewerBalance: balance.toString(),
    },
  });
}

function toLockedMedia(m: MediaRecord) {
  return {
    id: m.id,
    type: m.type,
    blurUrl: m.variants?.blur ?? null,
    width: m.width,
    height: m.height,
    // NO original URLs, NO variant URLs, NO playback IDs
  };
}

async function toAuthorizedMedia(m: MediaRecord) {
  if (m.type === "image") {
    // Generate presigned URLs for responsive variants
    const signedVariants: Record<string, string> = {};
    for (const [size, _url] of Object.entries(m.variants ?? {})) {
      if (size === "blur") continue; // Skip blur variant
      const key = getKeyFromPublicUrl(_url);
      signedVariants[size] = await generateSignedImageUrl(key, 300);
    }
    return { ...m, variants: signedVariants };
  }

  if (m.type === "video" && m.muxPlaybackId) {
    const { playbackToken, thumbnailToken } = generateSignedPlaybackToken(m.muxPlaybackId);
    return {
      ...m,
      muxPlaybackId: m.muxPlaybackId,
      playbackToken,
      thumbnailToken,
    };
  }

  return m;
}
```

### Publish Flow with Access Level Selection
```typescript
// Source: Extends existing app/api/posts/[id]/publish/route.ts pattern

const publishSchema = z.object({
  accessLevel: z.enum(["public", "hold_gated", "burn_gated"]).default("public"),
  tokenThreshold: z.string().optional(), // Required if gated
});

// In the publish handler, after existing validation:
if (parsed.data.accessLevel !== "public") {
  if (!parsed.data.tokenThreshold) {
    return Response.json(
      { error: "Token threshold required for gated posts" },
      { status: 400 },
    );
  }

  // Verify creator has a launched token
  const token = await db.query.creatorToken.findFirst({
    where: eq(creatorToken.creatorProfileId, creatorProfileId),
  });

  if (!token) {
    return Response.json(
      { error: "You must launch a token before creating gated content" },
      { status: 403 },
    );
  }

  // Set access level and threshold on the post
  await db.update(post).set({
    accessLevel: parsed.data.accessLevel,
    tokenThreshold: parsed.data.tokenThreshold,
    creatorTokenId: token.id,
  }).where(eq(post.id, postId));
}
```

### Video Blur Placeholder Generation
```typescript
// For gated video posts, generate blur placeholder from Mux thumbnail at processing time

export async function generateVideoBlurPlaceholder(
  muxPlaybackId: string,
  mediaId: string,
  creatorProfileId: string,
): Promise<string> {
  // Fetch thumbnail from Mux
  const thumbnailUrl = `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?width=400`;
  const response = await fetch(thumbnailUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  // Apply same blur pipeline as images
  const blurBuffer = await sharp(buffer)
    .resize(40, undefined, { fit: "inside", withoutEnlargement: true })
    .blur(20)
    .resize(400, undefined, { fit: "inside", withoutEnlargement: true, kernel: "cubic" })
    .webp({ quality: 60 })
    .toBuffer();

  // Store in R2
  const blurKey = `content/${creatorProfileId}/${mediaId}/blur.webp`;
  await uploadToR2(blurKey, blurBuffer, "image/webp");

  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  return `${publicUrl}/${blurKey}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS blur for content gating | Server-side blur + presigned URLs | Always been best practice | CSS blur is trivially bypassable; server-side is the only secure approach |
| Public Mux playback for all | Signed playback for gated content | Mux has always supported signed policies | Public IDs can't be restricted after creation |
| Client-side token balance checks | Server-side verification with cache | Always been best practice | Client-side checks are trivially bypassable |
| getAssetsByOwner (DAS) for balance | getTokenAccountsByOwner (RPC) for single mint | Both available | DAS returns all tokens; RPC with mint filter is more efficient for single-token checks |

**Deprecated/outdated:**
- `@mux/blurhash`: Deprecated in favor of `@mux/blurup` for blur placeholders. However, we don't need either -- Sharp blur on the Mux thumbnail is sufficient and doesn't add a dependency.

## Open Questions

1. **Mux Signed Playback for New vs Existing Videos**
   - What we know: Mux playback policies are set at asset creation time. Existing Phase 4 videos use `public` policy.
   - What's unclear: Should we migrate existing videos or only apply signed playback to newly created gated videos?
   - Recommendation: Only apply signed playback to videos in gated posts going forward. Existing public videos on public posts remain public. If a creator wants to gate an existing post... but wait, access level is locked once published, so this isn't an issue -- only new posts can be gated.

2. **R2 Bucket Access Model**
   - What we know: Current setup uses a public R2 bucket (R2_PUBLIC_URL serves content directly). Gated content needs its media protected from direct URL access.
   - What's unclear: Whether to make the bucket private (breaking all existing public URLs) or use a hybrid approach.
   - Recommendation: Keep the bucket public for backward compatibility. For gated posts, store variant images at non-guessable paths (include a secret segment in the key) OR rely on the fact that knowing the key pattern requires knowing the mediaId (UUID). The blur variant is served at the public URL. For truly locked content, serve responsive variants only via presigned GET URLs (generated per-request). The public URL structure for gated content variants should be removed from the `variants` JSON -- store only R2 keys, not public URLs, for gated media.

3. **Video Blur Placeholder Timing**
   - What we know: Mux thumbnails are available only after transcoding completes. Video processing is async (webhook-driven).
   - What's unclear: When exactly to generate the video blur placeholder.
   - Recommendation: Generate it in the Mux `video.asset.ready` webhook handler, after the playback ID is available. Store the blur URL in the media record's variants JSON.

## Sources

### Primary (HIGH confidence)
- Sharp API documentation - blur operation (https://sharp.pixelplumbing.com/api-operation#blur)
- Cloudflare R2 presigned URLs documentation (https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- Cloudflare R2 aws-sdk-js-v3 examples (https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/)
- Mux Secure Video Playback guide (https://www.mux.com/docs/guides/secure-video-playback)
- Mux Signing JWTs guide (https://www.mux.com/docs/guides/signing-jwts)
- Helius getTokenAccountsByOwner RPC (https://www.helius.dev/docs/api-reference/rpc/http/gettokenaccountsbyowner)
- Helius DAS get-tokens guide (https://www.helius.dev/docs/das/get-tokens)
- Existing codebase: `lib/media/image-processing.ts`, `lib/storage/upload.ts`, `lib/mux/client.ts`, `lib/solana/balance.ts`, `lib/db/schema.ts`

### Secondary (MEDIUM confidence)
- Mux @mux/blurup library for blur placeholders (https://github.com/muxinc/blurup) - verified approach
- Mux Node SDK JWT helpers (https://github.com/muxinc/mux-node-sdk) - verified in SDK source

### Tertiary (LOW confidence)
- None -- all critical patterns verified with official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and verified in codebase
- Architecture: HIGH - Patterns extend existing codebase patterns (presigned PUT -> presigned GET, responsive variants -> blur variant, public Mux -> signed Mux)
- Pitfalls: HIGH - Each pitfall is based on verified API behavior from official docs
- Code examples: MEDIUM - Examples combine verified API patterns but haven't been tested against the actual codebase

**Research date:** 2026-02-01
**Valid until:** 2026-03-03 (30 days -- stable domain, no fast-moving dependencies)
