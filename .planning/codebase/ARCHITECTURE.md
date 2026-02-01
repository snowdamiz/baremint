# Architecture

**Analysis Date:** 2026-01-31

## Pattern Overview

**Overall:** Next.js App Router (Server-Centric)

**Key Characteristics:**
- Server Components by default with React 19
- File-based routing using App Router
- Static generation with optional dynamic segments
- Integrated styling with Tailwind CSS v4
- TypeScript-first development with strict mode

## Layers

**Presentation Layer (React Components):**
- Purpose: Render UI components and manage client-side rendering where needed
- Location: `app/` directory
- Contains: Page components (`page.tsx`), layout components (`layout.tsx`), server/client components
- Depends on: React, Next.js components (Image, Link, etc.)
- Used by: Browser/client requests, external users

**Layout Layer:**
- Purpose: Define page structure, metadata, and global styling
- Location: `app/layout.tsx` (root layout), subdirectory layouts
- Contains: HTML structure, font definitions, metadata configuration
- Depends on: Next.js `Metadata` type, Google Fonts
- Used by: All pages that extend the layout

**Styling Layer:**
- Purpose: Global styles and theme configuration
- Location: `app/globals.css`
- Contains: Tailwind CSS imports, CSS variables for theme (light/dark mode)
- Depends on: Tailwind CSS v4, PostCSS
- Used by: All components via Tailwind utility classes

**Static Assets:**
- Purpose: Static files served by Next.js
- Location: `public/` directory
- Contains: SVG icons, favicon, images
- Depends on: HTTP server
- Used by: HTML documents, components via `<Image>` tags

## Data Flow

**Page Request Flow:**

1. HTTP request arrives for route (e.g., `/`)
2. Next.js router matches to `app/page.tsx`
3. Root layout from `app/layout.tsx` is applied
4. Page component renders (default: Server Component)
5. React 19 renders component tree
6. HTML is generated and sent to browser
7. CSS from `globals.css` (via Tailwind) is applied
8. Static assets from `public/` are loaded

**Component Composition:**
- RootLayout (`app/layout.tsx`) wraps all pages
- Home page (`app/page.tsx`) uses `<Image>` component from Next.js
- Global styling applied via CSS variable system

**State Management:**
- No centralized state management (not applicable for initial static setup)
- Route parameters handled via file-based routing
- Metadata configured per-page/layout level

## Key Abstractions

**Layout Component:**
- Purpose: Wrapper for all pages with shared structure and metadata
- Examples: `app/layout.tsx`
- Pattern: React functional component exporting `RootLayout` with typed `children` prop

**Page Component:**
- Purpose: Route-specific content rendered at path
- Examples: `app/page.tsx`
- Pattern: Default export of React functional component matching filename

**Metadata Configuration:**
- Purpose: SEO and document head management
- Examples: `app/layout.tsx` exports `Metadata` object
- Pattern: Exported constant using Next.js `Metadata` type

## Entry Points

**Application Root:**
- Location: `app/layout.tsx`
- Triggers: Every HTTP request
- Responsibilities: Set up HTML document structure, fonts, global metadata, CSS initialization

**Home Page:**
- Location: `app/page.tsx`
- Triggers: HTTP request to `/`
- Responsibilities: Render home page content with welcome message and navigation links

**Static Assets:**
- Location: `public/` files
- Triggers: Asset requests from HTML/CSS
- Responsibilities: Serve images, icons, and static resources

## Error Handling

**Strategy:** Next.js built-in error boundaries (not yet customized)

**Patterns:**
- Not yet implemented; uses Next.js default error page
- Can be customized via `error.tsx` convention
- 404 errors can be handled via `not-found.tsx`

## Cross-Cutting Concerns

**Logging:** Not yet implemented. Can be added via custom logging service.

**Validation:** Not yet applicable; frontend-only at this stage.

**Authentication:** Not yet implemented. Can be added via middleware or route handlers.

**Styling:** Global styles via Tailwind CSS with CSS custom properties for theming (light/dark mode support).

---

*Architecture analysis: 2026-01-31*
