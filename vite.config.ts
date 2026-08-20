import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Reached without @types/node (this tsconfig pins `types` to vitest), and
// tolerant of a non-node runtime resolving the config.
const nodeEnv =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

/**
 * Build the `app_version` shipped with every analytics event.
 *
 * Vercel injects `VERCEL_ENV` / `VERCEL_GIT_COMMIT_SHA` into every build, so
 * deploys are versioned without a dashboard variable; GitHub Actions supplies
 * `GITHUB_SHA`. A build with no CI git context still falls back to `'dev'`.
 */
function resolveAppVersion(): string {
  const sha = nodeEnv.VERCEL_GIT_COMMIT_SHA || nodeEnv.GITHUB_SHA;
  if (!sha) return 'dev';
  const env = nodeEnv.VERCEL_ENV || (nodeEnv.CI ? 'ci' : 'local');
  return `${env}-${sha.slice(0, 7)}`;
}

export default defineConfig(({ mode }) => {
  // Only derive a version when nothing explicit is configured. `loadEnv` sees
  // both .env files and inline/dashboard vars, and Vite re-reads env after this
  // config resolves, so seeding process.env here reaches import.meta.env.
  if (!loadEnv(mode, '.', 'VITE_').VITE_APP_VERSION) {
    nodeEnv.VITE_APP_VERSION = resolveAppVersion();
  }

  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      coverage: {
        provider: 'v8',
        thresholds: {
          lines: 80,
        },
      },
    },
  };
});
