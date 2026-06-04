import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { MedalBadge } from '../../src/components/MedalBadge';

describe('MedalBadge', () => {
  const allTiers = ['none', 'bronze', 'silver', 'gold', 'platinum'] as const;
  const namedTiers = ['bronze', 'silver', 'gold', 'platinum'] as const;

  it.each(namedTiers)('renders %s tier with label and tagline', (tier) => {
    render(<MedalBadge medal={tier} />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', expect.stringMatching(new RegExp(tier, 'i')));
  });

  it('uses the "No medal — keep going" aria-label for none', () => {
    render(<MedalBadge medal="none" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'No medal — keep going');
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
