---
phase: 03-creator-onboarding-token-launch
plan: 03
subsystem: token-launch
tags: [solana, spl-token, anchor, bonding-curve, wizard, confetti]

dependency-graph:
  requires: ["03-01", "03-02", "02-01"]
  provides: ["create-token-tx-builder", "launch-api", "token-wizard-steps"]
  affects: ["03-04", "04-xx"]

tech-stack:
  added: ["canvas-confetti"]
  patterns: ["anchor-idl-instruction-building", "pda-derivation", "multi-signer-transaction"]

key-files:
  created:
    - lib/solana/create-token.ts
    - app/api/creator/launch/route.ts
    - components/creator/steps/token-config-step.tsx
    - components/creator/steps/launch-review-step.tsx
    - components/creator/steps/launch-success-step.tsx
  modified:
    - components/creator/onboarding-wizard.tsx
    - package.json

decisions:
  - id: "03-03-pda-seeds"
    summary: "PDA derivation uses string seeds matching Anchor IDL (global_config, creator_profile + pubkey, bonding_curve + mint, etc.)"
  - id: "03-03-discriminator"
    summary: "Anchor IDL discriminator [84,52,204,228,24,140,234,75] used directly for create_token instruction"
  - id: "03-03-confetti-dynamic"
    summary: "canvas-confetti loaded via dynamic import() in useEffect to avoid SSR issues"
  - id: "03-03-effective-image"
    summary: "Token image defaults to creator avatar; custom image optional via toggle + R2 upload"

metrics:
  duration: "~5 minutes"
  completed: "2026-02-01"
---

# Phase 3 Plan 3: Token Launch Flow Summary

**On-chain create_token transaction builder, launch API with cooldown enforcement, and token config/review/success wizard steps**

## What Was Built

### Task 1: On-chain create_token Transaction Builder & Launch API

**lib/solana/create-token.ts** -- `buildAndSendCreateToken(userId, burnSolPrice)` follows the exact same @solana/kit pipe pattern as transfer.ts:
- Decrypts creator wallet, creates KeyPairSigner
- Generates fresh mint keypair via `generateKeyPairSigner()`
- Derives 6 PDAs using `getProgramDerivedAddress` with seeds matching the Anchor program
- Builds instruction data: 8-byte Anchor discriminator + u64 burn_sol_price
- Constructs account metas matching CreateToken struct ordering from IDL
- Signs with both creator signer and mint signer (mint must co-sign)
- Checks SOL balance >= 0.05 before attempting
- Returns signature, mintAddress, bondingCurveAddress, vestingAddress

**app/api/creator/launch/route.ts** -- POST handler with full validation:
- Validates tokenName (2-32), tickerSymbol (2-10 uppercase), burnSolPrice (positive)
- Requires authenticated session
- Requires creatorProfile with kycStatus === "approved" (403 if not)
- 90-day cooldown: computes remaining days if violated (403 with helpful message)
- Converts burnSolPrice from SOL to lamports
- On success: inserts into creatorToken table, updates lastTokenLaunchAt
- Returns mintAddress, txSignature, bondingCurveAddress, vestingAddress

### Task 2: Token Config, Review, and Success Wizard Steps

**TokenConfigStep** -- Form collecting:
- Token name (2-32 chars with character counter)
- Ticker symbol (2-10 chars, auto-uppercase, non-alpha stripped)
- Description (max 200 chars)
- Token image: defaults to creator avatar with "Use custom image" toggle for R2 upload
- Burn SOL price with tooltip explanation

**LaunchReviewStep** -- Summary card showing:
- Token name/ticker/image/description
- Supply: 1,000,000,000
- Creator allocation: 10% with 30-day cliff + 60-day linear vest
- Platform fees: 2.5% buy/sell
- Permanent action warning (90-day cooldown)
- "Launch Token" button with loading state, POSTs to /api/creator/launch

**LaunchSuccessStep** -- Celebration screen:
- canvas-confetti animation (100 particles + side bursts)
- Token details with truncated mint address + copy button
- Vesting timeline summary
- Share on Twitter (pre-filled tweet) and Copy Link buttons
- Solana Explorer transaction link
- "Go to Dashboard" button

**OnboardingWizard** -- Updated to wire all 5 steps:
- Profile -> KYC -> Token Config -> Review -> Success
- Step indicator hidden on success (irreversible action)
- Token config state managed with TokenConfigData interface
- Launch result stored for success screen display

## Decisions Made

| ID | Decision | Rationale |
|----|----------|-----------|
| 03-03-pda-seeds | PDA seeds use string form matching Anchor | @solana/kit getProgramDerivedAddress accepts string seeds directly |
| 03-03-discriminator | Anchor IDL discriminator used directly | Exact bytes from baremint.json IDL, no manual SHA256 needed |
| 03-03-confetti-dynamic | Dynamic import for canvas-confetti | Avoids SSR issues, matches project pattern for browser-only libs |
| 03-03-effective-image | Token defaults to creator avatar | Reduces friction; custom image is opt-in via toggle |

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `npx tsc --noEmit` passes with zero errors
- `npm run build` succeeds -- /api/creator/launch appears in route table
- PDA seeds match create_token.rs: `b"bonding_curve"`, `b"creator_profile"`, etc.
- 90-day cooldown: `Date.now() - lastTokenLaunchAt.getTime()` vs `90 * 24 * 60 * 60 * 1000`
- Account ordering matches IDL: creator, global_config, creator_profile, token_mint, bonding_curve, curve_token_account, vesting_account, vesting_token_account, token_program, system_program, rent

## Commits

| Hash | Message |
|------|---------|
| 10b2a10 | feat(03-03): on-chain create_token transaction builder and launch API |
| 2f6eebe | feat(03-03): token config, review, and success wizard steps |

## Next Phase Readiness

Plan 03-04 (creator dashboard token overview) can proceed -- it reads from creatorToken table which is now populated by the launch flow.
