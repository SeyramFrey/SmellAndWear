# Spec: Topbar Transparent/Scroll Behavior, Theme Tokens & Product Card Price Cleanup

**Date:** 2026-03-22
**Branch:** claude/happy-kare
**Status:** Approved — ready for implementation

---

## Overview

This spec covers four coordinated changes:

1. **Topbar scroll behavior** — transparent by default on desktop, solid on scroll (theme-aware)
2. **Design token cleanup** — replace all hardcoded colors in affected SCSS with `var(--sw-*)` tokens
3. **Logo vertical offset** — move logo down 0.3 rem cleanly via token
4. **Product card price token compliance** — replace the one remaining hardcoded price color with a semantic token
5. **Cursor rule** — enforce no-hardcoded-colors across the app via a `.cursor/rules` file

**Approach chosen:** Pure CSS/SCSS using existing `.scrolled` class and `[data-bs-theme]` attribute as selectors. No new Angular state.

---

## Section 1 — Token Updates (`_theme-variables.scss`)

### 1a. New tokens in `:root` (light mode)

```scss
// Topbar
--sw-topbar-bg-default: transparent;      // explicit transparent default (desktop)
--sw-topbar-logo-offset: 0.3rem;          // logo vertical nudge

// Product card pricing
--sw-price-discount: var(--sw-primary);   // discounted price color (light = brand red)
```

### 1b. Updates in `[data-bs-theme="dark"]` block

```scss
// Topbar
--sw-topbar-bg-default: transparent;      // same value, both modes
--sw-topbar-bg-scrolled: #000000;         // was #1e1e1e — user spec: "black background"

// Product card pricing
--sw-price-discount: #ff3d3d;             // brighter red — legible on dark surface
```

**Rationale for `--sw-topbar-bg-scrolled` dark update:** The current `#1e1e1e` is the general dark surface color. The spec requires pure black (`#000000`) in dark mode scrolled state, matching a high-contrast editorial feel consistent with dark-mode fashion brands.

**No other token values change.** Existing tokens that are already correct:
- `--sw-topbar-bg-scrolled` (light): `#ffffff` ✓
- `--sw-topbar-icon-default`: `#ffffff` (both modes) ✓
- `--sw-topbar-icon-scrolled`: `#1a1a1a` (light) / `#f5f5f5` (dark) ✓
- `--sw-nav-link-scrolled`: `#1a1a1a` (light) / `#f5f5f5` (dark) ✓

---

## Section 2 — Topbar Background Behavior (`_landing.scss`)

### Target behavior

| Breakpoint | Scroll state | Light mode bg | Dark mode bg |
|---|---|---|---|
| Mobile/tablet `< 1200px` | any | `#ffffff` (unchanged) | `#ffffff` (unchanged) |
| Desktop `≥ 1200px` | not scrolled | `transparent` | `transparent` |
| Desktop `≥ 1200px` | scrolled | `var(--sw-topbar-bg-scrolled)` = `#ffffff` | `var(--sw-topbar-bg-scrolled)` = `#000000` |

### Changes to `.navbar-landing` in `_landing.scss`

Add a `@media (min-width: 1200px)` block inside `.navbar-landing`:

```scss
@media (min-width: 1200px) {
  background: var(--sw-topbar-bg-default);  // transparent
  transition:
    background-color var(--sw-transition-slow),
    box-shadow var(--sw-transition-slow);

  &.scrolled {
    background: var(--sw-topbar-bg-scrolled);
    box-shadow: var(--sw-shadow-md);
  }
}
```

The mobile override (`background-color: #ffffff !important` at `< 1200px`) already wins due to `!important` — **no change needed there**.

The existing `.is-sticky` rule (`background: var(--bs-secondary-bg)`) covers the Bootstrap sticky fallback and remains untouched.

---

## Section 3 — Element Colors on Scroll (`topbar.component.scss`)

### Desktop icon/text colors

The existing desktop media query block (`@media (min-width: 1200px)`) has two sub-blocks:

**`not(.scrolled):not(.is-sticky)` → transparent state (unchanged behavior)**

Replace hardcoded `rgba(255, 255, 255, 1)` values with `var(--sw-topbar-icon-default)`. Visual result is identical (both are `#ffffff` in all modes), but now token-driven.

**`.scrolled` and `.is-sticky` → solid state**

Replace hardcoded `rgba(0, 0, 0, 1)` icon colors with `var(--sw-topbar-icon-scrolled)`.

- Light mode: resolves to `#1a1a1a` (black) — same as current
- Dark mode: resolves to `#f5f5f5` (white) — **this is the fix**: dark mode scrolled icons currently turn black (wrong), this makes them white

Replace `color: rgba(0, 0, 0, 1)` → `color: var(--sw-topbar-icon-scrolled)` for:
- `i.ri`, `i.ri-heart-line`, `i.ri-user-line`, `i.ri-search-2-line`
- `i.bx`, `i.bx-search`
- `span.fs-16`

The cart icon (`i.bx-shopping-bag`) stays `rgba(255, 255, 255, 1)` (always white — it sits inside the red cart button), which can be expressed as `var(--sw-text-inverse)`.

### Navigation link colors

In `#navbar.scrolled .nav-link-custom`:
- Replace `color: #000000` → `color: var(--sw-nav-link-scrolled)`

The existing `[data-bs-theme="dark"] #navbar.scrolled .nav-link-custom` override block (which sets `color: #f5f5f5`) becomes **redundant** once the token cascade handles it — remove that block.

### Logo variant

`isWhiteMode` is already computed as `!isMobile && !isScrolled && !isExceptionRoute`. On desktop transparent state, this is `true` → `logo_white.svg` shown.

**Problem:** In dark mode scrolled state, the dark logo appears on a black background — invisible.

**Fix:** Update the `isWhiteMode` TypeScript logic to also return `true` when `isDarkMode && isScrolled` (on desktop). This ensures `logo_white.svg` is used for:
- All desktop transparent states (existing)
- Dark mode scrolled state (new)

```typescript
// In updateWhiteMode():
const isMobile = window.innerWidth <= 991.98;
const isExceptionRoute = this.routeExceptions.some(...);
const isTransparentState = !isMobile && !this.isScrolled && !isExceptionRoute;
const isDarkScrolled = !isMobile && this.isScrolled && this.isDarkMode;
this.isWhiteMode = isTransparentState || isDarkScrolled;
```

Hamburger icon (`menu_burger_white.svg` vs `menu_burger.svg`) is also driven by `isWhiteMode` — this update applies there too automatically.

---

## Section 4 — Logo Vertical Offset (`topbar.component.scss`)

In `.logo_container`:

```scss
padding-top: var(--sw-topbar-logo-offset); // 0.3rem — moves logo down
```

This is a single-line addition to an existing rule. No breakpoint scoping needed — the offset is small and visually neutral on mobile.

---

## Section 5 — Cursor Rule

**File:** `.cursor/rules/design-tokens.mdc`

Rule enforces that all color values in landing/component SCSS must come from `var(--sw-*)` tokens. Key directives:

- No hex literals (`#xxxxxx`) outside of `_theme-variables.scss`
- No `rgb()` / `rgba()` with literal color values outside of `_theme-variables.scss`
- No `color: white` / `color: black` — use `var(--sw-text-inverse)` / `var(--sw-text-primary)`
- Exception: `rgba(var(--sw-*-rgb), alpha)` pattern is allowed (uses token RGB components)
- If a token doesn't exist for the needed value → add it to `_theme-variables.scss` first
- Scope: all files under `src/app/` and `src/assets/scss/` except `_theme-variables.scss` itself

---

## Section 6 — Product Card Price Token Compliance (`product-card.component.scss`)

### Audit result

| Price element | Current value | Status |
|---|---|---|
| Regular price | `var(--sw-text-primary)` | ✓ |
| Original/strikethrough price | `var(--sw-text-muted)` | ✓ |
| Strikethrough line color | `var(--sw-primary)` | ✓ |
| Discounted price — light mode | `var(--sw-primary)` | ✓ (update to `var(--sw-price-discount)` for semantic clarity) |
| **Discounted price — dark mode** | `#ff3d3d` | ✗ hardcoded — **must fix** |

### Changes

**Light mode `&--has-discount` block:**
```scss
// Before
color: var(--sw-primary);
// After
color: var(--sw-price-discount);  // resolves to var(--sw-primary) in light mode
```

**Dark mode `[data-bs-theme="dark"] &--has-discount` block:**
```scss
// Before
color: #ff3d3d; // Brighter red for dark mode
// After
color: var(--sw-price-discount);  // resolves to #ff3d3d in dark mode via token
```

The comment `// Brighter red for dark mode` moves to `_theme-variables.scss` alongside the token definition.

**No logic changes.** Discount detection, strikethrough display, and UX remain identical.

---

## Files Changed

| File | Change type |
|---|---|
| `src/assets/scss/_theme-variables.scss` | Add 3 tokens, update 1 dark-mode token value |
| `src/assets/scss/pages/_landing.scss` | Add desktop transparent/scrolled background rules |
| `src/app/shared/landing/index/topbar/topbar.component.scss` | Replace hardcoded colors with tokens in desktop scroll blocks |
| `src/app/shared/landing/index/topbar/topbar.component.ts` | Update `updateWhiteMode()` logic for dark mode scrolled logo |
| `src/app/shared/components/product-card/product-card.component.scss` | Replace `#ff3d3d` and update `var(--sw-primary)` to `var(--sw-price-discount)` |
| `.cursor/rules/design-tokens.mdc` | New file — Cursor rule enforcing token-only colors |

---

## Constraints

- Mobile/tablet (`< 1200px`) behavior: **no change**
- Existing scroll detection (`windowScroll()`, `ThemeService.isScrolled$`): **reused as-is**
- Existing `isDarkMode` / `isScrolled` Angular state: **reused as-is**
- Discount logic in product card: **no change**
- Checkout page / product-detail page special icon rules: **no change**
- `prefers-reduced-motion` compliance: transitions already set to `0ms` via existing `_theme-variables.scss` media query
