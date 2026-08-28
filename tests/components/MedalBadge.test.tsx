import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { MedalBadge } from '../../src/components/MedalBadge';
import { MEDAL_LABELS, MEDAL_TAGLINES } from '../../src/engine/medals';

describe('MedalBadge', () => {
  const allTiers = ['none', 'bronze', 'silver', 'gold', 'platinum'] as const;
  const namedTiers = ['bronze', 'silver', 'gold', 'platinum'] as const;

  it.each(namedTiers)('composes the %s aria-label from its label and tagline', (tier) => {
    render(<MedalBadge medal={tier} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      `${MEDAL_LABELS[tier]} — ${MEDAL_TAGLINES[tier]}`,
    );
  });

  // 027 — the none tier is a real progression title now, not the absence of one, so it
  // takes the same template as every other tier instead of a special-cased string.
  it('uses the progression title for the none tier', () => {
    render(<MedalBadge medal="none" />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Struggling Smallholder — Keep going',
    );
  });

  it('never says the word "medal" in the aria-label', () => {
    for (const tier of allTiers) {
      const { unmount } = render(<MedalBadge medal={tier} />);
      expect(screen.getByRole('img').getAttribute('aria-label')).not.toMatch(/medal/i);
      unmount();
    }
  });

  it('passes axe accessibility checks for each tier', async () => {
    for (const t of allTiers) {
      const { container, unmount } = render(<MedalBadge medal={t} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
      unmount();
    }
  });
});
