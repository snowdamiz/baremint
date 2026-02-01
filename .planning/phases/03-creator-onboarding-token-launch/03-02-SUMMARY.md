---
phase: 03-creator-onboarding-token-launch
plan: 02
subsystem: kyc-verification
tags: [sumsub, kyc, webhooks, identity, hmac]
depends_on:
  requires: ["03-01"]
  provides: ["sumsub-integration", "kyc-verification-flow", "webhook-handler"]
  affects: ["03-03", "03-04"]
tech-stack:
  added: ["@sumsub/websdk-react"]
  patterns: ["hmac-signed-api-calls", "webhook-signature-verification", "dynamic-import-ssr-bypass"]
key-files:
  created:
    - lib/sumsub/token.ts
    - lib/sumsub/webhook.ts
    - app/api/sumsub/token/route.ts
    - app/api/sumsub/webhook/route.ts
    - app/api/creator/kyc-status/route.ts
    - components/creator/steps/kyc-step.tsx
  modified:
    - components/creator/onboarding-wizard.tsx
    - app/(dashboard)/dashboard/creator/page.tsx
    - .env.example
    - package.json
decisions:
  - id: "03-02-01"
    decision: "Dynamic import for Sumsub WebSDK to avoid SSR issues"
    rationale: "Sumsub SDK accesses window/document on import; next/dynamic with ssr:false prevents hydration errors"
  - id: "03-02-02"
    decision: "User ID as externalUserId for Sumsub applicant mapping"
    rationale: "Simplifies lookup -- kycApplicantId stores the same user ID used as Sumsub externalUserId"
  - id: "03-02-03"
    decision: "Return 200 on webhook processing errors to prevent infinite Sumsub retries"
    rationale: "Sumsub retries on non-2xx; processing errors are logged but acknowledged to prevent webhook storm"
  - id: "03-02-04"
    decision: "Timing-safe comparison for webhook signature verification"
    rationale: "Prevents timing attacks on HMAC comparison using crypto.timingSafeEqual"
metrics:
  duration: "~3 minutes"
  completed: "2026-02-01"
---

# Phase 3 Plan 2: Sumsub KYC Verification Summary

Sumsub KYC integration with HMAC-signed token generation, webhook receiver with signature verification, and embedded WebSDK widget in onboarding wizard step 2.

## What Was Built

### Server-Side (Task 1)

**Token Generation (`lib/sumsub/token.ts`)**
- HMAC-SHA256 signed requests to Sumsub `/resources/accessTokens` endpoint
- Signature format: `timestamp + POST + path_with_query + body`
- Returns access token for client-side WebSDK initialization

**Webhook Handler (`app/api/sumsub/webhook/route.ts`)**
- Verifies `x-payload-digest` header using HMAC-SHA256 with timing-safe comparison
- Processes `applicantReviewed` events, ignores others
- Maps Sumsub `reviewAnswer`: GREEN -> approved, RED -> rejected
- Updates `creatorProfile.kycStatus` and `kycRejectionReason` in database
- Returns 200 even on processing errors to prevent Sumsub retry storms

**KYC Status Polling (`app/api/creator/kyc-status/route.ts`)**
- Authenticated GET endpoint returning current `kycStatus` and `rejectionReason`
- Manual fallback when webhook delivery is slow

### Client-Side (Task 2)

**KYC Step Component (`components/creator/steps/kyc-step.tsx`)**
- Six states: loading, active (widget shown), pending, approved, rejected, error
- Dynamically imports `@sumsub/websdk-react` to avoid SSR issues
- Token expiration handler auto-refreshes access token
- Listens for `idCheck.onApplicantSubmitted` to transition to pending state
- Rejected state shows reason with "Try Again" button
- Manual "Check Status" button polls the KYC status API

**Wizard Integration**
- KYC step wired as step 2 in the onboarding wizard
- `kycStatus` state flows from server (via creator page) through wizard to KYC step
- Approved status enables advancing to token config (step 3)
- Creator page passes `initialKycStatus` to wizard for returning users

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 43c2bb7 | Sumsub server-side integration (token, webhook, status) |
| 2 | 4000791 | KYC step in onboarding wizard with Sumsub WebSDK |

## Next Phase Readiness

- Plan 03-03 (token configuration step) can proceed -- KYC approval gates token config
- Sumsub credentials needed for full E2E testing (see USER-SETUP.md)
- Without credentials, the widget shows a config error (expected and documented)
