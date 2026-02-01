# Phase 3: Creator Onboarding & Token Launch - Research

**Researched:** 2026-02-01
**Domain:** Multi-step wizard UI, KYC integration (Sumsub), image handling, Solana token launch transactions
**Confidence:** HIGH

## Summary

Phase 3 introduces the creator onboarding wizard -- a multi-step flow that guides creators through profile setup, KYC verification, and token launch. The phase spans three major technical domains: (1) a multi-step form wizard with image upload/cropping, (2) Sumsub KYC integration with embedded Web SDK and server-side webhook processing, and (3) building and submitting Solana `create_token` transactions from the server using the existing custodial wallet infrastructure.

The existing codebase provides solid foundations: Better Auth for session management, Drizzle ORM for database operations, `@solana/kit` v5 for building/signing transactions server-side (see `lib/solana/transfer.ts` for the established pattern), and the Anchor smart contract with `create_token` instruction already deployed. The main new concerns are: Sumsub SDK integration (requires server-side HMAC auth + client-side embedded widget), image upload/cropping/storage, and managing wizard state across multiple steps.

The recommended approach is: use React state (useState) for wizard step management (no need for zustand since the wizard is a single-page flow, not multi-route), react-image-crop for in-browser cropping, Sumsub's `@sumsub/websdk-react` for embedded KYC, and local filesystem or S3-compatible storage for images. The token launch transaction follows the exact same `@solana/kit` pipe-based pattern already established in `lib/solana/transfer.ts`.

**Primary recommendation:** Build the wizard as a single client component with step state, embedding Sumsub SDK in a dialog for KYC, and reuse the established `@solana/kit` transaction pattern for the on-chain `create_token` call.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sumsub/websdk-react` | 2.6.x | Embedded KYC verification widget | Official React wrapper for Sumsub Web SDK 2.0 |
| `react-image-crop` | 11.x | In-browser image cropping (avatar circle + banner rectangle) | Lightweight (<5KB gzip), zero dependencies, supports `circularCrop`, aspect ratio |
| `canvas-confetti` | 1.9.x | Celebration confetti on successful token launch | Lightweight, supports web worker offloading, respects `prefers-reduced-motion` |
| `@aws-sdk/client-s3` | 3.x | Image upload to S3-compatible storage | Standard for presigned URL pattern |
| `@aws-sdk/s3-request-presigner` | 3.x | Generate presigned upload URLs | Pairs with client-s3 for direct browser uploads |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 4.x (already installed) | Validation for profile fields, token config | Every form step validation |
| `sonner` | 2.x (already installed) | Toast notifications for errors/success | Error states, success feedback |
| `lucide-react` | 0.563+ (already installed) | Icons for wizard steps, badges | UI throughout wizard |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-image-crop` | `react-easy-crop` | react-easy-crop has more built-in UI but is heavier; react-image-crop is more flexible and lighter |
| `canvas-confetti` | `react-confetti-explosion` | CSS-only (0 deps) but less customizable; canvas-confetti is more dramatic for a "launch ceremony" |
| S3 presigned URLs | Server action file upload to disk | Disk storage doesn't scale; S3 is production-ready from day one |
| useState for wizard | zustand with persist | Overkill for a single-page wizard; zustand adds complexity without benefit here since the wizard doesn't span routes |

**Installation:**
```bash
npm install @sumsub/websdk-react react-image-crop canvas-confetti @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install -D @types/canvas-confetti
```

## Architecture Patterns

### Recommended Project Structure
```
app/(dashboard)/dashboard/creator/
  page.tsx                        # Wizard entry point (redirects if already creator)
  layout.tsx                      # Optional: minimal layout for wizard
lib/
  sumsub/
    token.ts                      # Server-side: generate Sumsub access token (HMAC-SHA256)
    webhook.ts                    # Webhook signature verification + status update
  solana/
    create-token.ts               # Build + sign + send create_token instruction
  storage/
    upload.ts                     # S3 presigned URL generation
lib/db/
  schema.ts                       # Add: creatorProfile, creatorToken tables
app/api/
  sumsub/
    token/route.ts                # API route: generate Sumsub access token for client
    webhook/route.ts              # POST webhook receiver from Sumsub
  upload/
    presign/route.ts              # API route: generate presigned S3 upload URL
components/
  creator/
    onboarding-wizard.tsx         # Main wizard container with step state
    steps/
      profile-step.tsx            # Display name, bio, social links
      avatar-step.tsx             # Avatar upload + circle crop
      banner-step.tsx             # Banner upload + rectangle crop
      kyc-step.tsx                # Embedded Sumsub widget
      token-config-step.tsx       # Token name, ticker, image, description
      launch-review-step.tsx      # Summary + confirmation
      launch-success-step.tsx     # Confetti + share links
    image-cropper.tsx             # Reusable crop dialog (wraps react-image-crop)
    kyc-badge.tsx                 # Verified checkmark component
    vesting-timeline.tsx          # Visual vesting schedule timeline
```

### Pattern 1: Wizard Step Management
**What:** Single client component managing step index with per-step validation
**When to use:** Multi-step flows that don't need route-based navigation
**Example:**
```typescript
// components/creator/onboarding-wizard.tsx
"use client";
import { useState } from "react";

type WizardStep = "profile" | "avatar" | "banner" | "kyc" | "token-config" | "review" | "success";
const STEPS: WizardStep[] = ["profile", "avatar", "banner", "kyc", "token-config", "review", "success"];

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>("profile");
  const [wizardData, setWizardData] = useState<WizardData>({});

  const stepIndex = STEPS.indexOf(currentStep);
  const goNext = () => setCurrentStep(STEPS[stepIndex + 1]);
  const goBack = () => setCurrentStep(STEPS[stepIndex - 1]);

  // Each step component receives onComplete callback that merges data + advances
  const handleStepComplete = (stepData: Partial<WizardData>) => {
    setWizardData(prev => ({ ...prev, ...stepData }));
    goNext();
  };

  return (
    <div>
      {/* Step indicator */}
      <StepIndicator current={stepIndex} total={STEPS.length - 1} />
      {/* Render current step */}
      {currentStep === "profile" && <ProfileStep onComplete={handleStepComplete} />}
      {currentStep === "kyc" && <KycStep onComplete={handleStepComplete} data={wizardData} />}
      {/* ... etc */}
    </div>
  );
}
```

### Pattern 2: Sumsub Embedded KYC
**What:** Server generates access token via HMAC-authenticated API call, client renders embedded Sumsub widget
**When to use:** KYC verification flow
**Example:**
```typescript
// lib/sumsub/token.ts (server-side)
import crypto from "node:crypto";

const SUMSUB_APP_TOKEN = process.env.SUMSUB_APP_TOKEN!;
const SUMSUB_SECRET_KEY = process.env.SUMSUB_SECRET_KEY!;
const SUMSUB_BASE_URL = "https://api.sumsub.com";

function createSignature(ts: string, method: string, path: string, body?: string) {
  const hmac = crypto.createHmac("sha256", SUMSUB_SECRET_KEY);
  hmac.update(ts + method.toUpperCase() + path);
  if (body) hmac.update(body);
  return hmac.digest("hex");
}

export async function generateSumsubAccessToken(userId: string, levelName: string) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const method = "POST";
  const path = `/resources/accessTokens/sdk`;
  const body = JSON.stringify({ userId, levelName, ttlInSecs: 600 });
  const signature = createSignature(ts, method, path, body);

  const response = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-App-Token": SUMSUB_APP_TOKEN,
      "X-App-Access-Sig": signature,
      "X-App-Access-Ts": ts,
    },
    body,
  });

  if (!response.ok) throw new Error(`Sumsub token error: ${response.status}`);
  return response.json() as Promise<{ token: string; userId: string }>;
}
```

```typescript
// components/creator/steps/kyc-step.tsx (client-side)
"use client";
import SumsubWebSdk from "@sumsub/websdk-react";

export function KycStep({ accessToken, onComplete, onTokenExpired }) {
  return (
    <SumsubWebSdk
      accessToken={accessToken}
      expirationHandler={onTokenExpired}
      config={{ lang: "en" }}
      options={{ addViewportTag: false, adaptIframeHeight: true }}
      onMessage={(type, payload) => {
        if (type === "idCheck.onStepCompleted") {
          // KYC step finished -- user can proceed (but approval is async)
        }
      }}
      onError={(error) => console.error("Sumsub error:", error)}
    />
  );
}
```

### Pattern 3: Token Launch Transaction (Server-Side)
**What:** Build and submit `create_token` instruction using @solana/kit, following the same pattern as `lib/solana/transfer.ts`
**When to use:** When creator confirms token launch
**Example:**
```typescript
// lib/solana/create-token.ts
// Follows exact same pattern as lib/solana/transfer.ts:
// 1. Get user wallet from DB
// 2. Decrypt private key, create signer
// 3. Build transaction with pipe()
// 4. Sign with signTransactionMessageWithSigners()
// 5. Send via rpc.sendTransaction()
// 6. Record in database

// Key difference: create_token instruction requires multiple accounts:
// - creator (signer)
// - global_config PDA
// - creator_profile PDA
// - token_mint (new keypair -- generate client-side or server-side)
// - bonding_curve PDA
// - curve_token_account PDA
// - vesting_account PDA
// - vesting_token_account PDA
// - token_program, system_program, rent

// The token_mint is a NEW keypair generated for each launch
// All PDA addresses are derived from the mint address using seeds from the smart contract
```

### Pattern 4: Image Upload with Presigned URLs
**What:** Server generates S3 presigned URL, client uploads directly to S3, stores URL in DB
**When to use:** Avatar, banner, and token image uploads
**Example:**
```typescript
// Server action or API route
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function getPresignedUploadUrl(userId: string, fileType: string, purpose: "avatar" | "banner" | "token") {
  const key = `uploads/${purpose}/${userId}/${crypto.randomUUID()}.${fileType.split("/")[1]}`;
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: fileType,
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 300 });
  return { uploadUrl: url, publicUrl: `${process.env.CDN_URL}/${key}` };
}
```

### Anti-Patterns to Avoid
- **Storing images in the database:** Use object storage (S3/R2). DB blobs are slow and expensive.
- **Building Solana transactions client-side for custodial wallets:** The private key is encrypted server-side; all transaction building must happen server-side.
- **Polling Sumsub for KYC status:** Use webhooks instead. Polling wastes API calls and introduces latency.
- **Putting file validation only on the client:** Always validate file type, size, and dimensions server-side before generating presigned URLs.
- **Making KYC approval block the wizard:** Let creators complete profile + token config while KYC is pending. Only block the actual launch button.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| KYC verification | Custom ID document scanning | Sumsub Web SDK | Legal compliance, liveness detection, global ID support, rejection handling |
| Image cropping | Canvas manipulation code | react-image-crop | Touch support, aspect ratio, circular crop, accessibility |
| Confetti animation | Custom particle system | canvas-confetti | Web worker support, reduced-motion respect, proven performance |
| HMAC request signing | Manual crypto concatenation | Helper function (see code example) | Easy to get wrong -- timestamp, method, path, body order matters |
| File upload to cloud | Streaming through Next.js server | S3 presigned URLs | Direct browser-to-S3 upload avoids server bandwidth bottleneck |
| Webhook signature verification | Trust Sumsub IP addresses | HMAC-SHA256 digest comparison | IPs change; signature is cryptographically secure |
| Step indicator UI | Custom progress dots | shadcn/ui components (combine Separator + badges) | Consistent with existing design system |

**Key insight:** The KYC and image processing domains have mature, specialized solutions. Custom implementations introduce legal risk (KYC) and subtle bugs (image crop edge cases on mobile).

## Common Pitfalls

### Pitfall 1: Sumsub Access Token Signature Mismatch
**What goes wrong:** 401 error with `app-token-signature mismatch` when generating access tokens
**Why it happens:** HMAC signature construction is order-sensitive -- must be `timestamp + HTTP_METHOD + path + body`. Special characters in userId or levelName must be URL-encoded in the path.
**How to avoid:** Use the exact signature construction pattern from the code example. URL-encode userId if it contains `@`, `+`, or spaces.
**Warning signs:** HTTP 401 with errorCode 4003

### Pitfall 2: Sumsub WebSDK 1.0 vs 2.0
**What goes wrong:** SDK fails to load or shows blank screen
**Why it happens:** WebSDK 1.0 was deprecated and stopped working after October 7, 2025. Must use WebSDK 2.0.
**How to avoid:** Use `@sumsub/websdk-react` v2.x. The React component handles 2.0 initialization automatically.
**Warning signs:** Blank iframe, console errors about deprecated SDK

### Pitfall 3: create_token Transaction Rent Costs
**What goes wrong:** Transaction fails with insufficient funds
**Why it happens:** `create_token` initializes 7 accounts (token_mint, bonding_curve, curve_token_account, vesting_account, vesting_token_account, creator_profile) -- each requires rent-exempt minimum. Total cost is approximately 0.02-0.03 SOL.
**How to avoid:** Check creator's wallet balance before submitting transaction. Show estimated cost on the review screen. Include rent cost in the launch confirmation.
**Warning signs:** Transaction simulation failure

### Pitfall 4: Token Mint Keypair Generation
**What goes wrong:** Token mint address collision or lost keypair
**Why it happens:** The `create_token` instruction expects `token_mint` as an `init` account, meaning a NEW keypair must be generated and the transaction must be signed by both the creator AND the mint keypair.
**How to avoid:** Generate a fresh Ed25519 keypair for the mint on the server. The mint keypair is ephemeral -- only needed for the creation transaction. After creation, the mint authority is revoked anyway.
**Warning signs:** "already in use" errors, missing signer errors

### Pitfall 5: Webhook Race Condition with KYC Status
**What goes wrong:** Creator sees "pending" even after KYC is approved
**Why it happens:** Webhook delivery can be delayed, or the webhook handler fails silently. The creator's session doesn't automatically refresh.
**How to avoid:** Implement both webhook processing AND a manual "check status" button that calls the Sumsub API to get current status. Use optimistic UI updates when the webhook arrives. Store KYC status in the database with a timestamp.
**Warning signs:** Users complaining KYC is "stuck"

### Pitfall 6: Image Crop Output Quality
**What goes wrong:** Blurry or distorted uploaded images
**Why it happens:** Cropping at display resolution instead of original image resolution. Canvas output not sized correctly.
**How to avoid:** Always crop from the original-resolution image, not the displayed (scaled-down) image. Use `canvas.toBlob()` with appropriate quality settings. Set explicit output dimensions (e.g., avatar: 400x400, banner: 1200x400).
**Warning signs:** Images look fine during crop preview but blurry after upload

### Pitfall 7: 90-Day Cooldown Check Only On-Chain
**What goes wrong:** Creator goes through entire wizard only to have the transaction rejected at the end
**Why it happens:** The cooldown is enforced in the smart contract, but there's no server-side pre-check
**How to avoid:** Store `lastTokenLaunchTimestamp` in the database when a token is launched. Check it BEFORE entering the wizard. Show remaining cooldown time on the creator dashboard.
**Warning signs:** Transaction failures with "CooldownNotElapsed" error after completing the entire wizard

## Code Examples

### Database Schema Extensions
```typescript
// lib/db/schema.ts - New tables for Phase 3

export const creatorProfile = pgTable("creator_profile", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id).unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  socialTwitter: text("social_twitter"),
  socialInstagram: text("social_instagram"),
  socialYoutube: text("social_youtube"),
  socialWebsite: text("social_website"),
  kycStatus: text("kyc_status").notNull().default("none"), // none | pending | approved | rejected
  kycApplicantId: text("kyc_applicant_id"),    // Sumsub applicant ID
  kycRejectionReason: text("kyc_rejection_reason"),
  lastTokenLaunchAt: timestamp("last_token_launch_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const creatorToken = pgTable("creator_token", {
  id: text("id").primaryKey(),
  creatorProfileId: text("creator_profile_id").notNull().references(() => creatorProfile.id),
  tokenName: text("token_name").notNull(),
  tickerSymbol: text("ticker_symbol").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  mintAddress: text("mint_address").notNull().unique(),
  bondingCurveAddress: text("bonding_curve_address").notNull(),
  vestingAddress: text("vesting_address").notNull(),
  txSignature: text("tx_signature").notNull(),
  launchedAt: timestamp("launched_at").notNull().defaultNow(),
});
```

### Sumsub Webhook Handler
```typescript
// app/api/sumsub/webhook/route.ts
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { creatorProfile } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const SUMSUB_WEBHOOK_SECRET = process.env.SUMSUB_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  const rawBody = await req.text();
  const digest = req.headers.get("x-payload-digest") ?? "";

  // Verify webhook signature
  const computed = crypto
    .createHmac("sha256", SUMSUB_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  if (digest !== computed) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);

  if (payload.type === "applicantReviewed") {
    const { externalUserId, reviewResult } = payload;
    const status = reviewResult.reviewAnswer === "GREEN" ? "approved" : "rejected";
    const rejectionReason = reviewResult.rejectLabels?.join(", ") ?? null;

    await db.update(creatorProfile)
      .set({
        kycStatus: status,
        kycRejectionReason: status === "rejected" ? rejectionReason : null,
        updatedAt: new Date(),
      })
      .where(eq(creatorProfile.userId, externalUserId));
  }

  return Response.json({ ok: true });
}
```

### Image Crop to Blob Utility
```typescript
// lib/utils/crop-image.ts
export async function getCroppedImageBlob(
  imageSrc: string,
  crop: { x: number; y: number; width: number; height: number },
  outputSize: { width: number; height: number },
): Promise<Blob> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise(resolve => { image.onload = resolve; });

  const canvas = document.createElement("canvas");
  canvas.width = outputSize.width;
  canvas.height = outputSize.height;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    crop.x, crop.y, crop.width, crop.height,  // source rect (original resolution)
    0, 0, outputSize.width, outputSize.height,  // destination rect
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error("Canvas toBlob failed")),
      "image/webp",
      0.85,
    );
  });
}
```

### Confetti Launch Celebration
```typescript
// components/creator/steps/launch-success-step.tsx
"use client";
import { useEffect } from "react";
import confetti from "canvas-confetti";

export function LaunchSuccessStep({ tokenName, tickerSymbol }) {
  useEffect(() => {
    // Fire confetti from both sides
    const end = Date.now() + 2000;
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  return (
    <div className="text-center space-y-4">
      <h2 className="text-2xl font-bold">Your token is live!</h2>
      <p className="text-muted-foreground">{tokenName} ({tickerSymbol}) is now trading</p>
      {/* Share links */}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sumsub WebSDK 1.0 | WebSDK 2.0 (mandatory) | Oct 2025 | Must use v2.0; v1.0 no longer functions |
| `@solana/web3.js` v1 for transactions | `@solana/kit` v5 with pipe() pattern | 2024-2025 | Project already uses kit v5; continue this pattern |
| Store files on disk in Next.js `/public` | S3/R2 presigned URL upload | Standard practice | Scales to production; no filesystem dependency |
| react-hook-form for multi-step | useState for simple wizards, RHF for complex forms | Current | For a wizard with mostly non-form steps (image upload, KYC embed), useState is simpler |

**Deprecated/outdated:**
- Sumsub WebSDK 1.0: Stopped working October 7, 2025
- `@solana/web3.js` v1 Transaction class: Project uses `@solana/kit` v5 pipe-based pattern instead

## Open Questions

1. **S3 bucket vs Cloudflare R2 vs Vercel Blob**
   - What we know: All three work with the presigned URL pattern. R2 has zero egress fees. Vercel Blob is simplest to set up.
   - What's unclear: Which the project will use in production (hosting platform not yet decided)
   - Recommendation: Implement against S3 API (compatible with R2). Use environment variables for bucket/region so it's swappable. For local dev, could use MinIO or just store files temporarily.

2. **Sumsub KYC Level Configuration**
   - What we know: Need "Basic KYC" level (government ID + liveness selfie). The levelName is passed to the access token API.
   - What's unclear: Exact Sumsub dashboard setup and levelName string
   - Recommendation: Create a Sumsub account, configure the "basic-kyc" level in their dashboard, and use that levelName in the env config

3. **Token Mint Keypair as Transaction Signer**
   - What we know: The create_token instruction uses `init` for token_mint, which requires the mint keypair to sign the transaction
   - What's unclear: Whether @solana/kit v5 supports multiple signers in the pipe pattern easily
   - Recommendation: Generate the mint keypair server-side using Node.js crypto (same pattern as wallet keypair generation), add it as an additional signer. The existing `createKeyPairSignerFromBytes` function works for this.

4. **Display Name Uniqueness**
   - What we know: Display name is locked after creation to prevent impersonation
   - What's unclear: Whether uniqueness should be enforced (two creators with the same name)
   - Recommendation: Add a unique constraint on `display_name` in the `creator_profile` table. Show availability check during input.

## Sources

### Primary (HIGH confidence)
- Sumsub official docs: https://docs.sumsub.com/docs/get-started-with-web-sdk - WebSDK 2.0 integration guide
- Sumsub API reference: https://docs.sumsub.com/reference/generate-access-token - Access token generation
- Sumsub webhooks: https://docs.sumsub.com/docs/user-verification-webhooks - Webhook payload structure
- NPM `@sumsub/websdk-react` v2.6.1 - React component props and usage
- GitHub react-image-crop: https://github.com/DominicTobias/react-image-crop - API, circularCrop, aspect ratio
- Existing codebase: `lib/solana/transfer.ts` - Established @solana/kit v5 transaction pattern
- Existing codebase: `programs/baremint/src/instructions/create_token.rs` - Smart contract interface

### Secondary (MEDIUM confidence)
- NPM canvas-confetti: https://www.npmjs.com/package/canvas-confetti - Features, worker support
- Build with Matija: https://www.buildwithmatija.com/blog/master-multi-step-forms-build-a-dynamic-react-form-in-6-simple-steps - Multi-step wizard patterns
- Sumsub GitHub examples: https://github.com/SumSubstance/AppTokenUsageExamples - HMAC signing reference
- Neon/Vercel S3 upload guides: https://neon.com/guides/next-upload-aws-s3 - Presigned URL pattern

### Tertiary (LOW confidence)
- Exact Sumsub webhook retry behavior (documented as 4 retries: 5min, 1hr, 5hr, 18hr -- not independently verified)
- Exact rent costs for create_token transaction (estimated 0.02-0.03 SOL based on 7 account initializations)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official docs verified for Sumsub, react-image-crop, canvas-confetti. @solana/kit usage verified from existing codebase.
- Architecture: HIGH - Wizard pattern well-established in React ecosystem. Solana transaction pattern directly mirrors existing code. Sumsub integration follows official documentation.
- Pitfalls: HIGH - Sumsub signature issues documented in official FAQ. Rent costs based on Solana account model. WebSDK 2.0 requirement confirmed by official deprecation notice.

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days -- Sumsub SDK versions may update)
