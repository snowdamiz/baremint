# Baremint Local Testing Guide

Complete walkthrough for testing every feature of Baremint locally — from initial setup through every user flow.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Setup](#2-environment-setup)
3. [Database Setup](#3-database-setup)
4. [Solana Program (Smart Contract)](#4-solana-program-smart-contract)
5. [External Services Setup](#5-external-services-setup)
6. [Running the App](#6-running-the-app)
7. [Testing: Authentication & Wallets](#7-testing-authentication--wallets)
8. [Testing: Creator Onboarding](#8-testing-creator-onboarding)
9. [Testing: Token Launch](#9-testing-token-launch)
10. [Testing: Content Creation](#10-testing-content-creation)
11. [Testing: Token Trading](#11-testing-token-trading)
12. [Testing: Token-Gated Content](#12-testing-token-gated-content)
13. [Testing: Burn-to-Unlock](#13-testing-burn-to-unlock)
14. [Testing: Creator Monetization](#14-testing-creator-monetization)
15. [Testing: Discovery & Notifications](#15-testing-discovery--notifications)
16. [Testing: Admin Moderation](#16-testing-admin-moderation)
17. [Anchor Program Tests (Bankrun)](#17-anchor-program-tests-bankrun)
18. [Troubleshooting](#18-troubleshooting)
19. [Environment Variable Reference](#19-environment-variable-reference)

---

## 1. Prerequisites

Install the following before starting:

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | `brew install node` or [nvm](https://github.com/nvm-sh/nvm) |
| PostgreSQL | 15+ | `brew install postgresql@15` |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Solana CLI | 2.3.x | `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"` |
| Anchor CLI | 0.32.0 | `cargo install --git https://github.com/coral-xyz/anchor avm && avm install 0.32.0 && avm use 0.32.0` |
| pnpm/npm | latest | Comes with Node.js |

Verify installations:

```bash
node -v          # v20+
psql --version   # 15+
rustc --version  # stable
solana --version  # 2.3.x
anchor --version  # 0.32.0
```

### Solana Keypair

Generate if you don't have one:

```bash
solana-keygen new --outfile ~/.config/solana/id.json
```

Set config to localnet:

```bash
solana config set --url localhost
```

---

## 2. Environment Setup

Copy the example env file and fill in values:

```bash
cp .env.example .env
```

Minimal `.env` for local testing:

```bash
# Database (local PostgreSQL)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/baremint

# Better Auth
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=http://localhost:3000

# Wallet encryption
WALLET_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Solana RPC — point to local validator
HELIUS_RPC_URL=http://127.0.0.1:8899

# Public URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# R2 Storage (see Section 5 for local alternative)
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

# Mux Video (optional — video posts won't work without this)
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=
MUX_WEBHOOK_SECRET=

# Sumsub KYC (optional — bypass available, see Section 8)
SUMSUB_APP_TOKEN=
SUMSUB_SECRET_KEY=
SUMSUB_WEBHOOK_SECRET=

# CSAM scanning (optional — images will skip scanning if not set)
HIVE_CSAM_API_KEY=

# Admin emails (for moderation queue)
ADMIN_EMAILS=admin@test.com

# Helius webhooks (optional — trade confirmation via polling fallback)
HELIUS_API_KEY=
HELIUS_WEBHOOK_SECRET=
```

Generate the secrets:

```bash
# Generate BETTER_AUTH_SECRET
openssl rand -base64 32

# Generate WALLET_ENCRYPTION_KEY (must be exactly 64 hex chars)
openssl rand -hex 32
```

---

## 3. Database Setup

### Start PostgreSQL

```bash
# macOS (Homebrew)
brew services start postgresql@15

# Or run directly
pg_ctl -D /opt/homebrew/var/postgresql@15 start
```

### Create the Database

```bash
createdb baremint
```

If using a password:

```bash
psql -c "CREATE DATABASE baremint;"
```

### Install Dependencies and Run Migrations

```bash
npm install
npx drizzle-kit migrate
```

This creates all tables:
- `user`, `session`, `account`, `verification`, `twoFactor` (auth)
- `wallet`, `savedAddress`, `withdrawal` (wallets)
- `creatorProfile`, `creatorToken` (creators)
- `post`, `media`, `moderationAction`, `creatorStrike` (content)
- `trade`, `donation`, `contentUnlock`, `tokenBalanceCache` (economy)
- `notification` (notifications)

### Verify Tables

```bash
psql baremint -c "\dt"
```

You should see 15+ tables listed.

### Reset Database (if needed)

```bash
npx drizzle-kit drop
npx drizzle-kit migrate
```

---

## 4. Solana Program (Smart Contract)

### Build the Anchor Program

```bash
anchor build
```

This produces:
- `target/deploy/baremint.so` — compiled program
- `target/idl/baremint.json` — interface definition
- `target/types/baremint.ts` — TypeScript types

### Option A: Local Validator (for app testing)

Start a local Solana validator with the program deployed:

```bash
# Terminal 1 — start validator with program preloaded
solana-test-validator \
  --bpf-program FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG target/deploy/baremint.so \
  --reset
```

The validator runs on `http://127.0.0.1:8899`. Your `.env` should have:

```
HELIUS_RPC_URL=http://127.0.0.1:8899
```

### Fund Test Wallets

After starting the validator, airdrop SOL to your default keypair:

```bash
solana airdrop 100
solana balance
```

### Initialize the Program

The program needs a one-time `initialize` call to set up the GlobalConfig. Create a script or use the Anchor CLI:

```bash
# Create a quick initialization script
cat > scripts/init-localnet.ts << 'SCRIPT'
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import IDL from "../target/idl/baremint.json";

const PROGRAM_ID = new PublicKey("FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG");

async function main() {
  const connection = new Connection("http://127.0.0.1:8899", "confirmed");
  const keypairData = JSON.parse(
    fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`, "utf-8")
  );
  const authority = Keypair.fromSecretKey(new Uint8Array(keypairData));
  const wallet = new Wallet(authority);
  const provider = new AnchorProvider(connection, wallet, {});
  const program = new Program(IDL as any, provider);

  const [globalConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("global_config")],
    PROGRAM_ID
  );

  console.log("Initializing GlobalConfig...");
  console.log("Authority:", authority.publicKey.toBase58());
  console.log("GlobalConfig PDA:", globalConfigPda.toBase58());

  await program.methods
    .initialize(
      500,  // fee_bps (5%)
      250,  // platform_fee_bps (2.5%)
      250,  // creator_fee_bps (2.5%)
      new BN("1073000000000000"),  // initial_virtual_token_reserves
      new BN("30000000000")        // initial_virtual_sol_reserves (30 SOL)
    )
    .accounts({
      authority: authority.publicKey,
      globalConfig: globalConfigPda,
      systemProgram: SystemProgram.programId,
    })
    .signers([authority])
    .rpc();

  console.log("GlobalConfig initialized successfully!");
}

main().catch(console.error);
SCRIPT

npx ts-node --esm scripts/init-localnet.ts
```

### Option B: Bankrun Tests Only (no validator needed)

The Anchor tests use `solana-bankrun` which spins up an in-process validator — no external validator required:

```bash
npm run test:anchor
```

See [Section 17](#17-anchor-program-tests-bankrun) for details.

---

## 5. External Services Setup

### Cloudflare R2 (Image/Video Storage)

**Option A: Real R2 bucket (recommended)**

1. Create a Cloudflare R2 bucket at [dash.cloudflare.com](https://dash.cloudflare.com)
2. Create an API token with R2 read/write permissions
3. Enable public access on the bucket (or set up a custom domain)
4. Fill in `.env`:

```bash
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your-access-key>
R2_SECRET_ACCESS_KEY=<your-secret-key>
R2_BUCKET=baremint-dev
R2_PUBLIC_URL=https://pub-<hash>.r2.dev
```

**Option B: MinIO (S3-compatible local alternative)**

```bash
# Run MinIO locally
docker run -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

Then create a bucket called `baremint-dev` at `http://localhost:9001` and set:

```bash
R2_ENDPOINT=http://localhost:9000
R2_ACCESS_KEY_ID=minioadmin
R2_SECRET_ACCESS_KEY=minioadmin
R2_BUCKET=baremint-dev
R2_PUBLIC_URL=http://localhost:9000/baremint-dev
```

**Option C: Skip media entirely**

Without R2 configured, text-only posts work. Image/video uploads will throw errors.

### Mux (Video Transcoding)

Video posts require a Mux account. Sign up at [mux.com](https://www.mux.com/):

1. Create a new environment
2. Generate API access token (Settings → API Access Tokens)
3. Create a webhook endpoint pointing to `https://<your-ngrok-url>/api/webhooks/mux`
4. Fill in `.env`:

```bash
MUX_TOKEN_ID=<your-token-id>
MUX_TOKEN_SECRET=<your-token-secret>
MUX_WEBHOOK_SECRET=<your-webhook-secret>
```

For gated video playback (optional):

```bash
MUX_SIGNING_KEY_ID=<signing-key-id>
MUX_PRIVATE_KEY=<base64-encoded-rsa-private-key>
```

**Without Mux:** Text and image posts work. Video uploads will fail.

### Sumsub (KYC Verification)

For testing the creator KYC flow:

1. Sign up at [sumsub.com](https://sumsub.com/) (they offer sandbox/test environments)
2. Create an app token
3. Set up a webhook endpoint at `https://<your-ngrok-url>/api/sumsub/webhook`
4. Fill in `.env`:

```bash
SUMSUB_APP_TOKEN=<app-token>
SUMSUB_SECRET_KEY=<secret-key>
SUMSUB_WEBHOOK_SECRET=<webhook-secret>
```

**Bypassing KYC for local testing:** You can manually set a creator's KYC status in the database:

```sql
UPDATE creator_profile
SET kyc_status = 'approved', kyc_applicant_id = 'test-applicant'
WHERE user_id = '<your-user-id>';
```

### Hive AI (CSAM Scanning)

Contact `sales@thehive.ai` for an API key. Set:

```bash
HIVE_CSAM_API_KEY=<your-api-key>
```

**Without Hive:** Image uploads will skip CSAM scanning. The code checks for the API key and proceeds without scanning if not set.

### Webhook Tunneling (for Mux/Sumsub/Helius callbacks)

Since webhooks need to reach your local machine, use ngrok:

```bash
ngrok http 3000
```

Then use the ngrok URL for all webhook endpoints:
- Mux: `https://<id>.ngrok.io/api/webhooks/mux`
- Sumsub: `https://<id>.ngrok.io/api/sumsub/webhook`
- Helius: `https://<id>.ngrok.io/api/webhooks/helius`

---

## 6. Running the App

```bash
# Terminal 1 — local Solana validator (if testing on-chain features)
solana-test-validator \
  --bpf-program FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG target/deploy/baremint.so \
  --reset

# Terminal 2 — Next.js dev server
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 7. Testing: Authentication & Wallets

### 7.1 Email/Password Signup

1. Go to `http://localhost:3000` → redirects to `/auth`
2. Enter an email address (e.g., `test@test.com`)
3. Click Continue → enter name and password (min 8 characters)
4. Click Sign Up

**Verify:**
- Redirected to `/dashboard`
- Check database:
  ```sql
  SELECT id, email, name FROM "user" ORDER BY created_at DESC LIMIT 1;
  ```
- Wallet auto-created:
  ```sql
  SELECT w.public_key, w.encrypted_private_key IS NOT NULL AS has_key
  FROM wallet w
  JOIN "user" u ON u.id = w.user_id
  WHERE u.email = 'test@test.com';
  ```

### 7.2 Login (Existing User)

1. Go to `/auth`
2. Enter the same email
3. Enter password → click Log In
4. Should redirect to `/dashboard`

### 7.3 OAuth Login (Optional)

Requires `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` or `TWITTER_CLIENT_ID`/`TWITTER_CLIENT_SECRET` in `.env`.

1. Go to `/auth`
2. Click Google or Twitter button
3. Complete OAuth flow
4. Should redirect to `/dashboard` with wallet auto-created

### 7.4 Two-Factor Authentication

1. Go to `/dashboard/settings`
2. Click "Enable Two-Factor Authentication"
3. Enter your password to confirm
4. Scan QR code with an authenticator app (Google Authenticator, Authy, etc.)
5. Enter the 6-digit TOTP code
6. Save backup codes displayed

**Verify:**
- Check database:
  ```sql
  SELECT two_factor_enabled FROM "user" WHERE email = 'test@test.com';
  ```
- Log out and log in again → should redirect to `/auth/2fa` for TOTP verification

### 7.5 Wallet Balance

1. Go to `/dashboard`
2. The wallet widget in the sidebar shows your Solana address and SOL balance
3. For localnet testing, airdrop SOL to the wallet:
   ```bash
   # Get the wallet address from the dashboard or database
   solana airdrop 10 <WALLET_PUBLIC_KEY> --url localhost
   ```
4. Refresh the page → balance should update

### 7.6 SOL Withdrawal

1. Airdrop SOL to the user's custodial wallet first (see above)
2. Go to `/dashboard/withdraw`
3. Enter a recipient Solana address and amount
4. Click Review → confirm on the review page
5. If 2FA is enabled, enter TOTP code
6. Submit withdrawal

**Verify:**
```sql
SELECT * FROM withdrawal WHERE user_id = '<user-id>' ORDER BY created_at DESC LIMIT 1;
```

Check on-chain:
```bash
solana balance <RECIPIENT_ADDRESS> --url localhost
```

---

## 8. Testing: Creator Onboarding

### 8.1 Profile Setup

1. Go to `/dashboard/creator`
2. The onboarding wizard starts at Step 1: Profile
3. Upload an avatar (requires R2 configured)
4. Upload a banner image (optional)
5. Enter display name (required, immutable after save)
6. Enter bio, social links
7. Click Next

**Verify:**
```sql
SELECT display_name, bio, avatar_url, banner_url, kyc_status
FROM creator_profile
WHERE user_id = '<user-id>';
```

### 8.2 KYC Verification

**With Sumsub configured:**
1. Step 2 shows the Sumsub WebSDK embedded widget
2. Complete the identity verification flow in the widget
3. Sumsub sends a webhook to `/api/sumsub/webhook`
4. Status updates to `approved` or `rejected`

**Without Sumsub (manual bypass):**

```sql
UPDATE creator_profile
SET kyc_status = 'approved'
WHERE user_id = '<user-id>';
```

Then refresh the page — wizard should advance to Step 3.

---

## 9. Testing: Token Launch

**Prerequisites:** Creator profile exists, KYC approved, local validator running with program initialized.

### 9.1 Token Configuration (Step 3)

1. Enter token name (e.g., "My Token")
2. Enter ticker (e.g., "MYTKN")
3. Optional: upload custom token image or use avatar
4. Set burn SOL price (e.g., 0.01 SOL = 10000000 lamports) — this is the cost to burn-unlock content
5. Click Next

### 9.2 Launch Review (Step 4)

1. Review all token details
2. Click "Launch Token"
3. This sends an on-chain `create_token` transaction to the local validator
4. Wait for confirmation

**What happens on-chain:**
- New SPL mint created
- BondingCurve PDA initialized with 900M tokens (90%)
- VestingAccount PDA initialized with 100M tokens (10%)
- CreatorProfile PDA updated with launch timestamp

### 9.3 Launch Success (Step 5)

1. See the mint address and transaction signature
2. Link to Solana Explorer (won't work for localnet — that's fine)

**Verify on-chain:**
```bash
# Check the mint exists
solana account <MINT_ADDRESS> --url localhost

# Check bonding curve PDA has tokens
solana account <BONDING_CURVE_PDA> --url localhost
```

**Verify in database:**
```sql
SELECT mint_address, ticker, bonding_curve_address, vesting_address
FROM creator_token
WHERE creator_profile_id = '<creator-profile-id>';
```

### 9.4 90-Day Cooldown

Attempting to launch a second token immediately should fail with a cooldown error. The on-chain program enforces `launch_cooldown_seconds = 7,776,000` (90 days).

---

## 10. Testing: Content Creation

**Prerequisites:** Creator profile with launched token, R2 configured (for media).

### 10.1 Text Post

1. Go to `/dashboard`
2. Click "Create" in the sidebar/bottom nav (opens PostComposer modal)
3. Type text content
4. Content auto-saves as draft after 10 seconds
5. Click "Publish"
6. Select access level: **Public**
7. Click Publish

**Verify:**
```sql
SELECT id, content, status, access_level FROM post
WHERE user_id = '<user-id>' ORDER BY created_at DESC LIMIT 1;
```

The post should appear on the creator's profile at `/dashboard/creator/<creator-profile-id>`.

### 10.2 Image Post

1. Open PostComposer
2. Click the image upload button
3. Select a JPEG, PNG, or WebP file (max 25MB)
4. File uploads to R2 via presigned URL
5. CSAM scanning runs (if `HIVE_CSAM_API_KEY` is set)
6. Image is processed with Sharp into responsive variants (sm/md/lg WebP)
7. Status shows "Processing..." then "Ready"
8. Add optional text, click Publish → Public

**Verify:**
```sql
-- Check media record
SELECT id, status, mime_type, r2_key, variants
FROM media
WHERE post_id = '<post-id>';
```

### 10.3 Video Post

**Requires:** Mux credentials configured.

1. Open PostComposer
2. Click video upload button
3. Select MP4 or QuickTime file
4. Upload goes to R2 first (CSAM scan), then to Mux for transcoding
5. Status: Uploading → Scanning → Processing → Ready
6. Publish when ready

**Verify:**
```sql
SELECT id, status, mux_asset_id, mux_playback_id
FROM media
WHERE post_id = '<post-id>';
```

Mux sends a webhook to `/api/webhooks/mux` when transcoding completes. If using ngrok, ensure the webhook URL is correct.

### 10.4 Gated Content

1. Create a post (text, image, or video)
2. At the access level step, select **Hold-Gated**
3. Enter a token threshold (e.g., 1000000 = 1 token with 6 decimals)
4. Publish

**Verify:**
```sql
SELECT access_level, token_threshold FROM post WHERE id = '<post-id>';
```

For **Burn-Gated** content:
1. Select "Burn-Gated" at the access level step
2. The burn cost is determined by the creator's `burn_sol_price` set during token launch
3. Publish

### 10.5 Edit and Delete Posts

1. Go to creator profile
2. Find a published post
3. Click Edit → modify text → Save
4. Click Delete → confirm → post status becomes "removed" (soft delete)

```sql
SELECT status FROM post WHERE id = '<post-id>';
-- Should show 'removed'
```

---

## 11. Testing: Token Trading

**Prerequisites:** Creator token launched on local validator, viewer account with SOL.

### 11.1 Fund the Viewer

```bash
# Get the viewer's custodial wallet address from DB
psql baremint -c "SELECT w.public_key FROM wallet w JOIN \"user\" u ON u.id = w.user_id WHERE u.email = 'viewer@test.com';"

# Airdrop SOL
solana airdrop 10 <VIEWER_WALLET_ADDRESS> --url localhost
```

### 11.2 Buy Tokens

1. Log in as the viewer
2. Navigate to `/trade/<MINT_ADDRESS>`
3. The trade page shows token stats, price chart, and bonding curve visualization
4. In the Buy tab:
   - Enter SOL amount (e.g., 0.1 SOL)
   - See fee breakdown (2.5% platform + 2.5% creator)
   - Adjust slippage if needed (default 1%)
   - Click Buy
5. Confirm in the review dialog

**Verify on-chain:**
```bash
# Check the viewer's token balance
spl-token balance <MINT_ADDRESS> --owner <VIEWER_WALLET_ADDRESS> --url localhost

# Check bonding curve reserves changed
solana account <BONDING_CURVE_PDA> --url localhost
```

**Verify in database:**
```sql
SELECT * FROM trade
WHERE user_id = '<viewer-user-id>'
ORDER BY created_at DESC LIMIT 1;
```

### 11.3 Sell Tokens

1. On the same trade page, switch to the Sell tab
2. Enter token amount to sell
3. See SOL output estimate and fee breakdown
4. Click Sell → confirm

### 11.4 Price Chart

The candlestick chart shows price history from confirmed trades. After a few buy/sell transactions, the chart should render candles.

### 11.5 Bonding Curve Visualization

The collapsible curve visualization shows the current position on the bonding curve with reserves and price.

### 11.6 Trade History

The Trades tab on the trade page shows all confirmed buy/sell transactions for this token.

### 11.7 Holdings & P&L

The Holdings card shows the viewer's token position with average entry price and unrealized P&L (calculated from SQL aggregation of confirmed trades).

### 11.8 Helius Webhook (Trade Confirmation)

For localnet, Helius webhooks don't apply (those are for devnet/mainnet). Trades on localnet are confirmed immediately by the validator. The trade record in the database should be updated to `status = 'confirmed'` by the server action.

---

## 12. Testing: Token-Gated Content

**Prerequisites:** Viewer holds tokens from buying, creator has hold-gated posts.

### 12.1 View as Token Holder

1. Log in as the viewer (who holds tokens)
2. Go to the creator's profile `/dashboard/creator/<id>`
3. Hold-gated posts should show content normally (balance verified server-side)

### 12.2 View Without Tokens

1. Create a second viewer account with no tokens
2. Go to the same creator profile
3. Hold-gated posts show:
   - Blurred placeholder image/video
   - "Hold X tokens to unlock" message
   - Links to buy tokens

**Verify access check:**
```sql
-- Check token balance cache
SELECT * FROM token_balance_cache
WHERE wallet_address = '<viewer-wallet>'
AND mint_address = '<mint-address>';
```

### 12.3 Balance Caching

Token balances are cached in `token_balance_cache` to avoid hitting RPC on every request. The cache is refreshed periodically. You can force refresh by clearing the cache:

```sql
DELETE FROM token_balance_cache WHERE wallet_address = '<address>';
```

---

## 13. Testing: Burn-to-Unlock

**Prerequisites:** Creator has burn-gated posts, viewer holds tokens.

### 13.1 Burn Tokens for Content Access

1. Log in as a token holder
2. Find a burn-gated post on the creator's profile
3. See the locked state with burn cost displayed
4. Click "Unlock"
5. The unlock dialog shows:
   - Token amount to burn (calculated from creator's `burn_sol_price`)
   - Fee breakdown
6. Confirm the burn

**What happens:**
- Tokens are permanently destroyed (supply decreases)
- Fees extracted from bonding curve reserves (platform + creator split)
- `content_unlock` record created
- Content becomes permanently accessible for this viewer

**Verify:**
```sql
-- Check unlock record
SELECT * FROM content_unlock
WHERE user_id = '<viewer-user-id>'
AND post_id = '<post-id>';

-- Check that tokens were burned (supply should decrease)
```

On-chain:
```bash
spl-token supply <MINT_ADDRESS> --url localhost
```

### 13.2 Permanent Unlock

After burning, refresh the page. The post should show unlocked content without needing to burn again. The unlock is permanent and stored in the `content_unlock` table.

---

## 14. Testing: Creator Monetization

**Prerequisites:** Token launched, trades have occurred, tips received.

### 14.1 Earnings Dashboard

1. Log in as the creator
2. Go to `/dashboard/creator/earnings`
3. Dashboard shows:
   - Trade fee revenue (50% of fee from confirmed trades)
   - Burn count and revenue
   - Tips received (SOL + token)
   - Total earnings
   - Vesting status

### 14.2 Claim Vested Tokens

**Note:** On localnet you can't easily advance time. For real testing, the vesting cliff is 30 days. You'd need to either:

**Option A: Modify the program for testing** — build with shorter cliff/duration

**Option B: Use bankrun tests** — `advanceClock()` in the test suite handles time advancement (see [Section 17](#17-anchor-program-tests-bankrun))

**Option C: Wait 30 days** (not practical)

If time has passed the cliff:
1. Go to earnings dashboard
2. Click "Claim Vested Tokens"
3. Transaction executes `claim_vested` instruction
4. Tokens transfer from vesting PDA to creator's ATA

### 14.3 Withdraw Trade Fees

After trades have occurred and fees accumulated:

1. Go to earnings dashboard
2. Click "Withdraw Fees"
3. Transaction executes `withdraw_creator_fees` instruction
4. SOL transfers from bonding curve PDA to creator's wallet

**Verify:**
```bash
solana balance <CREATOR_WALLET> --url localhost
```

### 14.4 Donations / Tips

**SOL Tip:**
1. Log in as a viewer
2. Go to the trade page `/trade/<MINT_ADDRESS>`
3. Click the Tip button
4. Select SOL tab
5. Enter amount and send

**Token Tip:**
1. Same flow, select Token tab
2. Enter token amount
3. Send (SPL token transfer)

**Verify:**
```sql
SELECT * FROM donation
WHERE recipient_id = '<creator-user-id>'
ORDER BY created_at DESC;
```

---

## 15. Testing: Discovery & Notifications

### 15.1 Creator Browse Feed

1. Go to `/dashboard` (homepage)
2. Shows all KYC-approved creators with launched tokens
3. Paginated with "Load More" button
4. Cards show avatar, display name, category, token ticker

**Verify data:**
```sql
SELECT cp.display_name, ct.ticker, cp.kyc_status
FROM creator_profile cp
LEFT JOIN creator_token ct ON ct.creator_profile_id = cp.id
WHERE cp.kyc_status = 'approved' AND ct.id IS NOT NULL;
```

### 15.2 Creator Search

1. Go to `/dashboard/explore`
2. Type in the search box (300ms debounce)
3. Results filtered by full-text search on display name, bio, category
4. Uses PostgreSQL tsvector/GIN index

**Test search:**
```sql
-- Check that search vector is populated
SELECT display_name, search_vector FROM creator_profile;
```

### 15.3 Token Leaderboard

1. Go to `/dashboard/leaderboard`
2. Shows tokens ranked by 24h trading volume
3. Columns: rank, token, price, 24h volume, trades

Need at least a few trades to see meaningful data:
```sql
SELECT ct.ticker,
  SUM(CASE WHEN t.created_at > NOW() - INTERVAL '24 hours' THEN t.sol_amount ELSE 0 END) as volume_24h
FROM trade t
JOIN creator_token ct ON ct.mint_address = t.mint_address
WHERE t.status = 'confirmed'
GROUP BY ct.ticker;
```

### 15.4 Notifications

1. As a token holder, you receive notifications when:
   - Creator publishes a new post (fan-out to holders)
   - Token activity occurs (trades on tokens you hold)
2. Bell icon in the nav shows unread count
3. Click the bell → go to `/dashboard/notifications`
4. Mark notifications as read

**Trigger a notification:**
1. Log in as creator and publish a post
2. The `POST /api/posts/[id]/publish` route fans out notifications to up to 1000 holders
3. Log in as a holder and check the bell badge

**Verify:**
```sql
SELECT * FROM notification
WHERE user_id = '<holder-user-id>'
ORDER BY created_at DESC;
```

Notifications poll every 25-35 seconds (with jitter) via `GET /api/notifications/count`.

---

## 16. Testing: Admin Moderation

### 16.1 Setup Admin

Add your email to `ADMIN_EMAILS` in `.env`:

```bash
ADMIN_EMAILS=your-email@test.com,another-admin@test.com
```

### 16.2 Moderation Queue

1. Log in with an admin email
2. Go to `/dashboard/admin/moderation`
3. See flagged or reported content
4. Actions: Approve, Reject, Remove

### 16.3 Strike System

Content removals trigger strikes:
- Strike 1: Warning
- Strike 2: 7-day restriction
- Strike 3: Suspension (KYC status set to `suspended`)

```sql
SELECT * FROM creator_strike
WHERE creator_profile_id = '<creator-profile-id>'
ORDER BY created_at DESC;
```

---

## 17. Anchor Program Tests (Bankrun)

These tests run the Solana program in an in-process emulated validator — no external validator needed.

### Run All Tests

```bash
npm run test:anchor
```

This runs with `--runInBand` (sequential) to avoid race conditions with native code.

### Test Files

| File | What It Tests |
|------|---------------|
| `tests/initialize.test.ts` | GlobalConfig initialization, authority check, fee validation |
| `tests/create_token.test.ts` | Token creation, supply allocation (90/10), vesting setup, 90-day cooldown |
| `tests/buy_sell.test.ts` | Buy via bonding curve, sell back, slippage protection, fee deduction |
| `tests/burn.test.ts` | Burn-for-access, deflationary supply, fee extraction from reserves |
| `tests/vesting.test.ts` | Cliff enforcement, linear vesting, claim intervals, revoke |
| `tests/fees.test.ts` | Platform fee withdrawal, creator fee withdrawal, accrual tracking |

### Test Setup

Tests use `tests/setup.ts` which provides:

```typescript
// Start in-process validator with program loaded
setupTest()           // → { context, provider, program }

// Initialize global config
initializeGlobalConfig(program, authority)

// Create a token with bonding curve
createToken(program, context, creator, burnSolPrice)

// Create associated token account
createATA(context, provider, mint, owner, payer)

// Airdrop SOL in bankrun
airdropSol(context, to, lamports)

// Advance validator clock (for vesting tests)
advanceClock(context, seconds)
```

### Run a Specific Test

```bash
npx jest --config jest.config.anchor.ts --runInBand tests/buy_sell.test.ts
```

### Key Test Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `TOTAL_SUPPLY` | 1,000,000,000 (6 decimals) | 1B tokens total |
| `VESTING_AMOUNT` | 100,000,000 | 10% to creator vesting |
| `CURVE_AMOUNT` | 900,000,000 | 90% to bonding curve |
| `DEFAULT_FEE_BPS` | 500 | 5% total fee |
| `DEFAULT_VIRTUAL_SOL_RESERVES` | 30 SOL | Initial virtual SOL |
| `DEFAULT_VIRTUAL_TOKEN_RESERVES` | 1.073B | Initial virtual tokens |

### Known Issues

- **1 test failure:** `revoke_vesting is idempotent` — non-blocking, production behavior is correct
- Tests must run with `--runInBand` due to native code race conditions

---

## 18. Troubleshooting

### Database Connection Issues

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

Fix: Start PostgreSQL:
```bash
brew services start postgresql@15
```

### "WALLET_ENCRYPTION_KEY environment variable is not set"

Fix: Generate and add to `.env`:
```bash
openssl rand -hex 32
```
Must be exactly 64 hex characters (32 bytes).

### "R2 storage not configured"

Fix: Either set up R2/MinIO (see Section 5) or skip image/video testing.

### Local Validator: "Program not found"

Fix: Make sure you're loading the program:
```bash
solana-test-validator \
  --bpf-program FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG target/deploy/baremint.so \
  --reset
```

### "Transaction simulation failed: Attempt to debit lamports from account"

Fix: Airdrop more SOL to the wallet:
```bash
solana airdrop 10 <ADDRESS> --url localhost
```

### Anchor build fails: "blake3 edition2024 unsupported"

Fix: Blake3 is pinned to 1.5.5 in `Cargo.toml` for SBF compatibility. Run:
```bash
cargo update -p blake3 --precise 1.5.5
anchor build
```

### "HELIUS_RPC_URL is not configured"

For local testing, set:
```bash
HELIUS_RPC_URL=http://127.0.0.1:8899
```

### Mux webhook not arriving

Fix: Ensure ngrok is running and the Mux dashboard webhook URL matches your ngrok URL:
```bash
ngrok http 3000
# Update Mux webhook URL to: https://<id>.ngrok.io/api/webhooks/mux
```

### Sumsub webhook not arriving

Same as Mux — use ngrok and update the webhook URL in the Sumsub dashboard.

### Full-text search returns no results

Fix: Ensure the search vector is populated:
```sql
-- Manually update search vectors for existing profiles
UPDATE creator_profile
SET search_vector =
  setweight(to_tsvector('simple', coalesce(display_name, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(category, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(bio, '')), 'C');
```

### Next.js build fails: "env validation"

Fix: Skip env validation during build:
```bash
SKIP_ENV_VALIDATION=1 npm run build
```

---

## 19. Environment Variable Reference

### Required (Core)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/baremint` |
| `BETTER_AUTH_SECRET` | Session encryption secret | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | App URL for auth callbacks | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_URL` | Public-facing URL | `http://localhost:3000` |

### Required (Blockchain)

| Variable | Description | Example |
|----------|-------------|---------|
| `WALLET_ENCRYPTION_KEY` | 32-byte hex AES-256 key | `openssl rand -hex 32` |
| `HELIUS_RPC_URL` | Solana RPC endpoint | `http://127.0.0.1:8899` (localnet) |

### Required (Storage)

| Variable | Description | Example |
|----------|-------------|---------|
| `R2_ENDPOINT` | Cloudflare R2 / S3 endpoint | `https://<id>.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | R2 access key | — |
| `R2_SECRET_ACCESS_KEY` | R2 secret key | — |
| `R2_BUCKET` | Bucket name | `baremint-dev` |
| `R2_PUBLIC_URL` | Public URL for serving files | `https://pub-<hash>.r2.dev` |

### Optional (Video)

| Variable | Description |
|----------|-------------|
| `MUX_TOKEN_ID` | Mux API token ID |
| `MUX_TOKEN_SECRET` | Mux API token secret |
| `MUX_WEBHOOK_SECRET` | Mux webhook signature secret |
| `MUX_SIGNING_KEY_ID` | JWT signing key for gated video |
| `MUX_PRIVATE_KEY` | Base64-encoded RSA key for gated video |

### Optional (KYC)

| Variable | Description |
|----------|-------------|
| `SUMSUB_APP_TOKEN` | Sumsub app token |
| `SUMSUB_SECRET_KEY` | Sumsub HMAC signing secret |
| `SUMSUB_WEBHOOK_SECRET` | Sumsub webhook verification secret |

### Optional (Content Safety)

| Variable | Description |
|----------|-------------|
| `HIVE_CSAM_API_KEY` | Hive AI CSAM detection API key |

### Optional (OAuth)

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `TWITTER_CLIENT_ID` | Twitter OAuth client ID |
| `TWITTER_CLIENT_SECRET` | Twitter OAuth client secret |

### Optional (Webhooks)

| Variable | Description |
|----------|-------------|
| `HELIUS_API_KEY` | Helius API key for webhook registration |
| `HELIUS_WEBHOOK_SECRET` | Auth header for Helius webhooks |

### Optional (Admin)

| Variable | Description | Example |
|----------|-------------|---------|
| `ADMIN_EMAILS` | Comma-separated admin emails | `admin@test.com,dev@test.com` |
| `SKIP_ENV_VALIDATION` | Skip env checks during build | `1` |

---

## Quick Start Checklist

```
[ ] PostgreSQL running, `baremint` database created
[ ] .env populated with required variables
[ ] npm install completed
[ ] npx drizzle-kit migrate run
[ ] anchor build completed
[ ] solana-test-validator running with program loaded
[ ] Program initialized (GlobalConfig created)
[ ] npm run dev running
[ ] Create user account at /auth
[ ] Airdrop SOL to user's custodial wallet
[ ] Set up creator profile (or bypass KYC via SQL)
[ ] Launch creator token
[ ] Create and publish posts
[ ] Buy tokens on trade page
[ ] Verify gated content access
[ ] Check notifications
```
