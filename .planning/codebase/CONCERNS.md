# Codebase Concerns

**Analysis Date:** 2026-01-31

## Boilerplate Content Not Removed

**Issue:** Default create-next-app content still present in production code
**Files:**
- `app/page.tsx` (65 lines of template)
- `app/layout.tsx` (metadata still contains "Create Next App")

**Impact:**
- Misleading/incomplete page content for end users
- Generic metadata not appropriate for actual application
- Template instructions in UI confuse application purpose

**Fix approach:**
- Replace `app/page.tsx` with actual application landing page/content
- Update `app/layout.tsx` metadata (title, description) to reflect real application
- Remove hardcoded links to Vercel templates and Next.js documentation from main page

---

## Empty Next Configuration

**Issue:** `next.config.ts` contains only empty comment placeholder
**Files:** `next.config.ts`

**Impact:**
- No custom Next.js configuration established
- Future configuration changes may miss this file entirely
- Security/performance configurations not in place

**Fix approach:**
- Audit actual application requirements (image optimization, redirects, headers, etc.)
- Add necessary Next.js config options as application needs grow
- Document configuration decisions in comments for future reference

---

## Missing Environment Configuration

**Issue:** No `.env.example` or environment variable documentation
**Files:** `.gitignore` (shows `.env*` ignored but no examples provided)

**Impact:**
- New developers don't know what environment variables are required
- Potential for missing critical configuration in development/production
- No baseline for secrets management strategy

**Fix approach:**
- Create `.env.example` with all required environment variables
- Document each variable's purpose and valid values
- Add setup instructions to README for environment configuration

---

## Default Font Family Mismatch

**Issue:** CSS defines `Arial, Helvetica, sans-serif` but layout imports and uses Geist fonts
**Files:**
- `app/globals.css` (line 25: hardcoded Arial/Helvetica)
- `app/layout.tsx` (lines 5-13: Geist fonts imported and variables set)

**Impact:**
- Fallback font doesn't match primary design system
- Users without Geist font loaded will see inconsistent typography
- Potential accessibility issue if custom fonts fail to load

**Fix approach:**
- Update `globals.css` body font-family to use CSS custom property: `var(--font-geist-sans, sans-serif)`
- Verify font loading strategy in Tailwind/PostCSS setup for reliability
- Consider system font stack as fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

---

## Incomplete Lint Configuration

**Issue:** ESLint configured but `npm run lint` command lacks arguments (will find nothing by default)
**Files:**
- `package.json` (line 9: `"lint": "eslint"`)
- `eslint.config.mjs` (defined but no target specified)

**Impact:**
- Linting command runs but doesn't check any files
- No CI/CD integration possible for automated linting
- Developers may not catch style/quality issues before commit

**Fix approach:**
- Update lint script: `"lint": "eslint . --max-warnings 0"`
- Add lint:fix script: `"lint:fix": "eslint . --fix"`
- Consider adding pre-commit hooks (husky) to enforce linting before commits

---

## No Testing Infrastructure

**Issue:** No test framework installed or configured
**Files:** `package.json` (no jest, vitest, or testing-library)

**Impact:**
- No way to write or run tests
- Cannot verify component behavior or page rendering
- Risk of introducing bugs during development without test coverage

**Fix approach:**
- Add testing framework (vitest recommended for Next.js 16+)
- Add testing-library for React component testing
- Create test directory structure under `app/`
- Add test scripts to package.json: `test`, `test:watch`

---

## No TypeScript Strict Mode Path Resolution

**Issue:** tsconfig.json uses `@/*` path alias pointing to project root `./*`
**Files:** `tsconfig.json` (lines 21-23)

**Impact:**
- Alias `@/` imports everything from root, including .next, node_modules, dotfiles
- Potential for accidental imports of generated or dependency files
- No clear module boundary or public API surface

**Fix approach:**
- Change path alias to point to `src/*` if creating src folder, or `app/*` and `lib/*`
- Example: `"@/*": ["./lib/*"]` for utilities, or multiple: `"@/components/*": ["./app/components/*"]`
- Establish clear directory structure and import conventions

---

## No Production Readiness Checks

**Issue:** next.config.ts and environment setup lack production-specific configuration
**Files:**
- `next.config.ts`
- No security headers configuration
- No CSP (Content Security Policy) headers
- No environment variable validation

**Impact:**
- Application may run insecurely in production
- No protection against common web vulnerabilities (XSS, etc.)
- Silent failure if required environment variables missing at runtime

**Fix approach:**
- Add security headers to next.config.ts or via middleware
- Configure CSP headers appropriate for application
- Add environment variable validation at startup (e.g., using zod or joi)
- Reference: `.next-docs/01-app/02-guides/content-security-policy.mdx`

---

## Unused/Incomplete .next-docs Directory

**Issue:** Large .next-docs directory committed with Next.js documentation
**Files:** `.next-docs/` (entire documentation tree)

**Impact:**
- Adds unnecessary bloat to repository (hundreds of files)
- Outdated documentation (frozen at project creation time)
- Confusion: should reference live documentation instead
- Already in .gitignore but committed before rule added

**Fix approach:**
- Keep in .gitignore for future (already done)
- Consider removing from git history if storage is concern: `git rm -r .next-docs/`
- Document where to find official docs: nextjs.org/docs
- Use CLAUDE.md as single source for Next.js API references

---

## No README Application Description

**Issue:** README is default create-next-app template content
**Files:** `README.md`

**Impact:**
- No information about what application actually does
- No project-specific setup instructions
- Cannot contribute without understanding purpose
- Fails to orient new team members

**Fix approach:**
- Replace template content with actual project description
- Add sections: Features, Requirements, Setup, Development, Deployment
- Include architecture diagram or structure explanation
- Add contribution guidelines

---

## Tailwind v4 Setup Not Fully Validated

**Issue:** Using new Tailwind v4 (@tailwindcss/postcss) with inline theme in CSS
**Files:**
- `app/globals.css` (inline theme config)
- `postcss.config.mjs` (minimal config)
- `package.json` (tailwindcss: ^4, @tailwindcss/postcss: ^4)

**Impact:**
- New configuration style (@theme inline) may have edge cases
- Theme customization limited to CSS variables
- Build process may have undocumented interactions with Next.js bundling
- No explicit Tailwind config file for reference/documentation

**Fix approach:**
- Create `tailwind.config.ts` to document theme structure explicitly
- Move theme from inline CSS to proper config file
- Verify production build works with tree-shaking and CSS optimization
- Test dark mode switching behavior thoroughly

---

## Metadata Not Personalized

**Issue:** Layout metadata uses generic "Create Next App" defaults
**Files:** `app/layout.tsx` (lines 15-18)

**Impact:**
- Poor SEO (generic title/description)
- Share previews will show generic placeholder content
- No branding in browser tabs or search results

**Fix approach:**
- Set appropriate title: `title: "Your App Name"`
- Add meaningful description relevant to application
- Add icons/favicon configuration
- Add OG image metadata for social sharing

---

## Missing Deploy Configuration

**Issue:** No explicit deployment configuration or checklist
**Files:** `next.config.ts` (empty)

**Impact:**
- Unknown deployment target (Vercel? Self-hosted?)
- No caching strategy defined
- Potential performance issues in production

**Fix approach:**
- Add next.config options if self-hosting (e.g., output: "standalone")
- Document deployment target in README
- Reference: `.next-docs/01-app/01-getting-started/17-deploying.mdx`
- Add production checklist: `.next-docs/01-app/02-guides/production-checklist.mdx`

---

*Concerns audit: 2026-01-31*
