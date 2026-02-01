# Codebase Structure

**Analysis Date:** 2026-01-31

## Directory Layout

```
baremint/
├── app/                    # Application code (Next.js App Router)
│   ├── layout.tsx          # Root layout with metadata and global structure
│   ├── page.tsx            # Home page at /
│   ├── globals.css         # Global styles (Tailwind + CSS variables)
│   └── favicon.ico         # Favicon asset
├── public/                 # Static assets served at root
│   ├── next.svg            # Next.js logo
│   ├── vercel.svg          # Vercel logo
│   ├── file.svg            # Icon
│   ├── globe.svg           # Icon
│   └── window.svg          # Icon
├── .planning/              # GSD planning and analysis documents
│   └── codebase/           # Codebase documentation
├── .next-docs/             # Next.js documentation (generated)
├── .git/                   # Git repository
├── node_modules/           # Dependencies (not committed)
├── .next/                  # Next.js build output (not committed)
├── tsconfig.json           # TypeScript configuration
├── next.config.ts          # Next.js configuration
├── package.json            # Project manifest and scripts
├── package-lock.json       # Dependency lock file
├── postcss.config.mjs      # PostCSS and Tailwind config
├── eslint.config.mjs       # ESLint configuration
├── next-env.d.ts           # Next.js TypeScript definitions
├── .gitignore              # Git ignore rules
├── README.md               # Project readme
└── CLAUDE.md               # Project instructions and docs index
```

## Directory Purposes

**app/**
- Purpose: Application source code using Next.js App Router
- Contains: Page components, layouts, global styles, server/client components
- Key files: `layout.tsx` (root wrapper), `page.tsx` (routes)

**public/**
- Purpose: Static assets served at the root URL
- Contains: Images, icons, SVGs, favicons
- Key files: Logo SVGs used in home page

**.planning/codebase/**
- Purpose: GSD codebase analysis and architecture documentation
- Contains: ARCHITECTURE.md, STRUCTURE.md, and other reference docs
- Key files: This directory holds all codebase documentation

**.next-docs/**
- Purpose: Generated Next.js official documentation
- Contains: Complete Next.js docs (reference only, not source)
- Key files: Structured Next.js guides and API reference

**.git/**
- Purpose: Git version control
- Contains: Repository metadata, commits, branches
- Key files: Git hooks and history

**.next/**
- Purpose: Next.js build artifacts and cache
- Contains: Compiled code, static optimizations, server functions
- Generated: Yes
- Committed: No (in .gitignore)

## Key File Locations

**Entry Points:**
- `app/layout.tsx`: Root HTML document and global wrapper for all pages
- `app/page.tsx`: Home page component rendered at `/`

**Configuration:**
- `tsconfig.json`: TypeScript compiler options with path aliases (`@/*`)
- `next.config.ts`: Next.js build and runtime configuration
- `package.json`: Project metadata, scripts (dev, build, start, lint), dependencies
- `postcss.config.mjs`: PostCSS plugins for Tailwind CSS processing
- `eslint.config.mjs`: ESLint rules using Next.js presets

**Core Logic:**
- `app/layout.tsx`: Global layout structure, font loading, metadata setup
- `app/page.tsx`: Home page business logic and UI

**Styling:**
- `app/globals.css`: Tailwind CSS import, CSS custom properties for theming, light/dark mode rules
- Inline: Tailwind utility classes in JSX files

**Assets:**
- `public/`: All static files referenced in components
- `app/favicon.ico`: Browser tab icon

## Naming Conventions

**Files:**
- Components: `page.tsx`, `layout.tsx`, `error.tsx`, `not-found.tsx` (Next.js conventions)
- Styles: `globals.css` (global), `[component].module.css` (scoped, not yet used)
- Assets: lowercase with hyphens (e.g., `next.svg`)

**Directories:**
- lowercase with hyphens for multi-word (e.g., `.next-docs`)
- Single word lowercase for most dirs (e.g., `app`, `public`)

**Components:**
- PascalCase functions (e.g., `RootLayout`, `Home`)
- Use descriptive names (e.g., `RootLayout` not `Layout`)

**TypeScript Types:**
- Inline types for props (e.g., `Readonly<{ children: React.ReactNode }>`)
- Imported from `next` for metadata and configuration (e.g., `Metadata`)

## Where to Add New Code

**New Page/Route:**
- File location: `app/[route-name]/page.tsx`
- Layout (if needed): `app/[route-name]/layout.tsx`
- Styling: Inline Tailwind classes or new CSS file in same directory
- Example: For `/about` route, create `app/about/page.tsx`

**New Component/Module:**
- Primary code: Create in subdirectory under `app/` (e.g., `app/components/Card.tsx`) or create a separate `components/` directory at root if planning to share across multiple routes
- Example pattern: `app/components/[ComponentName].tsx`
- Current pattern: Components are inline within page files; consider extracting to `app/components/` as complexity grows

**Shared Utilities:**
- Location: Create `lib/` directory at root or `app/lib/` for app-specific utilities
- Example: `lib/utils.ts`, `lib/api-client.ts`
- Not yet used; establish pattern before adding

**Styled Components/Layouts:**
- Location: `app/[component-name]/` as a directory with its own `layout.tsx` and child pages
- Or: Extract reusable styled components to `app/components/`

**Global Styles:**
- Location: `app/globals.css` (already established)
- Add new CSS variables to `:root` in globals.css for theming
- Use Tailwind `@layer` directive for utility customizations

## Special Directories

**.next/**
- Purpose: Next.js build output and runtime cache
- Generated: Yes (by `next build` and `next dev`)
- Committed: No (ignored via .gitignore)
- Content: Compiled pages, optimized bundles, static generation cache

**.planning/codebase/**
- Purpose: GSD orchestrator analysis documents
- Generated: Yes (by GSD agents)
- Committed: Yes
- Content: ARCHITECTURE.md, STRUCTURE.md, TESTING.md, CONVENTIONS.md, etc.

**.next-docs/**
- Purpose: Reference documentation for Next.js
- Generated: Yes (via `npx @next/codemod agents-md`)
- Committed: Optional (consider version control)
- Content: Official Next.js guides and API reference

**node_modules/**
- Purpose: Installed npm dependencies
- Generated: Yes (via `npm install`)
- Committed: No (ignored via .gitignore)
- Content: All transitive dependencies from package.json

---

*Structure analysis: 2026-01-31*
