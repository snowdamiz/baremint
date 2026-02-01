# Technology Stack

**Analysis Date:** 2026-01-31

## Languages

**Primary:**
- TypeScript 5 - Type-safe application code and configuration
- JSX/TSX - React component syntax for UI

**Secondary:**
- JavaScript (Node.js) - Build and configuration scripts

## Runtime

**Environment:**
- Node.js v25.3.0 (current, as verified)

**Package Manager:**
- npm 11.7.0
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework with app router, server components, and built-in optimizations
- React 19.2.3 - UI component library
- React DOM 19.2.3 - React rendering engine for browser

**Build/Dev:**
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - PostCSS plugin for Tailwind CSS compilation
- TypeScript 5 - Static type checking for JavaScript

**Linting:**
- ESLint 9 - JavaScript and TypeScript linting
- eslint-config-next 16.1.6 - Next.js-specific ESLint configuration extending web vitals and TypeScript rules

## Key Dependencies

**Critical:**
- next 16.1.6 - Full-stack framework (required for app router, server components, image optimization, font optimization via next/font/google)
- react 19.2.3 - Latest React version with improved hooks and concurrent features
- react-dom 19.2.3 - React rendering to DOM

**Infrastructure:**
- @types/node ^20 - TypeScript types for Node.js
- @types/react ^19 - TypeScript types for React 19
- @types/react-dom ^19 - TypeScript types for React DOM 19

## Configuration

**Environment:**
- No environment variables required currently (project is bootstrapped without external integrations)
- `.env*` files ignored per `.gitignore` (available for future use)

**Build:**
- `next.config.ts` - Next.js configuration (currently minimal/empty)
- `tsconfig.json` - TypeScript compiler options with path aliases
- `eslint.config.mjs` - ESLint flat config format extending Next.js core web vitals and TypeScript
- `postcss.config.mjs` - PostCSS configuration for Tailwind CSS processing

**Styling:**
- `app/globals.css` - Global styles using `@import "tailwindcss"` with custom CSS variables for theme
- Tailwind CSS v4 with inline theme configuration

## Platform Requirements

**Development:**
- Node.js 25.3.0 or compatible version
- npm 11.7.0 or compatible version

**Production:**
- Deployment target: Vercel (recommended in Next.js 16, mentioned in README)
- Next.js supports self-hosting and other platforms via `output: "standalone"` config option

## Font Loading

**Google Fonts:**
- Using `next/font/google` to import and optimize:
  - Geist Sans font
  - Geist Mono font
- Fonts auto-optimized and preloaded by Next.js

---

*Stack analysis: 2026-01-31*
