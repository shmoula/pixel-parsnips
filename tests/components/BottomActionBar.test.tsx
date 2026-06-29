import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomActionBar } from '../../src/components/BottomActionBar';

const base = {
  onToggleShop: vi.fn(),
  onNextDay: vi.fn(),
  isProcessing: false,
  canAdvanceProductively: true,
};

describe('BottomActionBar', () => {
  it('renders the Shop and Next Day controls with onboarding anchors', () => {
    const { container } = render(<BottomActionBar {...base} />);
    expect(container.querySelector('[data-onboarding="shop-button"]')).toBeTruthy();
    expect(container.querySelector('[data-onboarding="next-day"]')).toBeTruthy();
  });

  it('calls onToggleShop and onNextDay', () => {
    const onToggleShop = vi.fn();
    const onNextDay = vi.fn();
    render(<BottomActionBar {...base} onToggleShop={onToggleShop} onNextDay={onNextDay} />);
    screen.getByRole('button', { name: /open shop/i }).click();
    expect(onToggleShop).toHaveBeenCalledOnce();
    screen.getByRole('button', { name: /advance to next day/i }).click();
    expect(onNextDay).toHaveBeenCalledOnce();
  });

  it('disables Next Day while processing', () => {
    render(<BottomActionBar {...base} isProcessing={true} />);
    expect(screen.getByRole('button', { name: /advance to next day/i })).toBeDisabled();
  });

  it('warns to plant first when advancing is unproductive', () => {
    render(<BottomActionBar {...base} canAdvanceProductively={false} />);
    expect(screen.getByRole('button', { name: /plant seeds first/i })).toBeInTheDocument();
  });
});
