import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpandableChip } from '../../src/components/ExpandableChip';

/** Stub matchMedia so `(min-width: 640px)` reports `matches`. */
function stubViewport(isDesktop: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: isDesktop && query === '(min-width: 640px)',
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

beforeEach(() => stubViewport(false));
afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('ExpandableChip', () => {
  it('renders a button that toggles below the sm breakpoint', async () => {
    const onToggle = vi.fn();
    render(
      <ExpandableChip expanded={false} onToggle={onToggle} className="chip" ariaLabel="Season 1 · Spring Thaw">
        <span>Spring</span>
      </ExpandableChip>,
    );
    const chip = screen.getByRole('button', { name: /season 1 · spring thaw/i });
    expect(chip).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(chip);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders a non-interactive element at sm and up', () => {
    stubViewport(true);
    const onToggle = vi.fn();
    render(
      <ExpandableChip expanded={false} onToggle={onToggle} className="chip" ariaLabel="Season 1 · Spring Thaw">
        <span>Spring</span>
      </ExpandableChip>,
    );
    // No button means no Preflight `cursor: pointer` and no dead click target.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Spring')).toBeInTheDocument();
  });

  it('drops aria-expanded at sm and up', () => {
    stubViewport(true);
    const { container } = render(
      <ExpandableChip expanded onToggle={() => {}} className="chip">
        <span>Spring</span>
      </ExpandableChip>,
    );
    expect(container.querySelector('[aria-expanded]')).toBeNull();
  });

  it('keeps the className in both modes', () => {
    const { container, unmount } = render(
      <ExpandableChip expanded={false} onToggle={() => {}} className="chip-x">
        <span>A</span>
      </ExpandableChip>,
    );
    expect(container.querySelector('.chip-x')).toBeInTheDocument();
    unmount();

    stubViewport(true);
    const second = render(
      <ExpandableChip expanded={false} onToggle={() => {}} className="chip-x">
        <span>A</span>
      </ExpandableChip>,
    );
    expect(second.container.querySelector('.chip-x')).toBeInTheDocument();
  });
});
