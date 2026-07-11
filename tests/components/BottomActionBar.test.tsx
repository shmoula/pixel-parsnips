import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomActionBar } from '../../src/components/BottomActionBar';

const base = {
  onOpenShop: vi.fn(),
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

  it('calls onOpenShop and onNextDay', () => {
    const onOpenShop = vi.fn();
    const onNextDay = vi.fn();
    render(<BottomActionBar {...base} onOpenShop={onOpenShop} onNextDay={onNextDay} />);
    screen.getByRole('button', { name: /open shop/i }).click();
    expect(onOpenShop).toHaveBeenCalledOnce();
    screen.getByRole('button', { name: /advance to next day/i }).click();
    expect(onNextDay).toHaveBeenCalledOnce();
  });

  it('disables Next Day while processing', () => {
    render(<BottomActionBar {...base} isProcessing={true} />);
    expect(screen.getByRole('button', { name: /advance to next day/i })).toBeDisabled();
  });

  it('shows skip day when advancing is unproductive', () => {
    render(<BottomActionBar {...base} canAdvanceProductively={false} />);
    expect(screen.getByRole('button', { name: /skip day/i })).toBeInTheDocument();
  });

  it('renders nothing when hidden', () => {
    const { container } = render(<BottomActionBar {...base} hidden={true} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('button', { name: /open shop/i })).not.toBeInTheDocument();
  });

  it('labels the advance control "Skip day" when nothing is planted (017 FR-018)', () => {
    render(<BottomActionBar {...base} canAdvanceProductively={false} />);
    expect(screen.getByRole('button', { name: /skip day — nothing planted/i })).toHaveTextContent(/skip day/i);
    expect(screen.queryByText(/plant seeds first/i)).toBeNull();
  });
});
