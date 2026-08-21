// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Avoid pulling the real React plugin (and its native deps) into the node test.
vi.mock('@vitejs/plugin-react', () => ({ default: () => ({ name: 'mock-react' }) }));

import viteConfig from '../vite.config';

type ConfigEnv = { mode: string; command: 'build' | 'serve' };
type ResolvedConfig = { define?: Record<string, string> };
type ConfigFactory = (env: ConfigEnv) => ResolvedConfig;

function evaluateConfig(mode: string): ResolvedConfig {
  return (viteConfig as unknown as ConfigFactory)({ mode, command: 'build' });
}

const APP_VERSION_KEYS = ['VERCEL_GIT_COMMIT_SHA', 'GITHUB_SHA', 'VERCEL_ENV', 'CI'] as const;

describe('vite.config __APP_VERSION__ injection', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [...APP_VERSION_KEYS, 'VITE_APP_VERSION']) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('derives the version fresh on each evaluation and never mutates process.env', () => {
    process.env.GITHUB_SHA = 'aaaaaaa0000';
    process.env.CI = 'true';
    const first = evaluateConfig('production');
    expect(first.define?.__APP_VERSION__).toBe(JSON.stringify('ci-aaaaaaa'));

    // A later evaluation with a changed git context must reflect the new value —
    // proving the derivation is recomputed and not cached in a shared holder.
    process.env.GITHUB_SHA = 'bbbbbbb1111';
    const second = evaluateConfig('production');
    expect(second.define?.__APP_VERSION__).toBe(JSON.stringify('ci-bbbbbbb'));

    // The fallback is never written back to process.env (that would let it mask
    // a later explicit .env VITE_APP_VERSION on re-evaluation).
    expect(process.env.VITE_APP_VERSION).toBeUndefined();
  });

  it("falls back to 'dev' with no CI git context", () => {
    const config = evaluateConfig('production');
    expect(config.define?.__APP_VERSION__).toBe(JSON.stringify('dev'));
  });

  it('omits the build constant under vitest (mode "test") so unit tests use import.meta.env', () => {
    process.env.GITHUB_SHA = 'ccccccc2222';
    const config = evaluateConfig('test');
    expect(config.define?.__APP_VERSION__).toBeUndefined();
  });
});
