// Shared copy for the "advance the day" control, rendered in two places (the
// desktop HUD and the mobile BottomActionBar). Kept in one module so the label
// and visible text stay in sync across both surfaces.

/** Accessible name — must contain the visible text (axe label-content-name-mismatch). */
export function nextDayLabel(canAdvanceProductively: boolean): string {
  return canAdvanceProductively ? 'Advance to next day' : 'Skip day — nothing planted';
}

/** Visible button text. */
export function nextDayText(canAdvanceProductively: boolean): string {
  return canAdvanceProductively ? 'Next Day' : 'Skip day';
}
