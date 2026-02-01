# Coding Conventions

**Analysis Date:** 2026-01-31

## Naming Patterns

**Files:**
- Pascal case for React components: `layout.tsx`, `page.tsx`
- Lower case with hyphens for utility files (if any added in future)
- Special Next.js files: `layout.tsx`, `page.tsx`, `globals.css` follow Next.js app router conventions

**Functions:**
- Pascal case for React components: `RootLayout()`, `Home()`
- Follows JSX component naming standards with capital first letter
- Default exports for page and layout components

**Variables:**
- Camel case for all variable declarations: `geistSans`, `geistMono`, `metadata`
- Const for immutable declarations: `const geistSans = ...`
- Type aliases use Pascal case: `Metadata` (imported from Next.js)

**Types:**
- Imported types use Pascal case: `Metadata`
- Inline object types use object destructuring with `Readonly` for props: `Readonly<{ children: React.ReactNode }>`
- Type annotations on constants: `export const metadata: Metadata = { ... }`

## Code Style

**Formatting:**
- ESLint configuration extends both `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Config file: `eslint.config.mjs`
- Flat config format (ESLint 9.x style)
- Custom global ignores for `.next/`, `out/`, `build/`, and `next-env.d.ts`

**Linting:**
- ESLint 9.x (flat config)
- Rules come from: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Key rules: Core Web Vitals compliance, TypeScript strict mode checks
- Command: `npm run lint` (runs `eslint`)

**TypeScript:**
- Target: ES2017
- Module resolution: bundler
- Strict mode: enabled (`"strict": true`)
- JSX mode: `react-jsx` (automatic JSX runtime)
- Isolated modules: enabled
- No emit: enabled (type checking only)
- Incremental builds: enabled
- Path alias configured: `@/*` maps to root directory

## Import Organization

**Order:**
1. External library imports: `import type { Metadata } from "next"`
2. Built-in Next.js component imports: `import { Geist, Geist_Mono } from "next/font/google"`
3. Built-in Next.js components: `import Image from "next/image"`
4. Relative CSS imports: `import "./globals.css"`

**Path Aliases:**
- `@/*` points to root directory (configured in `tsconfig.json`)
- Used for clean imports across the codebase (though not yet used in current files)

**Import Style:**
- Type imports use `import type` syntax: `import type { Metadata } from "next"`
- Default exports for components: `export default function Home() { ... }`
- Named exports for constants: `export const metadata: Metadata = { ... }`

## Error Handling

Not applicable - This is a fresh Create Next App with no complex error handling yet. Follow Next.js patterns for route error pages when adding features.

## Logging

Not applicable - No logging framework configured. Use browser console or Next.js server logs for debugging during development.

## Comments

**When to Comment:**
- Add JSDoc comments for exported functions and components if they require special usage documentation
- Inline comments should explain "why", not "what" the code does
- Current codebase has minimal comments, following "clean code" principles

**JSDoc/TSDoc:**
- No JSDoc comments currently used in codebase
- Should document exported functions when complexity warrants explanation

## Function Design

**Size:**
- Keep functions small and focused
- `RootLayout()` and `Home()` are single-responsibility components

**Parameters:**
- Use destructuring in function parameters: `({ children }: Readonly<{ ... }>)`
- Type parameters explicitly for clarity

**Return Values:**
- React components return JSX elements
- Implicit return for short JSX (as seen in current components)

## Module Design

**Exports:**
- Use default export for page and layout components (Next.js convention)
- Named exports for constants: `export const metadata: Metadata = { ... }`
- Components are default exports, utilities would be named exports

**Barrel Files:**
- Not yet used in codebase
- Consider creating them in utility directories if multiple related exports exist

## CSS & Styling

**Framework:** Tailwind CSS v4 with PostCSS
- Config file: `postcss.config.mjs`
- Global styles: `app/globals.css`
- Import approach: `@import "tailwindcss"` (v4 syntax)
- Custom CSS variables for theme: `--background`, `--foreground`
- Utility-first approach for component styling

**Dark Mode:**
- Supported via `prefers-color-scheme: dark` media query
- Dark variant classes used in JSX: `dark:bg-black`, `dark:text-zinc-50`

## Next.js Specific Patterns

**Component Types:**
- Use `React.ReactNode` for children prop type
- Mark component props as `Readonly` for immutability
- Use `export default` for page and layout components

**Metadata:**
- Centralized in layout files using `export const metadata: Metadata`
- Follows Next.js metadata conventions

---

*Convention analysis: 2026-01-31*
