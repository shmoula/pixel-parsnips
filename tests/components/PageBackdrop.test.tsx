import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PageBackdrop } from '../../src/components/PageBackdrop';

describe('PageBackdrop (018)', () => {
  it('is decorative: aria-hidden and pointer-events-none', () => {
    const { container } = render(<PageBackdrop />);
    const root = container.firstElementChild!;
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.className).toContain('pointer-events-none');
  });

  it('tiles the soil texture as the background', () => {
    const { container } = render(<PageBackdrop />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.backgroundImage).toContain('soil_tile');
  });

  it('renders prop images with empty alt (not in the a11y tree)', () => {
    const { container } = render(<PageBackdrop />);
    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) expect(img.getAttribute('alt')).toBe('');
    const srcs = imgs.map(i => i.getAttribute('src') ?? '');
    expect(srcs.some(s => s.includes('rake'))).toBe(true);
    expect(srcs.some(s => s.includes('pitchfork'))).toBe(true);
  });
});
