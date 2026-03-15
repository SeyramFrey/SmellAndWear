# Template & Legacy Code Inventory — SmellAndWear

> **Purpose:** Complete inventory of files and folders inherited from the Velzon admin template
> or accumulated as dead code, with a disposition decision for each.
> **Last updated:** 2026-03-15

---

## How to Read This File

| Status | Meaning |
|--------|---------|
| **DELETE** | No usage found anywhere. Safe to remove immediately. |
| **REFACTOR** | Active but has structural problems that must be fixed. |
| **KEEP** | Active, used, and correctly placed. |
| **INVESTIGATE** | Usage is unclear — manual trace required before deciding. |

---

## Section 1 — Edge Functions (`supabase/functions/`)

| Path | Status | Reason |
|------|--------|--------|
| `legacy-payment-notification/` | **DELETED** | Dead payment provider (removed). Had hardcoded API key and site ID. HMAC verification used placeholder secret. References wrong table. Zero Angular references. |
| `legacy-payment-return/` | **DELETED** | Stub file only. Deno template boilerplate, no implementation. Enabled in config.toml but never called. |
| `paystack-initialize/` | **KEEP** | Well-implemented. Server-side total computation, proper env validation, FX fallback. |
| `paystack-verify/` | **KEEP** | Server-side verification with amount cross-check vs `server_computed_total`. Idempotent. |
| `paystack-webhook/` | **KEEP** | HMAC SHA-512 signature verification. Idempotent. Correct 200 on invalid sig. |
| `paystack-return/` | **KEEP** | Redirect handler with origin allowlist. |
| `geo-default/` | **KEEP** | Geolocation with multiple fallbacks and safe defaults. |
| `invite-admin/` | **KEEP** | Admin-authenticated. DB role verified before action. |
| `invoice-generate/` | **KEEP** | Admin-only. PDF in private bucket. Audit log. |
| `invoice-send/` | **KEEP** | Admin-only. Idempotent. Uses Resend. Audit log. |
| `send-order-status-notification/` | **KEEP** | Admin-only. Status-specific templates. Audit log. |
| `product-category-redirect/` | **KEEP** | Safe public endpoint. Does not leak product data. |
| `_shared/invoice-helpers.ts` | **KEEP** | Shared by 3 functions. Well-structured. |
| `_shared/invoice-pdf.ts` | **KEEP** | Proper Unicode normalization, safe image embedding. |

**Action in `supabase/config.toml`:** Legacy payment provider entries removed. Consider increasing `email_sent` rate limit from 2/hour to at least 10 for production invoice resends.

---

## Section 2 — NgRx Store (`src/app/store/`)

All modules below are registered in `app.module.ts` (Effects + Reducers) but have **zero consumers** — no component ever calls their selectors.

| Path | Status | Reason |
|------|--------|--------|
| `store/CRM/` | **DELETE** | No component imports CRM selectors. Effects registered but never triggered. |
| `store/Crypto/` | **DELETE** | Same as CRM. |
| `store/Invoice/` | **DELETE** | Same. Note: the `invoice.service.ts` in core/services is separate and active. |
| `store/Jobs/` | **DELETE** | ApplicationEffects registered in AppModule — zero usage. |
| `store/Project/` | **DELETE** | Zero usage. |
| `store/Task/` | **DELETE** | Zero usage. |
| `store/Ticket/` | **DELETE** | Zero usage. |
| `store/Todo/` | **DELETE** | Zero usage. |
| `store/File Manager/` | **DELETE** | Zero usage. Note: folder name contains a space — also a filesystem risk. |
| `store/APIKey/` | **DELETE** | Zero usage. |
| `store/Ecommerce/` | **KEEP** | Active. Used by `products.component.ts` and several admin views. |
| `store/Authentication/` | **KEEP** | Used by auth flow. |
| `store/layouts/` | **KEEP** | Used by layout switching logic. |

**After deletion:** Remove all corresponding `import` and `StoreModule.forFeature` / `EffectsModule.forFeature` entries from `src/app/app.module.ts`.

---

## Section 3 — Pages (`src/app/pages/`)

| Path | Status | Reason |
|------|--------|--------|
| `pages/charts/` | **DELETE** | Entire directory. 18+ ApexCharts subdirs (area, bar, boxplot, bubble, candlestick, column, funnel, heatmap, line, mixed, pie, polar, radar, radialbar, range-area, scatter, slope, timeline, treemap) + chartjs + echart. Never added to `pages-routing.module.ts`. Never used in any template. |
| `pages/apps/` | **DELETE** | Empty module. Routed at `/admin/apps` but `AppsRoutingModule` has an empty routes array. Module imports 50+ dependencies and declares zero components. |
| `pages/dashboards/` | **REFACTOR** | Active. Contains `dashboard.component.ts` (688 lines) and local `toast-service.ts` duplicate. Extract chart methods; delete local toast service. |
| `pages/ecommerce/` | **REFACTOR** | Active. `orders.component.ts` (676 lines) and `products.component.ts` need decomposition. `order-details.component.ts` is acceptable size. |
| `pages/media/` | **REFACTOR** | Active. `medias.component.ts` makes direct Supabase `.from()` calls instead of going through `media.service.ts`. |
| `pages/admin/` | **KEEP** | Admin user management. Clean size. |

---

## Section 4 — Landing Pages (`src/app/landing/`)

| Path | Status | Reason |
|------|--------|--------|
| `landing/profile/` | **DELETE** | Contains `ProfileComponent` and `SettingsComponent`. Neither is referenced in `landing-routing.module.ts` or any router link. Replaced by `landing/account/settings/`. |
| `landing/checkout/` | **REFACTOR** | Active and load-bearing (payment flow). File is 1,400+ lines with 8+ responsibilities. Must be split into sub-components and a payment orchestrator service. |
| `landing/product-detail/` | **REFACTOR** | Active. 872 lines. Photo carousel, variant selection, pricing, promotions, cart operations — all mixed. Extract into child components. |
| `landing/all-categorie/` | **REFACTOR** | Active but folder name is a typo. Rename to `all-categories/`. Update routing. |
| `landing/s-c-products/` | **REFACTOR** | Active but name is cryptic. Rename to `subcategory-products/`. Update routing. |
| `landing/l-sous-categories/` | **REFACTOR** | Active but name is French abbreviation. Rename to `landing-subcategories/`. Update routing. |
| `landing/account/` | **KEEP** | Active customer account pages. Properly routed. |
| `landing/auth/` | **KEEP** | Customer login/signup. Separate from admin auth. |
| `landing/index/` | **KEEP** | Homepage. Manageable size. |
| `landing/bestsellers/` | **KEEP** | Active. |
| `landing/news/` | **KEEP** | Active. |
| `landing/all-products/` | **KEEP** | Active. |
| `landing/wear-choice/` | **KEEP** | Active. |
| `landing/wear-men/` | **KEEP** | Active. |
| `landing/men/` | **KEEP** | Active. |
| `landing/women/` | **KEEP** | Active. |
| `landing/order-success/` | **KEEP** | Active. Post-payment redirect. |

---

## Section 5 — Shared Landing (`src/app/shared/landing/`)

| Path | Status | Reason |
|------|--------|--------|
| `shared/landing/job/` | **DELETE** | Job portal template. 6 components (blog, candidates, findjobs, jobcategories, job-footer, process). Declared in `shared.module.ts` but never used in any template or route. |
| `shared/landing/nft/` | **DELETE** | NFT marketplace template. 6 components (categories, discover, features, market-place, top-creator, wallet). Declared in `shared.module.ts` but never used. |
| `shared/landing/index/` | **KEEP** | Active homepage shared content. |

**After deletion:** Remove the 12 component declarations from `shared.module.ts`.

---

## Section 6 — Shared Widgets (`src/app/shared/widget/`)

| Path | Status | Reason |
|------|--------|--------|
| `widget/crm/` | **DELETE** | 4 components. Exported from `widget.module.ts` but no template ever instantiates `app-crm-stat`, `app-closing-deals`, etc. |
| `widget/crypto/` | **DELETE** | 4 components. Same — exported but never instantiated. |
| `widget/nft/` | **DELETE** | 1 component. Same pattern. |
| `widget/projects/` | **DELETE** | 4 components (active-project, my-task, projects-stat, team-members). Never instantiated. |
| `widget/analytics/analatics-stat/` | **DELETE** | Note the typo in folder name (`analatics`). Never instantiated. |
| `widget/analytics/top-pages/` | **DELETE** | Never instantiated. |
| `widget/analytics/` (remaining) | **KEEP** | `BestSellingComponent` and `RecentOrdersComponent` are active in the dashboard. |
| `widget/dashboard/` | **KEEP** | Active ecommerce dashboard widgets. |

**After deletion:** Remove deleted component declarations/exports from `widget.module.ts`.

---

## Section 7 — Layouts (`src/app/layouts/`)

| Path | Status | Reason |
|------|--------|--------|
| `layouts/rightsidebar/` | **DELETE** | Never rendered. `layout.component.html` has `@if` conditions for vertical, horizontal, two-column, and semibox only. No condition for rightsidebar. |
| `layouts/vertical/` | **KEEP** | Primary admin layout. |
| `layouts/topbar/` | **KEEP** | Used by vertical layout. |
| `layouts/sidebar/` | **KEEP** | Used by vertical layout. |
| `layouts/footer/` | **KEEP** | Used by layouts. |
| `layouts/horizontal/` | **INVESTIGATE** | Conditionally rendered. Verify if any live route or setting reaches it before deleting. |
| `layouts/horizontal-topbar/` | **INVESTIGATE** | Same as above. |
| `layouts/two-column/` | **INVESTIGATE** | Same — check theme switcher settings to confirm reachability. |
| `layouts/two-column-sidebar/` | **INVESTIGATE** | Same. |

---

## Section 8 — Services (`src/app/core/services/`)

### Duplicates — DELETE after consolidation

| File | Status | Keep Which | Reason |
|------|--------|-----------|--------|
| `favoris.service.ts` | **DELETE** | `favorites.service.ts` | French name. Duplicate domain. |
| `favorite.service.ts` | **DELETE** | `favorites.service.ts` | Singular English. Duplicate domain. |
| `panier.service.ts` | **DELETE** | `cart.service.ts` | French name. Duplicate cart domain. |
| `promo.service.ts` | **DELETE** | `promotion.service.ts` | Abbreviation. Merge remaining logic then delete. |

### Rename — French → English

| Current Name | Target Name | Action |
|-------------|------------|--------|
| `commande.service.ts` | `order.service.ts` | Rename + update all imports |
| `commande-item.service.ts` | `order-item.service.ts` | Rename + update all imports |
| `client.service.ts` | Merge into `customer.service.ts` | Check for overlap first |
| `utilisateur.service.ts` | Merge into `user.service.ts` | Check for overlap first |
| `couleur.service.ts` | `color.service.ts` | Rename + update all imports |
| `taille.service.ts` | `size.service.ts` | Rename + update all imports |
| `adresse.service.ts` | `address.service.ts` | Rename + update all imports |
| `produit.service.ts` | `product.service.ts` | Rename + update all imports |
| `produit-photo.service.ts` | `product-photo.service.ts` | Rename + update all imports |
| `produit-variation.service.ts` | `product-variation.service.ts` | Rename + update all imports |

### Local Toast Service Duplicates — DELETE

| File | Status | Reason |
|------|--------|--------|
| `src/app/account/login/toast-service.ts` | **DELETE** | Local duplicate. Use `core/services/toast.service.ts`. |
| `src/app/account/login/toasts-container.component.ts` | **DELETE** | Part of local toast duplicate. |
| `src/app/pages/dashboards/dashboard/toast-service.ts` | **DELETE** | Local duplicate. Use `core/services/toast.service.ts`. |

### Active Services — KEEP

`admin-auth.service.ts`, `admin-invite.service.ts`, `admin-promotion.service.ts`, `admin.service.ts`, `auth.service.ts`, `cart.service.ts`, `categorie.service.ts`, `country-currency.service.ts`, `currency.service.ts`, `dashboard.service.ts` (REFACTOR — split), `delivery-prices.service.ts`, `event.service.ts`, `favorites.service.ts`, `image.service.ts`, `invoice.service.ts`, `landing-media.service.ts`, `landing-promotion.service.ts`, `language.service.ts`, `media.service.ts`, `pagination.service.ts`, `payment.service.ts`, `paystack.service.ts`, `product-redirect.service.ts`, `promotion.service.ts`, `rest-api.service.ts`, `scroll.service.ts`, `storage.service.ts`, `supabase-auth.service.ts`, `supabase.service.ts`, `theme.service.ts`, `toast.service.ts`, `token-storage.service.ts`, `user.service.ts`, `variant.service.ts`

---

## Section 9 — Models (`src/app/core/models/`)

| File | Status | Reason |
|------|--------|--------|
| `models.ts` | **REFACTOR** | Active but mixes French/English names. Missing `OrderStatus` enum, `CartItem` export, `OrderItem` interface. |
| `promotion.models.ts` | **REFACTOR** | Merge content into `models.ts` under a `// Promotions` section header. |
| `delivery-price.model.ts` | **KEEP** | Focused, clean model. |
| `request.sql` | **DELETE** | Not a TypeScript model. Move to `docs/sql/request.sql` if content is needed for reference, then delete from models directory. |

---

## Section 10 — Misc Files

| File | Status | Reason |
|------|--------|--------|
| `src/app/app-routing.module.ts~` | **DELETE** | Tilde backup file. 1 line, corrupted. |
| `src/typings.d.ts` | **DELETE** | Empty file. |
| `src/app/typings.d.ts` | **DELETE** | Empty file. |
| `src/app/shared-modules/` | **DELETE** | Contains only `feather-icons.module.ts` which is never imported anywhere. |
| `src/app/authUtils.ts` | **INVESTIGATE** | Conditional Firebase init. If `environment.defaultauth` is never `'firebase'`, this is dead. Verify before deleting. |
| `src/app/global-component.ts` | **INVESTIGATE** | Imported by `auth.service.ts`, `rest-api.service.ts`, and `products.component.ts`. Understand what it configures before removing. |

---

## Summary Counts

| Status | Count |
|--------|-------|
| DELETE | 38 paths |
| REFACTOR | 12 paths |
| KEEP | ~40 paths |
| INVESTIGATE | 6 paths |
