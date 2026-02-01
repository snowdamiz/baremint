# Phase 3: User Setup - Cloudflare R2

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
