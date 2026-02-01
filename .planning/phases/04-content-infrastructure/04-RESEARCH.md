# Phase 4: Content Infrastructure - Research

**Researched:** 2026-02-01
**Domain:** Content publishing, media upload/processing, video transcoding, CSAM scanning
**Confidence:** HIGH

## Summary

This phase covers the full content pipeline: data models for posts/media, presigned upload to Cloudflare R2, server-side image optimization with Sharp, cloud video transcoding, CSAM scanning before content goes live, and admin moderation. The project already has R2 presigned upload infrastructure (`lib/storage/upload.ts`) and the AWS S3 SDK installed, which will be extended for content media.

The recommended approach is: Drizzle schema for posts/media with status-based visibility, R2 presigned URLs for image uploads with Sharp post-processing via a Next.js Route Handler, Mux for video transcoding (direct uploads with webhooks), and Hive AI's Combined CSAM Detection API for scanning all media before publishing. Content flows through a pipeline: upload -> scan -> process -> publish, with flagged content held in "under_review" status.

**Primary recommendation:** Use a status-driven content pipeline where posts start as "draft", media is uploaded to R2 with presigned URLs, scanned by Hive CSAM API, processed (Sharp for images, Mux for video), and only transition to "published" when all media passes scanning and processing.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sharp | 0.34.x | Server-side image resize/optimize/format conversion | 4-5x faster than alternatives, uses libvips, de facto Node.js standard |
| @mux/mux-node | 12.x | Server-side Mux Video API (create uploads, manage assets) | Best-in-class video API, free encoding for basic quality, webhook-driven |
| @mux/mux-uploader-react | 1.x | Client-side resumable video upload component | Built-in progress bar, chunked/resumable uploads, pairs with Mux direct uploads |
| @mux/mux-player-react | 3.x | Client-side video playback component | HLS adaptive bitrate, thumbnail generation, works with Mux playback IDs |
| @aws-sdk/client-s3 | 3.x | R2 presigned URL generation (already installed) | Already in project, Cloudflare R2 uses S3-compatible API |
| @aws-sdk/s3-request-presigner | 3.x | Presign generation (already installed) | Already in project |
| drizzle-orm | 0.45.x | Database schema and queries (already installed) | Already in project |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.x | Validation for post creation/editing (already installed) | Validate all API inputs |
| sonner | 2.x | Toast notifications (already installed) | Upload progress feedback, publish confirmations |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Mux | Cloudflare Stream | Stream is simpler if all-in on CF, but no free encoding, resolution-blind pricing ($1/1000 min regardless of quality), weaker DX and analytics. Mux has free basic encoding, 100k free delivery min/month, multi-CDN, better React components |
| Hive CSAM API | PhotoDNA (Microsoft) | PhotoDNA is free but requires organizational vetting/approval process. Hive combines hash matching + AI classifier in one API call, handles both images and video |
| Hive CSAM API | Cloudflare CSAM Scanning | CF tool only scans cached CDN content, NOT uploaded files. Cannot be used for pre-publish scanning. Only useful as a supplementary layer |
| Sharp (server-side) | Next.js Image Optimization | Next.js `<Image>` handles display-time optimization but NOT upload-time processing. We need to resize/convert at upload time and store optimized versions in R2 |

**Installation:**
```bash
npm install sharp @mux/mux-node @mux/mux-uploader-react @mux/mux-player-react
```

## Architecture Patterns

### Recommended Project Structure
```
lib/
├── db/
│   └── schema.ts              # Extended with posts, media, moderation tables
├── storage/
│   └── upload.ts              # Extended for content media (images + video)
├── media/
│   ├── image-processing.ts    # Sharp resize/optimize pipeline
│   └── csam-scan.ts           # Hive CSAM API integration
├── mux/
│   ├── client.ts              # Mux SDK initialization
│   └── webhooks.ts            # Webhook signature verification + handlers
app/
├── api/
│   ├── posts/
│   │   ├── route.ts           # POST (create), GET (list) posts
│   │   └── [id]/
│   │       └── route.ts       # GET, PATCH, DELETE single post
│   ├── upload/
│   │   ├── presign/route.ts   # Extended for content media presigned URLs
│   │   └── video/route.ts     # Create Mux direct upload URL
│   ├── webhooks/
│   │   └── mux/route.ts       # Mux webhook handler
│   └── admin/
│       └── moderation/
│           └── route.ts       # Admin moderation queue endpoints
components/
├── content/
│   ├── post-composer.tsx       # Modal composer with text + media
│   ├── post-card.tsx           # Post display in feed (text, images, video)
│   ├── post-detail.tsx         # Full post detail view
│   ├── media-upload.tsx        # Image upload with progress
│   ├── video-upload.tsx        # Mux uploader wrapper
│   └── draft-list.tsx          # User's drafts
├── admin/
│   └── moderation-queue.tsx    # Admin review interface
```

### Pattern 1: Status-Driven Content Pipeline

**What:** Posts and media have explicit status fields that control visibility and processing state.
**When to use:** Always -- this is the core pattern for the entire phase.

```typescript
// Post statuses
type PostStatus = "draft" | "processing" | "published" | "under_review" | "removed";

// Media statuses
type MediaStatus = "uploading" | "scanning" | "processing" | "ready" | "flagged" | "failed";

// A post can only transition to "published" when:
// 1. All attached media has status "ready"
// 2. No media is "flagged"
// Post transitions to "under_review" if any media is "flagged"
```

### Pattern 2: Presigned Upload with Server-Side Post-Processing

**What:** Client uploads directly to R2 via presigned URL, then notifies server to process.
**When to use:** For all image uploads.

```typescript
// 1. Client requests presigned URL
// POST /api/upload/presign { contentType: "image/jpeg", purpose: "post-media" }
// Returns: { uploadUrl, key, mediaId }

// 2. Client uploads directly to R2 via presigned URL (PUT request)

// 3. Client confirms upload complete
// POST /api/media/[mediaId]/process
// Server: downloads from R2, runs CSAM scan, processes with Sharp,
//         uploads optimized versions back to R2, updates media status

// 4. Sharp processing pipeline (server-side)
async function processImage(r2Key: string): Promise<ProcessedImage> {
  const original = await downloadFromR2(r2Key);

  // Generate responsive sizes
  const sizes = [
    { width: 1200, suffix: "lg" },   // Full width
    { width: 800, suffix: "md" },    // Medium
    { width: 400, suffix: "sm" },    // Thumbnail
  ];

  const results = await Promise.all(
    sizes.map(async ({ width, suffix }) => {
      const buffer = await sharp(original)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const key = r2Key.replace(/\.[^.]+$/, `-${suffix}.webp`);
      await uploadToR2(key, buffer, "image/webp");
      return { width, key };
    })
  );

  return { variants: results };
}
```

### Pattern 3: Mux Direct Upload with Webhook Completion

**What:** Client uploads video directly to Mux, server receives webhook when ready.
**When to use:** For all video uploads.

```typescript
// 1. Server creates Mux direct upload
// POST /api/upload/video
import Mux from "@mux/mux-node";

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
  webhookSecret: process.env.MUX_WEBHOOK_SECRET,
});

const upload = await mux.video.uploads.create({
  cors_origin: process.env.NEXT_PUBLIC_APP_URL,
  new_asset_settings: {
    passthrough: mediaId,       // Links back to our media record
    playback_policy: ["public"],
    video_quality: "basic",     // Free encoding tier
  },
});
// Return upload.url to client

// 2. Client uses MuxUploader component
// <MuxUploader endpoint={uploadUrl} />

// 3. Webhook handler at /api/webhooks/mux
// event.type === "video.asset.ready"
// Extract playback_id, duration, passthrough (mediaId)
// Update media record with playback info
```

### Pattern 4: CSAM Scan Before Publish

**What:** All media is scanned via Hive API before becoming publicly visible.
**When to use:** Every image and video upload, no exceptions.

```typescript
// Hive Combined CSAM Detection API
async function scanForCSAM(mediaUrl: string): Promise<CSAMScanResult> {
  const response = await fetch("https://api.thehive.ai/api/v2/task/sync", {
    method: "POST",
    headers: {
      "Authorization": `Token ${process.env.HIVE_CSAM_API_KEY}`,
    },
    body: (() => {
      const form = new FormData();
      form.append("url", mediaUrl);
      return form;
    })(),
  });

  const data = await response.json();
  const output = data.output;

  // Check for hash match (known CSAM)
  if (output.reasons?.includes("matched")) {
    return { flagged: true, reason: "hash_match" };
  }

  // Check classifier prediction
  const prediction = output.classifierPrediction?.csam_classifier;
  if (prediction && prediction.csam > 0.5) {
    return { flagged: true, reason: "classifier", confidence: prediction.csam };
  }

  return { flagged: false };
}
```

### Pattern 5: Auto-Save Drafts

**What:** Post drafts auto-save to database at regular intervals.
**When to use:** In the post composer modal.

```typescript
// Recommended: 10-second debounce on text changes, save to DB
// Use a server action or API route for saving
// Store draft in posts table with status "draft"
// On composer open, check for existing drafts
// On publish, transition draft to "processing" -> "published"
```

### Anti-Patterns to Avoid

- **Processing media synchronously in the upload request:** Upload and processing must be separate. Client uploads to R2/Mux, then a background step handles scanning and optimization.
- **Storing original unoptimized images as the only copy:** Always keep the original in R2 AND generate optimized variants. The original is needed for reprocessing and legal compliance.
- **Making content visible before CSAM scan completes:** Content MUST be invisible to other users until scanning passes. Use the status field to enforce this.
- **Polling Mux for asset status:** Use webhooks. Mux rate-limits the GET /assets endpoint.
- **Uploading video through your server:** Use Mux direct uploads. Video files are too large to proxy through a Next.js server.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video transcoding | FFmpeg on server, HLS segment generation | Mux | Transcoding is CPU-intensive, requires HLS packaging, ABR ladder generation, CDN distribution. Mux handles all of this with free basic encoding |
| Image resize/format conversion | Canvas API, ImageMagick subprocess | Sharp | Sharp uses libvips (C library), 4-5x faster, handles EXIF rotation, ICC profiles, memory-efficient streaming |
| CSAM detection | Custom ML model, manual hash databases | Hive CSAM API | Legal liability, requires NCMEC database access, hash matching + AI classification is a specialized domain |
| Resumable video upload | Custom chunked upload protocol | @mux/mux-uploader-react | Resumable uploads with tus protocol, progress tracking, error recovery all built in |
| Video player with ABR | Custom HLS.js integration | @mux/mux-player-react | Handles HLS, quality switching, thumbnails, keyboard controls, accessibility |
| Presigned URLs | Custom signing logic | @aws-sdk/s3-request-presigner | Already in the project, handles URL expiration, content-type constraints |

**Key insight:** Media processing, transcoding, and CSAM scanning are all domains where DIY solutions carry significant technical debt and legal risk. The cost of managed services (Mux, Hive) is vastly cheaper than the engineering time and liability of building custom solutions.

## Common Pitfalls

### Pitfall 1: Race Condition Between Upload and Processing
**What goes wrong:** Client uploads file to R2, but the post-processing step runs before the upload finishes, resulting in corrupted or incomplete files.
**Why it happens:** Presigned URL uploads are asynchronous -- the server doesn't know when they complete.
**How to avoid:** Client must explicitly confirm upload completion before server begins processing. Create a `/api/media/[id]/confirm` endpoint that the client calls after a successful PUT to the presigned URL.
**Warning signs:** Intermittent "file not found" or "corrupted image" errors during processing.

### Pitfall 2: Sharp Memory Exhaustion on Large Images
**What goes wrong:** Processing a 25MB image can consume significant memory, especially with multiple concurrent uploads.
**Why it happens:** Sharp loads image data into memory for processing. Multiple large images processed simultaneously can exceed available memory.
**How to avoid:** Use Sharp's streaming pipeline (not loading full buffer), set `sharp.concurrency(1)` in serverless environments, and consider processing images sequentially rather than in parallel. The `withoutEnlargement: true` option prevents unnecessarily large output.
**Warning signs:** Process crashes, OOM errors in production logs.

### Pitfall 3: Mux Webhook Signature Verification Bypass
**What goes wrong:** Webhook endpoint accepts unverified payloads, allowing attackers to fake asset-ready events and mark unscanned content as published.
**Why it happens:** Skipping signature verification during development and forgetting to add it for production.
**How to avoid:** Always use `mux.webhooks.unwrap(rawBody, headers)` to verify webhook signatures. Set `MUX_WEBHOOK_SECRET` env var. Use `request.text()` for raw body (not `.json()`).
**Warning signs:** Content appearing without going through the scanning pipeline.

### Pitfall 4: Forgetting to Keep Original Files
**What goes wrong:** Original uploaded files are deleted after processing, but later you need them for reprocessing, legal compliance (CSAM reporting), or format changes.
**Why it happens:** Trying to save storage costs or assuming optimized versions are sufficient.
**How to avoid:** Always keep originals in R2 under a separate prefix (e.g., `originals/`). Only delete when the post is permanently deleted and legal hold periods have passed.
**Warning signs:** Inability to reprocess content or provide originals for legal requests.

### Pitfall 5: Content Visible During "Processing" Window
**What goes wrong:** A post is created and immediately visible while media is still being scanned or transcoded.
**Why it happens:** Publishing the post before all media attachments have completed the pipeline.
**How to avoid:** Posts with media stay in "processing" status until ALL attached media reaches "ready" status. Query for posts only with status "published" in all public-facing endpoints.
**Warning signs:** Users seeing broken image/video placeholders, or worse, unscanned content appearing briefly.

### Pitfall 6: Not Handling Mux Webhook Retries Idempotently
**What goes wrong:** Mux retries a webhook (up to 24 hours) and the handler processes it again, causing duplicate database entries or state corruption.
**Why it happens:** Mux retries if it doesn't receive a 2xx response within 5 seconds.
**How to avoid:** Make webhook handlers idempotent. Use the asset ID or upload ID as a unique constraint. Check if the media record already has the playback ID before updating.
**Warning signs:** Duplicate entries, status toggling, multiple notifications for the same event.

## Code Examples

### Drizzle Schema for Posts and Media

```typescript
// Source: Based on existing schema.ts patterns in the project
import { pgTable, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";

export const post = pgTable("post", {
  id: text("id").primaryKey(),
  creatorProfileId: text("creator_profile_id")
    .notNull()
    .references(() => creatorProfile.id),
  content: text("content"),                    // Plain text content
  status: text("status").notNull().default("draft"),  // draft | processing | published | under_review | removed
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const media = pgTable("media", {
  id: text("id").primaryKey(),
  postId: text("post_id").references(() => post.id),
  creatorProfileId: text("creator_profile_id")
    .notNull()
    .references(() => creatorProfile.id),
  type: text("type").notNull(),                // image | video
  status: text("status").notNull().default("uploading"), // uploading | scanning | processing | ready | flagged | failed
  originalKey: text("original_key"),           // R2 key for original file
  originalUrl: text("original_url"),           // Public URL for original
  variants: jsonb("variants"),                 // { sm: url, md: url, lg: url } for images
  muxAssetId: text("mux_asset_id"),           // Mux asset ID (video only)
  muxPlaybackId: text("mux_playback_id"),     // Mux playback ID (video only)
  muxUploadId: text("mux_upload_id"),         // Mux upload ID (video only)
  duration: integer("duration"),               // Duration in seconds (video only)
  width: integer("width"),
  height: integer("height"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),              // Bytes
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const moderationAction = pgTable("moderation_action", {
  id: text("id").primaryKey(),
  mediaId: text("media_id").references(() => media.id),
  postId: text("post_id").references(() => post.id),
  action: text("action").notNull(),            // flag_csam | approve | reject | remove
  reason: text("reason"),                       // hash_match | classifier | manual
  confidence: text("confidence"),               // CSAM classifier confidence score
  reviewedBy: text("reviewed_by").references(() => user.id), // Admin who reviewed
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const creatorStrike = pgTable("creator_strike", {
  id: text("id").primaryKey(),
  creatorProfileId: text("creator_profile_id")
    .notNull()
    .references(() => creatorProfile.id),
  moderationActionId: text("moderation_action_id")
    .notNull()
    .references(() => moderationAction.id),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

### Extended Presigned URL Generation (Images for Posts)

```typescript
// Extend existing lib/storage/upload.ts

const CONTENT_TYPES = {
  image: ["image/jpeg", "image/png", "image/webp"] as const,
  video: ["video/mp4", "video/quicktime"] as const,
};

const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25MB per context decision

export async function generateContentUploadUrl(
  creatorProfileId: string,
  contentType: string,
  mediaId: string,
): Promise<{ uploadUrl: string; key: string }> {
  const ext = getExtensionFromContentType(contentType);
  // Separate path for content media vs profile images
  const key = `content/${creatorProfileId}/${mediaId}/original.${ext}`;

  const client = getR2Client();
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: 900, // 15 minutes
  });

  return { uploadUrl, key };
}
```

### Mux Direct Upload Creation

```typescript
// lib/mux/client.ts
import Mux from "@mux/mux-node";

let muxClient: Mux | null = null;

export function getMuxClient(): Mux {
  if (!muxClient) {
    muxClient = new Mux({
      tokenId: process.env.MUX_TOKEN_ID!,
      tokenSecret: process.env.MUX_TOKEN_SECRET!,
      webhookSecret: process.env.MUX_WEBHOOK_SECRET,
    });
  }
  return muxClient;
}

// app/api/upload/video/route.ts
export async function POST(req: Request) {
  // ... auth check ...
  const { mediaId } = await req.json();

  const mux = getMuxClient();
  const upload = await mux.video.uploads.create({
    cors_origin: process.env.NEXT_PUBLIC_APP_URL!,
    new_asset_settings: {
      passthrough: mediaId,
      playback_policy: ["public"],
      video_quality: "basic",
    },
  });

  // Store upload.id on media record
  // UPDATE media SET mux_upload_id = upload.id WHERE id = mediaId

  return Response.json({ uploadUrl: upload.url });
}
```

### Mux Webhook Handler

```typescript
// app/api/webhooks/mux/route.ts
import { getMuxClient } from "@/lib/mux/client";

export async function POST(request: Request) {
  const mux = getMuxClient();
  const body = await request.text(); // Raw body for signature verification
  const headersList = Object.fromEntries(request.headers.entries());

  let event;
  try {
    event = mux.webhooks.unwrap(body, headersList);
  } catch {
    return new Response("Invalid signature", { status: 401 });
  }

  switch (event.type) {
    case "video.asset.ready": {
      const asset = event.data;
      const mediaId = asset.passthrough;
      const playbackId = asset.playback_ids?.[0]?.id;

      // Update media record (idempotent -- check if already processed)
      // UPDATE media SET
      //   status = 'ready', mux_asset_id = asset.id,
      //   mux_playback_id = playbackId, duration = asset.duration
      // WHERE id = mediaId AND mux_playback_id IS NULL

      // Check if all media for the post is ready, transition post if so
      break;
    }
    case "video.asset.errored": {
      const asset = event.data;
      const mediaId = asset.passthrough;
      // UPDATE media SET status = 'failed' WHERE id = mediaId
      break;
    }
  }

  return Response.json({ received: true });
}
```

### Sharp Image Processing Pipeline

```typescript
// lib/media/image-processing.ts
import sharp from "sharp";

interface ImageVariant {
  suffix: string;
  width: number;
}

const RESPONSIVE_SIZES: ImageVariant[] = [
  { suffix: "lg", width: 1200 },  // Full-width display
  { suffix: "md", width: 800 },   // Medium screens
  { suffix: "sm", width: 400 },   // Thumbnails / mobile
];

export async function processUploadedImage(
  imageBuffer: Buffer,
  baseKey: string, // e.g., content/creatorId/mediaId/original.jpg
): Promise<Record<string, string>> {
  const metadata = await sharp(imageBuffer).metadata();
  const variants: Record<string, string> = {};

  for (const { suffix, width } of RESPONSIVE_SIZES) {
    const processed = await sharp(imageBuffer)
      .resize({
        width,
        withoutEnlargement: true,  // Don't upscale small images
        fit: "inside",
      })
      .webp({ quality: 80 })
      .toBuffer();

    const variantKey = baseKey.replace(/\/original\.[^.]+$/, `/${suffix}.webp`);
    await uploadToR2(variantKey, processed, "image/webp");
    variants[suffix] = `${process.env.R2_PUBLIC_URL}/${variantKey}`;
  }

  return variants;
}
```

### CSAM Scanning Integration

```typescript
// lib/media/csam-scan.ts

interface CSAMScanResult {
  flagged: boolean;
  reason?: "hash_match" | "classifier";
  confidence?: number;
  rawResponse?: unknown;
}

export async function scanMediaForCSAM(mediaUrl: string): Promise<CSAMScanResult> {
  const apiKey = process.env.HIVE_CSAM_API_KEY;
  if (!apiKey) throw new Error("HIVE_CSAM_API_KEY not configured");

  const formData = new FormData();
  formData.append("url", mediaUrl);

  const response = await fetch("https://api.thehive.ai/api/v2/task/sync", {
    method: "POST",
    headers: {
      "Authorization": `Token ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`CSAM scan failed: ${response.status}`);
  }

  const data = await response.json();
  const output = data.output;

  // Hash match = known CSAM (highest confidence)
  if (output.reasons?.includes("matched")) {
    return {
      flagged: true,
      reason: "hash_match",
      rawResponse: data,
    };
  }

  // Classifier prediction
  const prediction = output.classifierPrediction?.csam_classifier;
  if (prediction && prediction.csam > 0.5) {
    return {
      flagged: true,
      reason: "classifier",
      confidence: prediction.csam,
      rawResponse: data,
    };
  }

  return { flagged: false };
}
```

### Video Player Component

```tsx
// components/content/video-player.tsx
import MuxPlayer from "@mux/mux-player-react";

interface VideoPlayerProps {
  playbackId: string;
  title?: string;
}

export function VideoPlayer({ playbackId, title }: VideoPlayerProps) {
  return (
    <MuxPlayer
      playbackId={playbackId}
      metadata={{ video_title: title }}
      streamType="on-demand"
      accentColor="#your-brand-color"
      thumbnailTime={0}
    />
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FFmpeg on server for transcoding | Cloud transcoding (Mux, Cloudflare Stream) | 2020+ | No server CPU burden, automatic ABR, CDN delivery included |
| JPEG/PNG delivery only | WebP/AVIF with Sharp conversion | 2022+ | 60-80% smaller files, faster page loads |
| Manual CSAM hash checking | Combined hash+AI classifier APIs (Hive) | 2023+ | Detects novel CSAM, not just known images |
| Process images in API handler | Presigned upload + async post-processing | 2021+ | No server bandwidth bottleneck, parallel uploads |
| ImageMagick/GraphicsMagick | Sharp (libvips) | 2015+ | 4-5x performance improvement, better memory efficiency |

**Deprecated/outdated:**
- `squoosh` (used by Next.js before Sharp): Much slower, Sharp is now the recommendation
- Separate hash matching and classifier endpoints in Hive: Being deprecated in favor of the combined endpoint at `/api/v2/task/sync`

## Open Questions

1. **Hive CSAM API Pricing**
   - What we know: Hive requires contacting sales for CSAM API pricing. It is not publicly listed.
   - What's unclear: Cost per scan, volume tiers, whether there's a free tier for startups.
   - Recommendation: Contact sales@thehive.ai before implementation. Budget for this as a critical operational cost. Alternative: Microsoft PhotoDNA is free but requires organizational vetting. Plan the code abstraction layer so the CSAM scanning provider can be swapped.

2. **Mux Webhook Endpoint for Video CSAM Scanning**
   - What we know: Mux handles video transcoding, but we need to scan the video for CSAM too.
   - What's unclear: Whether to scan the original video via Hive before sending to Mux, or scan the Mux-hosted version after transcoding.
   - Recommendation: Scan the original video file via Hive BEFORE creating the Mux upload. This prevents CSAM from ever reaching a third-party service. Upload the original to R2 first, scan it, then only proceed to Mux if it passes. This adds latency but is the correct approach for legal compliance.

3. **Strike Threshold for Suspension**
   - What we know: User decided on a strike system with suspension after N strikes.
   - What's unclear: What N should be.
   - Recommendation: Start with 3 strikes. Store as a configurable constant. First strike = warning + content removed. Second strike = 7-day restriction. Third strike = account suspension pending review.

4. **Video Duration Enforcement**
   - What we know: 10-minute video limit per the context decisions.
   - What's unclear: Whether to enforce client-side only or also server-side.
   - Recommendation: Enforce both. Client-side via the Mux uploader config. Server-side by setting `maxDurationSeconds: 600` on the Mux direct upload creation. Mux will reject videos exceeding this duration.

5. **Draft Auto-Save Storage**
   - What we know: Auto-save drafts are required.
   - What's unclear: Best interval and conflict resolution.
   - Recommendation: 10-second debounce after last text change. Save to the `post` table with status "draft". Use optimistic updates on the client. Add `updatedAt` comparison for conflict detection if the user has multiple tabs.

## Sources

### Primary (HIGH confidence)
- [Hive CSAM Combined API Reference](https://docs.thehive.ai/reference/csam-detection-combined-api-reference) - Full REST API spec with request/response examples
- [Mux Direct Uploads](https://www.mux.com/docs/guides/upload-files-directly) - Upload flow, SDK usage, passthrough field
- [Mux Webhooks](https://www.mux.com/docs/core/listen-for-webhooks) - Event types, signature verification, retry behavior
- [Sharp Documentation](https://sharp.pixelplumbing.com/) - Resize API, output formats, quality settings
- [Cloudflare Stream Direct Creator Uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/) - API reference (evaluated but not recommended)
- [Cloudflare CSAM Scanning Tool](https://developers.cloudflare.com/cache/reference/csam-scanning/) - Evaluated; only scans cached CDN content, not suitable as primary scanning solution
- Existing project code: `lib/storage/upload.ts`, `lib/db/schema.ts`, `app/api/upload/presign/route.ts`

### Secondary (MEDIUM confidence)
- [Mux Pricing](https://www.mux.com/pricing) - Free basic encoding, 100k delivery min/month free, $0.003/min storage
- [Cloudflare Stream Pricing](https://developers.cloudflare.com/stream/pricing/) - $5/1000 min storage, $1/1000 min delivery
- [Mux vs Cloudflare Stream comparison](https://www.mux.com/compare/cloudflare-stream) - Feature and pricing comparison (note: Mux-authored, potential bias)
- [Mux Node SDK GitHub](https://github.com/muxinc/mux-node-sdk) - v12.x, TypeScript support, webhook utilities

### Tertiary (LOW confidence)
- Hive CSAM API pricing - Not publicly available, requires sales contact
- @mux/mux-uploader-react exact latest version - npm registry returned 403, approximately 1.x based on search results

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs and npm
- Architecture: HIGH - Patterns based on official Mux docs, Sharp API docs, and existing project patterns
- Pitfalls: HIGH - Based on documented Mux webhook behavior, Sharp memory characteristics, and common upload pipeline issues
- CSAM scanning: MEDIUM - Hive API reference is well-documented, but pricing unknown and integration requires sales contact

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - stable domain, libraries are mature)
