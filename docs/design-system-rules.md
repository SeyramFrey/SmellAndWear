# SmellAndWear — Design System Rules

> **Audience:** Every developer writing or reviewing SCSS in this repository.
> **Status:** Active — reflects codebase state after Phase 5B batch A–E completion.
> **Last updated:** 2026-03-17

---

## 1. Executive Summary

### Purpose

SmellAndWear's design system exists to ensure that every visual decision — color, typography, spacing, motion — is expressed once, in one place, and consumed everywhere else by reference. That single place is `src/assets/scss/_theme-variables.scss`.

Before Phase 5, the codebase had brand colors, font stacks, and spacing values scattered across dozens of component SCSS files as raw hex codes and hardcoded strings. A single brand color change (`#B5190C`) required touching 15+ files. Dark mode was inconsistent. New components copied values from memory rather than a shared contract.

Phase 5 and Phase 5B systematically replaced this disorder with a token-based approach. This document captures the rules that preserve that investment and prevent regression.

### `--sw-*` tokens as the single source of truth

The `--sw-` prefix identifies SmellAndWear design tokens — CSS custom properties defined in `:root` inside `_theme-variables.scss`. These are the **only authorised source** for brand color, neutral color, typography, spacing, radius, shadow, motion, and z-index values in landing-area component SCSS.

When a value is expressed as `var(--sw-primary)` instead of `#B5190C`, it:

- Responds correctly to theme changes (dark mode)
- Can be updated across the entire codebase by editing one line
- Documents its semantic intent (brand primary, not a raw hex)
- Is auditable by tooling with a single grep

### Goal: no new styling disorder

The rule is simple: **do not add what we just removed.** No new raw `#B5190C`, no new `$brand-red` SCSS variables, no new hardcoded `'Open Sans', sans-serif` font stacks in component files. Any new component must consume tokens from day one.

---

## 2. Core Principles

### 2.1 Semantic tokens over raw values

A token carries intent. `var(--sw-primary)` means "the brand's primary action color." `#B5190C` means nothing except a hex code that may or may not be current.

Always ask: *does a token exist for this value?* If yes, use it. If no, check whether the value is a brand/neutral color that warrants a new token before defaulting to a literal.

### 2.2 Preserve visual consistency

Token migration is not an opportunity to change how something looks. When migrating a hardcoded value to a token, the visual result must be identical in the current theme. Do not upgrade a component's design during migration. Those are separate concerns.

### 2.3 Prefer controlled migration over aggressive rewrites

Phase 5B migrated 18 files across five batches ordered by risk. That controlled approach exists for a reason: wide-scope rewrites in SCSS cause silent visual regressions that are hard to detect without full UI review. Always migrate one file or one batch at a time, with a TypeScript check and a visual spot-check after each.

### 2.4 Do not introduce hardcoded brand values in component SCSS

If you find yourself writing `#B5190C`, `#8a1309`, `rgba(181, 25, 12, x)`, `'Open Sans', sans-serif`, or `'Montserrat', sans-serif` directly in a component `.scss` file, stop. Use the corresponding `--sw-*` token. These values are locked behind tokens precisely so components never need to know them.

### 2.5 Keep admin styling isolated

The Velzon admin template (`src/app/layouts/`, `src/app/pages/`, `src/app/shared/widget/`) uses its own styling system. Do not apply `--sw-*` tokens to admin components. Do not reference `bs-*` Bootstrap overrides into landing components. These two styling systems are intentionally isolated and must remain so.

---

## 3. Canonical Token System

All tokens are defined in `src/assets/scss/_theme-variables.scss`. This section documents the currently approved families.

### 3.1 Brand colors

```scss
--sw-primary:       #B5190C   // Brand red — primary action color
--sw-primary-rgb:   181, 25, 12  // RGB components for use in rgba()
--sw-primary-dark:  #8a1309   // Hover/active state of primary
--sw-primary-light: #d41e10   // Lighter variant (e.g. dark-mode links)
--sw-primary-soft:  rgba(181, 25, 12, 0.12)  // Subtle tint for backgrounds
```

**Usage pattern for rgba:**

```scss
// CORRECT — uses the RGB component token
box-shadow: 0 0 0 3px rgba(var(--sw-primary-rgb), 0.25);

// WRONG — hardcodes RGB values
box-shadow: 0 0 0 3px rgba(181, 25, 12, 0.25);
```

### 3.2 Neutral backgrounds

```scss
--sw-bg-primary:    #ffffff   // Page-level background
--sw-bg-secondary:  #f8f9fa   // Slightly elevated surfaces (headers, footers)
--sw-bg-tertiary:   #e9ecef   // Hover backgrounds, subtle fills
--sw-bg-surface:    #ffffff   // Card and panel surfaces
--sw-bg-elevated:   #ffffff   // Elevated surfaces (dropdowns, modals)
```

In dark mode these resolve to dark equivalents automatically. Never hardcode `#ffffff` or `#f8f9fa` in component backgrounds.

### 3.3 Text colors

```scss
--sw-text-primary:   #1a1a1a  // Body copy, headings
--sw-text-secondary: #666666  // Supporting text, labels
--sw-text-muted:     #999999  // Placeholder, captions
--sw-text-inverse:   #ffffff  // Text on dark/colored backgrounds
```

**Dark mode note:** `--sw-text-inverse` resolves to `#1a1a1a` in dark mode. This means it should only be used for text that sits on `--sw-primary` or another always-dark surface. For `color: white` on brand-colored buttons with a dedicated dark-mode block, prefer the literal `white` — see §4 for this exception.

### 3.4 Borders

```scss
--sw-border-primary:   #e5e7eb  // Standard dividers and input borders
--sw-border-secondary: #f0f0f0  // Subtle separators
--sw-border-focus:     var(--sw-primary)  // Focus ring border color
```

### 3.5 Shadows

```scss
--sw-shadow-sm:  0 2px 4px rgba(0, 0, 0, 0.05)
--sw-shadow-md:  0 4px 12px rgba(0, 0, 0, 0.1)
--sw-shadow-lg:  0 10px 25px rgba(0, 0, 0, 0.15)
```

Prefer these tokens for standard card and panel shadows. Custom shadow values (unusual spread, blur, or alpha) may remain literal.

### 3.6 Typography

```scss
--sw-font-heading: 'Bebas Neue', 'Arial Black', sans-serif
--sw-font-body:    'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
--sw-font-ui:      'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
--sw-font-mono:    'Courier New', Courier, monospace
```

Never write raw font stacks in component SCSS. If you use a font, reference its token. Font-size, font-weight, and line-height values are still component-local and do not require tokens.

### 3.7 Spacing

The 4-point spacing scale is available for optional use. Component-local spacing may still use raw `rem` values — the spacing tokens are not yet mandated across all components.

```scss
--sw-space-1:   0.25rem  //  4px
--sw-space-2:   0.5rem   //  8px
--sw-space-3:   0.75rem  // 12px
--sw-space-4:   1rem     // 16px
--sw-space-6:   1.5rem   // 24px
--sw-space-8:   2rem     // 32px
--sw-space-12:  3rem     // 48px
--sw-space-16:  4rem     // 64px
```

### 3.8 Border radius

```scss
--sw-radius-sm:   0.25rem  //  4px
--sw-radius-md:   0.5rem   //  8px
--sw-radius-lg:   0.75rem  // 12px
--sw-radius-xl:   1rem     // 16px
--sw-radius-full: 9999px   // pill shape
```

### 3.9 Motion / transitions

```scss
--sw-transition-fast:  150ms ease   // Micro-interactions (button hover, icon fade)
--sw-transition-base:  300ms ease   // Standard state changes
--sw-transition-slow:  500ms ease   // Entrances, reveals, panel slides
```

**Important:** These tokens respect `prefers-reduced-motion`. The `:root` block in `_theme-variables.scss` overrides all three to `0ms` when reduced motion is requested. Raw transition values like `0.2s ease` or `transition: all 0.3s ease` bypass this accessibility behaviour. Always use tokens.

The following transition types are acceptable as literals and should **not** be replaced with tokens:
- `cubic-bezier(...)` spring animations — the custom easing cannot be expressed by any token
- `0.8s ease` for intentional slow-zoom effects (e.g. product image hover)
- `ease-in-out` timing functions where the intent is specifically non-ease

### 3.10 Z-index

```scss
--sw-z-base:     1
--sw-z-dropdown: 100
--sw-z-sticky:   200
--sw-z-overlay:  300
--sw-z-modal:    400
--sw-z-toast:    500
```

Use these tokens for any stacking context that interacts with other layered UI. Arbitrary z-index values in components cause stacking order conflicts.

---

## 4. Hardcoding Rules

### 4.1 What must never be hardcoded in component SCSS

| Value | Token to use instead |
|-------|---------------------|
| `#B5190C` / `#b5190c` | `var(--sw-primary)` |
| `#8a1309` / `darken($brand-red, 7–8%)` | `var(--sw-primary-dark)` |
| `#d41e10` / `lighten($brand-red, x%)` | `var(--sw-primary-light)` |
| `rgba(181, 25, 12, x)` | `rgba(var(--sw-primary-rgb), x)` |
| `$brand-red` SCSS variable | delete; use `var(--sw-primary)` |
| `$brand-red-light` SCSS variable | delete; use literal `#ff3366` or a future `--sw-color-heart` token |
| `#ffffff` / `#fff` as a background | `var(--sw-bg-surface)` or `var(--sw-bg-secondary)` |
| `#f8f9fa` as a background | `var(--sw-bg-secondary)` |
| `#1a1a1a` / `#212529` / `#333` as text color | `var(--sw-text-primary)` |
| `#495057` / `#555` / `#666` as text color | `var(--sw-text-secondary)` |
| `#6c757d` / `#777` / `#999` as text color | `var(--sw-text-muted)` |
| `#e5e7eb` / `#dee2e6` / `#eee` / `#ddd` as border | `var(--sw-border-primary)` |
| `'Open Sans', sans-serif` | `var(--sw-font-body)` |
| `'Montserrat', sans-serif` | `var(--sw-font-ui)` |
| `'Bebas Neue', sans-serif` | `var(--sw-font-heading)` |
| `'Courier New', monospace` | `var(--sw-font-mono)` |
| `0.2s ease` transition | `var(--sw-transition-fast)` |
| `0.3s ease` transition | `var(--sw-transition-base)` |
| `0.5s ease` transition | `var(--sw-transition-slow)` |

### 4.2 What may still be hardcoded in justified cases

These categories of literal values are acceptable and should not be forcibly tokenised:

**Structural overlay and scrim layers**

```scss
// ACCEPTABLE — these are transparency layers, not color tokens
background: rgba(0, 0, 0, 0.5);
background: rgba(0, 0, 0, 0.7);
text-shadow: 2px 2px 8px rgba(0, 0, 0, 0.4);
```

**White shimmer and animation effects**

```scss
// ACCEPTABLE — decorative shimmer on dark backgrounds, not a surface token
background: rgba(255, 255, 255, 0.15);
background: rgba(255, 255, 255, 0.2);
```

**`color: white` on brand-colored or permanently-dark surfaces**

```scss
// ACCEPTABLE — button text on --sw-primary background
// --sw-text-inverse resolves to #1a1a1a in dark mode, which would break contrast
.filter-btn {
  background: var(--sw-primary);
  color: white;  // intentional literal: dark mode still needs white text here
}
```

**Non-brand semantic UI colors (Bootstrap status colors)**

```scss
// ACCEPTABLE — these are intentional semantic colors, not brand red
$status-delivered: #28a745;  // success green
$status-shipped:   #6f42c1;  // info purple
$status-cancelled: #dc3545;  // error red
```

**Heart/favorites accent**

```scss
// ACCEPTABLE — #ff3366 is a distinct pink/magenta, NOT --sw-primary-light (#d41e10)
// Replacing it with --sw-primary-light would change the visual meaning
$color-heart: #ff3366;
```

**Custom easing transitions**

```scss
// ACCEPTABLE — cubic-bezier springs cannot be expressed as a timing token
transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
```

**Animated gradient art that uses pure black / pure red**

```scss
// ACCEPTABLE — this is a decorative animation loop, not a brand color
background: linear-gradient(45deg, #000000, #ff0000, #000000, #ff0000);
```

**Dark CTA buttons with no token equivalent**

```scss
// ACCEPTABLE (for now) — #333/#222 as button backgrounds have no --sw-* token
// Document as a future opportunity (see §10)
background: #333;
&:hover { background: #222; }
```

**Bootstrap invalid/error state**

```scss
// ACCEPTABLE — Bootstrap's error color, not a brand color
&.is-invalid { border-color: #dc3545; }
```

**rgba() with neutral muted text where no RGB component token exists**

```scss
// ACCEPTABLE — CSS custom properties cannot be used as rgba() arguments
// --sw-text-muted is a full color value, not an RGB triplet
background-color: rgba(108, 117, 125, 0.15);  // literal RGB of --sw-text-muted
// FUTURE: add --sw-text-muted-rgb if this pattern becomes common
```

### 4.3 Prohibited patterns

These SCSS constructs must never appear in component files:

```scss
// PROHIBITED — local brand variable declarations
$brand-red: #B5190C;
$brand-red-light: ...;
$brand-red-dark: ...;

// PROHIBITED — SCSS darken/lighten on brand variable
background: darken($brand-red, 8%);
color: lighten($brand-red, 10%);

// PROHIBITED — hardcoded brand hex anywhere in component SCSS
background-color: #B5190C;
border: 2px solid #b5190c;

// PROHIBITED — raw font stacks
font-family: 'Open Sans', sans-serif;
font-family: 'Montserrat', -apple-system, ...;
```

---

## 5. Light / Dark Mode Rules

### 5.1 How theme switching works

SmellAndWear uses two mechanisms for theme switching:

1. **`[data-bs-theme="dark"]`** — Bootstrap's standard attribute applied to `<html>` or `<body>`
2. **`[data-sw-theme="dark"]`** — SmellAndWear's own attribute (both selectors are equivalent in `_theme-variables.scss`)

When either attribute is present, the dark theme block in `_theme-variables.scss` overrides all `--sw-*` token values. Components that use only `--sw-*` tokens automatically respond to theme changes without any additional code.

### 5.2 Semantic token consumption is the only supported pattern

```scss
// CORRECT — automatic dark mode support
.card {
  background: var(--sw-bg-surface);   // #ffffff in light, #1e1e1e in dark
  color: var(--sw-text-primary);      // #1a1a1a in light, #f5f5f5 in dark
  border: 1px solid var(--sw-border-primary);
}

// WRONG — requires manual dark mode duplication
.card {
  background: #ffffff;
  color: #1a1a1a;
  // then later:
  [data-bs-theme="dark"] & {
    background: #1e1e1e;
    color: #f5f5f5;
  }
}
```

The wrong pattern existed in `product-card.component.scss` before Phase 5B. It was eliminated during Batch C.

### 5.3 Local dark mode overrides — when they are still acceptable

A local `[data-bs-theme="dark"]` block inside a component SCSS file is acceptable **only** when:

1. The component has a purely visual property (e.g. `color: #ff3d3d` — brighter red for dark mode) that has no token equivalent yet, **and**
2. The override is small (1–5 lines), isolated, and documented with a comment.

Do not write large parallel dark-mode blocks that duplicate the entire component layout. Migrate to tokens instead.

### 5.4 `--sw-text-inverse` usage

`--sw-text-inverse` resolves to `#ffffff` in light mode and `#1a1a1a` in dark mode. It is appropriate for text on always-light surfaces that invert on dark mode. It is **not** appropriate for text on `--sw-primary` (brand red) backgrounds — those must use `white` or `var(--sw-text-inverse)` only if the background also adapts. When in doubt, use `color: white` as an intentional literal.

---

## 6. Component Migration Rules

### 6.1 How to migrate a component safely

Follow this sequence exactly. Do not skip steps.

1. **Read the full file** before making any change. Understand all hardcoded values in context.
2. **Map every value** to a token (or decide it is an acceptable literal) before editing anything.
3. **Check `_theme-variables.scss`** to confirm the token you plan to use actually exists.
4. **Apply one file at a time.** Do not batch multiple files in a single commit.
5. **Commit immediately** after each file. Use the format: `style(<component>): migrate hardcoded values to SW tokens`
6. **Run TypeScript check** after each commit: `npx tsc --noEmit --project tsconfig.app.json`
7. **Visual spot-check** the affected component in browser before marking done.

### 6.2 When to use a token vs leave as literal

Ask these questions in order:

| Question | Answer | Action |
|----------|--------|--------|
| Is it a brand color (`#B5190C` family)? | Yes | Use `var(--sw-primary)` or related. Never literal. |
| Is it a structural overlay/scrim (`rgba(0,0,0,x)`)? | Yes | Leave as literal. These are transparency layers. |
| Does an exact token exist for this value? | Yes | Use the token. |
| Is it a near-match (e.g. `#6c757d` vs `--sw-text-muted: #999999`)? | Yes | Use the token — accept the minor shift. |
| Is it a non-brand semantic color (`#28a745`, `#dc3545`)? | Yes | Leave as literal or keep as SCSS variable. |
| Is it a decorative animation color (`#f6e58d`, `#ff0000` in gradient art)? | Yes | Leave as literal. |
| Is it a white/light shimmer on a dark surface? | Yes | Leave as literal. |
| None of the above applies — no token exists | — | Leave as literal. Consider adding a token in §10. |

### 6.3 How to handle risky files

Files with more than 30 hardcoded values, complex SCSS variables, or JavaScript-coupled state styling (e.g. scroll-state classes toggled by TypeScript) require extra care:

1. Open a dedicated plan document in `docs/superpowers/plans/` before touching the file.
2. Map all SCSS variables and their computed usages before migrating anything.
3. Migrate in sub-batches within the same file (e.g. brand colors first, then neutrals, then transitions).
4. Run the project in a browser after each sub-batch.
5. Never combine risky file migration with other styling work in the same PR.

### 6.4 How to document intentional exceptions

When a value must remain as a literal despite having a close token, document it inline:

```scss
// INTENTIONAL LITERAL: #ff3366 is the favorites heart accent.
// It is NOT --sw-primary-light (#d41e10) — these are different hues.
$color-heart: #ff3366;

// INTENTIONAL LITERAL: #333 dark CTA button background.
// No --sw-* token exists for a dark neutral button background yet.
// See docs/design-system-rules.md §10 for future tokenisation plan.
background: #333;

// INTENTIONAL LITERAL: rgba() does not accept CSS custom properties.
// Literal RGB of --sw-text-muted (#6c757d = 108,117,125).
background-color: rgba(108, 117, 125, 0.15);
```

This makes auditing unambiguous: a grep for `#B5190C` with zero results confirms full migration; a grep for `#333` with comments confirms intentional exceptions.

### 6.5 Eliminating SCSS variable declarations

Any component that defines local SCSS brand variables must eliminate them during migration:

```scss
// BEFORE — prohibited pattern
$brand-red: #B5190C;
$brand-red-light: #ff3366;

.card { border: 1px solid $brand-red; }
.icon { color: darken($brand-red, 8%); }
.soft { background: rgba($brand-red, 0.1); }

// AFTER — correct pattern
// $brand-red-light (#ff3366) kept as $color-heart — see §4.2
$color-heart: #ff3366;

.card { border: 1px solid var(--sw-primary); }
.icon { color: var(--sw-primary-dark); }
.soft { background: rgba(var(--sw-primary-rgb), 0.1); }
```

Do not rename `$brand-red` to another SCSS variable name. Delete the variable and use the CSS custom property directly.

---

## 7. Sensitive / Deferred Zones

These files must not be casually touched. Each has specific risk factors that require dedicated planning before any migration work begins.

### 7.1 `checkout.component.scss` — Permanently deferred

**Path:** `src/app/landing/checkout/checkout.component.scss`

**Why sensitive:** This file styles the payment flow. Any visual instability — broken button states, obscured input fields, wrong colors in form validation — can interrupt the purchase process and directly impact revenue. Payment UI regressions are the hardest to catch in testing because they involve real payment provider interactions.

**Current state:** 8 occurrences of `#B5190C`, pre-existing `--sw-*` tokens from Phase 5.

**Policy:** Do not modify this file under any circumstances until:
- The Paystack integration has been tested end-to-end with a full checkout flow
- A dedicated review with explicit visual sign-off is in place
- All other Batch F files have been successfully migrated first as lower-risk practice

### 7.2 `topbar.component.scss` — High-risk deferred

**Path:** `src/app/shared/landing/index/topbar/topbar.component.scss`

**Why sensitive:** The topbar is rendered on every landing page. It has 2047 lines, 186 hardcoded color values, and four SCSS variables (`$cart-red`, `$cart-red-dark`, `$cart-red-light`, `$cart-red-soft`) that drive shadow and rgba calculations. Critically, icon and link colors change dynamically via TypeScript class toggling based on scroll position — meaning a CSS token substitution here can interact unexpectedly with JavaScript state.

**Current state:** 54 brand color occurrences, 19 pre-existing `--sw-*` tokens from Phase 0.

**Required approach:**
1. Read the full file and map every SCSS variable usage and every scroll-state class
2. Create a dedicated plan document (not an ad-hoc batch entry)
3. Migrate only brand color tokens first, verify scroll behaviour
4. Migrate neutrals as a separate pass
5. Full visual review on both mobile and desktop before and after

### 7.3 `product-detail.component.scss` — Medium-risk deferred

**Path:** `src/app/landing/product-detail/product-detail.component.scss`

**Why sensitive:** 861 lines covering product gallery, variant selector, size chart, and sticky CTA. The font `'Helvetica Neue', Arial, sans-serif` appears here — this is an intentional design choice (system font for product detail) that must be verified against `var(--sw-font-body)` before substitution.

**Current state:** 54 hardcoded color values, 8 `#B5190C` occurrences, 1 font-family.

**Required approach:** Pair with `s-c-products.component.scss` in the same batch. Both are product listing/detail views and share similar patterns.

### 7.4 `signup-landing.component.scss` — Medium-risk deferred

**Path:** `src/app/landing/auth/signup/signup-landing.component.scss`

**Why sensitive:** Signup flow regression means users cannot register. The visual complexity is significant (multi-section card layout) and bugs here affect user acquisition.

**Current state:** 12 `#B5190C` occurrences, 357 lines, 47 hardcoded values.

**Required approach:** Migrate after `login-landing.component.scss` (already migrated in Batch E) is confirmed stable in production. Use `login-landing` as the reference pattern — the two files have very similar structure.

### 7.5 Admin template SCSS — Permanently isolated

**Paths:** `src/app/layouts/`, `src/app/pages/`, `src/app/shared/widget/`

**Why sensitive:** These files belong to the Velzon admin template. They use their own theming system, variable naming conventions, and component architecture. Applying `--sw-*` tokens to admin files would mix two incompatible design systems and create unpredictable results.

**Policy:** Never apply `--sw-*` tokens to admin template files. Never reference Bootstrap overrides from admin SCSS in landing components. These two zones are permanently isolated.

---

## 8. Review Checklist

Use this checklist before approving any PR that contains SCSS changes.

### Mandatory checks

- [ ] No new `#B5190C` or `#b5190c` values added to any component file
- [ ] No new `$brand-red`, `$brand-red-light`, `$brand-red-dark`, or `$cart-red` SCSS variable declarations
- [ ] No raw font stacks (`'Open Sans', sans-serif`, `'Montserrat', sans-serif`, etc.) in component files
- [ ] All new transitions use `var(--sw-transition-*)` tokens, or are documented exceptions
- [ ] Token references verified against `_theme-variables.scss` (the token actually exists)
- [ ] No deferred file (checkout, topbar, product-detail, signup-landing) was modified without a dedicated plan

### Quality checks

- [ ] Intentional literal values are documented with an inline comment explaining why
- [ ] `rgba()` calls that use brand color use `rgba(var(--sw-primary-rgb), x)` form
- [ ] `color: white` on colored-background buttons is intentional and commented
- [ ] No admin SCSS files (`layouts/`, `pages/`, `widget/`) were modified
- [ ] Visual spot-check performed: affected component looks identical to pre-migration in light mode
- [ ] Visual spot-check performed: dark mode (if applicable) shows no regression
- [ ] TypeScript check passed: `npx tsc --noEmit --project tsconfig.app.json` reports 0 errors

### Grep verification commands

Run these before marking a migration complete:

```bash
# 1. Confirm no brand hex remains in the migrated file
grep -n "#B5190C\|#b5190c" <file>

# 2. Confirm no $brand-red SCSS variable remains
grep -n "\$brand-red\|\$cart-red" <file>

# 3. Confirm no raw font stacks remain
grep -n "'Open Sans'\|'Montserrat'\|'Bebas Neue'\|'Courier New'" <file>

# 4. Confirm TypeScript is clean
npx tsc --noEmit --project tsconfig.app.json
```

---

## 9. Recommended Workflow

### For token migration tasks

```
1. AUDIT
   └─ Read the target file fully
   └─ Map every hardcoded value to a token or document it as an intentional literal
   └─ Identify SCSS variable declarations to eliminate
   └─ Confirm all target tokens exist in _theme-variables.scss

2. PLAN
   └─ For files < 30 values: migrate in a single pass
   └─ For files 30–60 values: migrate brand colors first, then neutrals, then transitions
   └─ For files > 60 values (topbar): create a dedicated plan document first

3. IMPLEMENT
   └─ One file per commit
   └─ Commit message format: style(<component>): migrate hardcoded values to SW tokens
   └─ Document every intentional literal inline before committing

4. VERIFY
   └─ npx tsc --noEmit
   └─ Grep check (see §8)
   └─ Browser visual check: light mode
   └─ Browser visual check: dark mode (if component has dark support)

5. REVIEW
   └─ Apply the §8 checklist
   └─ Request approval before merging
```

### For new component development

```
1. Start with tokens from day one — no placeholder hardcoded values
2. Check _theme-variables.scss for the right token before writing any color/font/spacing
3. If no token exists for a value you need, discuss adding one before adding a literal
4. Run the §8 review checklist before the first PR for any new component
```

### For hotfixes and urgent styling changes

Even under time pressure:
- Do not add `#B5190C` or any raw brand value as a quick fix
- `var(--sw-primary)` is exactly as easy to type and is always correct
- Token violations in hotfixes accumulate into the same disorder Phase 5B cleaned up

---

## 10. Future Improvements

These are optional enhancements for future iterations. They are not urgent but are noted here to prevent ad-hoc solutions.

### 10.1 Heart/favorites semantic token

**Current state:** `#ff3366` is used as a literal `$color-heart` SCSS variable in `account-favorites.component.scss` and `account-orders.component.scss`.

**Proposed improvement:** Add `--sw-color-heart: #ff3366` to `_theme-variables.scss`. This would make the favorites accent colour themeable (useful if the brand ever decides on a different accent for wishlists) and eliminate the last SCSS variable from account components.

### 10.2 Dark neutral button background token

**Current state:** `#333` and `#222` are used as button backgrounds in `search-bar.component.scss` (desktop and mobile "Load more" buttons). No `--sw-*` token for a dark neutral button background currently exists.

**Proposed improvement:** Add `--sw-btn-dark-bg: #333` and `--sw-btn-dark-hover: #222` to the theme. This would complete the search bar migration to 100% token coverage.

### 10.3 Muted text RGB component token

**Current state:** `rgba(108, 117, 125, 0.15)` appears in `account-orders.component.scss` as a literal because `rgba()` cannot accept CSS custom properties as colour arguments.

**Proposed improvement:** Add `--sw-text-muted-rgb: 108, 117, 125` (mirroring the `--sw-primary-rgb` pattern). Then the expression becomes `rgba(var(--sw-text-muted-rgb), 0.15)`.

### 10.4 Batch F dedicated plans

Each of the four remaining high-risk files deserves its own planning document before migration begins:

| File | Recommended approach |
|------|---------------------|
| `topbar.component.scss` | Full SCSS variable audit first; migrate in 3 sub-batches |
| `product-detail.component.scss` | Pair with `s-c-products.component.scss`; verify Helvetica Neue intent |
| `signup-landing.component.scss` | Model after the already-complete `login-landing.component.scss` |
| `checkout.component.scss` | Only after end-to-end payment flow test is in place |

### 10.5 Very-light icon placeholder token

**Current state:** `#ccc` is used in `search-bar.component.scss` for empty-state search icons. It has no `--sw-*` token equivalent.

**Proposed improvement:** Consider adding `--sw-icon-placeholder: #cccccc` to the icon token family.

### 10.6 `--sw-bg-tertiary` consistency for hover states

Several components still use `#f5f5f5` as a subtle hover background (which sits between `--sw-bg-secondary` and `--sw-bg-tertiary` in brightness). If `--sw-bg-tertiary` is confirmed as `#e9ecef` and `--sw-bg-secondary` as `#f8f9fa`, the `#f5f5f5` value fits neither exactly. Either:
- Accept `var(--sw-bg-tertiary)` as close enough, or
- Add `--sw-bg-hover: #f5f5f5` as a dedicated hover-state background token

---

## Appendix — Token Quick Reference

```
BRAND
  --sw-primary            Brand red             #B5190C
  --sw-primary-rgb        Brand red RGB         181, 25, 12
  --sw-primary-dark       Brand red hover       #8a1309
  --sw-primary-light      Brand red light       #d41e10
  --sw-primary-soft       Brand red soft tint   rgba(181,25,12,0.12)

BACKGROUNDS
  --sw-bg-surface         Card / panel white    #ffffff
  --sw-bg-secondary       Elevated background   #f8f9fa
  --sw-bg-tertiary        Hover / subtle fill   #e9ecef

TEXT
  --sw-text-primary       Primary copy          #1a1a1a
  --sw-text-secondary     Supporting text       #666666
  --sw-text-muted         Captions / labels     #999999
  --sw-text-inverse       Text on dark bg       #ffffff

BORDERS
  --sw-border-primary     Standard divider      #e5e7eb
  --sw-border-secondary   Subtle separator      #f0f0f0

SHADOWS
  --sw-shadow-sm          Small shadow          0 2px 4px rgba(0,0,0,0.05)
  --sw-shadow-md          Medium shadow         0 4px 12px rgba(0,0,0,0.1)
  --sw-shadow-lg          Large shadow          0 10px 25px rgba(0,0,0,0.15)

MOTION
  --sw-transition-fast    Micro-interactions    150ms ease
  --sw-transition-base    Standard changes      300ms ease
  --sw-transition-slow    Entrances / reveals   500ms ease

TYPOGRAPHY
  --sw-font-heading       Bebas Neue stack
  --sw-font-body          Open Sans stack
  --sw-font-ui            Montserrat stack
  --sw-font-mono          Courier New stack

Z-INDEX
  --sw-z-dropdown         100
  --sw-z-sticky           200
  --sw-z-overlay          300
  --sw-z-modal            400
  --sw-z-toast            500
```

---

*Generated 2026-03-17 — based on codebase state after Phase 5B batch A–E completion.*
*Source of truth: `src/assets/scss/_theme-variables.scss`*
*Migration history: `docs/superpowers/plans/2026-03-17-phase5b-component-token-migration.md`*
