---
phase: 01-authentication-wallets
plan: 03
subsystem: auth-wallets
tags: [oauth, 2fa, totp, withdrawal, solana, address-book]
dependency-graph:
  requires: ["01-01", "01-02"]
  provides: ["oauth-login", "totp-2fa", "sol-withdrawal", "address-book"]
  affects: ["02-xx (token trading may use withdrawal patterns)", "03-xx (content gating may check 2FA)"]
tech-stack:
  added: ["@solana-program/system (re-export)", "@radix-ui/react-dialog", "@radix-ui/react-checkbox"]
  patterns: ["server actions for mutations", "pipe() pattern for Solana tx building", "multi-step form with URL params"]
key-files:
  created:
    - components/auth/oauth-buttons.tsx
    - app/(auth)/auth/2fa/page.tsx
    - components/two-factor/setup-dialog.tsx
    - components/two-factor/verify-form.tsx
    - components/two-factor/backup-codes.tsx
    - app/(dashboard)/dashboard/settings/page.tsx
    - app/(dashboard)/dashboard/settings/security-settings.tsx
    - lib/solana/transfer.ts
    - app/(dashboard)/dashboard/withdraw/page.tsx
    - app/(dashboard)/dashboard/withdraw/actions.ts
    - app/(dashboard)/dashboard/withdraw/review/page.tsx
    - components/withdraw/withdraw-form.tsx
    - components/withdraw/address-book.tsx
    - components/withdraw/review-card.tsx
    - components/ui/dialog.tsx
    - components/ui/checkbox.tsx
    - components/ui/badge.tsx
    - components/ui/alert.tsx
  modified:
    - lib/auth.ts
    - components/auth/auth-form.tsx
    - app/(dashboard)/layout.tsx
    - package.json
decisions:
  - id: oauth-social-providers
    decision: "Used Better Auth socialProviders config for Google/Twitter with env var client credentials"
  - id: 2fa-setup-flow
    decision: "4-step dialog: password -> QR code -> verify code -> backup codes"
  - id: withdrawal-2fa-enforcement
    decision: "2FA banner blocks withdrawal UI when not enabled; server-side TOTP verification before transfer"
  - id: keypair-reconstruction
    decision: "Concatenate 32-byte private key + 32-byte public key (from getAddressEncoder) for createKeyPairSignerFromBytes"
  - id: withdrawal-review-params
    decision: "Pass withdrawal details via URL search params between form and review pages"
metrics:
  duration: ~8 min
  completed: 2026-02-01
---

# Phase 1 Plan 3: OAuth, 2FA & Withdrawal Summary

**Google/Twitter OAuth, TOTP 2FA with backup codes, SOL withdrawal with address book and 2FA enforcement**

## What Was Done

### Task 1: OAuth Providers and 2FA Setup (97de733)
- Added Google and Twitter social providers to Better Auth config using env vars
- Created OAuth buttons component (`OAuthButtons`) with `authClient.signIn.social()` calls
- Wired OAuth buttons into existing auth form with "or" divider separator
- Created 2FA verification page at `/auth/2fa` with split-screen layout matching auth page
- Created TOTP verify form with 6-digit code input and backup code toggle
- Created 4-step 2FA setup dialog: password entry, QR code scan, code verification, backup codes display
- Created backup codes component with grid display, copy-all, and "I saved these" checkbox gate
- Created settings page at `/dashboard/settings` with security section showing 2FA status
- Added Withdraw and Settings navigation links to dashboard sidebar
- Installed shadcn dialog, checkbox, badge, and alert components

### Task 2: SOL Withdrawal Flow (33f4139)
- Created `buildAndSendSolTransfer` using @solana/kit `pipe()` pattern: createTransactionMessage -> setFeePayer -> setLifetime -> appendInstruction -> sign -> send
- Reconstructs signer from encrypted private key + public key via `createKeyPairSignerFromBytes`
- Created server actions for withdrawal operations: save/delete address, execute withdrawal with server-side 2FA verification
- Created withdraw page showing balance, 2FA enforcement banner, and withdraw form
- Created withdraw form with destination input, Solana address validation, amount with Max button, USD equivalent, and save-address option
- Created address book component with click-to-select and delete with confirmation
- Created review page with withdrawal details card, fee estimate, TOTP code input, success/failure states
- Success state shows Solana Explorer link for transaction verification

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Better Auth `socialProviders` config | Native support, consistent with existing auth setup, handles OAuth flow |
| 4-step setup dialog (pwd -> QR -> verify -> backup) | Industry standard TOTP setup flow, each step validates before proceeding |
| `getAddressEncoder().encode()` for public key bytes | Proper @solana/kit v5 way to convert Address to bytes for keypair reconstruction |
| URL search params for review page | Stateless navigation between form and review, supports browser back button |
| Server-side `auth.api.verifyTOTP` before transfer | Critical security: TOTP verification must happen server-side, not client-only |
| 2FA banner blocks withdrawal UI | Users cannot bypass 2FA requirement even via direct URL navigation |

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 1 (Authentication & Wallets) is now feature-complete pending human verification:
- Email/password auth with split-screen UI
- Google + Twitter OAuth login
- Custodial Solana wallet auto-created on signup
- Dashboard with wallet widget showing SOL/USD balance
- TOTP 2FA setup and enforcement
- SOL withdrawal with address book, two-step confirmation, and 2FA

**Env vars needed for full testing:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (for OAuth)
- `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET` (for OAuth)
- `DATABASE_URL`, `BETTER_AUTH_SECRET` (for auth)
- `WALLET_ENCRYPTION_KEY` (for wallet encryption)
- `HELIUS_RPC_URL` (optional, defaults to devnet)
