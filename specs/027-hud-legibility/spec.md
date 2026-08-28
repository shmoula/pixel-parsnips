# 027 — HUD Legibility

**Status:** Draft · **Date:** 2026-08-27 · **Effort:** S–M
**Backlog items:** F7 (mobile lease visibility) + "simplification and unification" (2026-08-26 review)

---

## Problem

Three findings, one surface.

1. **The reputation chip restates the day counter.** `getReputationTier(currentDay)` maps
   days to a cosmetic title. The day counter is already the largest element in the HUD, so
   the title is a derived re-encoding, not additional information. It changes no player
   decision and occupies a chip slot at every width.

2. **Two ladders name the same axis.** Reputation (7 tiers, by day) and Medal (5 tiers, by
   `seasonReached`) measure the same run progression on two surfaces. They agree at days 21
   and 41, **disagree at day 61** — the medal steps silver→gold while reputation does not
   move for 40 days — and reputation carries four extra steps inside season 1.

   | Days | Season | Reputation | Medal |
   |---|---|---|---|
   | 1–3 / 4–7 / 8–13 / 14–20 | S1 | 4 distinct tiers | none |
   | 21–40 | S2 | Respected Agronomist | bronze |
   | 41–60 | S3 | Master of the Harvest | silver |
   | 61–80 | S4 | *(no change)* | **gold** |
   | 81+ | endless | Legendary Cultivator | platinum |

3. **Lease is invisible below 640px.** `season.leasePerDay` renders in exactly one place in
   the whole in-run UI — [`HUD.tsx:231`](../../src/components/HUD.tsx), inside a
   `hidden sm:flex` wrapper. Mobile players cannot see the per-day cost before advancing.

## Goals

- Remove the reputation chip from the HUD.
- Collapse the reputation ladder into the medal so one ladder names run progression.
- Surface the per-day lease at every width, without adding a HUD row.

## Non-goals

- No engine, `SCHEMA_VERSION`, save-migration, or simulator change. Presentation only.
- No change to `deriveMedal` or to the `run_ended` analytics payload.
- No art or palette work — that is 028.
- Two-row mobile HUD at 360px. See "Measured constraints" — unreachable without shrinking
  the balance chip, logged to the backlog instead.

---

## A. Retire the reputation ladder

**Delete** `src/engine/reputation.ts` and `tests/engine/reputation.test.ts`.

**Re-author** `MEDAL_LABELS` in [`src/engine/medals.ts`](../../src/engine/medals.ts). The
reputation titles become the medal's names; the ladder collapses 7 tiers → 5.

| Medal | Was | Becomes |
|---|---|---|
| `none` (died in S1) | "No Medal" | Struggling Smallholder |
| `bronze` (reached S2) | "Bronze" | Apprentice Farmer |
| `silver` (reached S3) | "Silver" | Seasoned Grower |
| `gold` (reached S4) | "Gold" | Respected Agronomist |
| `platinum` (won) | "Platinum" | Legendary Cultivator |

Two authored names are dropped by the 7→5 collapse: **Hopeful Homesteader** and **Master of
the Harvest**. This is a deliberate content call, not an oversight — the surviving five read
as a single competence progression.

`MEDAL_TAGLINES` is **unchanged**; it still supplies the badge's second line
("Survived Summer Heat", etc.).

**`MedalBadge.tsx`** — the aria-label template `` `${label} medal — ${tagline}` `` would now
read "Seasoned Grower medal", which is wrong. Change it to `` `${label} — ${tagline}` `` and
drop the special-case `none` branch (it becomes "Struggling Smallholder — Keep going").

`deriveMedal` is untouched. The `run_ended` analytics prop carries tier *ids*
(`'silver'`), not labels, so the analytics contract is unaffected.

## B. Remove the HUD chip

From [`HUD.tsx`](../../src/components/HUD.tsx), remove: the `reputation` import, the
`getReputationTier` call, the `repExpanded` state, `getRepTitleClass`, and the reputation
`ExpandableChip` block. `ExpandableChip` itself stays — the season chip still uses it.

Test updates:
- `tests/components/HUD.test.tsx` — delete the `HUD — reputation chip` describe block;
  narrow the sm+ assertion at ~line 251 to the season chip only.
- `tests/components/MedalBadge.test.tsx` — update expected labels.
- `tests/engine/medals.test.ts` — update expected labels.

## C. Daily ledger chip (F7) + streak flame

> **Revised after playtest — see "As-built measurement".** This section was authored around
> a *merged* chip carrying lease and the streak bonus together. The merge shipped, was
> rejected on look, and the streak moved to a pulsing 🔥 on the day counter (`StreakFlame`).
> The lease half below is what stands; the streak-bonus half is superseded, and the mobile
> lease reads `−15/d`, not `−15/day`. The reasoning is kept because it is why the flame
> carries no digits: the merge failed on width, not on principle.

Replace **both** the standalone streak chip and the `hidden sm:flex` lease wrapper with one
chip in the header's `contents` group.

The merge was argued from unit: both halves are **coins per day**. Lease is a certain
`−N/day`; the streak bonus is `min(harvestStreak, 4) × 5`, applied **once per day** on any
harvest day (see `computeStreakUpdate` in `gameEngine.ts`), not per harvest. That argument
held arithmetically and failed on reading: two numbers in one chip parse as one figure.

**Content**

As shipped (the streak no longer appears in this chip at all):

| State | Mobile (<sm) | sm+ |
|---|---|---|
| any streak | `−15/d` | `Lease 15🪙/day` |
| season's last day | *(no preview)* | append `(rises to 22 next season)` |

The sm+ form keeps the word "Lease" and the coin glyph — the 81px budget binds the mobile
form only, and desktop has room to spare. The end-of-season preview stays sm+-only, exactly
as today; it has never rendered below 640px.

The `/day` suffix degrades to `/d` on mobile — a deliberate graceful-degradation step that
pays for the flame's 19px on the day chip (see "As-built measurement"). The `title` and
`aria-label` carry the full meaning at all widths and never change form.

**Colour** — the cost text is `parchment/70` on `chip`, measured **7.06:1**, and the
end-of-season preview is `gold/70` on `chip`, **5.47:1**. (The `gold` bonus half this
section originally specified no longer renders, so its `ledger bonus` row was retired from
`palette.contrast.test.ts`; plain `gold` on `chip` is still gated by the `gold value` row.)

> **The lease may not use `farm-stone` inside a chip.** Measured: `stone` on `bar` = 4.529
> (passes, by 0.029); `stone` on `chip` = **3.751 (fails AA)**. Moving the text into a chip
> changes its background, so the foreground must change with it.

**Contrast-test change** — the `lease readout` row (`stone` on `bar`) must be retired from
`PAIRS` and replaced with the new chip's pairs. `HUD.tsx:230` is the only `farm-stone`-on-
`bar` surface in the codebase, so the combination stops rendering. This satisfies the file's
own rule: *"A row may only change in the same commit that changes the component it mirrors."*

**Streak count is not shown** — `−15·×6+20` measures 97px and costs a HUD row. This
constraint outlived the merge: `StreakFlame` shows no digits either, and puts the count and
the bonus in its tooltip instead. `peakHarvestStreak` still surfaces at run end as
"Longest streak".

---

## Measured constraints

Measured in-browser against the running app. Worst-case contract text (`10/10 · 12d`),
which is the widest state the HUD reaches.

Chip widths at 375px:

| Content | Width |
|---|---|
| `−15/d` | 61 |
| `−15+15` | 73 |
| `−15/day` | 77 |
| `−15·+15` | **81** |
| `−15🔥+15` | 83 |
| `−15🪙/day` | 87 |
| `🪙−15+15` | 90 |
| `−15·×6+20` | 97 |

Resulting HUD rows at 375px:

| Arrangement | Rows |
|---|---|
| **Today** (rep + streak + contract) | **3** |
| Separate lease chip + separate streak chip | 3 |
| Merged with emoji (`−15🔥+15`, 83px) | 3 |
| **Merged, emoji-free (`−15·+15`, 81px)** | **2** |

**Budget: the chip's mobile form must stay ≤ 81px.** Any emoji inside it costs ~10px, which
costs an entire HUD row. This binds the `<sm` form only — the sm+ form has room to spare and
keeps its coin glyphs. It is the binding constraint on section C and any future edit to it.

**360px is 3 rows regardless**, today included — the season chip (94px) and balance chip
(151px) consume 245 of the 328px available, and the balance chip is wide because of its
`Goal 105·D20` caption. That chip is the real lever for mobile HUD density and is logged to
the backlog as a separate item, not fixed here.

### As-built measurement

Measured in-browser at 375px (mobile preset) with the worst-case contract probe
(`10/10 · 12d`) in the header, against a real save seeded to a live 3-day streak.

**Revision — the streak left the ledger chip.** Playtesting rejected the merged form: a
streak reads as a state you either hold or have lost, not a figure to parse, and the
`+15` half made the chip two numbers wide. The streak is now a pulsing 🔥 on the day
counter it accrues against (`StreakFlame`), and the ledger is a single figure again.

That flame costs 19px of the day chip (94px → 113px), which the first row could not
absorb. Measured: shrinking the flame does **not** pay for it — even a 10px glyph still
wraps to a third row. The lever is the lease suffix, so the mobile form reads `−15/d`
(61px) rather than `−15/day` (77px). The sm+ form is unchanged (`Lease 15🪙/day`).

| Metric | Budget | Measured |
|---|---|---|
| Day chip width, no streak, 375px | — | 94px |
| Day chip width, live streak (flame), 375px | — | 113px |
| Ledger chip width (`−15/d`), 375px | ≤ 81px | 61px |
| Header rows, live streak + worst-case contract, 375px | 2 | 2 |

Rejected variants, all still 3 rows at 375px: flame at `text-body`/`gap-1` (109px day
chip) and at `text-caption`/`gap-0.5` (106px) while keeping `−15/day`.

---

## Verification

- `npm test && npm run lint` green.
- `tests/palette.contrast.test.ts` green with the amended `PAIRS`.
- Width budget: a **documented browser check** that the ledger chip renders in 2 rows at
  375px with a live streak and a worst-case contract. This cannot be a unit test — jsdom has
  no layout engine, so `getBoundingClientRect` returns zeroes and no wrap can be observed.
  Record the measured chip width alongside the 81px budget so a future regression is legible.
- **Real-device check on a physical phone** at 375px — the HUD at day 1, with a streak live,
  and with a streak + contract live. This is an explicit acceptance step, not a proxy for
  the emulated viewport.
- Bankruptcy screen shows the new medal names at each tier.

## Backlog updates on ship

- **F7** — closed by section C.
- **G13** (011 Farm Reputation Tier) — record that its HUD chip was retired by 027 and its
  ladder folded into the medal. The feature is superseded, not reverted.
- **New item** — mobile HUD density at ≤360px; the balance chip caption is the lever.
- **028 cross-spec note** — `stone` on `bar` currently passes at **4.529**, a 0.029 margin.
  The palette lift will lighten `bar` and break any remaining pair on it. 028 must re-derive
  its contrast pairs rather than eyeball them.
