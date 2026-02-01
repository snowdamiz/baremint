# Testing Patterns

**Analysis Date:** 2026-01-31

## Test Framework

**Status:** Not configured

**Current State:**
- No testing framework is installed or configured
- No test scripts in `package.json`
- No test files in codebase (no `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx` files)
- No Jest, Vitest, or other test runner configuration

**Available Next.js Testing Options:**
- Jest (reference: `.next-docs/01-app/02-guides/testing/jest.mdx`)
- Vitest (reference: `.next-docs/01-app/02-guides/testing/vitest.mdx`)
- Playwright (reference: `.next-docs/01-app/02-guides/testing/playwright.mdx`)
- Cypress (reference: `.next-docs/01-app/02-guides/testing/cypress.mdx`)

## Test File Organization

**Recommended Location (when added):**
- Co-located pattern: Place test files next to source files
- Naming: `[component].test.tsx` or `[component].spec.tsx`

**Example Structure (when tests are added):**
```
app/
├── page.tsx
├── page.test.tsx          # Tests for Home component
├── layout.tsx
├── layout.test.tsx        # Tests for RootLayout
└── globals.css
```

## Test Structure

**Pattern (when framework is added):**
- Follow Next.js testing guides in `.next-docs/01-app/02-guides/testing/`
- For React component testing: Use React Testing Library patterns
- For API route testing: Use supertest or node-fetch patterns
- For E2E testing: Use Playwright or Cypress

**Not Yet Implemented:**
- No describe/test/it blocks currently in use
- No setup files configured
- No test utilities or fixtures

## Mocking

**Framework:** Not configured

**When Adding Tests:**
- Mock Next.js components as needed (e.g., `next/image`)
- Mock external dependencies following testing framework documentation
- Consider mocking `next/font/google` for font imports in unit tests
- For API routes: Mock database calls and external services

## Fixtures and Factories

**Test Data:** Not applicable - no tests yet

**When Adding Tests:**
- Create fixture files in `__fixtures__/` or `fixtures/` directories
- Use factory functions for generating test data
- Consider creating seed data for integration tests

## Coverage

**Requirements:** Not enforced

**When Adding Tests:**
- Coverage tracking can be enabled once testing framework is installed
- Recommended minimum: 70% for critical paths
- Run coverage reports with test framework command

## Test Types

**Unit Tests:**
- Test individual components in isolation
- Examples: Testing `Home()` component rendering, `RootLayout` props handling
- Use React Testing Library for component testing

**Integration Tests:**
- Test interactions between multiple components
- Test Next.js features like metadata, layouts, and routing
- Use Next.js test utilities when available

**E2E Tests:**
- Test full user workflows
- Recommended: Playwright or Cypress
- Test navigation, form interactions, and page rendering
- Reference: `.next-docs/01-app/02-guides/testing/playwright.mdx`

## Setup Instructions (for Future Implementation)

**Option 1: Jest (Recommended for Next.js)**

1. Install dependencies:
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

2. Create `jest.config.ts` in project root
3. Create `jest.setup.ts` for common test configuration
4. Add test script to `package.json`: `"test": "jest"`

**Option 2: Vitest**

1. Install dependencies:
```bash
npm install --save-dev vitest @vitest/ui @testing-library/react jsdom
```

2. Create `vitest.config.ts` in project root
3. Add test script: `"test": "vitest"`

**Option 3: Playwright (for E2E)**

1. Install dependencies:
```bash
npm install --save-dev @playwright/test
```

2. Create `playwright.config.ts`
3. Add test scripts: `"test:e2e": "playwright test"`

## Common Patterns (When Tests Are Added)

**Async Testing:**
- Wrap async operations in `async/await`
- Use `waitFor()` for DOM updates in React Testing Library

**Error Testing:**
- Test error boundaries when added
- Mock console methods to verify error logging
- Test error.tsx pages (Next.js error handling file convention)

**Next.js Specific Testing:**
- Test route params with dynamic routes
- Test metadata generation with `generateMetadata()`
- Test server components vs client components
- Reference: `.next-docs/01-app/02-guides/testing/jest.mdx`

---

*Testing analysis: 2026-01-31*
