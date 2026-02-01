# External Integrations

**Analysis Date:** 2026-01-31

## APIs & External Services

**None Currently Configured:**
- No third-party API integrations detected in codebase
- No SDK imports or API client libraries present
- Project is a fresh Next.js 16 starter template

## Data Storage

**Databases:**
- Not detected
- No ORM client libraries (Prisma, Drizzle, TypeORM, etc.) present
- No database configuration in `next.config.ts`

**File Storage:**
- Local filesystem only
- Public assets stored in `public/` directory
- Next.js Image component used for optimization: `next/image`

**Caching:**
- Next.js built-in caching mechanisms available:
  - Static file caching
  - Route caching (configured via `next.config.ts` if needed)
- No external cache service (Redis, Memcached) currently integrated

## Authentication & Identity

**Auth Provider:**
- Not detected
- No authentication middleware or providers present
- No JWT, OAuth, or identity service integration

## Monitoring & Observability

**Error Tracking:**
- Not detected
- No error tracking service (Sentry, Datadog, etc.) integrated

**Logs:**
- Standard Node.js/Next.js console logging available
- No centralized logging service configured

## CI/CD & Deployment

**Hosting:**
- Recommended: Vercel (mentioned in README.md and linked in UI)
- Supports alternative self-hosting with Node.js server

**CI Pipeline:**
- Not detected
- No GitHub Actions, GitLab CI, or other CI service configured
- Available for setup in `.github/workflows/` directory (not created)

## Environment Configuration

**Required env vars:**
- None currently required
- Application has no external service dependencies

**Secrets location:**
- Not applicable (no secrets required)
- `.env*` files excluded from version control per `.gitignore`
- Can add `.env.local`, `.env.production`, etc. when integrations are added

## Webhooks & Callbacks

**Incoming:**
- None detected
- No webhook endpoint handlers present
- Can be added via Next.js route handlers: `app/api/[route]/route.ts`

**Outgoing:**
- None detected
- No outbound API calls to external services in codebase

## Google Fonts Integration

**Service:**
- Google Fonts API
- Integration: `next/font/google` (built-in Next.js feature)
- Fonts loaded: Geist Sans, Geist Mono
- Configuration: `app/layout.tsx`
- Fonts automatically optimized and cached by Next.js

---

*Integration audit: 2026-01-31*
