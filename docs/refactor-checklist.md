# Refactor Validation Checklist — SmellAndWear

> **Purpose:** Mandatory checks to run after each cleanup batch before committing.
> **Rule:** Do not commit if any check in the relevant section is failing.
> **Last updated:** 2026-03-15

---

## How to Use This Checklist

1. Complete a batch from `codebase-cleanup-plan.md`
2. Find the matching section below
3. Run every command listed
4. All must pass before `git commit`
5. Note any warnings (not just errors) — warnings from deleted template code should disappear; new warnings are regressions

---

## Universal Checks (Run After Every Batch)

These must pass after **any** code change:

```bash
# Production build — must complete with exit code 0
ng build --configuration production

# Check for any TypeScript errors
npx tsc --noEmit

# Verify no dead imports from deleted modules remain
grep -r "from.*charts\|from.*apps.module\|from.*shared-modules" src/ --include="*.ts"
# Expected: zero results after Phase 2
```

---

## Phase 1 — Security Fixes

### After removing legacy payment provider (Phase 1 complete)

- [x] Legacy payment provider Edge Functions removed; no hardcoded credentials in codebase
- [x] `supabase/config.toml` no longer references legacy payment functions
- [ ] `ng build --configuration production` passes
- [x] Hardcoded API key removed from codebase
- [x] Checkout component no longer logs calculation details; debug lines that expose pricing removed

---

## Phase 2 — Dead Template Code

### After Batch 2A (Charts + Apps + shared-modules)

- [ ] `ng build --configuration production` passes
- [ ] No broken route: navigate to `/admin` in the browser — admin dashboard loads
- [ ] `src/app/pages/charts/` does not exist
- [ ] `src/app/pages/apps/` does not exist
- [ ] `src/app/shared-modules/` does not exist
- [ ] `app.module.ts` no longer imports `AppsModule` or `ChartsModule`

### After Batch 2B (Landing Template Pages)

- [ ] `ng build --configuration production` passes
- [ ] Customer routes work: `/`, `/products`, `/wear-men`, `/wear-women` all load without error
- [ ] `src/app/shared/landing/job/` does not exist
- [ ] `src/app/shared/landing/nft/` does not exist
- [ ] `src/app/landing/profile/` does not exist
- [ ] `shared.module.ts` no longer declares `ProcessComponent`, `FindjobsComponent`, `CandidatesComponent`, `BlogComponent`, `JobcategoriesComponent`, `JobFooterComponent`, `MarketPlaceComponent`, `WalletComponent`, `FeaturesComponent`, `CategoriesComponent`, `DiscoverComponent`, `TopCreatorComponent`

### After Batch 2C (Template Widgets)

- [ ] `ng build --configuration production` passes
- [ ] Admin dashboard loads and displays all stat widgets, recent orders, best sellers
- [ ] `src/app/shared/widget/crm/` does not exist
- [ ] `src/app/shared/widget/crypto/` does not exist
- [ ] `src/app/shared/widget/nft/` does not exist
- [ ] `src/app/shared/widget/projects/` does not exist
- [ ] `widget.module.ts` still exports `BestSellingComponent`, `RecentOrdersComponent`, and other active dashboard widgets
- [ ] No `NG0304` (component not found) errors in browser console

### After Batch 2D (Layouts)

- [ ] `ng build --configuration production` passes
- [ ] Admin layout renders correctly: sidebar, topbar, and main content area are present
- [ ] `src/app/layouts/rightsidebar/` does not exist
- [ ] `layouts.module.ts` no longer declares `RightsidebarComponent`
- [ ] No layout rendering errors in browser console

### After Batch 2E (NgRx Dead Store Modules)

- [ ] `ng build --configuration production` passes
- [ ] `app.module.ts` no longer imports: `CRMEffects`, `CryptoEffects`, `InvoiceEffects`, `ApplicationEffects` (Jobs), `ProjectEffects`, `TaskEffects`, `TicketEffects`, `TodoEffects`, `FileManagerEffects`, `APIKeyEffects`
- [ ] `app.module.ts` no longer registers: corresponding `StoreModule.forFeature()` and `EffectsModule.forFeature()` calls
- [ ] `src/app/store/CRM/`, `Crypto/`, `Invoice/`, `Jobs/`, `Project/`, `Task/`, `Ticket/`, `Todo/`, `File Manager/`, `APIKey/` do not exist
- [ ] NgRx store still works for ecommerce: admin product list loads data from the store
- [ ] Auth still works: login → admin dashboard redirect functions correctly

### After Batch 2F (Misc Dead Files)

- [ ] `ng build --configuration production` passes
- [ ] `src/app/app-routing.module.ts~` does not exist
- [ ] `src/typings.d.ts` does not exist
- [ ] `src/app/typings.d.ts` does not exist
- [ ] `src/app/core/models/request.sql` does not exist (moved to `docs/sql/` if needed)

---

## Phase 3 — Service Consolidation

### After 3A (Favorites)

- [ ] `ng build --configuration production` passes
- [ ] `favoris.service.ts` does not exist
- [ ] `favorite.service.ts` does not exist
- [ ] `grep -r "FavorisService\|favoris\.service\|FavoriteService\|favorite\.service" src/` → zero results
- [ ] Favorites functionality works end-to-end: add a product to favorites, view favorites list
- [ ] `favorites.service.ts` is the sole import for any favorites operation

### After 3B (Cart)

- [ ] `ng build --configuration production` passes
- [ ] `panier.service.ts` does not exist
- [ ] `grep -r "PanierService\|panier\.service" src/` → zero results
- [ ] Cart works end-to-end: add item → view cart → item count in header is correct

### After 3C (Promotions)

- [ ] `ng build --configuration production` passes
- [ ] `promo.service.ts` does not exist
- [ ] `grep -r "PromoService\|promo\.service" src/` → zero results
- [ ] Active promotions display correctly on the landing page
- [ ] Admin promotion management still works

### After 3D (Toast Services)

- [ ] `ng build --configuration production` passes
- [ ] `src/app/account/login/toast-service.ts` does not exist
- [ ] `src/app/account/login/toasts-container.component.ts` does not exist
- [ ] `src/app/pages/dashboards/dashboard/toast-service.ts` does not exist
- [ ] Admin login still shows toast notifications on success and error
- [ ] Dashboard still shows toast notifications on relevant actions

### After 3E (French Service Renames)

- [ ] `ng build --configuration production` passes
- [ ] `grep -ri "commandeservice\|commande\.service\|clientservice\|client\.service\|utilisateurservice\|panierservice\|couleurservice\|tailleservice" src/` → zero results
- [ ] Order management in admin works: list orders, view order details, update status
- [ ] Checkout still creates orders successfully
- [ ] No `NullInjectorError` in browser console after rename (means a consumer was missed)

---

## Phase 4 — Component Decomposition

### After 4A (Checkout Decomposition)

- [ ] `ng build --configuration production` passes
- [ ] Full checkout flow works end-to-end:
  - [ ] Add item to cart
  - [ ] Navigate to `/checkout`
  - [ ] Address form renders and validates
  - [ ] Cart summary shows correct items and totals
  - [ ] Selecting a shipping zone updates the total display
  - [ ] Clicking "Pay" calls `paystack.service.ts` (not a direct HTTP call)
  - [ ] Paystack popup/redirect launches
  - [ ] Return to `/order-success` after payment
- [ ] No component file in `landing/checkout/` exceeds 400 lines
- [ ] Payment amounts sent to Paystack are still computed server-side (verify in Network tab: the Edge Function call body must NOT contain `amount`)

### After 4B (Product Detail Decomposition)

- [ ] `ng build --configuration production` passes
- [ ] Product detail page works end-to-end:
  - [ ] Photos display and thumbnail navigation works
  - [ ] Size and color selection updates the variant
  - [ ] Out-of-stock variants are shown as unavailable
  - [ ] Price displays in correct currency (EUR for FR, XOF for CI)
  - [ ] Promotions/discounts render correctly
  - [ ] "Add to cart" button works
  - [ ] Related products section loads
- [ ] `product-detail.component.ts` (shell) is under 200 lines
- [ ] No `ExpressionChangedAfterItHasBeenCheckedError` in browser console

### After 4C (Dashboard Decomposition)

- [ ] `ng build --configuration production` passes
- [ ] Dashboard loads with all charts
- [ ] Analytics period selector (week/month/year) still updates charts
- [ ] `dashboard.component.ts` is under 200 lines

### After 4D (Orders Decomposition)

- [ ] `ng build --configuration production` passes
- [ ] Orders list: filters work (status, search, date range)
- [ ] CSV export downloads a valid file
- [ ] Pagination works
- [ ] Order status update still triggers email notification

---

## Phase 5 — Model Standardization

### After model updates

- [ ] `ng build --configuration production` passes with zero TypeScript errors
- [ ] `grep -r "Produit\b\|Commande\b\|ProduitVariation\b" src/app/core/models/` → zero results (French names gone from models)
- [ ] `OrderStatus` enum is defined and used in at least the order service and order details component
- [ ] `CartItem` is imported from `core/models/models.ts` in `cart.service.ts` (not defined inline)
- [ ] `promotion.models.ts` no longer exists as a separate file (merged into `models.ts`)

---

## Phase 6 — Folder Renaming

### After folder renames

- [ ] `ng build --configuration production` passes
- [ ] `src/app/landing/all-categorie/` does not exist; `all-categories/` exists
- [ ] `src/app/landing/s-c-products/` does not exist; `subcategory-products/` exists
- [ ] `src/app/landing/l-sous-categories/` does not exist; `landing-subcategories/` exists
- [ ] All renamed paths work in browser: navigate to each renamed route
- [ ] `landing-routing.module.ts` references the new folder paths
- [ ] No 404 for renamed routes

---

## Payment Security Checks (Run Before Any Release)

These are non-negotiable. Run after any change touching checkout, cart, or payment services.

- [ ] **Amount not in client request:** Open browser DevTools → Network → filter for Edge Function calls → verify the `paystack-initialize` call body contains `order_id`, `email`, `locale` and **does NOT contain** `amount`, `total`, `subtotal`, or any price field
- [ ] **Server total matches:** After a test payment, verify `commande.server_computed_total` in Supabase matches `paid_amount * 100` from the Paystack dashboard
- [ ] **No double-charge:** Replay the `paystack-verify` call with the same reference → second call must return a 409 or idempotent "already paid" response, not a second charge
- [ ] **Invalid reference rejected:** Call `paystack-verify` with a fabricated reference → must return 404, not 200
- [ ] **Checkout with expired session:** Navigate to `/checkout` while logged out → must redirect to login, not proceed to payment

---

## Auth & Admin Security Checks (Run Before Any Release)

- [ ] Navigate to `/admin` without being logged in → redirected to `/auth/login`
- [ ] Log in as a non-admin Supabase user → `AdminGuard` must redirect away (not grant access)
- [ ] Admin invite flow: invite a new email → new admin can log in and access `/admin`
- [ ] Removing an admin: confirm the removed user can no longer access `/admin`
- [ ] Customer login does not grant access to admin routes

---

## Responsive & Localization Checks (Run Before Any Release)

- [ ] Homepage renders correctly at 375px (mobile), 768px (tablet), 1280px (desktop)
- [ ] Checkout is usable on mobile (address form, cart summary, pay button all visible)
- [ ] Product detail photo carousel works on touch (swipe or tap thumbnails)
- [ ] Currency displays correctly: navigate with `country_code=FR` → prices in EUR; `country_code=CI` → prices in XOF
- [ ] FX rate is visible on the checkout summary for CI market

---

## Pre-Release Final Gate

All of the following must be true before merging cleanup into `main`:

- [ ] `ng build --configuration production` exits 0 with no errors
- [ ] `npx tsc --noEmit` exits 0
- [ ] Zero `ERROR` lines in browser console on: homepage, product detail, checkout, admin dashboard, orders list
- [ ] Payment security checks above all pass
- [ ] Auth security checks above all pass
- [x] Legacy payment provider removed (Phase 1)
- [x] Hardcoded legacy payment key removed
- [ ] No file in `src/app/` is larger than 400 lines (post-Phase 4)
- [ ] `grep -r "\.from\(" src/app --include="*.ts" | grep -v service | grep -v guard` → zero results (no direct Supabase calls outside services/guards)
