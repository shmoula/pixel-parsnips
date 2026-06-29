import '@testing-library/jest-dom';
// Type augmentation: extends Vi.Assertion with toHaveNoViolations types
import 'vitest-axe/extend-expect';
// Runtime registration of the vitest-axe matcher
import { expect } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const axeMatchers: any = require('vitest-axe/matchers');
expect.extend(axeMatchers);

// jsdom has no ResizeObserver; provide a no-op default so components that observe
// element size don't crash. Individual tests can override globalThis.ResizeObserver
// to capture and drive the resize callback.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom has no matchMedia; default to "no preference" (motion allowed).
// Individual tests can override window.matchMedia to simulate reduced motion.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
