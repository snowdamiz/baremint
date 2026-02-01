# Phase 5: Token-Gated Content - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Viewers holding sufficient creator tokens can access gated content; others see a locked placeholder. Creators set access levels and thresholds when publishing. Token trading (Phase 6) and burn-to-unlock transactions (Phase 7) are separate phases — this phase builds the gating infrastructure, access verification, and UI but buy/burn buttons are non-functional placeholders.

</domain>

<decisions>
## Implementation Decisions

### Gating UX on publish
- Separate step after writing the post — creator writes content first, then a dedicated step asks about access level and threshold before publishing
- Default access level is public — creator explicitly opts into gating
- Gating applies per-post only — entire post is either public or gated (no per-media gating within a post)
- Access level is locked once published — cannot change after publish

### Locked content appearance
- Server-side blur for gated media — blur is generated server-side so it cannot be bypassed by inspecting the DOM or disabling CSS
- Heavy gaussian blur — colors bleed through, recognizable as an image/video but content completely obscured
- Post text (caption) is always visible — only media is gated
- No engagement metadata shown to non-holders (no unlock counts, no social proof)

### Unlock prompts & messaging
- Simple "Unlock" button on locked posts — opens a dialog with unlock options
- Dialog shows the gating type: hold-gated (subscription-style, hold X tokens) or burn-gated (pay once, burn X tokens)
- Dialog shows viewer's current token balance vs required amount (e.g., "You hold 5 / 100 $TICKER needed")
- Buy/burn buttons rendered as if functional but do nothing in Phase 5 (wired up in Phases 6 and 7)

### Threshold behavior
- Per-post threshold — each gated post can have a different token requirement
- No platform-imposed limits on threshold — creator can set any amount
- Token balance cached with TTL (not checked on every request) to reduce API calls
- Immediate revoke when balance drops — on next TTL check, if balance is below threshold, content locks again

### Claude's Discretion
- Cache TTL duration for token balance checks
- Exact blur parameters (radius, downscale factor)
- Server-side blur generation approach (Sharp, pre-generated at upload time, etc.)
- Unlock dialog layout and styling
- Access level step UI design within the publish flow

</decisions>

<specifics>
## Specific Ideas

- Blur must be server-side generated (not CSS) to prevent client-side bypass — the original media URL should never be exposed to unauthorized viewers
- Unlock dialog should feel complete even though buy/burn actions are placeholder — viewers shouldn't feel like the feature is broken

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-token-gated-content*
*Context gathered: 2026-02-01*
