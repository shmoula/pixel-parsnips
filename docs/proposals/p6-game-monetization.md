# Pixel Parsnips — Monetization Strategy Proposal

> 🗄️ **ARCHIVED / SUPERSEDED — do not implement.** Monetization is out of scope for
> this portfolio/hobby project (backlog decision 2026-07-21; see [backlog.md](../../backlog.md)
> "Backlog — Monetization"). This document is retained as a historical design record only.
> The rollout sequencing ("Now / Next / Later") and the localStorage persistence mitigations
> below reflect that superseded intent and must **not** be read as an active implementation
> plan — in particular, any real-money entitlement would require server-side purchase
> verification, which this proposal does not provide.
>
> *Authored by the Game Economy Architect role. Grounded in ethical F2P principles,
> browser-native constraints, and the specific risk/reward structure of Pixel Parsnips.*

---

## Context & Constraints

Before proposing strategies, two facts about Pixel Parsnips shape every recommendation:

1. **Browser-native, no backend.** State lives in `localStorage`. Any purchase that grants
   in-game benefit must handle the reality that localStorage can be cleared — meaning the
   player loses their "purchased advantage." This makes server-validated currency (the gold
   standard per `validations.md`) a prerequisite for any real-money gameplay advantage. It also
   means cosmetic-first monetization is lower-risk technically and ethically.

2. **Roguelite structure with a hard fail state.** Runs end at bankruptcy. This is both the
   game's greatest retention asset *and* its best monetization moment — the bankruptcy screen
   is a natural, non-intrusive inflection point. Interrupting *live* gameplay with purchase
   prompts would violate the anti-pattern `aggressive-popup` and damage the tension the game
   is built on.

---

## Strategy 1 — Rewarded Ads on the Bankruptcy Screen

**Model:** Ad revenue (rewarded video)
**Effort:** Low
**Risk:** Very low

### How It Works

At the run-end bankruptcy screen — after the player has seen their run summary (days survived,
peak balance) — offer a single, optional rewarded ad:

> *"Watch a short ad to start your next run with 125 coins instead of 100."*

The offer appears as a secondary button. The primary action is always "Start New Run" for free
at 100 coins. No purchase prompt interrupts active gameplay.

### Why It Fits

The bankruptcy screen is already the game's emotional reset point. The player just lost — they
are in "one-more-try" mode and most receptive to any offer that gives them a slight edge.
A 25-coin head start (~2 extra turns of land lease buffer) is a meaningful but non-decisive
advantage: it doesn't trivialise the game, it just reduces the most punishing early-game
variance.

A secondary variant: a "Weather Forecast" ad reward — watching an ad before pressing "Next Day"
reveals tomorrow's weather category (Positive / Neutral / Negative / Disaster) without
specifying the exact event. This sells *information*, not power.

### Sharp Edges

- **Never** force an ad before a run starts or mid-gameplay. Only the bankruptcy screen.
- Limit to one ad offer per bankruptcy (not per session). Repeated prompts on the same screen
  are the same as an aggressive popup.
- Cap the coin bonus so it cannot compound: the ad reward applies only to the starting balance,
  not to an already-in-progress run.

### Revenue Model

Rewarded video CPMs on browser games typically run $2–8 USD per 1,000 impressions depending on
geo and ad network. With 15–20% of bankruptcy-screen players watching (industry baseline for
opt-in rewarded ads), a daily active base of 1,000 players could yield $30–160/day with no
infrastructure investment beyond ad SDK integration.

---

## Strategy 2 — Cosmetic Farm Themes ("Seasonal Harvests")

**Model:** Direct cosmetic IAP, $1.99–$3.99 per theme
**Effort:** Medium
**Risk:** Low (zero gameplay impact)

### How It Works

Sell visual reskins of the entire farm — crop sprites, plot textures, HUD colour scheme, Day
Summary modal art direction — as standalone theme packs. No gameplay numbers change. A Pumpkin
in the "Haunted Harvest" theme is still 20 coins, 3 days, 65 yield.

**Proposed themes:**

| Theme | Visual Direction | Price |
|---|---|---|
| Classic (included) | Current parchment/wood aesthetic | Free |
| Haunted Harvest | Halloween: skull plots, ghost crops, purple HUD | $1.99 |
| Winter Solstice | Snow-covered soil, frosted crops, icy blue palette | $1.99 |
| Desert Oasis | Sand plots, cactus-inspired crops, amber tones | $1.99 |
| Neon Future | Synthwave grid, glowing progress rings, dark UI | $3.99 |

### Value Anchoring

Price the entry theme at $1.99 so the first purchase is low-friction (addresses
`first-purchase-friction` sharp edge). The Neon Future theme at $3.99 acts as an anchor —
it makes $1.99 feel like a no-brainer. A bundle of all four paid themes at $7.99 ("Full
Harvest Bundle") provides a "Best Value" option per the `value-anchoring` pattern.

### Persistence Problem & Solution

Since Pixel Parsnips uses localStorage, a theme purchase could be lost if the player clears
storage. Two mitigations:

1. **Email/code delivery:** After purchase via Stripe, email the player a redemption code they
   can re-enter. Codes are hashed and validated client-side. Simple, no full backend required.
2. **"Restore Purchases" flow:** A one-click flow where the player re-enters their email to
   re-apply purchased themes.

Neither solution is as robust as server-side accounts, but both prevent the most common
accidental-loss scenario (browser cache clear) while avoiding full backend complexity at this
stage.

> ⚠️ **Superseded — not an implementation plan.** Client-side code hashing and email-only
> "restore" cannot prove purchase ownership and are trivially bypassed; they were never built.
> Any real entitlement would require server-side purchase verification with revocation/chargeback
> handling. Kept here only to record the design's known weakness.

### Sharp Edges

- Themes must be **purely cosmetic**. No theme may provide information advantages (e.g., no
  theme with higher-contrast "Ready to Harvest" indicators that are meaningfully easier to spot).
- Never call a theme "Limited Edition" unless it is genuinely time-limited and will not return.
  Per `artificial-scarcity-backfire`: if it returns seasonally, call it "Seasonal." Be explicit.
- Show the real price in local currency alongside any gem/coin representation if a dual currency
  is ever introduced.

---

## Strategy 3 — Content Expansion DLC ("Root Vegetable Season")

**Model:** One-time paid content unlock, $2.99
**Effort:** High (requires new game content)
**Risk:** Medium (requires design and balance work)

### How It Works

Sell a content expansion that adds genuine new gameplay depth behind a paywall. The core game
remains complete and fully playable for free. The expansion adds a second "Season" mode with:

- **3 new crops** (Turnip, Beetroot, Leek) with different growth profiles and risk/reward ratios
- **2 new weather events** (Early Frost: delays harvest by 1 day / Bumper Crop: +0.3 yield
  bonus to all mature plots this turn)
- **Extended plot grid** (16 plots instead of 12 — the additional 4 are only accessible in
  expansion mode)
- **"Prestige" run modifier:** start a run with 75 coins instead of 100, but with a 1.5×
  score multiplier — for players who want a harder challenge

### Why This Model Works Here

Pixel Parsnips already follows the "complete experience at no cost" philosophy inherent to
its tycoon identity. An expansion DLC respects that contract: free players get the full game.
Paying players get *more game*, not an easier game. This avoids the `pay-to-win-backlash`
sharp edge entirely — the expansion adds difficulty variants and content breadth, not power.

The price point ($2.99) is positioned to convert the segment of players who have survived
30+ days and exhausted the current content ceiling — they are the most engaged and the most
likely to pay for more depth.

### Sharp Edges

- The expansion content must add difficulty and complexity, not reduce it. "Prestige mode
  at 75 coins" is an example of *harder* paid content — the inverse of pay-to-win.
- New crops in the expansion should be balanced against existing crops, not strictly better.
  A Leek that outperforms a Pumpkin in all metrics would be a subtle pay-to-win.
- Consider offering expansion crops as a free "demo" for the first 5 days of play to let
  players evaluate the content before purchasing.

---

## Strategy 4 — "Founder's Edition" Starter Pack (One-Time, Time-Limited)

**Model:** First-purchase conversion, $0.99, available for the first 7 days of play
**Effort:** Low
**Risk:** Very low

### How It Works

A single, one-time-per-account offer shown subtly (corner of the bankruptcy screen or the shop
sidebar) for the player's first 7 calendar days. After 7 days, the offer disappears permanently.

**Contents ($0.99):**

- The "Haunted Harvest" cosmetic theme (or one theme of the player's choice)
- A "Founder" badge visible on the run summary screen (Days Survived + Peak Balance +
  Founder badge)
- A "Parsnip Gold" HUD colour variant (gold coin icon styling)

**What it does NOT include:** any additional starting coins, extra plots, seed discounts, or
any mechanic that would change the game's balance. This is cosmetics only.

### Why This Is the First Purchase

Per the `first-purchase-friction` sharp edge, converting a free player to a payer is the
hardest step in monetization — and it multiplies future purchase likelihood by 10–100×.
The $0.99 price removes financial risk. The exclusive Founder badge creates genuine scarcity
(early adopters only) without false urgency. The 7-day window is honest: the badge is
genuinely tied to early-access participation.

### Value Anchoring in Context

The Founder's Pack at $0.99 makes the $1.99 theme packs look more reasonable to someone who
has already made a small commitment. First purchase → second purchase friction drops
dramatically.

### Sharp Edges

- Offer must be shown **non-intrusively**: a subtle banner on the bankruptcy screen or a small
  badge on the shop sidebar. Never a modal that blocks gameplay access.
- The "Founder" badge must clearly communicate what it means (early supporter recognition,
  not a gameplay stat). Do not imply it confers any mechanical advantage.
- If an account system is added later, the Founder status must migrate with the player —
  do not let localStorage loss erase a purchased badge.

---

## Strategy 5 — "Almanac Plus" Subscription (Future)

**Model:** Optional subscription, $1.99/month
**Effort:** High (requires backend, account system)
**Risk:** Medium — subscription fatigue is real; only viable with genuine recurring value

### How It Works

A lightweight subscription for players who play Pixel Parsnips habitually:

- **Monthly exclusive theme** (seasonal, returns annually — not "limited")
- **Enhanced run history:** last 10 run summaries stored server-side (vs. only the last run
  in localStorage)
- **Global leaderboard access:** days survived leaderboard with weekly resets
- **Subscriber badge** on the run summary
- **One free "Weather Forecast" per run** (as described in Strategy 1 — reveals tomorrow's
  weather category)

### What It Does NOT Include

No additional starting coins, no plot count changes, no seed discounts. The competitive
leaderboard is accessible to subscribers and shows all players (subscribers compete against
non-subscribers fairly; subscribers simply see the board).

### Prerequisites

This strategy **requires a backend and account system** to be viable. Subscriptions based on
localStorage are not reliable — a player can clear their browser and lose their subscription
state with no recourse. Do not launch a subscription without:

1. Server-side receipt validation (addresses `unvalidated-purchase` validation)
2. Server-side currency/state persistence (addresses `client-side-currency` validation)
3. A clear account creation / restore flow

Attempting this without backend infrastructure would create a support nightmare and chargeback
risk (`refund-chargeback-spiral` sharp edge).

### Pricing Rationale

$1.99/month sits in the "considered but low-friction" tier — equivalent to a coffee. It must
deliver $5+ in perceived monthly value (per the `progression-pacing` pattern: 2–3× price in
perceived value). The monthly theme alone must feel worth $2 to the player; the leaderboard
and history are the reasons to maintain the subscription.

---

## Recommended Rollout Sequence

> 🗄️ **Historical sequencing — superseded.** The "Now / Next / Later / Future" phases below
> describe the *original* proposed ordering; none of it is scheduled. Monetization is out of
> scope (see the banner at the top of this file and the "do not build" note in
> [backlog.md](../../backlog.md)). Read the table as a design record, not a plan.

| Phase | Strategy | Why First |
|---|---|---|
| **Now** | Strategy 1 — Rewarded Ads | Zero backend, immediate revenue, no P2W risk |
| **Now** | Strategy 4 — Founder's Pack | Low effort, converts early adopters, enables Strategy 2 |
| **Next** | Strategy 2 — Cosmetic Themes | Builds on first-purchase conversion, no new content required |
| **Later** | Strategy 3 — Content DLC | Highest revenue potential, highest effort — do after retention is proven |
| **Future** | Strategy 5 — Subscription | Only when backend/accounts are ready |

---

## Economy Health Checklist

Since Pixel Parsnips has an in-game coin economy (soft currency), any monetization that
introduces hard currency or purchased items must respect the existing sink-source balance:

- [ ] New currency sources (ad bonuses, starter coin bonuses) have matching sinks (land lease, tax)
- [ ] No purchase allows bypassing the bankruptcy mechanic
- [ ] All economy values (crop prices, lease fees) remain in the game code, not fetched from
  server — acceptable at this stage since there is no premium currency layer yet
- [ ] If dual currency is ever introduced: never allow soft→hard conversion
  (per `dual-currency-system` pattern)
- [ ] If hard currency is introduced: show real currency equivalent on every display
  (addresses `hidden-real-price` validation)

---

## Risks to Monitor

| Risk | Severity | Mitigation |
|---|---|---|
| LocalStorage loss invalidates purchases | High | Email code redemption / restore flow (Strategies 2 & 4) |
| Rewarded ad SDK slows page load | Medium | Lazy-load ad SDK only on bankruptcy screen |
| Cosmetic themes break accessibility (contrast) | Medium | Test all themes against WCAG AA contrast ratios |
| Expansion crops perceived as P2W | Medium | Strictly harder or lateral, never strictly better |
| Subscription with no backend = churn + chargebacks | Critical | Do not launch Strategy 5 without full backend |

---

*Pixel Parsnips Monetization Strategy v1.0 — April 2026*
*Grounded in: game-monetization patterns.md, sharp_edges.md, validations.md*
