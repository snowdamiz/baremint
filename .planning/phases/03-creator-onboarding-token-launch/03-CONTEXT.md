# Phase 3: Creator Onboarding & Token Launch - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Verified creators can set up profiles, complete KYC, and launch their own SPL token with anti-rug protections enforced. This covers the full creator onboarding wizard from role switch through token launch. Content publishing, token trading, and viewer-facing features are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Creator profile setup
- Dedicated multi-step onboarding wizard (not a simple toggle) — guides through profile, KYC, and token launch in sequence
- Profile fields: display name, bio, avatar, banner, social links (Twitter/Instagram/YouTube/website)
- Avatar and banner uploads include in-browser cropping (circle crop for avatar, wide rectangle for banner)
- Profile is editable after setup except for display name (prevent impersonation)

### KYC verification flow
- Sumsub embedded Web SDK — opens inside the app in a modal/panel, user never leaves
- Basic KYC level: government ID document + liveness selfie check (no proof of address)
- Creator can continue onboarding setup while KYC is pending review, but cannot launch token until approved
- On rejection: show Sumsub rejection reason + allow immediate retry with guidance tips

### Token launch ceremony
- Creator configures: token name, ticker symbol, image, and short description
- Token image defaults to creator's avatar with option to override with custom upload
- Launch confirmation: summary screen showing token details, vesting terms, and fees, then celebratory success screen with animation/confetti and share links
- 90-day cooldown between token launches — enforced server-side

### Trust & transparency signals
- KYC verification badge: small verified checkmark next to creator name (Twitter/X blue check style)
- Vesting schedule displayed as timeline with milestones (cliff date, vesting end date, current position) — visible to viewers on creator profile
- 90-day cooldown info is private to the creator only (shown in settings/profile editing page, not public profile)

### Claude's Discretion
- Token page preview approach before launch (full page preview vs summary card)
- Additional trust signals beyond badge + vesting (token age, holder count, etc.)
- Exact onboarding wizard step indicators and navigation
- Error state handling throughout the wizard
- Exact crop dimensions and image size limits

</decisions>

<specifics>
## Specific Ideas

- The onboarding should feel like a guided journey, not a form dump — wizard with clear progression
- Launch moment should feel celebratory (confetti/animation + share links)
- KYC should be seamless — embedded in-app, not a redirect to external site
- Display name lock prevents impersonation after creator establishes identity

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-creator-onboarding-token-launch*
*Context gathered: 2026-02-01*
