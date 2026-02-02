---
phase: 06-token-trading
plan: 03
subsystem: trade-confirmation
tags: [helius, webhooks, trade-confirmation, idempotent]
dependency-graph:
  requires: [06-01]
  provides: [trade-confirmation-webhook, webhook-registration]
  affects: [06-04, 06-05]
tech-stack:
  added: []
  patterns: [raw-webhook-processing, idempotent-update, graceful-degradation]
key-files:
  created:
    - app/api/webhooks/helius/route.ts
    - lib/helius/webhook.ts
  modified: []
decisions:
  - id: "06-03-01"
    decision: "Return 200 even on auth mismatch to prevent retry storms (log warning for investigation)"
  - id: "06-03-02"
    decision: "Handle both raw (tx.transaction.signatures[0]) and enhanced (tx.signature) webhook formats"
  - id: "06-03-03"
    decision: "registerTradeWebhook passes HELIUS_WEBHOOK_SECRET as authHeader when configured"
metrics:
  duration: "~1.5 min"
  completed: "2026-02-02"
---

# Phase 6 Plan 3: Helius Webhooks for Trade Confirmation Summary

POST endpoint at /api/webhooks/helius confirms pending trades from on-chain results via Helius raw webhooks, plus registerTradeWebhook/deleteTradeWebhook utilities using helius-sdk v2 createHelius API.

## What Was Built

### Webhook Endpoint (`app/api/webhooks/helius/route.ts`)
- POST handler receives Helius raw webhook arrays of transaction objects
- Optional Authorization header verification via `HELIUS_WEBHOOK_SECRET`
- Handles both raw format (`tx.transaction.signatures[0]`) and enhanced format (`tx.signature`)
- Queries trade table for pending records matching txSignature
- Updates trade status to "confirmed" (meta.err === null) or "failed" (meta.err !== null)
- Idempotent: WHERE clause on `status='pending'` prevents duplicate processing
- Always returns 200 to prevent retry storms (same pattern as Mux webhook)

### Webhook Registration (`lib/helius/webhook.ts`)
- `registerTradeWebhook(bondingCurveAddress)`: Creates raw Helius webhook for a bonding curve PDA
- `deleteTradeWebhook(webhookId)`: Removes a previously registered webhook
- Graceful degradation: returns null when HELIUS_API_KEY or NEXT_PUBLIC_APP_URL not set
- Uses helius-sdk v2 `createHelius` + `webhooks.create` API (not deprecated Helius class)
- Passes HELIUS_WEBHOOK_SECRET as authHeader when configured

## Decisions Made

1. **Return 200 on auth mismatch** -- Logging a warning but returning 200 prevents Helius from endlessly retrying on misconfiguration. Mismatches can be investigated via logs.
2. **Dual format support** -- Raw webhooks use `tx.transaction.signatures[0]`, enhanced use `tx.signature`. Supporting both means the handler works regardless of webhook type configuration.
3. **Auth header passthrough** -- When `HELIUS_WEBHOOK_SECRET` is set, it's passed as `authHeader` during webhook creation so Helius sends it back on each delivery.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Helius SDK v2 uses createHelius, not Helius class**
- **Found during:** Task 2
- **Issue:** Plan referenced `new Helius()` and `helius.createWebhook()` but SDK v2 exports `createHelius()` function returning a client with `webhooks.create()`
- **Fix:** Used correct `createHelius({ apiKey })` API with `helius.webhooks.create()` and `helius.webhooks.delete()`
- **Files modified:** lib/helius/webhook.ts
- **Commit:** d74100a

## Verification Results

- `npx tsc --noEmit` passes with zero errors (both tasks)
- Webhook handler always returns 200 status
- Trade update uses `WHERE status='pending'` for idempotency
- Both success (meta.err null) and failure (meta.err non-null) cases handled
- registerTradeWebhook returns null gracefully when env vars missing

## Next Phase Readiness

- **06-04 (Charts)**: Can query confirmed trades for OHLCV price data
- **06-05 (History)**: Can display confirmed/failed trade status in transaction history
- Webhook registration utility ready for integration into token creation flow
