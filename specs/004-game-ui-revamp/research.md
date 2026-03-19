# Phase 0 Research: Game UI Visual Revamp

**Branch**: `004-game-ui-revamp` | **Date**: 2026-03-19
**Spec**: [spec.md](./spec.md)

---

## Topic 1: Circular SVG Progress Ring

**Decision**: `strokeDasharray` / `strokeDashoffset` technique on an SVG `<circle>` element, wrapped in a React component with the emoji/icon absolutely centered via a sibling element.

**Rationale**: Canonical CSS/SVG approach — no canvas, no external libs. Math: `circumference = 2 * Math.PI * r`, then `strokeDashoffset = circumference * (1 − progress)`. Animates smoothly with CSS `transition` on `stroke-dashoffset`. SVG attributes compose cleanly with Tailwind utility classes on the wrapper.

**Alternatives considered**:
- `conic-gradient` on a `<div>` — simpler DOM but hard to clip cleanly, poor anti-aliasing at the progress edge.
- CSS `@property` animated custom property — adds complexity, Safari support was patchy.

**Key implementation notes**:
- `<circle>` must have `strokeLinecap="round"` and `transform="rotate(-90 cx cy)"` so progress starts at 12 o'clock.
- Use `fill="none"` on both track and progress circles; track circle gets muted color (`text-farm-soil/30`).
- Wrapper pattern: outer `<div className="relative inline-flex items-center justify-center">`, `<svg>` absolutely positioned inset-0, emoji `<span>` as sibling absolutely centered. Avoids `foreignObject` (Safari quirks).
- New component: `src/components/ProgressRing.tsx`. Props: `progress: number` (0–1), `size?: number`, `strokeWidth?: number`, `children` (the emoji/icon).

---

## Topic 2: Bottom Sheet / Slide-up Drawer (mobile)

**Decision**: Fixed-position `<div>` pinned to `bottom-0 left-0 right-0`, toggled with `translate-y-full` / `translate-y-0` CSS transform. Above the `md:` breakpoint, the same component renders as a sidebar (CSS handles the switch declaratively — no JS breakpoint detection needed).

**Rationale**: Pure CSS transforms avoid layout reflow. `transition-transform duration-300 ease-in-out` gives standard bottom-sheet feel. Fixed positioning keeps it out of the stacking context of plot elements. Tailwind's `md:` prefix handles the responsive breakpoint without JS media query listeners.

**Alternatives considered**:
- Conditional rendering (`null` vs mounted) — causes layout flash and loses slide animation.
- `@radix-ui/react-dialog` — excellent but no external UI libraries allowed.

**Key implementation notes**:
- Apply `overscroll-contain` to the scrollable content inside the sheet to prevent scroll chaining.
- Backdrop: `<div className="fixed inset-0 bg-black/50 transition-opacity">` handles click-to-dismiss; toggling `opacity-0 pointer-events-none` vs `opacity-100` keeps it in DOM so transition works.
- Responsive: single component with `bottom-0 left-0 right-0 rounded-t-2xl md:right-0 md:top-0 md:left-auto md:h-full md:w-56 md:rounded-none md:translate-y-0 md:translate-x-0`.
- A shop-toggle button (e.g., "🌾 Shop") is needed in the HUD or as a floating action button on mobile to open the sheet.
- On desktop (`md:` and above), the bottom sheet is always visible as the sidebar (existing layout preserved).

---

## Topic 3: CSS Texture Without External Images

**Decision**: Layered `repeating-linear-gradient` for structural dirt pattern on the game canvas. An inline SVG `<filter>` using `feTurbulence` for grain/noise overlay. Cracked earth on exhausted plots via two angled `repeating-linear-gradient` layers.

**Rationale**: `feTurbulence` + `feColorMatrix` is the only pure CSS/SVG technique that produces convincing organic noise without an image file. Runs on GPU via SVG filter pipeline, referenced from CSS via `filter: url(#noise-id)`. Zero network requests.

**Alternatives considered**:
- `backdrop-filter: contrast() brightness()` hack — works for overlays but hard to control, clips to element bounds in some browsers.
- `box-shadow` inset stacking — only convincing for very simple geometric patterns.

**Key implementation notes**:
- The invisible `<svg>` filter definition rendered once at root (e.g., in `App.tsx`):
  `<svg className="hidden" aria-hidden="true"><defs><filter id="pp-grain">feTurbulence...</filter></defs></svg>`
  All textured elements reference it via Tailwind arbitrary value: `[filter:url(#pp-grain)]`.
- `feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3"` paired with `feColorMatrix type="saturate" values="0"` and `feBlend mode="multiply"`.
- Cracked earth: two `repeating-linear-gradient` at ~20deg and ~−30deg with narrow dark-brown lines at low opacity layered over the existing gray background.
- The farm canvas dirt texture: a `repeating-linear-gradient` with alternating dark/mid brown bands + the grain filter overlay.

---

## Topic 4: Modal Pattern in React (no library)

**Decision**: `ReactDOM.createPortal` into `document.body`. Backdrop `<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">` wraps a centered card. Escape key via `useEffect` + `addEventListener`.

**Rationale**: Portal rendering ensures the modal is never clipped by parent `overflow-hidden` or `transform` contexts (common in game UIs with plot tile animations). Z-index works reliably as a direct child of `<body>`. Backdrop div doubles as dismiss target.

**Alternatives considered**:
- Inline rendering in JSX tree — acceptable for simple cases, but game layout uses `overflow-hidden` containers that clip modal.
- `<dialog>` HTML element — `::backdrop` pseudo-element is incompatible with Tailwind utilities; polyfill surface non-trivial.

**Key implementation notes**:
- `useEffect` for Escape must return a cleanup: `return () => document.removeEventListener('keydown', handler)`.
- Click-outside dismissal: `onClick={onClose}` on backdrop, `onClick={e => e.stopPropagation()}` on inner card.
- Auto-focus the close button on mount to prevent focus remaining on background elements.
- New component: `src/components/DaySummaryModal.tsx`. Props: `log: DailyLogEntry`, `onClose: () => void`. Renders `DailyLog` inside the modal card.

---

## Dependency Audit

No new npm dependencies required. All implementation uses:
- React 18 (already installed) — `createPortal`, `useState`, `useEffect`, `useRef`
- Tailwind CSS 3 (already installed) — responsive prefixes, arbitrary values, CSS transforms
- SVG (browser native) — progress rings, grain texture filter
- Pure CSS (browser native) — gradients, box-shadow, transitions

**Decision**: Zero new dependencies. Existing setup is sufficient.
