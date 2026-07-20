import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Shop } from '../../src/components/Shop';
import { BUILDING_DEFINITIONS } from '../../src/engine/constants';
import type { BuildingCardData } from '../../src/engine/useGameEngine';

function shopProps(buildingCards: BuildingCardData[]) {
  return {
    coinBalance: 500,
    seedInventory: { radish: 0, parsnip: 0, pumpkin: 0 },
    fertilizerInventory: 0,
    selectedCrop: null,
    getSeedPrice: () => 5,
    seedYieldMultiplier: 1,
    onBuySeed: vi.fn(),
    onSelectCrop: vi.fn(),
    onBuyFertilizer: vi.fn(),
    marketActive: null,
    buildingCards,
    onBuyBuilding: vi.fn(),
  };
}

const cards = (season: number): BuildingCardData[] =>
  BUILDING_DEFINITIONS.map(def => ({ def, owned: false, unlocked: season >= def.unlockSeason }));

describe('Shop — buildings shelf (019)', () => {
  it('season 1: shows the toolshed and one teaser cell, no gated buildings', () => {
    render(<Shop {...shopProps(cards(1))} />);
    expect(screen.getByText('Toolshed')).toBeInTheDocument();
    expect(screen.getByText(/New buildings unlock in Season 2/)).toBeInTheDocument();
    expect(screen.queryByText('Scarecrow')).toBeNull();
  });

  it('season 2: shows all five, teaser gone', () => {
    render(<Shop {...shopProps(cards(2))} />);
    expect(screen.getByText('Scarecrow')).toBeInTheDocument();
    expect(screen.queryByText(/New buildings unlock/)).toBeNull();
  });

  it('owned buildings stay on the Buildings shelf, swapped to the owned variant', () => {
    const owned = cards(2).map(c => (c.def.id === 'toolshed' ? { ...c, owned: true } : c));
    render(<Shop {...shopProps(owned)} />);
    const shelf = screen.getByLabelText('Buildings');
    expect(shelf).toContainElement(screen.getByText('Toolshed'));
    // The owned variant drops the buy button; the still-purchasable Scarecrow keeps one.
    expect(screen.queryByLabelText(/Buy Toolshed/)).toBeNull();
    expect(screen.getByLabelText(/Buy Scarecrow/)).toBeInTheDocument();
  });

  it('keeps the shelf visible with owned cards when everything is owned', () => {
    const allOwned = cards(2).map(c => ({ ...c, owned: true }));
    render(<Shop {...shopProps(allOwned)} />);
    const shelf = screen.getByLabelText('Buildings');
    for (const def of BUILDING_DEFINITIONS) {
      expect(shelf).toContainElement(screen.getByText(def.name));
    }
    // Nothing left to purchase, so no building buy buttons remain on the shelf.
    expect(within(shelf).queryByLabelText(/^Buy /)).toBeNull();
  });
});
