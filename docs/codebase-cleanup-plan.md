# Codebase Cleanup Plan — SmellAndWear

> **Status:** Pre-refactor baseline
> **Last updated:** 2026-03-15
> **Scope:** Full cleanup before any new feature development

---

## 1. Goals

- Eliminate all dead template code (Velzon admin template remnants)
- Consolidate duplicated services and reduce the service count from 49 to ~30
- Establish a clear, enforced separation of concerns (components vs. services vs. Supabase)
- Reduce the Angular bundle by removing unused NgRx store modules and unused components
- Establish naming conventions (English throughout) before new features are added

---

## 2. Cleanup Phases

### Phase 1 — Security & Critical Fixes
**Deadline:** Before any other refactor work begins
**No tests required before starting. No PR review needed. Just delete and disable.**

| Task | Target | Risk |
|------|--------|------|
| Remove legacy-payment-notification Edge Function | `supabase/functions/legacy-payment-notification/` (deleted) | None — dead code with hardcoded credentials |
| Remove legacy-payment-return Edge Function | `supabase/functions/legacy-payment-return/` (deleted) | None — stub file, never implemented |
| Disable both in config.toml | `supabase/config.toml` (done) | None |
| Remove debug logs from checkout | `checkout.component.ts:949-957` | None — UI only |

**Done when:** (Phase 1 complete) Legacy payment provider removed; no hardcoded credentials.

---

### Phase 2 — Dead Template Code Deletion
**Prerequisite:** Phase 1 complete
**Rule:** Do not refactor, do not rename. Delete only. Run `ng build` after each batch.

#### Batch 2A — Pages & Charts (largest payload)
- `src/app/pages/charts/` — entire directory (18+ chart component subdirs, never routed)
- `src/app/pages/apps/` — empty module with no routes or components
- `src/app/shared-modules/` — unused feather-icons wrapper

#### Batch 2B — Landing Template Pages
- `src/app/shared/landing/job/` — job portal template (6 components)
- `src/app/shared/landing/nft/` — NFT marketplace template (6 components)
- `src/app/landing/profile/` — never routed (replaced by `landing/account/`)

#### Batch 2C — Template Widgets
- `src/app/shared/widget/crm/` — never instantiated in any template
- `src/app/shared/widget/crypto/` — never instantiated in any template
- `src/app/shared/widget/nft/` — never instantiated in any template
- `src/app/shared/widget/projects/` — never instantiated in any template
- `src/app/shared/widget/analytics/analatics-stat/` — never instantiated
- `src/app/shared/widget/analytics/top-pages/` — never instantiated

#### Batch 2D — Unused Layouts
- `src/app/layouts/rightsidebar/` — never referenced in `layout.component.html`

#### Batch 2E — Dead NgRx Store Modules
Remove from `src/app/store/` AND unregister from `src/app/app.module.ts`:
- `store/CRM/`
- `store/Crypto/`
- `store/Invoice/`
- `store/Jobs/`
- `store/Project/`
- `store/Task/`
- `store/Ticket/`
- `store/Todo/`
- `store/File Manager/`
- `store/APIKey/`

#### Batch 2F — Misc Dead Files
- `src/app/app-routing.module.ts~` — backup file
- `src/typings.d.ts` — empty file
- `src/app/typings.d.ts` — empty file
- `src/app/core/models/request.sql` — move to `docs/sql/` if needed, then delete from models

**Done when:** `ng build --configuration production` passes with zero errors.
**Metric:** Bundle size reduction expected ~15–20% gzipped.

---

### Phase 3 — Service Layer Consolidation
**Prerequisite:** Phase 2 complete
**Rule:** One service survives per domain. Consumers must be updated before the duplicate is deleted. One domain at a time.

#### 3A — Favorites (3 → 1)
- Keep: `favorites.service.ts`
- Delete: `favoris.service.ts`, `favorite.service.ts`
- Search all usages: `grep -r "favoris\|FavorisService\|FavoriteService" src/`

#### 3B — Cart (2 → 1)
- Keep: `cart.service.ts`
- Delete: `panier.service.ts`
- Search all usages: `grep -r "panier\|PanierService" src/`

#### 3C — Promotions (4 → 2)
- Keep: `promotion.service.ts` (public), `admin-promotion.service.ts` (admin)
- Delete: `promo.service.ts` (merge remaining logic into `promotion.service.ts`)
- Evaluate: `landing-promotion.service.ts` — keep only if distinct from `promotion.service.ts`

#### 3D — Toast Services (3 → 1)
- Keep: `src/app/core/services/toast.service.ts` (SweetAlert2-based)
- Delete: `src/app/account/login/toast-service.ts` + `toasts-container.component.ts`
- Delete: `src/app/pages/dashboards/dashboard/toast-service.ts`
- Update consumers to import from `CoreModule`

#### 3E — French/English Service Rename
Rename services that still use French naming, updating all imports:
- `commande.service.ts` → `order.service.ts`
- `commande-item.service.ts` → `order-item.service.ts`
- `client.service.ts` → `customer.service.ts` (merge with `customer.service.ts` if duplicate)
- `utilisateur.service.ts` → `user.service.ts` (merge with `user.service.ts` if duplicate)
- `couleur.service.ts` → `color.service.ts`
- `taille.service.ts` → `size.service.ts`
- `adresse.service.ts` → `address.service.ts`

**Done when:** `grep -r "panier\|favoris\|PanierService\|FavorisService" src/` returns zero results.

---

### Phase 4 — Component Decomposition
**Prerequisite:** Phase 3 complete
**Rule:** Extract, don't rewrite. Keep the existing logic working; just move it.

#### 4A — Checkout Component (1400+ lines)
Split into:
- `checkout-address-form.component.ts` — address and delivery form
- `checkout-cart-summary.component.ts` — cart display and item totals
- `checkout-payment.component.ts` — Paystack initialization + result handling
- `checkout-payment-orchestrator.service.ts` — coordinates initialization flow

The existing `checkout.component.ts` becomes the page shell that assembles these.

#### 4B — Product Detail Component (872 lines)
Extract into child components:
- `product-photo-carousel.component.ts` — photo display, thumbnail nav, auto-slide
- `product-variant-selector.component.ts` — size/color selection, stock checking
- `product-pricing.component.ts` — price display, promotions, EUR/XOF rendering

#### 4C — Dashboard Component (688 lines)
- Move all chart initialization methods to `dashboard-charts.service.ts`
- Keep `dashboard.component.ts` as a thin data-binding shell

#### 4D — Orders Admin Component (676 lines)
- Extract: `order-filter.service.ts` for filtering/sorting/search
- Extract: `order-export.service.ts` for CSV generation
- Pagination should use the existing `pagination.service.ts`

**Done when:** No component file exceeds 400 lines.

---

### Phase 5 — Model & Type Standardization
**Prerequisite:** Phase 4 complete

- Standardize all model interfaces to English in `core/models/models.ts`
- Create `OrderStatus` enum (currently uses loose strings: `'Nouvelle'`, `'En cours'`, etc.)
- Export `CartItem` type from models (currently only in `cart.service.ts`)
- Remove `ProduitVariation` alias — unify on `Variant`
- Add missing `OrderItem` interface
- Move `promotion.models.ts` content into `models.ts` under a clear section header

---

### Phase 6 — Folder & Naming Normalization
**Prerequisite:** Phase 5 complete
**Rule:** Only rename. No logic changes.

- `src/app/landing/all-categorie/` → `all-categories/`
- `src/app/landing/s-c-products/` → `subcategory-products/`
- `src/app/landing/l-sous-categories/` → `landing-subcategories/`
- All module and routing files must update their references after each rename

---

## 3. Rules of Intervention

1. **One phase at a time.** Do not start Phase 3 while Phase 2 is incomplete.
2. **Build after every batch.** `ng build` must pass before committing.
3. **No silent deletions.** Every deleted file must be verified unused via grep before removal.
4. **No feature changes during cleanup.** If a bug is discovered, log it and continue. Do not fix it inline.
5. **No new abstractions during cleanup.** Do not add utility files, helper functions, or new services during this phase unless they are strictly required by a consolidation step.
6. **Commit per batch.** Each batch (2A, 2B, etc.) is one git commit. Commit message format: `cleanup(phase-X): <description>`.

---

## 4. Risk Areas

| Area | Risk Level | Why | Mitigation |
|------|-----------|-----|-----------|
| Removing NgRx store modules | HIGH | AppModule registers Effects — wrong removal order causes DI errors | Remove effect import from AppModule first, then delete store folder |
| Service consolidation (favorites, cart) | HIGH | Components spread across landing and admin both use these | Grep all usages before deleting old service |
| Checkout decomposition | HIGH | Payment flow is load-bearing; any wrong extraction breaks orders | Decompose UI first, leave PaymentOrchestratorService logic untouched until stable |
| Renaming French services | MEDIUM | Barrel imports (`index.ts`) may re-export old names | Check `src/app/store/index.ts` and any `public-api.ts` after rename |
| Deleting layout components | MEDIUM | Layout conditions are runtime (theme switching) | Trace all `@if(is*LayoutRequested())` branches in `layout.component.html` before deleting |
| Model rename | MEDIUM | French model names used directly in Supabase query column mappings | Verify column names in queries are string literals, not the type name |

---

## 5. What Is NOT in Scope

- Adding new features
- Migrating from NgModule to fully standalone
- Changing the Supabase schema
- Changing the payment flow
- Performance optimization (lazy loading, code splitting)
- Unit test writing

These are post-cleanup tasks.
