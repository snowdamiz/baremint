---
phase: 01-authentication-wallets
plan: 01
subsystem: auth
tags: [better-auth, drizzle, neon, shadcn, next-js-16, proxy]

dependency-graph:
  requires: []
  provides:
    - Database schema with all Phase 1 tables
    - Better Auth email/password authentication
    - Split-screen auth UI with email-first flow
    - Route protection via proxy.ts
    - Dashboard page with session display
  affects:
    - 01-02 (wallet creation builds on user/session tables)
    - 01-03 (OAuth and 2FA build on auth instance and twoFactor plugin)

tech-stack:
  added:
    - better-auth@^1.4.15
    - drizzle-orm@^0.45.1
    - drizzle-kit (dev)
    - "@neondatabase/serverless"
    - "@solana/kit@^3.0.3"
    - helius-sdk@^2.0.5
    - zod@^3.x
    - qrcode (+ @types/qrcode dev)
    - "@t3-oss/env-nextjs"
    - shadcn/ui (button, input, label, card, separator, tabs, sonner)
    - sonner (toast replacement)
  patterns:
    - Lazy database connection via Proxy pattern (prevents build failures without DATABASE_URL)
    - Email-first unified auth form (signup/login detection)
    - proxy.ts for route protection (Next.js 16 convention)
    - nextCookies() as last Better Auth plugin
    - twoFactor plugin pre-configured for Plan 03

key-files:
  created:
    - lib/env.ts
    - lib/db/index.ts
    - lib/db/schema.ts
    - lib/auth.ts
    - lib/auth-client.ts
    - drizzle.config.ts
    - .env.example
    - proxy.ts
    - app/api/auth/[...all]/route.ts
    - app/(auth)/auth/page.tsx
    - app/(auth)/layout.tsx
    - app/(dashboard)/dashboard/page.tsx
    - app/(dashboard)/dashboard/sign-out-button.tsx
    - app/(dashboard)/layout.tsx
    - components/auth/auth-form.tsx
    - components/ui/button.tsx
    - components/ui/input.tsx
    - components/ui/label.tsx
    - components/ui/card.tsx
    - components/ui/separator.tsx
    - components/ui/tabs.tsx
    - components/ui/sonner.tsx
    - lib/db/migrations/0000_chubby_squirrel_girl.sql
  modified:
    - package.json
    - app/layout.tsx
    - app/globals.css
    - .gitignore

decisions:
  - Used sonner instead of deprecated shadcn toast component
  - Made database connection lazy (Proxy pattern) to allow builds without DATABASE_URL
  - Added SKIP_ENV_VALIDATION support for build-time env flexibility
  - Installed all Phase 1 dependencies upfront (including @solana/kit, helius-sdk, qrcode) to avoid touching package.json in later plans

metrics:
  duration: ~5 minutes
  completed: 2026-01-31
---

# Phase 1 Plan 1: Auth Foundation Summary

Database schema, Drizzle ORM with Neon, Better Auth email/password with twoFactor pre-configured, split-screen auth UI, and proxy-based route protection.

## What Was Built

### Task 1: Dependencies, Database, and Schema
Installed all Phase 1 dependencies including forward-looking ones (Solana, Helius, QR code). Initialized shadcn/ui with core components. Created the full database schema with 8 tables: 5 Better Auth tables (user, session, account, verification, twoFactor) and 3 custom Baremint tables (wallet, savedAddress, withdrawal). Set up Drizzle ORM with Neon serverless driver, typed environment validation via @t3-oss/env-nextjs, and generated the initial SQL migration.

### Task 2: Auth System and UI
Created the Better Auth server instance with Drizzle adapter, emailAndPassword enabled, and twoFactor plugin pre-configured (ready for Plan 03). Built the auth client with twoFactor redirect support. Set up the catch-all route handler at `/api/auth/[...all]`. Created `proxy.ts` for Next.js 16 route protection that redirects unauthenticated users from `/dashboard` to `/auth`.

Built the split-screen auth page: left panel with dark branding (Baremint name, tagline, feature bullets), right panel with the auth form. The form follows an email-first flow -- user enters email, then sees signup fields (name, password, confirm) or can switch to login mode. After successful auth, redirects to `/dashboard`.

The dashboard shows user email from server-side session and includes a sign-out button. The dashboard layout has a sidebar placeholder ready for the wallet widget in Plan 02.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lazy database connection for build compatibility**
- Found during: Task 2 (build verification)
- Issue: `neon()` throws immediately if DATABASE_URL is not set, causing `next build` to fail during static page generation
- Fix: Wrapped the Drizzle client in a JavaScript Proxy that defers `neon()` initialization until first actual database access
- Files modified: lib/db/index.ts

**2. [Rule 1 - Bug] Toast component deprecated in shadcn/ui**
- Found during: Task 1 (shadcn component installation)
- Issue: `npx shadcn@latest add toast` reported "The toast component is deprecated. Use the sonner component instead."
- Fix: Installed `sonner` component instead, used `<Toaster />` from `@/components/ui/sonner`
- Files modified: components/ui/sonner.tsx, app/layout.tsx

## Verification Status

- TypeScript: `npx tsc --noEmit` passes with zero errors
- Build: `npx next build` succeeds (warnings about missing BETTER_AUTH_SECRET are expected without env vars)
- Schema: All 8 tables exported from lib/db/schema.ts
- Migration: SQL migration generated at lib/db/migrations/0000_chubby_squirrel_girl.sql
- Routes: /auth renders split-screen layout, /dashboard is protected by proxy.ts

**Note:** Full end-to-end auth flow (signup, login, session persistence) requires DATABASE_URL and BETTER_AUTH_SECRET to be configured. The build and type-check pass without them.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | b35ac76 | feat(01-01): install dependencies, configure database, and create schema |
| 2 | eb6aeb2 | feat(01-01): set up Better Auth, route handler, proxy, and auth UI |

## Next Phase Readiness

**For Plan 01-02 (Custodial Wallets):**
- Schema already includes wallet, savedAddress, withdrawal tables
- @solana/kit and helius-sdk already installed
- Dashboard layout has sidebar placeholder ready for wallet widget
- WALLET_ENCRYPTION_KEY env var already defined in lib/env.ts

**For Plan 01-03 (OAuth + 2FA + Withdrawal):**
- twoFactor plugin already configured in lib/auth.ts
- twoFactorClient already set up in lib/auth-client.ts with redirect to /auth/2fa
- twoFactor table already in schema
- OAuth env vars (GOOGLE_*, TWITTER_*) already in lib/env.ts
- Auth form has commented-out OAuth button placeholder area
