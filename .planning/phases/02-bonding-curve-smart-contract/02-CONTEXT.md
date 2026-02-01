# Phase 2: Bonding Curve Smart Contract - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

A fully tested Anchor program on devnet that implements token creation, buy/sell via bonding curve, burn-for-access, vesting, and fee distribution. This phase covers only the on-chain program and its test suite — no frontend, no off-chain integration.

</domain>

<decisions>
## Implementation Decisions

### Curve shape & pricing
- Claude's discretion on curve formula (linear, quadratic, sigmoid, or hybrid) — research what works best for creator token economies
- Claude's discretion on initial price point — determine sensible starting price based on typical SOL amounts viewers would spend
- Fixed total supply: 1 billion tokens minted at launch per creator
- Mint authority revoked immediately after initial mint — non-mintable tokens (critical trust signal)
- Distribution: 90% (900M) to bonding curve PDA, 10% (100M) to creator vesting account
- Claude's discretion on reserve ratio and price sensitivity

### Fee structure
- 5% total fee on every trade (buy AND sell)
- Split: 2.5% platform, 2.5% creator
- Fixed globally via GlobalConfig PDA — no per-creator customization
- Fee deducted from input SOL before calculating tokens: on a $100 buy, $5 to fees, $95 into curve
- On sells: fee deducted from SOL proceeds before sending to seller
- Fees collected into separate platform vault and creator vault PDAs

### Burn mechanics
- Burn cost is SOL-denominated: creator sets a SOL price, system calculates token equivalent at current curve price
- No SOL returned to the viewer on burn — tokens are destroyed, reducing supply (deflationary)
- The SOL-equivalent value of burned tokens stays in curve reserves MINUS 5% fee
- Burn fee: 5% of the SOL-equivalent value goes to fee vaults (2.5% platform, 2.5% creator), taken from curve reserves
- Remaining 95% of SOL-equivalent stays in curve reserves, benefiting remaining holders

### Vesting rules
- 10% creator allocation (100M tokens) locked in vesting account at mint
- 30-day cliff — no claims possible before day 30
- After cliff: weekly claim windows over 60-day linear vest (roughly 8-9 weekly claims)
- On creator ban: unvested tokens automatically burned (revoke instruction triggered by system)
- Burned unvested tokens are deflationary — benefits remaining holders

### Claude's Discretion
- Bonding curve formula selection (research-driven)
- Initial price and price sensitivity parameters
- Reserve ratio
- Exact weekly vesting math (equal portions vs. pro-rata daily accrual claimed weekly)
- PDA seed design and account structure
- Slippage protection implementation
- Error handling and constraint design

</decisions>

<specifics>
## Specific Ideas

- Mint authority must be revoked — "Minting not being disabled is not trusted in the market"
- Distribution model: 90/10 split (curve/creator) with real tokens, not virtual allocation
- Burns should feel like a cost that benefits the community, not a trade — no SOL return keeps it clean

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-bonding-curve-smart-contract*
*Context gathered: 2026-02-01*
