# Unification Roadmap — SmellAndWear
> **Generated:** 2026-03-16
> **Purpose:** Safe, phased strategy to unify the codebase, centralize the theme, and clean up the Velzon template artifacts — without breaking the Admin area or the payment flow.
> **Rule:** No phase may be started until its prerequisites are met. Admin safety takes priority over cleanup speed.

---

## Executive Summary

The SmellAndWear codebase contains three layers that must be unified:

1. **Template artifacts** — Velzon v4.1.0 structures that are dead (no project usage) but still registered in NgModules, NgRx, SCSS, and `angular.json`
2. **Naming inconsistencies** — French-named services/folders that coexist with English equivalents
3. **Color/token fragmentation** — Brand tokens (`--sw-*`) defined but overridden by Velzon tokens (`--vz-*`), causing color drift on the live site

The roadmap is split into **5 phases**. Each phase is independent in scope but sequential in order. A phase that could affect Admin functionality is explicitly gated.

---

## Prerequisites Before Any Phase Starts

| Prerequisite | Action | Owner |
|-------------|--------|-------|
| Locate `theme-variables.scss` source | Find where `--sw-*` tokens are actually declared; they exist at runtime but the file is not in `src/assets/scss/` | Dev |
| Confirm `environment.defaultauth` value | Check `src/environments/environment.ts` and `environment.prod.ts` — if it is never `'firebase'`, `authUtils.ts` is dead | Dev |
| Confirm Admin layout switcher state | Check if the layout-type switcher UI is exposed to admin users — determines whether horizontal/two-column layouts are live | Dev |
| Verify Google Fonts import | Confirm Bebas Neue, Open Sans, Montserrat are in `index.html` or a loaded CSS file | Dev |
| Run full build successfully | `ng build` must pass with zero errors before any phase begins — establishes a baseline | CI |

---

## Phase 0 — Color Fix (Immediate, Zero Risk)

**Goal:** Fix the three live color mismatches identified in the audit without touching any component, template, or routing.
**Risk:** Minimal — CSS-only change, scoped to `:root` overrides.
**Admin impact:** None — the `--vz-primary` override will affect admin sidebar if it uses `$primary`-derived colors. Test admin sidebar after applying.

### Steps

**Step 0.1 — Create brand override file**

Create `src/assets/scss/sw-brand-overrides.scss`:

```scss
// SmellAndWear Brand Overrides
// Loaded AFTER the Velzon bundle to ensure these win at :root level.
// DO NOT put anything here that should only apply to the landing area.

:root {
  // Override Velzon primary to brand red
  --vz-primary:        #B5190C;
  --vz-primary-rgb:    181, 25, 12;

  // Override Velzon danger to brand red (fixes back-to-top button)
  --vz-danger:         #B5190C;
  --vz-danger-rgb:     181, 25, 12;

  // Override Velzon link color to dark neutral (fixes social icon blue)
  --vz-link-color:     #212529;
  --vz-link-color-rgb: 33, 37, 41;
  --vz-link-hover-color: #B5190C;
}
```

**Step 0.2 — Add to `angular.json` styles array**

Insert after `src/assets/scss/config/default/app.scss` and before `src/assets/scss/icons.scss`:

```json
"src/assets/scss/sw-brand-overrides.scss"
```

**Step 0.3 — Fix promo discount badge**

In the component(s) rendering `.promo-badge` and `.mobile-promo-badge`, change:
```scss
background: red;           // or background: #ff0000
→ background: var(--sw-primary);
```

**Step 0.4 — Fix back-to-top button class**

In the landing component template that renders the back-to-top button, change:
```html
class="btn btn-danger btn-icon landing-back-top"
→ class="btn btn-primary btn-icon landing-back-top"
```
Or create a dedicated `.btn-brand` class using `--sw-primary`.

**Step 0.5 — Fix cart count badge**

In the cart badge component, change hardcoded `#CD1C0E` to `var(--sw-primary)`.

**Step 0.6 — Verify admin sidebar**

After applying overrides: open `/admin` and confirm the sidebar still renders correctly. If sidebar background changes (it uses `$primary`-derived variables), add a scoped re-override:
```scss
.layout-wrapper:not(.landing) {
  --vz-primary: #405189;  // Restore Velzon primary for admin only
}
```

**Deliverable:** Live site passes visual color compliance. All three mismatch categories resolved.

---

## Phase 1 — Dead NgRx Store Cleanup

**Goal:** Remove 10 dead NgRx slices from `app.module.ts` registrations and then delete their folders.
**Risk:** Low — none of these slices are consumed. But `app.module.ts` changes carry compile risk.
**Admin impact:** None (admin uses only `Authentication`, `Ecommerce`, `layouts`).

### Steps (must be in this exact order)

**Step 1.1 — Remove `StoreModule.forFeature` registrations from `app.module.ts`**

Remove registrations for:
- `CrmReducer` / `CrmEffects`
- `CryptoReducer` / `CryptoEffects`
- `InvoiceReducer` (note: `invoice.service.ts` stays — it is separate)
- `JobsReducer` / `ApplicationEffects`
- `ProjectReducer` / `ProjectEffects`
- `TaskReducer` / `TaskEffects`
- `TicketReducer` / `TicketEffects`
- `TodoReducer` / `TodoEffects`
- `FileManagerReducer` / `FileManagerEffects`
- `ApiKeyReducer` / `ApiKeyEffects`

**Step 1.2 — Remove corresponding imports at top of `app.module.ts`**

**Step 1.3 — Run `ng build` — must pass with zero errors**

**Step 1.4 — Delete store folders**

```
store/CRM/
store/Crypto/
store/Invoice/
store/Jobs/
store/Project/
store/Task/
store/Ticket/
store/Todo/
store/File Manager/
store/APIKey/
```

**Step 1.5 — Run `ng build` again — confirm still clean**

**Deliverable:** 10 dead NgRx slices removed. `app.module.ts` clean. Build passes.

---

## Phase 2 — Dead Component Cleanup

**Goal:** Remove dead template components from `SharedModule`, `WidgetModule`, and pages.
**Risk:** Medium — `SharedModule` and `WidgetModule` declarations/exports must be cleaned before folder deletion.
**Admin impact:** None (all deleted components are never instantiated in admin templates).

### Steps

**Step 2.1 — Remove dead landing components from `shared.module.ts`**

From `declarations` and `exports` arrays, remove:
- All components in `shared/landing/job/` (6 components)
- All components in `shared/landing/nft/` (6 components)

**Step 2.2 — Remove dead widgets from `widget.module.ts`**

From `declarations` and `exports`, remove:
- All components in `widget/crm/` (4)
- All components in `widget/crypto/` (4)
- All components in `widget/nft/` (1)
- All components in `widget/projects/` (4)
- `widget/analytics/analatics-stat/` (1)
- `widget/analytics/top-pages/` (1)

**Step 2.3 — Run `ng build` — must pass**

**Step 2.4 — Delete dead component folders**

```
src/app/shared/landing/job/
src/app/shared/landing/nft/
src/app/shared/widget/crm/
src/app/shared/widget/crypto/
src/app/shared/widget/nft/
src/app/shared/widget/projects/
src/app/shared/widget/analytics/analatics-stat/
src/app/shared/widget/analytics/top-pages/
```

**Step 2.5 — Remove pages/charts/ and pages/apps/**

These modules need their imports removed from `pages.module.ts` (if present):
- Remove `ChartsModule` import and routing entry (if present)
- Remove `AppsModule` import and routing entry
- Delete `src/app/pages/charts/`
- Delete `src/app/pages/apps/`

**Step 2.6 — Remove dead layout: `layouts/rightsidebar/`**

Verify `layout.component.html` has no condition for `rightsidebar` (confirmed in audit). Remove declaration from `layouts.module.ts`, then delete folder.

**Step 2.7 — Remove dead landing: `landing/profile/`**

Verify `landing-routing.module.ts` has no route for this component. Remove from `landing.module.ts` declarations. Delete folder.

**Step 2.8 — Remove local toast service duplicates**

- Delete `src/app/account/login/toast-service.ts`
- Delete `src/app/account/login/toasts-container.component.ts`
- Delete `src/app/pages/dashboards/dashboard/toast-service.ts`
- Update any import references in `login.component.ts` and `dashboard.component.ts` to use `core/services/toast.service.ts`

**Step 2.9 — Remove misc dead files**

```
src/app/app-routing.module.ts~   (tilde backup)
src/typings.d.ts
src/app/typings.d.ts
src/app/shared-modules/          (feather-icons.module.ts — never imported)
src/app/core/models/request.sql  (move to docs/sql/ if content needed)
```

**Step 2.10 — Run `ng build` — confirm clean**

**Deliverable:** Dead component folders removed. Module declarations clean. Build passes.

---

## Phase 3 — Service Consolidation & Naming Normalization

**Goal:** Eliminate duplicate services and rename French-named services/files to English equivalents.
**Risk:** Medium-high — service renames touch imports across many components.
**Admin impact:** Some admin services may be affected. Test admin product listing and order management after.

### Prerequisite: Dependency Trace

Before renaming any service, run:
```bash
grep -r "ServiceNameHere" src/ --include="*.ts"
```
to get the full list of import sites.

### Step 3.1 — Delete confirmed duplicate services (no consumers lost)

| Delete | Keep | Verify first |
|--------|------|-------------|
| `favoris.service.ts` | `favorites.service.ts` | `grep -r "favoris" src/` |
| `favorite.service.ts` | `favorites.service.ts` | `grep -r "FavoriteService" src/` |
| `panier.service.ts` | `cart.service.ts` | `grep -r "panier" src/` |

After deletion: merge any unique logic found into the canonical service before deleting.

### Step 3.2 — Merge `promo.service.ts` into `promotion.service.ts`

Check for methods in `promo.service.ts` not present in `promotion.service.ts`. Migrate them. Then delete `promo.service.ts` and update all import sites.

### Step 3.3 — Rename French-named services (requires import updates)

**Priority order** (highest risk first):

| Current | Target | Risk |
|---------|--------|------|
| `commande-item.service.ts` | `order-item.service.ts` | Used in order flow |
| `categorie.service.ts` | `category.service.ts` | Used in admin + landing |
| `produit-photo.service.ts` | `product-photo.service.ts` | Used in add-product |
| `produit-variation.service.ts` | `product-variation.service.ts` | Used in product detail |

**For each rename:**
1. Copy file to new name
2. Update class name inside the file
3. Update all `import` statements across `src/`
4. Run `ng build`
5. Delete old file

### Step 3.4 — Investigate and resolve uncertain services

- `utilisateur.service.ts` vs `user.service.ts` — compare method signatures, merge if overlap exists
- `client.service.ts` vs `customer.service.ts` — same analysis
- `rest-api.service.ts` — verify if still called; if so, remove `global-component.ts` API URL reference

**Deliverable:** Service layer normalized to English names. No duplicate domains.

---

## Phase 4 — SCSS Dead Weight Removal

**Goal:** Remove SCSS for template features that have no project equivalent, reducing bundle size.
**Risk:** Low-medium — removing an SCSS file that is still referenced anywhere causes a build error.
**Admin impact:** Minimal if the correct files are removed (template-only pages).

### Prerequisites
- Confirm Phase 0 is complete (brand overrides are in place)
- Run a full build and confirm zero errors as baseline

### Step 4.1 — Locate `theme-variables.scss`

This is the most urgent SCSS prerequisite. The `--sw-*` tokens exist at runtime but the file is not found at `src/assets/scss/theme-variables.scss`. Search:
```bash
grep -r "sw-primary" src/ --include="*.scss"
grep -r "@import.*theme-variables" src/ --include="*.scss"
```
Locate the actual file. If it is defined inline in a component, extract it to a standalone file at `src/assets/scss/sw-brand-tokens.scss` and update `styles.scss` import.

### Step 4.2 — Remove confirmed dead SCSS page imports from `app.scss`

Remove the following `@import` lines from `src/assets/scss/config/default/app.scss`:

```scss
// SAFE TO REMOVE — no project feature:
@import "../../pages/chat";
@import "../../pages/email";
@import "../../pages/kanban";
@import "../../pages/nft-landing";
@import "../../pages/file-manager";
@import "../../pages/to-do";
@import "../../pages/jobs";
@import "../../pages/job-landing";
@import "../../pages/sitemap";
@import "../../pages/team";
@import "../../pages/landing";   // Velzon demo landing, not SW landing
```

**After each removal:** Run `ng build` and `ng serve` to verify no visual breakage.

### Step 4.3 — Investigate uncertain SCSS pages before removing

Before removing these, verify the corresponding project pages do not rely on them:

| SCSS File | Check before removing |
|-----------|----------------------|
| `pages/_gallery.scss` | Does `MediasComponent` or any page use `.gallery-*` classes? |
| `pages/_blog.scss` | Does `NewsComponent` use `.blog-*` classes? |
| `pages/_profile.scss` | Does `AccountSettingsComponent` use `.profile-*` classes? |
| `pages/_timeline.scss` | Does `OrderDetailsComponent` use `.timeline-*` classes? |
| `pages/_search-results.scss` | Is there a search results page? |

### Step 4.4 — Remove unused plugin imports

After confirming no project feature uses these plugins:

```scss
// Verify usage first, then remove if confirmed unused:
@import "../../plugins/tour";           // shepherd.js tour
@import "../../plugins/colorpicker";    // color picker UI
@import "../../plugins/multijs";        // multi-select alternative
@import "../../plugins/form-wizard";    // multi-step forms
@import "../../plugins/vector-maps";    // vector map (vs. leaflet)
```

### Step 4.5 — Clean `styles.scss` of NFT residue

Remove from `styles.scss`:
```scss
#landingnft {
  .slick-dots { ... }
}
```
This rule targets the dead NFT landing template section.

### Step 4.6 — Remove shepherd.js from `angular.json`

If the template tour is confirmed unused:
```json
// Remove from angular.json styles:
"node_modules/shepherd.js/dist/css/shepherd.css"
// Remove from angular.json scripts (if present):
"node_modules/shepherd.js/dist/js/shepherd.min.js"
```

**Deliverable:** SCSS bundle reduced. All remaining imports map to active project features.

---

## Phase 5 — Theme Centralization (Long-term)

**Goal:** Replace the dual `--sw-*` / `--vz-*` token system with a single unified design token file. Formally separate Admin styles from Landing styles.
**Risk:** High — touches every component. Must be done component by component.
**Admin impact:** High — Admin will temporarily depend on legacy tokens until migrated.

### Prerequisites
- Phases 0–4 complete
- All dead code removed
- `--vz-*` brand overrides in place (Phase 0)

### Step 5.1 — Establish the canonical token file

Create `src/assets/scss/design-tokens.scss` as the single source of truth:

```scss
// ============================================================
// SMELLWEAR DESIGN TOKENS — Single Source of Truth
// ============================================================

:root {
  // === Brand Palette ===
  --sw-color-brand:        #B5190C;
  --sw-color-brand-dark:   #8a1309;
  --sw-color-brand-light:  #d41e10;
  --sw-color-brand-alpha:  rgba(181, 25, 12, 0.12);

  // === Neutral Scale ===
  --sw-color-black:        #000000;
  --sw-color-near-black:   #1a1a1a;
  --sw-color-dark:         #212529;
  --sw-color-white:        #FFFFFF;

  // ... (expand as needed)
}
```

### Step 5.2 — Migrate landing components to unified tokens

Component by component, replace:
- `color: red` / `background: #FF0000` → `var(--sw-color-brand)`
- `color: #405189` (Velzon blue leakage) → `var(--sw-color-dark)` or `var(--sw-color-brand)`
- `var(--sw-btn-primary-bg)` → `var(--sw-color-brand)` (simplify)

### Step 5.3 — Formalize Landing vs Admin style isolation

Create a selector boundary in global styles:

```scss
// Landing: uses --sw-* tokens
.layout-wrapper.landing { ... }

// Admin: retains --vz-* tokens until rebuilt
.layout-wrapper:not(.landing) { ... }
```

### Step 5.4 — Long-term: Replace Velzon Admin Theme

This is the final step and the riskiest. Options:
1. **Option A (recommended):** Keep Velzon for admin forever. It is a valid, maintained template. Only fix the token conflicts.
2. **Option B:** Build a minimal custom admin shell with Angular Material or ng-bootstrap, migrating admin pages one by one.

**Do not start Option B until all landing cleanup is complete and stable.**

---

## Phase Sequencing Summary

```
Phase 0: Color Fix (1 day)
    ↓
Phase 1: Dead NgRx Cleanup (0.5 day)
    ↓
Phase 2: Dead Component Cleanup (1–2 days)
    ↓
Phase 3: Service Normalization (2–3 days)
    ↓
Phase 4: SCSS Dead Weight (1 day)
    ↓
Phase 5: Theme Centralization (ongoing, per-component)
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Admin layout breaks after `--vz-primary` override | Medium | High | Test admin sidebar immediately after Phase 0; add scoped re-override if needed |
| `StoreModule.forFeature` removal causes runtime error | Low | High | Remove registrations BEFORE folder deletion; run build after each step |
| Service rename misses an import | Medium | Medium | Use global grep before renaming; run full build after each rename |
| SCSS removal breaks admin page | Low | Medium | Remove one SCSS import at a time; run `ng serve` and visit admin after each |
| `theme-variables.scss` not found — tokens lost | High | Medium | Locate or recreate the file before any SCSS work |
| Layout switcher allows non-vertical admin layout | Medium | Medium | Check NgRx layout store before deleting horizontal/two-column variants |

---

## Cleanup Priority Stack (TL;DR Order)

| Priority | Action | Phase |
|----------|--------|-------|
| 🔴 Critical | Fix brand color mismatches live on site | Phase 0 |
| 🔴 Critical | Locate missing `theme-variables.scss` | Phase 0 prerequisite |
| 🟠 High | Remove 10 dead NgRx slices (app.module.ts bloat) | Phase 1 |
| 🟠 High | Remove dead template components (SharedModule bloat) | Phase 2 |
| 🟡 Medium | Normalize service naming (French → English) | Phase 3 |
| 🟡 Medium | Remove dead SCSS page bundles | Phase 4 |
| 🟢 Low | Remove unused packages (shepherd.js, etc.) | Phase 4 |
| 🟢 Low | Theme centralization (design tokens) | Phase 5 |
| 🟢 Low | Admin rebuild / Velzon replacement | Phase 5 (optional) |

---

*This document is the master sequencing guide. All work must follow this order. For the current state of each item, cross-reference `docs/codebase-usage-audit.md` (what exists), `docs/admin-template-dependency-map.md` (what the admin needs), and `docs/scss-import-map.md` (where styles are controlled).*
