# Phase 0 Completion Report — SCSS Foundation Stabilisation
> **Executed:** 2026-03-16
> **Scope:** Phase 0 of `docs/unification-roadmap.md` — CSS-only brand stabilisation
> **Rule applied:** No business logic changes, no Admin shell modifications, no SCSS deletions

---

## Summary

All Phase 0 objectives are complete. The live color mismatches have been fixed at the source, the Velzon token leaks are neutralised, and the SCSS import chain is valid and documented.

---

## PART 1 — SCSS Foundation Stabilisation

### Finding: `theme-variables.scss` was never missing

The audit noted `theme-variables.scss` as "missing from disk." This was a false alarm caused by the glob scanner excluding SCSS partial files (underscore-prefixed names).

| What the audit saw | Reality |
|--------------------|---------|
| `@import 'assets/scss/theme-variables'` → file not found | File exists at `src/assets/scss/_theme-variables.scss` |
| SCSS partial resolution (`_name.scss` ↔ `name`) is standard | Import compiles correctly |

**Action taken:** None. Import is valid and resolves at build time.

**The `_theme-variables.scss` file is healthy** — it declares all `--sw-*` brand tokens in `:root` and the dark mode override block. It loads at position 4 in `angular.json`, before the Velzon bundle. Because `--sw-*` tokens do not conflict with Velzon's `--vz-*` namespace, they coexist correctly and are not overwritten.

---

## PART 2 — Brand Override Layer Created

### New file: `src/assets/scss/sw-brand-overrides.scss`

A dedicated brand override file was created and inserted into `angular.json` at position 10 — **after** the Velzon bundle (`app.scss`) and **before** `icons.scss`.

**SCSS Load Order (final):**

```
1.  node_modules/prismjs/themes/prism.css
2.  node_modules/shepherd.js/dist/css/shepherd.css
3.  node_modules/flatpickr/dist/flatpickr.css
4.  src/styles.scss                                  ← loads _theme-variables.scss (--sw-* tokens)
5.  node_modules/slick-carousel/slick/slick.scss
6.  node_modules/slick-carousel/slick/slick-theme.scss
7.  node_modules/@ctrl/ngx-emoji-mart/picker.css
8.  src/assets/scss/config/default/bootstrap.scss
9.  src/assets/scss/config/default/app.scss          ← Velzon bundle (--vz-* tokens)
10. src/assets/scss/sw-brand-overrides.scss          ← ✅ NEW — brand overrides win cascade
11. src/assets/scss/icons.scss
```

**Why load order matters:** The Velzon bundle defines `--vz-primary: #405189` inside `_root.scss`. Any override placed before position 9 would be silently overwritten. Position 10 guarantees the brand values win.

### Structure of `sw-brand-overrides.scss`

**Section 1 — Global `:root` corrections:**
- `--vz-primary: #B5190C` — replaces Velzon blue, fixes any landing-area element that inherited it
- `--vz-primary-rgb: 181, 25, 12` — RGB companion required by Bootstrap rgba() helpers
- `--vz-link-color: #212529` — fixes footer social icons and any unstyled `<a>` that was inheriting Velzon blue
- `--vz-link-color-rgb: 33, 37, 41`
- `--vz-link-hover-color: #B5190C` — brand red hover

**Section 2 — Admin restore block:**
- Selector: `.layout-wrapper:not(.landing), .auth-page-wrapper`
- Restores `--vz-primary: #405189` inside all admin layout wrappers
- Also covers `/auth/*` admin pages (login, invite, reset-password) which use `.auth-page-wrapper` with `var(--vz-primary)` for their page background — these are outside the main layout wrapper but exclusively admin
- Confirmed: customer landing auth pages at `/customer` do **not** use `.auth-page-wrapper`

**Section 3 — Landing-scoped button fix:**
- Selector: `.layout-wrapper.landing .btn-danger.landing-back-top`
- Overrides all Velzon `--vz-btn-*` custom properties to brand red
- Covers 11 landing page templates with zero HTML file changes

---

## PART 3 — Three Confirmed Live Mismatches Fixed

### Mismatch 1: Discount/Promo Badges `#FF0000` → `#B5190C`

**File changed:** `src/app/shared/landing/index/topbar/topbar.component.scss`

| Location | Element | Before | After |
|----------|---------|--------|-------|
| Line 57 | `.promo-badge` background | `#ff0000` | `var(--sw-primary)` |
| Line 81 | `.promo-badge::before` arrow | `border-right: 6px solid #ff0000` | `border-right: 6px solid var(--sw-primary)` |
| Line 882 | `.product-discount` badge (cart dropdown) | `background: #ff0000` | `background: var(--sw-primary)` |
| Line 1083 | `.mobile-promo-badge` | `background: #ff0000` | `background: var(--sw-primary)` |

All 4 occurrences replaced. Confirmed with post-edit grep: zero `#ff0000` remain in the file.

### Mismatch 2: Back-to-Top Button `#F06548` → `#B5190C`

**Method:** CSS custom property override in `sw-brand-overrides.scss` (Section 3).

No HTML templates were modified. The 11 landing pages that use `class="btn btn-danger btn-icon landing-back-top"` are fixed through the cascade:
- `.layout-wrapper.landing .btn-danger.landing-back-top` sets all `--vz-btn-*` vars to brand red
- Admin `.btn-danger` buttons (delete confirmations, destructive actions) retain Velzon coral `#F06548`

### Mismatch 3: Footer Social Icons `#405189` → `#212529`

**Method:** `--vz-link-color: #212529` override in `:root` in `sw-brand-overrides.scss` (Section 1).

The `.social-icon` wrapper in `footer.component.scss` does not set an explicit `color`. The `<a>` elements inside inherited Velzon's `--vz-link-color: #405189` (blue). With the override, they inherit `#212529` (dark neutral) — brand-compliant.

The hover state changes to brand red (`--vz-link-hover-color: #B5190C`) — correct and intentional.

---

## Bonus Fix: Cart Count Badge `#CD1C0E` → `#B5190C`

Not listed as one of the three primary mismatches but addressed as Step 0.5 in the roadmap.

**File changed:** `src/app/shared/landing/index/topbar/topbar.component.scss`

The `.cart-badge` was using `lighten($cart-red, 5%)` which compiled to `#CD1C0E` — 24 units off-brand on the red channel. Changed to `var(--sw-primary)` for exact brand compliance and design-token alignment.

---

## Admin Safety Verification

### What was checked

| Check | Result |
|-------|--------|
| `var(--vz-primary)` in `structure/` SCSS | Zero usages — sidebar uses compiled SCSS values, not CSS custom props |
| `var(--vz-primary)` in `components/` SCSS | Zero usages in admin components |
| `var(--vz-primary)` in admin Angular components | `admin-invite.component.scss` + `reset-password.component.scss` only |
| Both covered by restore block? | ✅ Yes — `.auth-page-wrapper` added to restore scope |
| Landing components using `var(--vz-primary)` | Zero — no landing component will be unexpectedly affected |
| `var(--vz-primary)` in `form-wizard.scss` | 6 usages — all inside admin forms (inside `.layout-wrapper:not(.landing)`) → restore block covers ✅ |

### Admin areas with no impact

- Sidebar navigation colours (compiled from SCSS `$primary` at build time — not runtime CSS props)
- Admin topbar
- Admin footer
- All admin `.btn-primary` buttons (Bootstrap scopes their vars to `.btn-primary { --bs-btn-bg: ... }`, not `:root`)
- Admin `.btn-danger` destructive buttons (scoped override only targets `.landing-back-top`)

---

## Files Changed

| File | Type | Change |
|------|------|--------|
| `src/assets/scss/sw-brand-overrides.scss` | **CREATED** | New brand override layer |
| `angular.json` | **MODIFIED** | Added `sw-brand-overrides.scss` at position 10 in styles array |
| `src/app/shared/landing/index/topbar/topbar.component.scss` | **MODIFIED** | 5 fixes: 4× badge `#ff0000` → `var(--sw-primary)`, 1× cart badge `lighten($cart-red,5%)` → `var(--sw-primary)` |

---

## What Was Intentionally NOT Changed

| Item | Reason |
|------|--------|
| `src/styles.scss` | Import of `_theme-variables.scss` is valid — no change needed |
| `src/assets/scss/_theme-variables.scss` | File is healthy — `--sw-*` tokens correct |
| Any admin SCSS file | Admin safety rule |
| Any HTML template | Back-to-top fix applied via CSS, not template edits |
| Any routing or TypeScript | No business logic scope |
| Any Velzon SCSS source files | These are read-only template files |
| SCSS files for uncertain features | Phase 4 scope |

---

## Remaining Theme-Centralisation Work (Later Phases)

| Item | Phase | Notes |
|------|-------|-------|
| Dead NgRx store slices removal | Phase 1 | 10 slices in `app.module.ts` |
| Dead template components removal | Phase 2 | SharedModule, WidgetModule, pages/charts, pages/apps |
| Service name normalization | Phase 3 | French → English renames |
| Dead SCSS page imports removal | Phase 4 | 11 confirmed-dead `@import` lines in `app.scss` |
| Full design token centralization | Phase 5 | Unify `--sw-*` and `--vz-*` into a single token file |
| Remove `--vz-*` dependency entirely | Phase 5 | After admin is rebuilt or fully scoped |
| `#landingnft .slick-dots` in `styles.scss` | Phase 4 | Dead NFT template residue in global styles |

---

## Quick Reference: Brand Color Map (Post Phase 0)

| Token | Value | Used for |
|-------|-------|---------|
| `--sw-primary` | `#B5190C` | All brand-primary elements on landing |
| `--vz-primary` (landing) | `#B5190C` ← overridden | Any legacy component on landing using this token |
| `--vz-primary` (admin) | `#405189` ← restored | Admin interactive states, form wizard steps |
| `--vz-link-color` (global) | `#212529` ← overridden | All unstyled links, social icons |
| `--vz-link-hover-color` | `#B5190C` ← new | Link hover state |
| `--vz-danger` (admin) | `#F06548` | Admin destructive buttons (unchanged) |
| `.landing-back-top` button | `#B5190C` ← scoped fix | Landing back-to-top button only |
