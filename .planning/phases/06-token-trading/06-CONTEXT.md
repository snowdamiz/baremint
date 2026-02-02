# Phase 6: Token Trading - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Viewers can buy and sell creator tokens through the bonding curve with a full trading interface. Includes trade execution, price charts, fee display, and transaction history. Does not include burn-to-unlock (Phase 7), creator earnings/withdrawals (Phase 8), or discovery/leaderboards (Phase 9).

</domain>

<decisions>
## Implementation Decisions

### Trading experience
- Dedicated trade page (`/trade/[token]`), not inline on creator page
- SOL amount input with estimated token output preview (buy) / estimated SOL received (sell)
- Trade form shows buy/sell tabs on the same page

### Price & curve display
- Candlestick chart as the primary price chart
- Time intervals: 5M, 15M, 1H, 4H, 1D, 1W (detailed set for active traders)
- Bonding curve visualization as a secondary/collapsible widget (not the main chart)
- Detailed token stats: price, market cap, circulating supply, volume, holders, 24h change

### Fee transparency
- Slippage tolerance: sensible default (e.g., 1%) with gear icon popover to adjust (Uniswap-style)

### Transaction feedback
- Sonner toast notification after trade submission with summary and Solana explorer link
- Transaction history as a tab below the chart on the trade page
- History shows user's own trades only (no global trade feed)
- Compact history entries: type (buy/sell), amount, price, time

### Claude's Discretion
- Quick-amount buttons design (presets, percentages, or both)
- Fee breakdown display approach (always visible vs expandable)
- Price impact warning design (color-coded vs threshold banner)
- Holdings card detail level (with or without P&L tracking)
- Confirmation flow (one-click vs review dialog)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-token-trading*
*Context gathered: 2026-02-01*
