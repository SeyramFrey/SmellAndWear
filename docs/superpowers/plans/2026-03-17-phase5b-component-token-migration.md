# Phase 5b — Component-Level Token Migration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate remaining hardcoded design values in landing-area components to `--sw-*` CSS custom properties, working in safe batches from smallest/simplest to largest/riskiest.

**Architecture:** Token substitution only — no structural changes, no selector changes, no business-logic touches. Each task is a mechanical find-and-replace of hardcoded values. Admin SCSS (layouts/, pages/, widgets/) and checkout.component.scss are permanently out of scope.

**Tech Stack:** SCSS CSS custom properties (`--sw-*`), Angular component encapsulated SCSS. All tokens defined in `src/assets/scss/_theme-variables.scss`.

---

## Audit Summary (post-Phase-5 state)

### Token reference — use these for every substitution

| Hardcoded value | Token | Notes |
|-----------------|-------|-------|
| `#B5190C` | `var(--sw-primary)` | Brand red |
| `#8a1309` / `darken($brand-red, 7–8%)` | `var(--sw-primary-dark)` | Hover/active state |
| `#d41e10` / `lighten($brand-red, x%)` | `var(--sw-primary-light)` | Lighter red |
| `rgba($brand-red, 0.05–0.12)` | `var(--sw-primary-soft)` | Soft red tint (= `rgba(181,25,12,0.12)`) |
| `rgba($brand-red, 0.1)` | `rgba(var(--sw-primary-rgb), 0.10)` | When exact alpha differs from `--sw-primary-soft` |
| `rgba($brand-red, 0.3–0.4)` | `rgba(var(--sw-primary-rgb), 0.35)` | Shadow alpha — use nearest value |
| `#ffffff` / `#fff` / `white` | `var(--sw-bg-surface)` | Surface backgrounds |
| `#f8f9fa` | `var(--sw-bg-secondary)` | Slightly elevated bg |
| `#e9ecef` / `#e9e9e9` / `#f0f0f0` | `var(--sw-bg-tertiary)` | Hover / subtle bg |
| `#1a1a1a` / `#212529` | `var(--sw-text-primary)` | Primary text |
| `#333` / `#374151` | `var(--sw-text-primary)` | Dark text |
| `#495057` / `#555` / `#666` | `var(--sw-text-secondary)` | Secondary text |
| `#6c757d` / `#777` / `#9ca3af` | `var(--sw-text-muted)` | Muted text |
| `#8c8c8c` / `#999` / `#adb5bd` | `var(--sw-text-muted)` | Muted text variants |
| `#dee2e6` / `#e5e7eb` / `#eee` / `#ddd` | `var(--sw-border-primary)` | Primary borders |
| `#f1f3f4` / `#f0f0f0` (border context) | `var(--sw-border-secondary)` | Subtle borders |
| `0 2px 4px rgba(0,0,0,0.05)` | `var(--sw-shadow-sm)` | Small shadow |
| `0 4px 12px rgba(0,0,0,0.1)` | `var(--sw-shadow-md)` | Medium shadow |
| `0 10px 25px rgba(0,0,0,0.15)` | `var(--sw-shadow-lg)` | Large shadow |
| `rgba(0,0,0,0.1)` in shadow | keep as literal | Opacity-only shadows — no exact token match |
| `0.2s ease` / `0.3s ease` | `var(--sw-transition-fast)` / `var(--sw-transition-base)` | |
| `'Bebas Neue'...` | `var(--sw-font-heading)` | |
| `'Open Sans'...` | `var(--sw-font-body)` | |
| `'Montserrat'...` | `var(--sw-font-ui)` | |
| `'Courier New'...` | `var(--sw-font-mono)` | |
| `-apple-system, BlinkMacSystemFont...` | `var(--sw-font-body)` | System stack fallback |

### Special cases — do NOT replace

| Value | Reason |
|-------|--------|
| `#000000` / `#000` in `promo-bar` | Intentional design: promotional banner is always black |
| `rgba(255,255,255,x)` as overlay/animation shimmer | Decorative effects — not themeable |
| `#0066cc` focus outline in `promo-bar` | Accessibility-safe focus color — verify before changing |
| `#f6e58d` in `button.component.scss` gradients | This is a special hover effect gradient, NOT a brand color |
| `#FF0000` in `button.component.scss` gradient | Same gradient effect — leave |
| `rgba(0,0,0,x)` overlay/scrim values | These are structural transparency layers, not color tokens |
| Any value inside `[data-bs-theme="dark"]` blocks already using `--sw-*` | Already migrated |

### SCSS variable elimination

Every component that defines `$brand-red: #B5190C` at the top must:
1. Delete the local `$brand-red` / `$brand-red-light` / `$brand-red-dark` variable declaration
2. Replace all usages: `$brand-red` → `var(--sw-primary)`
3. Replace `darken($brand-red, N%)` → `var(--sw-primary-dark)`
4. Replace `rgba($brand-red, x)` → `rgba(var(--sw-primary-rgb), x)` or `var(--sw-primary-soft)` (when x ≈ 0.12)

---

## Scope exclusions (permanent — do not touch in any batch)

| Area | Reason |
|------|--------|
| `layouts/` (admin shell) | Velzon admin — never touch |
| `pages/` (admin pages) | Velzon admin — never touch |
| `shared/widget/` (admin widgets) | Admin — never touch |
| `account/` (admin auth pages) | Velzon admin auth — never touch |
| `landing/checkout/checkout.component.scss` | Payment-critical — defer indefinitely |
| `extraspages/` | Admin extras — leave |

---

## Batch A — Trivial targets (≤5 hardcoded values each)

**Risk: SAFE** — small files, isolated values, no SCSS variables to eliminate, clear token mappings.

### Task A1: `section-title.component.scss`

**Files:**
- Modify: `src/app/shared/components/section-title/section-title.component.scss`

- [ ] Read the file
- [ ] Replace `color: #666` → `color: var(--sw-text-secondary)` (1 change)
- [ ] Verify no other hardcoded values remain
- [ ] Commit: `style(section-title): migrate color to --sw-text-secondary`

---

### Task A2: `topbar-promo.component.scss`

**Files:**
- Modify: `src/app/shared/landing/index/topbar-promo/topbar-promo.component.scss`

- [ ] Read the file
- [ ] Replace `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1)` → `box-shadow: var(--sw-shadow-sm)` (1 change)
- [ ] Verify no other hardcoded values remain
- [ ] Commit: `style(topbar-promo): migrate shadow to --sw-shadow-sm`

---

### Task A3: `video-hero.component.scss`

**Files:**
- Modify: `src/app/shared/components/video-hero/video-hero.component.scss`

- [ ] Read the file
- [ ] The three `rgba(0, 0, 0, 0.4)` values are overlay/scrim values — check if they match the `--sw-overlay-bg` token (`rgba(0,0,0,0.5)`)
- [ ] `background-color: rgba(0, 0, 0, 0.4)` → keep as literal (slightly different alpha than token — do not force-fit)
- [ ] `text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4)` → keep as literal (shadow, not color token)
- [ ] Result: 0 changes needed — this file is already acceptable
- [ ] Commit: no commit needed (verify then skip)

---

### Task A4: `category-card.component.scss`

**Files:**
- Modify: `src/app/shared/components/category-card/category-card.component.scss`

- [ ] Read the file
- [ ] `rgba(0,0,0,0)` gradient start → keep (transparent, not a color token)
- [ ] `rgba(0,0,0,0.7)` gradient end → keep (structural overlay gradient)
- [ ] `rgba(0, 0, 0, 0.4)` text-shadow → keep (shadow, not color token)
- [ ] Result: 0 changes needed — these are intentional overlay gradients
- [ ] Commit: no commit needed (verify then skip)

---

### Task A5: `wear-men.component.scss`

**Files:**
- Modify: `src/app/landing/wear-men/wear-men.component.scss`

- [ ] Read the file, identify the 1 hardcoded value
- [ ] Apply the appropriate token substitution from the reference table
- [ ] Verify no other hardcoded values remain
- [ ] Commit: `style(wear-men): migrate hardcoded color to SW token`

---

### Task A6: `banner-promo.component.scss`

**Files:**
- Modify: `src/app/shared/landing/index/banner-promo/banner-promo.component.scss`

- [ ] Read the file
- [ ] `box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1)` → keep as literal (shadow with custom spread/blur)
- [ ] `box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2)` → keep as literal
- [ ] `background: rgba(255, 255, 255, 0.1)` → keep (shimmer/overlay effect, not a surface color)
- [ ] `background: rgba(255, 255, 255, 0.2)` → keep (same reason)
- [ ] Result: 0 forced changes — these are decorative overlay values
- [ ] Commit: no commit needed

---

## Batch B — Small landing pages (5–12 hardcoded values, no SCSS variables)

**Risk: LOW** — consistent pattern across these pages. Each page has the same small set: `.landing-back-top` radius/colors plus a few component-specific values.

### Task B1: Migrate `index.component.scss`, `wear-choice.component.scss`, `all-categorie.component.scss`

**Files:**
- Modify: `src/app/landing/index/index.component.scss`
- Modify: `src/app/landing/wear-choice/wear-choice.component.scss`
- Modify: `src/app/landing/all-categorie/all-categorie.component.scss`

Do each file independently, committing after each.

For each file:
- [ ] Read the file
- [ ] Apply substitutions from the token reference table
- [ ] Preserve `rgba(0,0,0,x)` overlay/shadow values as literals
- [ ] Verify no hardcoded brand or neutral colors remain
- [ ] Commit per file: `style(<component>): migrate colors to SW tokens`

---

### Task B2: Migrate `all-products.component.scss`, `bestsellers.component.scss`, `news.component.scss`

**Files:**
- Modify: `src/app/landing/all-products/all-products.component.scss`
- Modify: `src/app/landing/bestsellers/bestsellers.component.scss`
- Modify: `src/app/landing/news/news.component.scss`

Note: these three files each contain `font-family: 'Bebas Neue', sans-serif` and `font-family: 'Open Sans', sans-serif` (abbreviated stacks, not the full canonical stack). Replace with:
- `'Bebas Neue', sans-serif` → `var(--sw-font-heading)`
- `'Open Sans', sans-serif` → `var(--sw-font-body)`

For each file:
- [ ] Read the file
- [ ] Apply color token substitutions
- [ ] Apply font-family token substitutions (2 per file)
- [ ] Verify clean
- [ ] Commit per file: `style(<component>): migrate colors and font-family to SW tokens`

---

### Task B3: `popup-promo.component.scss`

**Files:**
- Modify: `src/app/shared/landing/index/popup-promo/popup-promo.component.scss`

- [ ] Read the file (7 hardcoded values)
- [ ] Apply substitutions
- [ ] Commit: `style(popup-promo): migrate colors to SW tokens`

---

## Batch C — Shared reusable components (medium complexity)

**Risk: MEDIUM** — these components are rendered across multiple pages. A visual regression here is visible everywhere. Read carefully before changing. One commit per file.

### Task C1: `button.component.scss`

**Files:**
- Modify: `src/app/shared/components/button/button.component.scss`

Special note: `button.component.scss` contains gradient hover effects using `#f6e58d` and `#FF0000` that are **purely decorative hover animations** (the gradient "wipes" direction on hover). Do NOT replace these with tokens — they are intentional and non-brand. Only migrate:
- `background: linear-gradient(to left top, #B5190C 50%, #FF0000 50%)` — the `#B5190C` can become `var(--sw-primary)` but leave `#FF0000` as the animation target
- `color: #fff` → `var(--sw-text-inverse)`
- `box-shadow` shadow rgba values → keep as literals

- [ ] Read the file in full
- [ ] Replace `#B5190C` in the gradient with `var(--sw-primary)`
- [ ] Replace `color:#fff` → `color: var(--sw-text-inverse)`
- [ ] Leave all `rgba(0,0,0,x)` shadow values, `#f6e58d`, and `#FF0000` as literals
- [ ] Commit: `style(button): migrate brand color to --sw-primary`

---

### Task C2: `account-favorites.component.scss`

**Files:**
- Modify: `src/app/landing/account/favorites/account-favorites.component.scss`

This file defines local SCSS variables:
```scss
$brand-red:       #B5190C;
$brand-red-light: #ff3366;  // NOTE: this is NOT the SW primary-light — it is a pink/magenta
```

Note: `$brand-red-light: #ff3366` is used for favorites/heart icon accents — it is NOT `--sw-primary-light` (`#d41e10`). Leave `#ff3366` usages as a literal or define a specific `--sw-color-favorite` token if desired. Do NOT blindly replace with `--sw-primary-light`.

- [ ] Read the file in full
- [ ] Delete `$brand-red: #B5190C` variable declaration
- [ ] Replace all `$brand-red` usages → `var(--sw-primary)`
- [ ] Keep `$brand-red-light: #ff3366` or rename it `$color-heart` and keep literal (it's semantically different from `--sw-primary-light`)
- [ ] Apply neutral color substitutions
- [ ] Commit: `style(account-favorites): migrate brand color to --sw-primary`

---

### Task C3: `product-card.component.scss`

**Files:**
- Modify: `src/app/shared/components/product-card/product-card.component.scss`

This file already has partial `--sw-*` adoption (6 lines in the dark-mode area). Extend it to the light-mode section.

Key values:
- `#B5190C` (3 occurrences) → `var(--sw-primary)`
- `rgba(181, 25, 12, 0.3)` → `rgba(var(--sw-primary-rgb), 0.3)`
- `#fff0f3` / `#fff` → `var(--sw-bg-surface)` (check context)
- `#ff3366` → keep literal (heart icon accent, same as favorites)
- `#ff0000` → check context: if this is an error/critical badge, keep; if it is a brand color mistake, replace with `var(--sw-primary)`
- `#333` / `#212529` → `var(--sw-text-primary)`
- `#8c8c8c` / `#6c757d` → `var(--sw-text-muted)`

- [ ] Read the file in full
- [ ] Map every hardcoded value before making changes
- [ ] Apply substitutions carefully, preserving structural overlay rgba values
- [ ] Do NOT change the existing `--sw-*` lines already in the file
- [ ] Commit: `style(product-card): migrate hardcoded colors to SW tokens`

---

## Batch D — Account area and promo components

**Risk: MEDIUM** — the account components all share `$brand-red` SCSS variables and have custom state colors. The `promo-bar` has intentionally black styling.

### Task D1: `shared-account.scss`

**Files:**
- Modify: `src/app/landing/account/shared-account.scss`

This is a shared stylesheet imported/used by the account sub-pages. Changes here cascade.

The file defines `$brand-red: #B5190C` at line 1.

- [ ] Read the full file
- [ ] Delete `$brand-red` SCSS variable declaration
- [ ] Replace all `$brand-red` usages → `var(--sw-primary)`
- [ ] Apply neutral color substitutions using the reference table
- [ ] Preserve box-shadow rgba values as literals
- [ ] Verify that all account sub-pages still look correct (manual check)
- [ ] Commit: `style(shared-account): migrate brand color and neutrals to SW tokens`

---

### Task D2: `account-dashboard.component.scss`

**Files:**
- Modify: `src/app/landing/account/dashboard/account-dashboard.component.scss`

Note: `darken($brand-red, 7%)` → `var(--sw-primary-dark)`.

- [ ] Read the full file
- [ ] Delete `$brand-red: #B5190C` declaration
- [ ] Replace `$brand-red` → `var(--sw-primary)`
- [ ] Replace `darken($brand-red, 7%)` → `var(--sw-primary-dark)`
- [ ] Apply neutral color substitutions
- [ ] Commit: `style(account-dashboard): migrate brand color to SW tokens`

---

### Task D3: `promo-bar.component.scss`

**Files:**
- Modify: `src/app/shared/landing/index/promo-bar/promo-bar.component.scss`

Special consideration: `background-color: #000000` and `color: #ffffff` are INTENTIONAL — the promo bar is designed to be a full-black bar with white text. Do NOT replace these with `--sw-bg-*` tokens. They must remain as `#000000` / `#ffffff` or be mapped to explicit named tokens if ever the design changes.

**Only migrate:**
- `font-family: 'Courier New', monospace` → `var(--sw-font-mono)` ← 1 change
- `rgba(255, 255, 255, x)` shimmer animations → keep as literals (decorative)
- `outline: 2px solid #0066cc` → this is an accessibility focus color, keep as literal

- [ ] Read the full file
- [ ] Replace `font-family: 'Courier New', monospace` → `font-family: var(--sw-font-mono)`
- [ ] Leave all other values unchanged (by design)
- [ ] Commit: `style(promo-bar): migrate font-family to --sw-font-mono`

---

### Task D4: `l-sous-categories.component.scss`

**Files:**
- Modify: `src/app/landing/l-sous-categories/l-sous-categories.component.scss`

- [ ] Read the file (12 hardcoded values, 257 lines)
- [ ] Apply color and font substitutions from reference table
- [ ] Commit: `style(l-sous-categories): migrate hardcoded values to SW tokens`

---

## Batch E — Higher complexity components

**Risk: MEDIUM-HIGH** — these files are larger or more structurally complex. Take extra care. One file per subagent dispatch.

### Task E1: `search-bar.component.scss`

**Files:**
- Modify: `src/app/shared/landing/index/search-bar/search-bar.component.scss`

This is the global search component — visible on every landing page. 51 color + 9 font-family hardcoded values. 667 lines.

Note: `background: #B5190C` and `background: #FF0000` both appear in the search overlay area. `#FF0000` here is a bright red used for a visual accent on results — it is an **off-brand mistake**, not intentional. Replace both with `var(--sw-primary)`.

Font families:
- `'Open Sans', sans-serif` → `var(--sw-font-body)`
- `'Montserrat', sans-serif` → `var(--sw-font-ui)`

- [ ] Read the full file
- [ ] Apply all color substitutions
- [ ] Apply all font-family substitutions (9 occurrences)
- [ ] Leave `rgba(0,0,0,x)` overlay/shadow values as literals unless they are obviously surface backgrounds
- [ ] Commit: `style(search-bar): migrate hardcoded values to SW tokens`

---

### Task E2: `account-orders.component.scss`

**Files:**
- Modify: `src/app/landing/account/orders/account-orders.component.scss`

Large file (577 lines), 41 hardcoded values, `$brand-red` SCSS variable with `darken()` and `rgba()` calls.

- [ ] Read the full file
- [ ] Delete `$brand-red` and `$brand-red-light` declarations
- [ ] Replace `$brand-red` → `var(--sw-primary)`
- [ ] Replace `darken($brand-red, 8%)` → `var(--sw-primary-dark)`
- [ ] Replace `rgba($brand-red, x)` → `rgba(var(--sw-primary-rgb), x)` with appropriate alpha
- [ ] Keep `$brand-red-light: #ff3366` as `$color-favorite-heart: #ff3366` or literal (same heart accent)
- [ ] Apply neutral color substitutions
- [ ] Commit: `style(account-orders): migrate brand color and neutrals to SW tokens`

---

### Task E3: `login-landing.component.scss`

**Files:**
- Modify: `src/app/landing/auth/login/login-landing.component.scss`

33 hardcoded values. Note: `rgba(181, 25, 12, 0.1)` is the focus ring shadow — should become `var(--sw-primary-soft)`.

- [ ] Read the full file
- [ ] Apply substitutions
- [ ] `rgba(181, 25, 12, 0.1)` → `var(--sw-primary-soft)` (primary-soft is 0.12, close enough; or use `rgba(var(--sw-primary-rgb), 0.10)` for exact match)
- [ ] Commit: `style(login-landing): migrate hardcoded values to SW tokens`

---

## Batch F — Deferred (high risk / complexity)

These files require careful planning before touching. Do NOT include in any automated batch run.

### `topbar.component.scss` — DEFERRED

- **Lines:** 2047
- **Hardcoded count:** 186 color values
- **SCSS variables:** `$cart-red`, `$cart-red-dark`, `$cart-red-light`, `$cart-red-soft` — these drive shadow calculations
- **Risk factors:**
  - Scroll state management (icon colors change on scroll via TS class toggling)
  - Mobile vs desktop rendering differences
  - 4 computed SCSS variables that become rgba/shadow values
  - Phase-0 fixes are already in this file and must not be regressed
- **Recommended approach:** Separate dedicated task. Read the full file first, map all SCSS variable usages, plan token mapping explicitly before making any change.

### `product-detail.component.scss` — DEFERRED

- **Lines:** 861
- **Hardcoded count:** 54 color + 1 font-family (`'Helvetica Neue', Arial, sans-serif`)
- **Risk factors:**
  - Complex product gallery, variant selector, size chart, sticky CTA
  - The font `'Helvetica Neue'` is intentionally different from the brand fonts — verify before replacing with `--sw-font-body`
- **Recommended approach:** Read and map first. The font should likely become `var(--sw-font-body)`.

### `s-c-products.component.scss` — DEFERRED

- **Lines:** 517
- **Hardcoded count:** 33 values
- **Risk factors:** Subcategory product listing page with filter state management
- **Recommended approach:** Include in a future batch with `product-detail.component.scss`.

### `product-modal.component.scss` — DEFERRED

- **Lines:** 492
- **Hardcoded count:** 70 values (highest density after topbar)
- **Risk factors:** Global overlay modal used across all product cards
- **Recommended approach:** Treat as its own dedicated task after product-card is confirmed clean.
- Note: currently defines `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` → `var(--sw-font-body)` is safe here.

### `signup-landing.component.scss` — DEFERRED

- **Lines:** 357
- **Hardcoded count:** 47 values
- **Risk factors:** Signup flow — regression means users can't register. Visually complex card layout.

### `checkout.component.scss` — PERMANENTLY DEFERRED

- **Lines:** 333
- **Hardcoded count:** 49 values
- **Reason:** Payment-critical component. Visual instability here can interrupt the purchase flow.
- **Policy:** No styling changes until Paystack integration is tested end-to-end after any change.

---

## Execution order summary

```
Batch A (trivial)     → Tasks A1, A2, A5  (A3, A4, A6 = no changes needed)
         ↓
Batch B (small pages) → Tasks B1, B2, B3
         ↓
Batch C (shared UI)   → Tasks C1, C2, C3
         ↓
Batch D (account)     → Tasks D1, D2, D3, D4
         ↓
Batch E (complex)     → Tasks E1, E2, E3
         ↓
Batch F (deferred)    → Plan separately, dedicated sessions
```

After every batch: run `npx tsc --noEmit --project tsconfig.app.json` and visually verify the landing homepage, a product page, and the account dashboard before continuing.

---

## Verification protocol (after each commit)

```bash
# 1. TypeScript check
npx tsc --noEmit --project tsconfig.app.json

# 2. Grep check: confirm no raw brand hex remains in migrated file
grep -n "#B5190C\|#b5190c" <file>

# 3. Grep check: confirm no $brand-red SCSS variable remains
grep -n "\$brand-red\|\$cart-red" <file>

# 4. Visual check: open landing page, account page — confirm no color regression
```

---

## Expected outcome

After all batches A–E:

| Metric | Before Phase 5b | After Phase 5b |
|--------|----------------|----------------|
| Files with `$brand-red` SCSS var | 6 | 0 |
| Files with hardcoded `#B5190C` | ~10 | 0 (except deferred) |
| Files still 100% hardcoded (non-admin) | ~25 | ~5 (deferred batch F only) |
| Token adoption across landing components | ~15% | ~85% |

---

*Generated: 2026-03-17 | Auditor: post-Phase-5 analysis*
*Reference: `docs/codebase-usage-audit.md`, `docs/unification-roadmap.md`, `src/assets/scss/_theme-variables.scss`*
