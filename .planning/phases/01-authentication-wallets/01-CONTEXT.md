# Phase 1: Authentication & Wallets - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can securely create accounts (email/password or OAuth), enable 2FA, and interact with a custodial Solana wallet (view balance, withdraw SOL). No token trading, no creator features, no content — just auth and wallet foundations.

</domain>

<decisions>
## Implementation Decisions

### Sign-up & login flow
- Split-screen layout: left side branding, right side auth form
- Unified auth form — no tabs, no separate pages. User enters email, system detects if account exists and routes to login or sign-up accordingly
- OAuth buttons (Google, Twitter) appear above email input, separated by "or" divider
- Email-first flow: enter email → system decides next step (password for existing, create account for new)

### Wallet presentation
- Wallet lives in a sidebar widget — always visible but not the hero element
- Wallet address hidden by default, "Your Wallet" label with a "Show address" toggle for those who need it
- USD is the primary balance display (e.g., "$185.10") with SOL as secondary
- Zero balance empty state: Claude's discretion

### 2FA setup experience
- 2FA prompted just-in-time: required before first SOL withdrawal, not during onboarding
- Also available in settings for proactive setup
- Once enabled, 2FA is required on every withdrawal — no device trust, no skipping
- 2FA cannot be disabled once enabled — permanent security measure
- Recovery codes shown once during setup — user must acknowledge they've saved them before proceeding

### SOL withdrawal flow
- Two-step confirmation: Step 1 enter details (address, amount), Step 2 separate review page showing destination, amount, network fee, final amount
- No withdrawal limits — 2FA is the security guard
- Address book: users can save withdrawal addresses with labels and select from saved addresses
- Transaction status feedback: Claude's discretion

### Claude's Discretion
- Split-screen left side branding content (approach, imagery, copy)
- Zero-balance wallet empty state design
- Transaction status feedback UX after withdrawal submission
- Auth form validation patterns and error message styling

</decisions>

<specifics>
## Specific Ideas

- Auth form should feel seamless — the system figures out login vs sign-up, not the user
- Wallet should not intimidate non-crypto users (hidden address, USD-first balance)
- 2FA is a security gate for withdrawals, not a friction point during onboarding

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-authentication-wallets*
*Context gathered: 2026-01-31*
