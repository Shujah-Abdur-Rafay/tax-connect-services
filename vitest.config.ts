import { defineConfig } from 'vitest/config';

// Scoped to the rules test suite so it doesn't try to type/transform the app.
// Run via `npm run test:rules` (which wraps it in `firebase emulators:exec`).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
