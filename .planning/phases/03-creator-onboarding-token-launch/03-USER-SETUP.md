# Phase 3: User Setup

## Cloudflare R2 Storage

Baremint uses Cloudflare R2 for storing creator images (avatars, banners, token images). R2 is S3-compatible with zero egress fees.

### Prerequisites

- A Cloudflare account (free tier works)
- Access to the Cloudflare Dashboard

### Steps

#### 1. Create an R2 Bucket

1. Go to **Cloudflare Dashboard** -> **R2 Object Storage** -> **Create bucket**
2. Name the bucket (e.g., `baremint-images`)
3. Choose a location hint close to your users (or leave as automatic)
4. Click **Create bucket**

#### 2. Enable Public Access

1. Go to **R2** -> your bucket -> **Settings**
2. Under **Public access**, enable public access
3. You can either:
   - Use the default R2 public URL (e.g., `https://pub-XXXX.r2.dev`)
   - Set up a **custom domain** (recommended for production)
4. Copy the public URL for the `R2_PUBLIC_URL` env var

#### 3. Create API Token

1. Go to **R2** -> **Manage R2 API Tokens** -> **Create API token**
2. Token name: `baremint-uploads` (or similar)
3. Permissions: **Object Read & Write**
4. Specify bucket: Select your bucket
5. TTL: Leave as no expiry (or set as needed)
6. Click **Create API Token**
7. Copy the **Access Key ID** and **Secret Access Key** (shown only once)

#### 4. Get the S3 API Endpoint

1. Go to **R2** -> **Overview**
2. Copy the **S3 API** endpoint URL (format: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)

### Environment Variables

Add these to your `.env` file:

```env
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_BUCKET=baremint-images
R2_ACCESS_KEY_ID=<your-access-key-id>
R2_SECRET_ACCESS_KEY=<your-secret-access-key>
R2_PUBLIC_URL=https://pub-XXXX.r2.dev
```

### Verification

After configuring, the app should be able to:
- Generate presigned upload URLs via `POST /api/upload/presign`
- Upload images directly from the browser to R2
- Serve uploaded images via the public URL

### Notes

- Without R2 configured, the image upload flow will fail gracefully with an error toast
- The profile form and wizard still work without R2 -- only image uploads require it
- For local development, you can use R2 directly (no local alternative needed since R2 has a free tier)

---

## Sumsub KYC Verification

Baremint uses Sumsub for creator identity verification (KYC). Creators must pass KYC before launching a token to prevent anonymous rug-pulls.

### Prerequisites

- A Sumsub account (https://sumsub.com -- has a test/sandbox mode)
- Access to the Sumsub Dashboard

### Steps

#### 1. Create an App Token

1. Go to **Sumsub Dashboard** -> **Developers** -> **App Tokens**
2. Click **Generate new token**
3. Copy the **App Token** (this is `SUMSUB_APP_TOKEN`)
4. Copy the **Secret Key** (shown only once -- this is `SUMSUB_SECRET_KEY`)

#### 2. Create a Verification Level

1. Go to **Sumsub Dashboard** -> **Verification Levels**
2. Create a new level or use the default `basic-kyc-level`
3. Configure it with:
   - **ID document** check (passport, driver's license, or national ID)
   - **Liveness check** (selfie verification)
4. Note the level name -- it must match the `levelName` parameter in the code (default: `basic-kyc-level`)

#### 3. Configure Webhook

1. Go to **Sumsub Dashboard** -> **Developers** -> **Webhooks**
2. Add a new webhook endpoint: `https://<YOUR_DOMAIN>/api/sumsub/webhook`
3. Select events: **Applicant reviewed** (at minimum)
4. Copy the **Secret key** for webhook verification (this is `SUMSUB_WEBHOOK_SECRET`)
5. For local development, use a tunnel service (e.g., ngrok) to expose your local server

### Environment Variables

Add these to your `.env` file:

```env
SUMSUB_APP_TOKEN=<your-app-token>
SUMSUB_SECRET_KEY=<your-secret-key>
SUMSUB_WEBHOOK_SECRET=<your-webhook-secret>
```

### Verification

After configuring, the app should be able to:
- Show the Sumsub verification widget on the KYC step of the creator wizard
- Complete ID document upload and liveness check within the app
- Receive webhook callbacks that update KYC status to approved/rejected
- Poll KYC status manually via the "Check Status" button

### Notes

- Without Sumsub credentials, the KYC widget will show a configuration error (expected in development)
- The onboarding wizard still renders without Sumsub -- only the verification step requires it
- For testing, use Sumsub's sandbox mode which provides test document images
- Webhook delivery can be delayed; the manual "Check Status" button is the fallback
