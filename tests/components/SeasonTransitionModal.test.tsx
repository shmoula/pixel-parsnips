import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeasonTransitionModal } from '../../src/components/SeasonTransitionModal';
import { getSeasonForDay } from '../../src/engine/seasons';

describe('SeasonTransitionModal — passed variant', () => {
  it('shows "Season 1 — Complete" with next-season preview', () => {
    render(
      <SeasonTransitionModal
        variant="passed"
        currentDay={20}
        coinBalance={200}
        peakBalance={250}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    expect(screen.getByText(/Season 1 — Complete/i)).toBeInTheDocument();
    expect(screen.getByText(/Summer Heat/i)).toBeInTheDocument();
    expect(screen.getByText(/rises to 20\/day/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Begin Season 2/i })).toBeInTheDocument();
  });

  it('"Begin Season N+1" button calls onContinue', () => {
    const onContinue = vi.fn();
    render(
      <SeasonTransitionModal
        variant="passed"
        currentDay={20}
        coinBalance={200}
        peakBalance={250}
        onContinue={onContinue}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Begin Season 2/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});

describe('SeasonTransitionModal — failed variant', () => {
  it('shows "X coins short" when gap is between 1% and 50%', () => {
    // Target 150, balance 138 → 12 coins short, gap 8% < 50%
    render(
      <SeasonTransitionModal
        variant="failed"
        currentDay={20}
        coinBalance={138}
        peakBalance={150}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    expect(screen.getByText(/12 coins short/i)).toBeInTheDocument();
  });

  it('suppresses "X coins short" when gap exceeds 50%', () => {
    // Target 150, balance 30 → 120 short, gap 80% — suppress
    render(
      <SeasonTransitionModal
        variant="failed"
        currentDay={20}
        coinBalance={30}
        peakBalance={50}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    expect(screen.queryByText(/coins short/i)).not.toBeInTheDocument();
  });

  it('"Start New Run" calls onRestart', () => {
    const onRestart = vi.fn();
    render(
      <SeasonTransitionModal
        variant="failed"
        currentDay={20}
        coinBalance={138}
        peakBalance={150}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={onRestart}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Start New Run/i }));
    expect(onRestart).toHaveBeenCalledOnce();
  });
});

describe('SeasonTransitionModal — victory variant', () => {
  it('shows VICTORY headline with End Run and Continue buttons', () => {
    render(
      <SeasonTransitionModal
        variant="victory"
        currentDay={80}
        coinBalance={700}
        peakBalance={891}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    expect(screen.getByText(/VICTORY/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /End Run Here/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue/i })).toBeInTheDocument();
  });

  it('"End Run Here" calls onEndRun', () => {
    const onEndRun = vi.fn();
    render(
      <SeasonTransitionModal
        variant="victory"
        currentDay={80}
        coinBalance={700}
        peakBalance={891}
        onContinue={vi.fn()}
        onEndRun={onEndRun}
        onRestart={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /End Run Here/i }));
    expect(onEndRun).toHaveBeenCalledOnce();
  });

  it('"Continue" calls onContinue (which the parent uses to flip endlessMode)', () => {
    const onContinue = vi.fn();
    render(
      <SeasonTransitionModal
        variant="victory"
        currentDay={80}
        coinBalance={700}
        peakBalance={891}
        onContinue={onContinue}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('shows dynamic season target instead of hardcoded 600', () => {
    // Season 4 ends at day 80, target is 600
    const season4 = getSeasonForDay(80);
    render(
      <SeasonTransitionModal
        variant="victory"
        currentDay={80}
        coinBalance={700}
        peakBalance={891}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    expect(screen.getByText(new RegExp(`/ ${season4.target} target`))).toBeInTheDocument();
  });
});

describe('SeasonTransitionModal — Escape key handling', () => {
  it('passed variant: Escape calls onContinue', () => {
    const onContinue = vi.fn();
    render(
      <SeasonTransitionModal
        variant="passed"
        currentDay={20}
        coinBalance={200}
        peakBalance={250}
        onContinue={onContinue}
        onEndRun={vi.fn()}
        onRestart={vi.fn()}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('failed variant: Escape calls onRestart', () => {
    const onRestart = vi.fn();
    render(
      <SeasonTransitionModal
        variant="failed"
        currentDay={20}
        coinBalance={50}
        peakBalance={80}
        onContinue={vi.fn()}
        onEndRun={vi.fn()}
        onRestart={onRestart}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onRestart).toHaveBeenCalledOnce();
  });

  it('victory variant: Escape calls onEndRun (safe choice)', () => {
    const onEndRun = vi.fn();
    render(
      <SeasonTransitionModal
        variant="victory"
        currentDay={80}
        coinBalance={700}
        peakBalance={891}
        onContinue={vi.fn()}
        onEndRun={onEndRun}
        onRestart={vi.fn()}
      />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEndRun).toHaveBeenCalledOnce();
  });
});
