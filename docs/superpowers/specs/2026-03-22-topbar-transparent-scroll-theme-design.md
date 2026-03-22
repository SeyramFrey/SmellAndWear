# Spec: Topbar Transparent/Scroll Behavior, Theme Tokens & Product Card Price Cleanup

**Date:** 2026-03-22
**Branch:** claude/happy-kare
**Status:** Approved — ready for implementation

---

## Overview

This spec covers five coordinated changes:

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

Only add/change what differs from `:root`:

```scss
// Topbar: bg-default is the same transparent value — do NOT redeclare it (no-op)
--sw-topbar-bg-scrolled: #000000;         // was #1e1e1e — user spec: "black background"

// Product card pricing
--sw-price-discount: #ff3d3d;             // brighter red — legible on dark surface
```

**Why not redeclare `--sw-topbar-bg-default` in dark block:** The value is `transparent` in both modes. CSS custom properties inherit from `:root` — redeclaring an identical value adds noise without effect. Add a comment in `:root` noting "same for dark mode" if clarity is needed.

**Rationale for `--sw-topbar-bg-scrolled` dark update:** `#1e1e1e` is the general dark surface. The spec requires pure black (`#000000`) in dark mode scrolled state for a high-contrast editorial feel.

**Relationship with `--sw-topbar-bg` (existing token):**
`--sw-topbar-bg` (`:root`: `#ffffff`, dark: `#1e1e1e`) is a general topbar background token used elsewhere. Do not remove it. The new `--sw-topbar-bg-default` (transparent) and `--sw-topbar-bg-scrolled` (updated) are the scroll-state-specific tokens.

**No other token values change.** Existing tokens that are already correct:
- `--sw-topbar-bg-scrolled` (light): `#ffffff` ✓
- `--sw-topbar-icon-default`: `#ffffff` (light) / `#f5f5f5` (dark) ✓
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
| Desktop `≥ 1200px` | `.is-sticky` | `var(--sw-topbar-bg-scrolled)` | `var(--sw-topbar-bg-scrolled)` |

`.is-sticky` on desktop should also use `var(--sw-topbar-bg-scrolled)` so it stays visually consistent with the scrolled state in both modes. The existing `background-color: var(--bs-secondary-bg)` on `.is-sticky` would resolve to Bootstrap's dark surface in dark mode (not `#000000`) — replace it.

### Changes to `.navbar-landing` in `_landing.scss`

**Step 1:** Replace the existing top-level `transition: all 0.5s ease` with a scoped transition to avoid cascade conflicts:

```scss
.navbar-landing {
  padding: 8px 0px;
  transition:
    background-color var(--sw-transition-slow),
    box-shadow var(--sw-transition-slow);
  // ...existing rules unchanged...
}
```

**Step 2:** Add a desktop-only block inside `.navbar-landing`:

```scss
@media (min-width: 1200px) {
  background: var(--sw-topbar-bg-default);  // transparent

  &.scrolled,
  &.is-sticky {
    background: var(--sw-topbar-bg-scrolled);
    box-shadow: var(--sw-shadow-md);
  }
}
```

The mobile override (`background-color: #ffffff !important` at `< 1200px`) already wins due to `!important` — **no change needed there**.

---

## Section 3 — Element Colors on Scroll (`topbar.component.scss`)

### Desktop icon/text colors

The existing desktop media query block (`@media (min-width: 1200px)`) has two sub-blocks:

**`not(.scrolled):not(.is-sticky)` → transparent state (unchanged visual behavior)**

Replace hardcoded `rgba(255, 255, 255, 1)` values with `var(--sw-topbar-icon-default)`. Visual result is identical (`#ffffff` in all modes), but now token-driven.

**`.scrolled` and `.is-sticky` → solid state**

Replace hardcoded `rgba(0, 0, 0, 1)` icon colors with `var(--sw-topbar-icon-scrolled)`.

- Light mode: resolves to `#1a1a1a` (black) — same as current
- Dark mode: resolves to `#f5f5f5` (white) — **this is the fix**: dark mode scrolled icons currently turn black (wrong), this makes them white

Replace `color: rgba(0, 0, 0, 1)` → `color: var(--sw-topbar-icon-scrolled)` for:
- `i.ri`, `i.ri-heart-line`, `i.ri-user-line`, `i.ri-search-2-line`
- `i.bx`, `i.bx-search`
- `span.fs-16`

The cart icon (`i.bx-shopping-bag`) stays white (sits inside the red cart button): replace `rgba(255, 255, 255, 1)` → `var(--sw-text-inverse)`.

### Navigation link colors

In `#navbar.scrolled .nav-link-custom`:
- Replace `color: #000000` → `color: var(--sw-nav-link-scrolled)`

**Handling the existing `[data-bs-theme="dark"] #navbar.scrolled` override block (lines ~1922–1943 in `topbar.component.scss`):**

The base `color: #f5f5f5` on `.nav-link-custom` becomes redundant once `var(--sw-nav-link-scrolled)` handles it. However, this block also contains `:hover` and `.active` sub-rules that must be **preserved**:

```scss
// Keep these — remove only the base color declaration, not the block:
&:hover {
  color: #ffffff;         // → replace with var(--sw-text-inverse) or keep as-is
  text-decoration: underline;
}
&.active {
  color: #ffffff;         // → replace with var(--sw-text-inverse)
  font-weight: 800;
}
```

Do not delete the entire dark-mode block. Remove only the redundant base `color: #f5f5f5` declaration; keep the `:hover` and `.active` sub-rules, replacing their `#ffffff` hex values with `var(--sw-nav-link)` — which resolves to `#f5f5f5` in dark mode (correct: light text on dark bg). Do **not** use `var(--sw-text-inverse)` here — in dark mode that token resolves to `#1a1a1a` (dark charcoal), which would make hovered nav links invisible.

### Logo variant

`isWhiteMode` is already computed as `!isMobile && !isScrolled && !isExceptionRoute`. On desktop transparent state this is `true` → `logo_white.svg` shown.

**Problem 1:** In dark mode scrolled state, the dark logo appears on a black background — invisible.

**Problem 2 — breakpoint alignment:** The existing `isMobile` check uses `window.innerWidth <= 991.98`, but the CSS desktop breakpoint is `1200px`. A tablet at 992–1199px would receive `isWhiteMode = true` (white logo) but the SCSS forces a `#ffffff !important` background — producing white-on-white. Correct `isMobile` to align with the SCSS breakpoint.

**Fix in `updateWhiteMode()`:**

```typescript
private updateWhiteMode(): void {
  // Align with CSS breakpoint: desktop starts at 1200px (was <= 991.98 — wrong)
  const isMobile = window.innerWidth < 1200;
  const isExceptionRoute = this.routeExceptions.some(exception =>
    this.currentRoute.startsWith(exception)
  );

  // White logo/icons when:
  // (a) desktop transparent state, OR
  // (b) desktop dark mode scrolled (dark logo invisible on black bg)
  const isTransparentState = !isMobile && !this.isScrolled && !isExceptionRoute;
  const isDarkScrolled = !isMobile && this.isScrolled && this.isDarkMode;
  this.isWhiteMode = isTransparentState || isDarkScrolled;

  this.isCheckoutPage = this.currentRoute.startsWith('/checkout');
  this.isProductDetailPage = this.currentRoute.startsWith('/product-detail');
}
```

Update the JSDoc comment above `updateWhiteMode()` to reflect the `< 1200` threshold and the `isDarkScrolled` condition — the existing comment still references `> 991.98` and does not mention dark mode scrolled.

Hamburger icon (also driven by `isWhiteMode`) benefits from this fix automatically.

**Also fix `windowScroll()` — second `isMobile` site:**

`windowScroll()` at line ~771 contains an independent `const isMobile = window.innerWidth <= 991.98` used for the hamburger icon class logic. This must also be updated to `< 1200` to stay consistent. Both sites in `topbar.component.ts` must be corrected:

1. `updateWhiteMode()` — threshold for `isWhiteMode`
2. `windowScroll()` — threshold for hamburger class assignment

**Fix in `subscribeToTheme()`:** `updateWhiteMode()` is currently called on scroll and route change but not on theme toggle. Add a call so the logo updates immediately when the user switches modes while scrolled:

```typescript
private subscribeToTheme(): void {
  this.cartSubscriptions.push(
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
      this.updateWhiteMode(); // re-evaluate logo when theme changes
    })
  );

  this.cartSubscriptions.push(
    this.themeService.isScrolled$.subscribe(isScrolled => {
      this.isScrolled = isScrolled;
      this.updateWhiteMode(); // keep in sync (already called by windowScroll, belt+suspenders)
    })
  );
}
```

---

## Section 4 — Logo Vertical Offset (`topbar.component.scss`)

In `.logo_container`:

```scss
padding-top: var(--sw-topbar-logo-offset); // 0.3rem — moves logo down
```

Single-line addition to an existing rule. No breakpoint scoping needed.

---

## Section 5 — Cursor Rule

**File:** `.cursor/rules/design-tokens.mdc`

Rule enforces that all color values in component and asset SCSS must come from `var(--sw-*)` tokens. Key directives:

- No hex literals (`#xxxxxx`) outside of `_theme-variables.scss`
- No `rgb()` / `rgba()` with literal color values outside of `_theme-variables.scss`
- No `color: white` / `color: black` — use `var(--sw-text-inverse)` / `var(--sw-text-primary)`
- Allowed exception: `rgba(var(--sw-*-rgb), alpha)` pattern (uses token RGB components, not literals)
- If a needed token does not exist → add it to `_theme-variables.scss` first, then reference it
- Scope: all files under `src/app/` and `src/assets/scss/` **except** `_theme-variables.scss` itself
- Scope includes product card component SCSS (`product-card.component.scss`)

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
color: var(--sw-price-discount);  // resolves to var(--sw-primary) in light mode — no visual change
```

**Dark mode `[data-bs-theme="dark"] &--has-discount` block:**
```scss
// Before
color: #ff3d3d; // Brighter red for dark mode
// After
color: var(--sw-price-discount);  // resolves to #ff3d3d in dark mode via token
```

The comment `// Brighter red for dark mode — legible on dark surface` moves to `_theme-variables.scss` alongside the token definition.

**No logic changes.** Discount detection, strikethrough display, and UX remain identical.

---

## Files Changed

| File | Change type |
|---|---|
| `src/assets/scss/_theme-variables.scss` | Add 3 tokens (`--sw-topbar-bg-default`, `--sw-topbar-logo-offset`, `--sw-price-discount`); update `--sw-topbar-bg-scrolled` in dark block to `#000000` |
| `src/assets/scss/pages/_landing.scss` | Replace `transition: all` with scoped transition; add desktop transparent/scrolled background block; update `.is-sticky` desktop to use `--sw-topbar-bg-scrolled` |
| `src/app/shared/landing/index/topbar/topbar.component.scss` | Replace hardcoded colors with tokens in desktop scroll blocks; preserve dark-mode nav hover/active sub-rules, replace their hex with tokens |
| `src/app/shared/landing/index/topbar/topbar.component.ts` | Fix `isMobile` threshold to `< 1200` in **both** `updateWhiteMode()` and `windowScroll()`; update `updateWhiteMode()` for `isDarkScrolled`; update JSDoc; add `updateWhiteMode()` call in `subscribeToTheme()` |
| `src/app/shared/components/product-card/product-card.component.scss` | Replace `#ff3d3d` with `var(--sw-price-discount)`; update light-mode discount from `var(--sw-primary)` to `var(--sw-price-discount)` |
| `.cursor/rules/design-tokens.mdc` | New file — Cursor rule enforcing token-only colors |

---

## Constraints

- Mobile/tablet (`< 1200px`) behavior: **no change**
- Existing scroll detection (`windowScroll()`, `ThemeService.isScrolled$`): **reused as-is**
- Discount logic in product card: **no change**
- Checkout page / product-detail page special icon rules (`#navbar.checkout-page`, `#navbar.product-detail-page`): **no change** — their `!important` rules override scroll state rules
- `prefers-reduced-motion` compliance: transitions already set to `0ms` via existing `@media (prefers-reduced-motion: reduce)` block in `_theme-variables.scss` — no additional action needed
