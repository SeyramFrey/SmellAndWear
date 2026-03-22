# Topbar Transparent/Scroll + Theme Tokens + Product Card Price Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the desktop topbar transparent by default and theme-aware on scroll, replace all hardcoded SCSS colors with design tokens, add a product card price token, and enforce the rules via a Cursor rule file.

**Architecture:** Six independent tasks executed in order — tokens first (foundation), then CSS/SCSS consumers, then TypeScript logic, then product card, then Cursor rule. Each task is a commit. All changes reuse existing Angular scroll/theme state; no new state is introduced.

**Tech Stack:** Angular 17 standalone, SCSS with CSS custom properties, Bootstrap 5 `[data-bs-theme]` dark mode, existing `ThemeService` (`isDarkMode$`, `isScrolled$`), existing `.scrolled` / `.is-sticky` classes added by `windowScroll()`.

---

## Context for agentic workers

### Key file paths
| Role | Path |
|---|---|
| Design tokens | `src/assets/scss/_theme-variables.scss` |
| Landing layout CSS | `src/assets/scss/pages/_landing.scss` |
| Topbar component SCSS | `src/app/shared/landing/index/topbar/topbar.component.scss` |
| Topbar component TS | `src/app/shared/landing/index/topbar/topbar.component.ts` |
| Product card SCSS | `src/app/shared/components/product-card/product-card.component.scss` |
| Cursor rule (new) | `.cursor/rules/design-tokens.mdc` |
| Spec | `docs/superpowers/specs/2026-03-22-topbar-transparent-scroll-theme-design.md` |

### How scroll state works
- `windowScroll()` in `topbar.component.ts` fires on `@HostListener('window:scroll')`.
- When `scrollTop > 40`, it adds class `is-sticky` to `#navbar` and sets `this.isScrolled = true`.
- `.scrolled` is a separate class — grep the component to confirm where it is added. Both `.scrolled` and `.is-sticky` are treated identically for background purposes.
- `isWhiteMode` drives which logo SVG is rendered: `logo_white.svg` (white icons) vs default dark logo.

### Dark mode selector
Both `[data-sw-theme="dark"]` and `[data-bs-theme="dark"]` are used in the theme file — always target `[data-bs-theme="dark"]` in component SCSS since Bootstrap applies that attribute.

### Mobile/tablet boundary
The SCSS uses `@media (max-width: 1199.98px)` for mobile/tablet and `@media (min-width: 1200px)` for desktop. **Do not change anything at `< 1200px`.**

---

## Task 1 — Add New Design Tokens

**Files:**
- Modify: `src/assets/scss/_theme-variables.scss:41-47` (`:root` topbar block)
- Modify: `src/assets/scss/_theme-variables.scss:160-166` (dark mode topbar block)
- Modify: `src/assets/scss/_theme-variables.scss:77-80` (`:root` after `--sw-info`)

There are no automated tests for CSS tokens, so the verification step is a visual diff.

- [ ] **Step 1: Add three new tokens to `:root`**

In `_theme-variables.scss`, inside the `:root` block, find the "Topbar specific" comment (around line 41). Add after `--sw-topbar-icon-mobile`:

```scss
  --sw-topbar-bg-default: transparent;      // transparent by default on desktop (same for dark mode — not redeclared)
  --sw-topbar-logo-offset: 0.3rem;          // logo vertical nudge down
```

And inside the "Alerts/Toasts" group (after `--sw-info: #3b82f6;` at line 80, before the `// === TYPOGRAPHY ===` comment at line 82), add a new group:

```scss
  --sw-info: #3b82f6;

  // Product card pricing
  --sw-price-discount: var(--sw-primary);   // discounted price color (light = brand red)

  // === TYPOGRAPHY ===
```

(The surrounding context lines show where to insert — between `--sw-info` and the `// === TYPOGRAPHY ===` section comment.)

- [ ] **Step 2: Update `--sw-topbar-bg-scrolled` in dark mode block to pure black**

In the `[data-bs-theme="dark"]` block (around line 162), find:

```scss
  --sw-topbar-bg-scrolled: #1e1e1e;
```

Replace with:

```scss
  --sw-topbar-bg-scrolled: #000000;         // pure black on scroll — editorial dark feel
```

- [ ] **Step 3: Add `--sw-price-discount` to dark mode block**

In the `[data-bs-theme="dark"]` block, after `--sw-topbar-icon-mobile: #f5f5f5;` line (around line 165), add:

```scss
  // Product card pricing
  --sw-price-discount: #ff3d3d;             // brighter red — legible on dark surface
```

- [ ] **Step 4: Verify token declarations**

```bash
grep -n "sw-topbar-bg-default\|sw-topbar-logo-offset\|sw-price-discount\|sw-topbar-bg-scrolled" src/assets/scss/_theme-variables.scss
```

Expected: 6 matching lines — 4 distinct tokens: `sw-topbar-bg-default` once (`:root`), `sw-topbar-logo-offset` once (`:root`), `sw-price-discount` twice (`:root` + dark block), `sw-topbar-bg-scrolled` twice (`:root` = `#ffffff`, dark block = `#000000`).

- [ ] **Step 5: Commit**

```bash
git add src/assets/scss/_theme-variables.scss
git commit -m "feat(tokens): add topbar-bg-default, logo-offset, price-discount tokens; bg-scrolled dark → #000000"
```

---

## Task 2 — Landing SCSS: Transparent Background + Scoped Transition

**Files:**
- Modify: `src/assets/scss/pages/_landing.scss:61-105`

- [ ] **Step 1: Replace the entire `.navbar-landing` block**

The current `.navbar-landing` block spans lines 61–105. This single step replaces the whole block, which both (a) replaces `transition: all 0.5s ease` with a scoped transition (preventing cascade conflicts with the new desktop background rule) and (b) adds the desktop transparent/scrolled behaviour.

Find the opening of `.navbar-landing` at line 61 and its closing `}` at line 105 (just before `//navbar-light`). Replace the **entire** `.navbar-landing` rule with:

```scss
.navbar-landing {
    padding: 8px 0px; // Reduced from 10px
    transition:
      background-color var(--sw-transition-slow),
      box-shadow var(--sw-transition-slow);

    // MOBILE & TABLET: Always solid white background, always fixed
    @media (max-width: 1199.98px) {
        background-color: #ffffff !important; // ALWAYS solid white
        box-shadow: 0 1px 16px -2px rgba(56, 65, 74, 0.15);
        padding: 6px 8px;
        position: fixed !important;
        top: var(--promo-bar-height, 0px) !important;
        left: 0;
        right: 0;
        width: 100%;
        z-index: 1030;
    }

    // DESKTOP: Transparent by default, solid on scroll
    @media (min-width: 1200px) {
      background: var(--sw-topbar-bg-default);  // transparent in both light & dark

      &.scrolled,
      &.is-sticky {
        background: var(--sw-topbar-bg-scrolled);  // #ffffff light / #000000 dark
        box-shadow: var(--sw-shadow-md);
      }
    }

    .navbar-nav {
        .nav-item {
            .nav-link {
                font-size: 16px;
                font-weight: $font-weight-medium;
                transition: all 0.4s;
                font-family: $font-family-secondary;
                color: var(--#{$prefix}body-color);
                padding: 14px;

                @media (max-width: 991.98px) {
                    padding: 8px 0px;
                }

                &:hover,
                &.active,
                &:focus {
                    color: $success !important;
                }
            }
        }
    }

    &.is-sticky {
        // Mobile/tablet fallback only — desktop is handled above in the @media block
        @media (max-width: 1199.98px) {
          background-color: var(--#{$prefix}secondary-bg);
          box-shadow: 0 1px 16px -2px rgba(56, 65, 74, 0.15);
        }
    }
}
```

**Note:** The old `&.is-sticky` at line 101 used `var(--#{$prefix}secondary-bg)` (Bootstrap token). We move it to mobile/tablet only, so desktop uses the new `--sw-topbar-bg-scrolled`.

- [ ] **Step 2: Verify the file compiles without error**

Run the Angular build in watch-free check mode:

```bash
cd /c/Projets/Smell_Wear/.claude/worktrees/happy-kare && npx ng build --configuration development 2>&1 | tail -20
```

Expected: `Build at:` line with no `ERROR` lines. If SCSS compilation errors appear, fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/assets/scss/pages/_landing.scss
git commit -m "feat(topbar): transparent desktop bg by default, solid on scroll via tokens"
```

---

## Task 3 — Topbar Component SCSS: Token-Driven Icon/Nav Colors

**Files:**
- Modify: `src/app/shared/landing/index/topbar/topbar.component.scss:1820-1944`

This task replaces all hardcoded `rgba(255,255,255,1)` / `rgba(0,0,0,1)` / `#000000` / `#f5f5f5` / `#ffffff` literals in the desktop scroll section with tokens.

- [ ] **Step 1: Replace icon colors in the "not scrolled" block (transparent state)**

In `topbar.component.scss`, find the block at line ~1821:

```scss
  .navbar-landing:not(.scrolled):not(.is-sticky) {
    .topbar-action-btn,
    .btn-topbar {
      i.ri {
        color: rgba(255, 255, 255, 1) !important;
```

Replace all `color: rgba(255, 255, 255, 1) !important` occurrences **within this not-scrolled block** with `color: var(--sw-topbar-icon-default) !important`.

This block covers:
- `i.ri` (line ~1825)
- `i.ri-heart-line, i.ri-user-line, i.ri-search-2-line` (line ~1833)
- `i.bx, i.bx-search` (line ~1840)
- `i.bx-shopping-bag` (line ~1845)
- `span.fs-16` (line ~1850)

All five become `var(--sw-topbar-icon-default)`. Visual result is identical (`#ffffff` light / `#f5f5f5` dark) but token-driven.

- [ ] **Step 2: Replace icon colors in the scrolled/sticky block**

Find the block at line ~1856:

```scss
  .navbar-landing.scrolled,
  .navbar-landing.is-sticky {
    .topbar-action-btn,
    .btn-topbar {
      i.ri {
        color: rgba(0, 0, 0, 1) !important;
```

Replace:
- All `color: rgba(0, 0, 0, 1) !important` → `color: var(--sw-topbar-icon-scrolled) !important`
  - Applies to: `i.ri`, `i.ri-heart-line/user-line/search-2-line`, `i.bx`/`i.bx-search`, `span.fs-16`
- The `i.bx-shopping-bag` line: replace `rgba(255, 255, 255, 1)` → `var(--sw-topbar-icon-default) !important`
  - **Do NOT use `var(--sw-text-inverse)` here** — that token resolves to `#1a1a1a` (dark charcoal) in dark mode, making the cart icon invisible on the red pill. `var(--sw-topbar-icon-default)` resolves to `#ffffff` (light) / `#f5f5f5` (dark) — always a light, visible colour.

After this change, dark mode scrolled icons will be `#f5f5f5` (white) instead of the current `#000000` (wrong).

- [ ] **Step 3: Replace nav link color in scrolled state**

Find around line 1907:

```scss
#navbar.scrolled {
  .navbar-nav-left {
    .nav-links-list {
      .nav-link-item {
        .nav-link-custom {
          color: #000000;

          &:hover {
            color: #333333;
          }
```

Replace:
- `color: #000000` → `color: var(--sw-nav-link-scrolled)`
- `color: #333333` (hover) → `color: var(--sw-nav-link-scrolled)` (token already slightly lighter via `opacity` if needed, or keep as separate token — for simplicity use the same token, the underline provides hover indication)

- [ ] **Step 4: Clean up dark mode nav block — remove redundant base color only**

Find the dark mode block around line 1922:

```scss
[data-bs-theme="dark"] {
  #navbar.scrolled {
    .navbar-nav-left {
      .nav-links-list {
        .nav-link-item {
          .nav-link-custom {
            color: #f5f5f5; // Light text in dark mode   ← REMOVE this line only

            &:hover {
              color: #ffffff; // White on hover           ← keep, replace value
              text-decoration: underline;
            }

            &.active {
              color: #ffffff; // White for active state   ← keep, replace value
              font-weight: 800;
            }
          }
```

Actions:
1. **Delete** the `color: #f5f5f5;` line — it is now redundant (handled by `var(--sw-nav-link-scrolled)` which resolves to `#f5f5f5` in dark mode).
2. **Replace** `color: #ffffff` in `:hover` → `color: var(--sw-nav-link-scrolled) !important` — this is the correct scrolled-context token and resolves to `#f5f5f5` in dark mode (light text on dark bg). Do NOT use `var(--sw-text-inverse)` — that resolves to `#1a1a1a` in dark mode (dark on dark = invisible). Do NOT use `var(--sw-nav-link)` — semantically that is for the transparent (non-scrolled) state.
3. **Replace** `color: #ffffff` in `.active` → `color: var(--sw-nav-link-scrolled) !important`
4. **Preserve** the block structure and `font-weight: 800` on `.active`.

- [ ] **Step 5: Add logo vertical offset**

Find the top-level `.logo_container` block at line ~84:

```scss
.logo_container {
  // Center logo in the navbar
  display: flex;
  justify-content: center;
  flex: 0 0 auto;
```

Add `padding-top: var(--sw-topbar-logo-offset);` as the first property inside this rule:

```scss
.logo_container {
  padding-top: var(--sw-topbar-logo-offset); // 0.3rem — moves logo down slightly
  // Center logo in the navbar
  display: flex;
  justify-content: center;
  flex: 0 0 auto;
```

- [ ] **Step 6: Build check**

```bash
cd /c/Projets/Smell_Wear/.claude/worktrees/happy-kare && npx ng build --configuration development 2>&1 | tail -20
```

Expected: no `ERROR` lines.

- [ ] **Step 7: Commit**

```bash
git add src/app/shared/landing/index/topbar/topbar.component.scss
git commit -m "feat(topbar): replace hardcoded icon/nav colors with tokens; add logo-offset"
```

---

## Task 4 — Topbar Component TS: White Mode Logic + Theme Subscription Fix

**Files:**
- Modify: `src/app/shared/landing/index/topbar/topbar.component.ts:266-328`
- Modify: `src/app/shared/landing/index/topbar/topbar.component.ts:768-794` (windowScroll isMobile)

- [ ] **Step 1: Update `subscribeToTheme()` to call `updateWhiteMode()` on theme change**

Find lines 266–279:

```typescript
  private subscribeToTheme(): void {
    this.cartSubscriptions.push(
      this.themeService.isDarkMode$.subscribe(isDark => {
        this.isDarkMode = isDark;
      })
    );

    // Also subscribe to scroll state from theme service
    this.cartSubscriptions.push(
      this.themeService.isScrolled$.subscribe(isScrolled => {
        this.isScrolled = isScrolled;
      })
    );
  }
```

Replace with:

```typescript
  private subscribeToTheme(): void {
    this.cartSubscriptions.push(
      this.themeService.isDarkMode$.subscribe(isDark => {
        this.isDarkMode = isDark;
        this.updateWhiteMode(); // re-evaluate logo immediately when mode changes
      })
    );

    // Also subscribe to scroll state from theme service
    this.cartSubscriptions.push(
      this.themeService.isScrolled$.subscribe(isScrolled => {
        this.isScrolled = isScrolled;
        this.updateWhiteMode(); // belt-and-suspenders (windowScroll also calls this)
      })
    );
  }
```

**Why:** Without this, toggling dark/light mode while scrolled leaves `isWhiteMode` stale until the next scroll event — the logo would not flip immediately.

- [ ] **Step 2: Update `updateWhiteMode()` — fix breakpoint and add dark-scrolled logic**

Find lines 303–328:

```typescript
  /**
   * Update white mode based on scroll state and current route
   *
   * White mode (white icons + white logo) is ONLY for:
   * - Desktop (screen width > 991.98px)
   * - When topbar is transparent (not scrolled)
   * - When not on exception routes (checkout, product-detail)
   *
   * On mobile/tablet: always use black logo and black icons
   */
  private updateWhiteMode(): void {
    const isMobile = window.innerWidth <= 991.98;
    const isExceptionRoute = this.routeExceptions.some(exception =>
      this.currentRoute.startsWith(exception)
    );

    // White mode is active when:
    // - Desktop only (NOT mobile/tablet) AND
    // - Not scrolled AND
    // - Not on exception route
    this.isWhiteMode = !isMobile && !this.isScrolled && !isExceptionRoute;

    // Detect special pages for icon styling (icons stay black)
    this.isCheckoutPage = this.currentRoute.startsWith('/checkout');
    this.isProductDetailPage = this.currentRoute.startsWith('/product-detail');
  }
```

Replace with:

```typescript
  /**
   * Update white mode based on scroll state, theme, and current route.
   *
   * White logo/icons are shown when:
   * (a) Desktop transparent state: ≥1200px wide, not scrolled, not on exception route
   * (b) Desktop dark mode scrolled: ≥1200px wide, scrolled, dark mode active
   *     → dark logo on black background would be invisible; show white logo instead
   *
   * Mobile/tablet (< 1200px): always use dark logo (solid white background).
   */
  private updateWhiteMode(): void {
    // Align with CSS breakpoint — desktop starts at 1200px (SCSS uses min-width: 1200px)
    const isMobile = window.innerWidth < 1200;
    const isExceptionRoute = this.routeExceptions.some(exception =>
      this.currentRoute.startsWith(exception)
    );

    // (a) Transparent state: desktop, not scrolled, not exception route
    const isTransparentState = !isMobile && !this.isScrolled && !isExceptionRoute;
    // (b) Dark scrolled: desktop, scrolled, dark mode — white logo needed on black bg
    const isDarkScrolled = !isMobile && this.isScrolled && this.isDarkMode;

    this.isWhiteMode = isTransparentState || isDarkScrolled;

    // Detect special pages for icon styling
    this.isCheckoutPage = this.currentRoute.startsWith('/checkout');
    this.isProductDetailPage = this.currentRoute.startsWith('/product-detail');
  }
```

- [ ] **Step 3: Fix `isMobile` in `windowScroll()` — second site**

Find line ~771 inside `windowScroll()`:

```typescript
    const isMobile = window.innerWidth <= 991.98;
```

Replace with:

```typescript
    const isMobile = window.innerWidth < 1200;
```

**Why this site also matters:** `windowScroll()` uses `isMobile` to decide whether to add `hamburger-dark` class on the burger icon. At 992–1199px (tablet), the wrong threshold leaves the burger in an incorrect state when the transparent-topbar logic kicks in.

- [ ] **Step 4: Build check**

```bash
cd /c/Projets/Smell_Wear/.claude/worktrees/happy-kare && npx ng build --configuration development 2>&1 | tail -20
```

Expected: no TypeScript `ERROR` lines.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/landing/index/topbar/topbar.component.ts
git commit -m "fix(topbar): white-mode logic — align isMobile to 1200px; support dark-scrolled logo; trigger on theme change"
```

---

## Task 5 — Product Card Price Token Compliance

**Files:**
- Modify: `src/app/shared/components/product-card/product-card.component.scss:173-178` (light mode discount)
- Modify: `src/app/shared/components/product-card/product-card.component.scss:350-354` (dark mode discount)

- [ ] **Step 1: Update light mode discount price to semantic token**

Find lines ~173–178:

```scss
    // When there's an active discount
    &--has-discount {
      .product-card__price-current {
        color: var(--sw-primary);
        font-weight: 800;
      }
    }
```

Replace `color: var(--sw-primary)` with `color: var(--sw-price-discount)`:

```scss
    // When there's an active discount
    &--has-discount {
      .product-card__price-current {
        color: var(--sw-price-discount);  // resolves to var(--sw-primary) in light mode
        font-weight: 800;
      }
    }
```

Visual result: **identical** — `--sw-price-discount` resolves to `var(--sw-primary)` in light mode.

- [ ] **Step 2: Update dark mode discount price to semantic token**

Find lines ~350–354 (inside the `[data-bs-theme="dark"]` block for product-card):

```scss
      &--has-discount {
        .product-card__price-current {
          color: #ff3d3d; // Brighter red for dark mode
        }
      }
```

Replace with:

```scss
      &--has-discount {
        .product-card__price-current {
          color: var(--sw-price-discount); // resolves to #ff3d3d in dark mode — legible on dark surface
        }
      }
```

- [ ] **Step 3: Verify no other hardcoded price colors remain**

```bash
grep -n "#ff3d3d\|#FF3D3D\|rgb(255.*61\|rgba(255.*61" src/app/shared/components/product-card/product-card.component.scss
```

Expected: **no matches**.

- [ ] **Step 4: Build check**

```bash
cd /c/Projets/Smell_Wear/.claude/worktrees/happy-kare && npx ng build --configuration development 2>&1 | tail -20
```

Expected: no `ERROR` lines.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/components/product-card/product-card.component.scss
git commit -m "fix(product-card): replace hardcoded #ff3d3d with --sw-price-discount token"
```

---

## Task 6 — Cursor Rule: Enforce Design Token–Only Colors

**Files:**
- Create: `.cursor/rules/design-tokens.mdc`

- [ ] **Step 1: Create `.cursor/rules/` directory and rule file**

```bash
mkdir -p /c/Projets/Smell_Wear/.claude/worktrees/happy-kare/.cursor/rules
```

- [ ] **Step 2: Write the Cursor rule**

Create `.cursor/rules/design-tokens.mdc` with the following content:

```markdown
---
description: Enforce design-token-only colors in all SCSS and component files
globs: ["src/app/**/*.scss", "src/assets/scss/**/*.scss"]
alwaysApply: true
---

# Design Token Rule: No Hardcoded Colors

## Rule

All color values in Angular component SCSS and asset SCSS **must** come from CSS custom property tokens defined in `src/assets/scss/_theme-variables.scss`.

## What Is Forbidden (outside `_theme-variables.scss`)

- Hex literals: `#ffffff`, `#1a1a1a`, `#ff3d3d`, etc.
- RGB/RGBA with literal values: `rgb(255, 255, 255)`, `rgba(0, 0, 0, 0.5)`
- Named colors: `color: white`, `color: black`, `background: transparent` (use `var(--sw-topbar-bg-default)`)
- Bootstrap-prefixed color tokens used for Smell & Wear–specific theming (prefer `--sw-*` over `--bs-*`)

## What Is Allowed

- `var(--sw-*)` tokens: `color: var(--sw-text-primary)`, `background: var(--sw-topbar-bg-scrolled)`
- `rgba(var(--sw-primary-rgb), 0.15)` — RGB component pattern using token
- Bootstrap structural tokens like `var(--bs-border-radius)` (non-color structural values)
- `transparent` keyword only as a value for `--sw-topbar-bg-default` in `_theme-variables.scss`

## Required Workflow for New Colors

1. Check if an existing `--sw-*` token already covers the color.
2. If no token exists: **add it to `src/assets/scss/_theme-variables.scss` first** (both `:root` light and `[data-bs-theme="dark"]` dark blocks as needed).
3. Then reference the new token in the component SCSS.
4. Never define a color value directly in a component SCSS file.

## Token Reference Quick Map

| Need | Light token | Dark override |
|---|---|---|
| Primary text | `var(--sw-text-primary)` | auto via dark block |
| Muted/secondary text | `var(--sw-text-muted)` | auto |
| Inverse text (on dark bg) | `var(--sw-text-inverse)` ⚠️ | `#1a1a1a` in dark — use `var(--sw-nav-link)` for nav |
| Page background | `var(--sw-bg-primary)` | auto |
| Card background | `var(--sw-card-bg)` | auto |
| Topbar default bg | `var(--sw-topbar-bg-default)` = transparent | same |
| Topbar scrolled bg | `var(--sw-topbar-bg-scrolled)` = `#ffffff` | `#000000` |
| Topbar icon (transparent) | `var(--sw-topbar-icon-default)` | auto |
| Topbar icon (scrolled) | `var(--sw-topbar-icon-scrolled)` | auto |
| Nav link | `var(--sw-nav-link)` | auto |
| Nav link (scrolled) | `var(--sw-nav-link-scrolled)` | auto |
| Brand/accent | `var(--sw-primary)` | same |
| Sale/discount price | `var(--sw-price-discount)` | `#ff3d3d` |
| Success | `var(--sw-success)` | same |
| Error | `var(--sw-error)` | same |

## Scope

This rule applies to:
- `src/app/**/*.scss` (all Angular component SCSS)
- `src/assets/scss/**/*.scss` (all shared/global SCSS)

**Exception:** `src/assets/scss/_theme-variables.scss` is the **source of truth** — hex values are allowed there and only there.
```

- [ ] **Step 3: Verify file was created**

```bash
cat /c/Projets/Smell_Wear/.claude/worktrees/happy-kare/.cursor/rules/design-tokens.mdc
```

Expected: the file contents printed.

- [ ] **Step 4: Commit**

```bash
git add .cursor/rules/design-tokens.mdc
git commit -m "chore(cursor): add design-tokens rule — enforce var(--sw-*) only in SCSS"
```

---

## Final Verification Checklist

After all 6 tasks are committed:

- [ ] **Build succeeds cleanly**
  ```bash
  cd /c/Projets/Smell_Wear/.claude/worktrees/happy-kare && npx ng build --configuration development 2>&1 | grep -E "ERROR|WARNING|Build at"
  ```
  Expected: `Build at:` line, no `ERROR` lines.

- [ ] **No hardcoded colors remain in affected SCSS files**
  ```bash
  grep -n "rgba(255, 255, 255\|rgba(0, 0, 0\|#000000\|#ffffff\|#f5f5f5\|#1a1a1a\|#ff3d3d" \
    src/app/shared/landing/index/topbar/topbar.component.scss \
    src/app/shared/components/product-card/product-card.component.scss
  ```
  Expected remaining matches (these are **intentional exceptions**, not regressions):
  - `topbar.component.scss` lines inside `#navbar.checkout-page` block — icons hardcoded `#000000` (checkout special styling, out of scope)
  - `topbar.component.scss` lines inside `#navbar.product-detail-page` block — same reason
  - `product-card.component.scss` line ~192: `border: 1px solid rgba(0, 0, 0, 0.1)` on color dots — semantic border, not a color token, acceptable
  - `product-card.component.scss` line ~358: `background-color: rgba(255, 255, 255, 0.15)` on `__hover-indicator` — out of scope for this feature

  Any match **outside** these expected locations is a regression and must be fixed.

- [ ] **Token count in theme file**
  ```bash
  grep -c "sw-topbar-bg-default\|sw-topbar-logo-offset\|sw-price-discount" src/assets/scss/_theme-variables.scss
  ```
  Expected: `4` (bg-default×1, logo-offset×1, price-discount×2 — one in `:root`, one in dark block).

- [ ] **Both `isMobile` sites updated in topbar.component.ts**
  ```bash
  grep -n "innerWidth" src/app/shared/landing/index/topbar/topbar.component.ts
  ```
  Expected: all `innerWidth` comparisons use `< 1200`, none use `<= 991.98`.
