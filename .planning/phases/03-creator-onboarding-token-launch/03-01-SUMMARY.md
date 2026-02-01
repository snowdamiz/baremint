---
phase: 03-creator-onboarding-token-launch
plan: 01
subsystem: creator-profile
tags: [database, r2, presigned-urls, wizard, image-cropping, drizzle]
requires:
  - phase: 01
    provides: auth, database, wallet tables
provides:
  - creatorProfile and creatorToken database tables
  - R2 presigned URL upload pipeline
  - Creator profile CRUD API
  - Multi-step onboarding wizard shell
  - Profile step with image cropping
affects:
  - phase: 03 plans 02-04 (KYC, token launch, ceremony)
tech-stack:
  added: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "react-image-crop"]
  patterns: ["presigned URL upload", "multi-step wizard with useState", "reusable image cropper dialog"]
key-files:
  created:
    - lib/storage/upload.ts
    - app/api/upload/presign/route.ts
    - app/api/creator/profile/route.ts
    - components/creator/onboarding-wizard.tsx
    - components/creator/steps/profile-step.tsx
    - components/creator/image-cropper.tsx
    - components/ui/textarea.tsx
    - app/(dashboard)/dashboard/creator/page.tsx
  modified:
    - lib/db/schema.ts
    - app/(dashboard)/layout.tsx
    - .env.example
    - tsconfig.json
    - package.json
key-decisions:
  - "R2 presigned URL upload pattern: browser uploads directly to R2, server only generates signed URL"
  - "useState for wizard step management rather than route-based navigation"
  - "Display name immutable after creation to prevent impersonation"
  - "Image output as WebP at 0.85 quality for optimal size/quality balance"
patterns-established:
  - "Presigned upload: fetch /api/upload/presign -> PUT to R2 -> store publicUrl"
  - "Wizard shell: single client component managing step index with step-specific sub-components"
  - "Image cropper: reusable dialog accepting aspect ratio, circular crop flag, and output dimensions"
duration: 5min
completed: 2026-02-01
---

# Phase 3 Plan 1: Creator Profile Foundation Summary

**Creator profile database tables, R2 presigned upload pipeline, profile CRUD API, and onboarding wizard with image cropping**

## Performance

- Duration: ~5 minutes
- Started: 2026-02-01T21:13:20Z
- Completed: 2026-02-01T21:18:40Z
- Tasks: 2/2
- Files created: 8
- Files modified: 4

## Accomplishments

1. **Database schema** - Added `creatorProfile` table (profile fields, KYC status, social links) and `creatorToken` table (token metadata, on-chain addresses) to Drizzle schema
2. **R2 upload pipeline** - Created presigned URL generation utility using AWS SDK S3 client configured for Cloudflare R2, with content type validation and 5MB limit
3. **Upload API** - POST endpoint at `/api/upload/presign` that validates auth and content type, returns presigned PUT URL and public serving URL
4. **Profile API** - GET/POST endpoints at `/api/creator/profile` for creating and updating creator profiles, with display name immutability on updates
5. **Onboarding wizard** - Multi-step wizard shell with step indicator showing 5 steps (profile, KYC, token config, review, launch), stubs for future steps
6. **Profile step** - Full profile form with display name validation (2-50 chars), bio (500 char limit), social links, avatar and banner upload with cropping
7. **Image cropper** - Reusable dialog component wrapping react-image-crop with configurable aspect ratio, circular crop, and canvas-based output at specified dimensions
8. **Navigation** - Added Creator link to dashboard sidebar, creator page at `/dashboard/creator`

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Database schema + image upload infrastructure | `029128a` | schema.ts, upload.ts, presign/route.ts, profile/route.ts |
| 2 | Onboarding wizard with profile step and image cropping | `3839d78` | onboarding-wizard.tsx, profile-step.tsx, image-cropper.tsx, creator/page.tsx |

## Files Created/Modified

### Created
- `lib/storage/upload.ts` - R2 presigned URL generation
- `app/api/upload/presign/route.ts` - Presigned URL API endpoint
- `app/api/creator/profile/route.ts` - Creator profile CRUD API
- `components/creator/onboarding-wizard.tsx` - Multi-step wizard container
- `components/creator/steps/profile-step.tsx` - Profile form step
- `components/creator/image-cropper.tsx` - Reusable image crop dialog
- `components/ui/textarea.tsx` - Shadcn textarea component
- `app/(dashboard)/dashboard/creator/page.tsx` - Creator onboarding page

### Modified
- `lib/db/schema.ts` - Added creatorProfile and creatorToken tables
- `app/(dashboard)/layout.tsx` - Added Creator link to sidebar navigation
- `.env.example` - Added R2 environment variables
- `tsconfig.json` - Excluded tests/ directory from compilation
- `package.json` - Added @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, react-image-crop

## Decisions Made

1. **R2 presigned URL pattern** - Browser uploads directly to R2 via presigned PUT URL. Server generates the URL and returns the public serving URL. No file data flows through the Next.js server.
2. **useState for wizard** - Simple step index state rather than route-based navigation. The wizard is a single-page flow and doesn't need URL-based step tracking.
3. **Display name immutability** - Per CONTEXT.md, display name cannot be changed after profile creation to prevent impersonation. The API enforces this server-side.
4. **WebP output at 0.85 quality** - Cropped images are converted to WebP for optimal file size while maintaining visual quality. Avatar: 400x400, Banner: 1200x400.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded tests/ from tsconfig.json**
- **Found during:** Task 1 build verification
- **Issue:** Pre-existing Anchor smart contract test files (tests/setup.ts, tests/burn.test.ts, etc.) had TypeScript errors that blocked `npm run build`
- **Fix:** Added `"tests"` to tsconfig.json `exclude` array. Tests have their own jest.config.anchor.ts.
- **Files modified:** tsconfig.json
- **Commit:** 029128a

**2. [Rule 3 - Blocking] Installed @types/bn.js**
- **Found during:** Task 1 build verification
- **Issue:** Pre-existing missing type declaration for bn.js in test files
- **Fix:** Installed @types/bn.js as dev dependency
- **Files modified:** package.json, package-lock.json
- **Commit:** 029128a

## Issues Encountered

None beyond the pre-existing test TypeScript errors documented in Deviations.

## User Setup Required

Cloudflare R2 must be configured for image uploads to work. See `.planning/phases/03-creator-onboarding-token-launch/03-USER-SETUP.md` for detailed instructions.

Required environment variables:
- `R2_ENDPOINT` - S3 API endpoint from Cloudflare Dashboard
- `R2_BUCKET` - Bucket name
- `R2_ACCESS_KEY_ID` - API token access key
- `R2_SECRET_ACCESS_KEY` - API token secret key
- `R2_PUBLIC_URL` - Public bucket URL for serving images

The wizard and profile form work without R2 configured -- only image uploads will fail with an error toast.

## Next Phase Readiness

Plan 03-02 (KYC integration) can build on:
- `creatorProfile` table with `kycStatus`, `kycApplicantId`, `kycRejectionReason` fields
- Onboarding wizard shell with stub KYC step ready to be implemented
- Creator page that routes to KYC step when profile exists but KYC is not approved

Plan 03-03 (token launch) can build on:
- `creatorToken` table with all on-chain address fields
- `creatorProfile.lastTokenLaunchAt` for 90-day cooldown enforcement
- Wizard shell with stub token-config and launch-review steps
