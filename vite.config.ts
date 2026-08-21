import { defineConfig } from 'vitest/config';
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
  // Inject the derived version as the build-time fallback `__APP_VERSION__`,
  // computed fresh on every evaluation. An explicit `VITE_APP_VERSION` still
  // wins at runtime — Vite feeds it through `import.meta.env` natively, and
  // `config.ts` reads that first. We deliberately do NOT write the fallback into
  // process.env: `loadEnv` prioritises process.env over `.env` files, so a
  // seeded value would mask a later `.env` change on a config re-evaluation.
  // Left undefined under vitest (mode 'test') so unit tests exercise the real
  // import.meta.env fallback path.
  return {
    plugins: [react()],
    define: mode === 'test' ? {} : { __APP_VERSION__: JSON.stringify(resolveAppVersion()) },
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
