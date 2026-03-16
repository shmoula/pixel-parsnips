import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BankruptcyScreen } from '../../src/components/BankruptcyScreen';

// ── T022: BankruptcyScreen smoke tests ────────────────────────────────────────

describe('BankruptcyScreen', () => {
  it('renders the days survived count', () => {
    render(
      <BankruptcyScreen daysPlayed={10} peakBalance={150} onRestart={vi.fn()} />
    );
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('renders the peak balance', () => {
    render(
      <BankruptcyScreen daysPlayed={10} peakBalance={150} onRestart={vi.fn()} />
    );
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });

  it('renders a Restart button', () => {
    render(
      <BankruptcyScreen daysPlayed={10} peakBalance={150} onRestart={vi.fn()} />
    );
    expect(
      screen.getByRole('button', { name: /restart/i })
    ).toBeInTheDocument();
  });

  it('calls onRestart when Restart button is clicked', async () => {
    const onRestart = vi.fn();
    render(
      <BankruptcyScreen daysPlayed={5} peakBalance={80} onRestart={onRestart} />
    );
    screen.getByRole('button', { name: /restart/i }).click();
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
