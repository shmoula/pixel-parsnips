import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreditsModal } from '../../src/components/CreditsModal';

afterEach(cleanup);

describe('CreditsModal', () => {
  it('credits the LPC crop authors and links back to the source', () => {
    render(<CreditsModal onClose={() => {}} />);
    expect(screen.getByText(/bluecarrot16/)).toBeInTheDocument();
    expect(screen.getByText(/Daniel Eddeland/)).toBeInTheDocument();
    expect(screen.getByText(/Joshua Taylor/)).toBeInTheDocument();
    expect(screen.getByText(/Richard Kettering/)).toBeInTheDocument();
    expect(screen.getByText(/CC-BY-SA 3\.0\+/)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /opengameart\.org/i });
    expect(link).toHaveAttribute('href', 'https://opengameart.org/content/lpc-crops');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('credits the original art, the font and the audio', () => {
    render(<CreditsModal onClose={() => {}} />);
    expect(screen.getByText(/Original work by Vaclav Balak/i)).toBeInTheDocument();
    expect(screen.getByText(/Press Start 2P/)).toBeInTheDocument();
    expect(screen.getByText(/SIL Open Font License/i)).toBeInTheDocument();
    expect(screen.getByText(/Synthesised in-browser/i)).toBeInTheDocument();
  });

  it('is a labelled modal dialog', () => {
    render(<CreditsModal onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: /credits/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on the Close button and on Escape', async () => {
    const onClose = vi.fn();
    render(<CreditsModal onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('moves focus to the Close button on mount', () => {
    render(<CreditsModal onClose={() => {}} />);
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<CreditsModal onClose={() => {}} />);
    // @ts-expect-error matcher registered in tests/setup.ts
    expect(await import('vitest-axe').then((m) => m.axe(container))).toHaveNoViolations();
  });
});
