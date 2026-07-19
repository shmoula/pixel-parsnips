import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MuteToggle } from '../../src/components/MuteToggle';
import { AUDIO_KEY, isMuted } from '../../src/audio/sfx';

beforeEach(() => {
  localStorage.clear();
});

describe('MuteToggle', () => {
  it('renders unmuted by default with aria-pressed=false', () => {
    render(<MuteToggle />);
    const btn = screen.getByRole('button', { name: /mute sound effects/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveTextContent('🔊');
  });

  it('toggles to muted on click and persists', () => {
    render(<MuteToggle />);
    const btn = screen.getByRole('button', { name: /mute sound effects/i });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveTextContent('🔇');
    expect(isMuted()).toBe(true);
    expect(JSON.parse(localStorage.getItem(AUDIO_KEY)!)).toEqual({ schemaVersion: 1, muted: true });
  });

  it('initializes from the persisted value on a fresh mount', () => {
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ schemaVersion: 1, muted: true }));
    render(<MuteToggle />);
    expect(screen.getByRole('button', { name: /mute sound effects/i }))
      .toHaveAttribute('aria-pressed', 'true');
  });
});
