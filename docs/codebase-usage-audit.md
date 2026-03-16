# Codebase Usage Audit — SmellAndWear
> **Generated:** 2026-03-16
> **Auditor:** Senior Angular Codebase Auditor
> **Scope:** Full repository — Angular app, SCSS, Edge Functions, store, assets
> **Rule:** If something cannot be proven dead, it is marked UNCERTAIN. No deletions in this pass.

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ **ACTIVE** | Demonstrably used in routing, templates, or service injection |
| ⚠️ **LEGACY-DEP** | Still imported or registered but contains template artifacts or dead dependencies |
| ❌ **DEAD** | No live reference found anywhere in the codebase |
| 🔍 **UNCERTAIN** | Usage could not be fully traced without runtime instrumentation |

---

## 1. Application Architecture

| Aspect | Observed State |
|--------|---------------|
| Angular version | 18.0.4 |
| Component model | **NgModules** (not standalone) |
| Routing | `app-routing.module.ts` + feature routing modules |
| State management | NgRx (Store + Effects) |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Payment | Paystack (server-side via Edge Functions) |
| UI base | Velzon v4.1.0 admin template (Themesbrand) |
| CSS framework | Bootstrap 5.3.3 (via Velzon config) |

---

## 2. Root & Entry Files

| File | Status | Notes |
|------|--------|-------|
| `src/main.ts` | ✅ ACTIVE | App bootstrap |
| `src/index.html` | ✅ ACTIVE | HTML shell |
| `src/app/app.module.ts` | ⚠️ LEGACY-DEP | Root module — still registers deleted store slices (CRM, Crypto, Jobs, etc.) |
| `src/app/app-routing.module.ts` | ✅ ACTIVE | Root routing — 4 lazy-loaded modules |
| `src/app/app-routing.module.ts~` | ❌ DEAD | Tilde backup file, 1-line corrupted file |
| `src/app/app.component.ts` | ✅ ACTIVE | Root component |
| `src/app/authUtils.ts` | 🔍 UNCERTAIN | Firebase init guard — active only if `environment.defaultauth === 'firebase'`; verify env value |
| `src/app/global-component.ts` | ⚠️ LEGACY-DEP | Imported by `auth.service.ts`, `rest-api.service.ts`, `products.component.ts`; contains deprecated Themesbrand API URLs that must not reach production |
| `src/typings.d.ts` | ❌ DEAD | Empty file |
| `src/app/typings.d.ts` | ❌ DEAD | Empty file |

---

## 3. Core Module (`src/app/core/`)

### 3.1 Guards

| File | Status | Notes |
|------|--------|-------|
| `guards/admin.guard.ts` | ✅ ACTIVE | Protects all `/admin` routes |
| `guards/auth.guard.ts` | ✅ ACTIVE | Used on authenticated routes |
| `guards/client.guard.ts` | ✅ ACTIVE | Protects `/account` (customer) routes |

### 3.2 Interceptors

| File | Status | Notes |
|------|--------|-------|
| `helpers/auth.interceptor.ts` | ✅ ACTIVE | HTTP auth header injection |
| `helpers/error.interceptor.ts` | ✅ ACTIVE | Global error handling |
| `helpers/jwt.interceptor.ts` | ✅ ACTIVE | JWT token injection |

### 3.3 Models

| File | Status | Notes |
|------|--------|-------|
| `models/models.ts` | ⚠️ LEGACY-DEP | Active but mixes French/English identifiers; missing `OrderStatus` enum, `CartItem` export |
| `models/promotion.models.ts` | ⚠️ LEGACY-DEP | Active; should be merged into `models.ts` |
| `models/delivery-price.model.ts` | ✅ ACTIVE | Clean, focused model |
| `models/request.sql` | ❌ DEAD | SQL file in wrong location; should be `docs/sql/` or removed |

### 3.4 Services

| File | Status | Notes |
|------|--------|-------|
| `services/auth.service.ts` | ✅ ACTIVE | General auth orchestration |
| `services/supabase-auth.service.ts` | ✅ ACTIVE | Supabase-specific auth; primary auth service |
| `services/admin-auth.service.ts` | ✅ ACTIVE | Admin role verification |
| `services/admin-invite.service.ts` | ✅ ACTIVE | Admin invitation flow |
| `services/admin-promotion.service.ts` | ✅ ACTIVE | Admin promo management |
| `services/admin.service.ts` | ✅ ACTIVE | Admin CRUD operations |
| `services/cart.service.ts` | ✅ ACTIVE | Shopping cart state |
| `services/categorie.service.ts` | ✅ ACTIVE | Category data (French name — rename target) |
| `services/client.service.ts` | 🔍 UNCERTAIN | May overlap with `customer.service.ts`; verify distinct methods |
| `services/color.service.ts` | ✅ ACTIVE | Product color variants |
| `services/commande-item.service.ts` | ✅ ACTIVE | Order line items (French name — rename target) |
| `services/country-currency.service.ts` | ✅ ACTIVE | CI/FR currency routing |
| `services/currency.service.ts` | ✅ ACTIVE | EUR/XOF conversion |
| `services/customer.service.ts` | ✅ ACTIVE | Customer data access |
| `services/dashboard.service.ts` | ✅ ACTIVE | Admin dashboard aggregations |
| `services/delivery-prices.service.ts` | ✅ ACTIVE | Delivery zone pricing |
| `services/event.service.ts` | ✅ ACTIVE | In-app event bus |
| `services/favorites.service.ts` | ✅ ACTIVE | Wishlist management |
| `services/image.service.ts` | ✅ ACTIVE | Image URL helpers |
| `services/invoice.service.ts` | ✅ ACTIVE | Invoice generation trigger |
| `services/landing-media.service.ts` | ✅ ACTIVE | Landing page media loading |
| `services/landing-promotion.service.ts` | ✅ ACTIVE | Landing promo display |
| `services/language.service.ts` | ✅ ACTIVE | i18n switching |
| `services/media.service.ts` | ✅ ACTIVE | Media upload/management |
| `services/order.service.ts` | ✅ ACTIVE | Order management |
| `services/pagination.service.ts` | ✅ ACTIVE | Pagination state |
| `services/payment.service.ts` | ✅ ACTIVE | Payment abstraction layer |
| `services/paystack.service.ts` | ✅ ACTIVE | **Critical** — Paystack Edge Function client |
| `services/product-redirect.service.ts` | ✅ ACTIVE | Canonical product URL resolution |
| `services/product.service.ts` | ✅ ACTIVE | Product CRUD |
| `services/produit-photo.service.ts` | ✅ ACTIVE | Product photo management (French name — rename target) |
| `services/produit-variation.service.ts` | ✅ ACTIVE | Product variant management (French name — rename target) |
| `services/promo.service.ts` | ⚠️ LEGACY-DEP | Abbreviation duplicate — merge remaining logic into `promotion.service.ts` then delete |
| `services/promotion.service.ts` | ✅ ACTIVE | Canonical promotion service |
| `services/rest-api.service.ts` | 🔍 UNCERTAIN | Imports `global-component.ts` with deprecated API URLs; verify if still called |
| `services/scroll.service.ts` | ✅ ACTIVE | Scroll restoration |
| `services/size.service.ts` | ✅ ACTIVE | Product size variants |
| `services/storage.service.ts` | ✅ ACTIVE | localStorage abstraction |
| `services/supabase.service.ts` | ✅ ACTIVE | Supabase client singleton |
| `services/theme.service.ts` | ✅ ACTIVE | Dark/light theme switching |
| `services/toast.service.ts` | ✅ ACTIVE | Global notification service |
| `services/token-storage.service.ts` | ✅ ACTIVE | JWT persistence |
| `services/user.service.ts` | ✅ ACTIVE | User profile |
| `services/utilisateur.service.ts` | 🔍 UNCERTAIN | French-name service; may overlap with `user.service.ts` |
| `services/variant.service.ts` | ✅ ACTIVE | Variant data access |
| **Duplicate — favoris.service.ts** | ❌ DEAD | French duplicate of `favorites.service.ts` |
| **Duplicate — favorite.service.ts** | ❌ DEAD | Singular duplicate of `favorites.service.ts` |
| **Duplicate — panier.service.ts** | ❌ DEAD | French duplicate of `cart.service.ts` |

---

## 4. NgRx Store (`src/app/store/`)

| Module | Status | Notes |
|--------|--------|-------|
| `store/Authentication/` | ✅ ACTIVE | Used by auth flow |
| `store/Ecommerce/` | ✅ ACTIVE | Used by admin products list |
| `store/layouts/` | ✅ ACTIVE | Used by layout switching |
| `store/CRM/` | ❌ DEAD | Registered in `app.module.ts`; zero selector consumers |
| `store/Crypto/` | ❌ DEAD | Same — registered but never consumed |
| `store/Invoice/` | ❌ DEAD | Same — `invoice.service.ts` is separate and active |
| `store/Jobs/` | ❌ DEAD | `ApplicationEffects` registered; zero usage |
| `store/Project/` | ❌ DEAD | Zero usage |
| `store/Task/` | ❌ DEAD | Zero usage |
| `store/Ticket/` | ❌ DEAD | Zero usage |
| `store/Todo/` | ❌ DEAD | Zero usage |
| `store/File Manager/` | ❌ DEAD | Zero usage; folder name has a space (filesystem risk) |
| `store/APIKey/` | ❌ DEAD | Zero usage |

---

## 5. Landing Module (`src/app/landing/`)

| Path | Status | Notes |
|------|--------|-------|
| `landing/index/` | ✅ ACTIVE | Homepage (`/`) |
| `landing/wear-men/` | ✅ ACTIVE | Men's collection (`/wear-men`) — audited in color audit |
| `landing/wear-choice/` | ✅ ACTIVE | Category chooser (`/wear`) |
| `landing/product-detail/` | ✅ ACTIVE | Single product view — 872 lines, decomposition needed |
| `landing/checkout/` | ✅ ACTIVE | **Payment critical** — 1,400+ lines, high risk area |
| `landing/order-success/` | ✅ ACTIVE | Post-payment confirmation |
| `landing/all-products/` | ✅ ACTIVE | Full catalog (`/shop-all`) |
| `landing/bestsellers/` | ✅ ACTIVE | Best sellers collection |
| `landing/news/` | ✅ ACTIVE | Content/blog page |
| `landing/all-categorie/` | ✅ ACTIVE | Category page (folder name typo — rename to `all-categories/`) |
| `landing/s-c-products/` | ✅ ACTIVE | Subcategory products (cryptic name — rename to `subcategory-products/`) |
| `landing/l-sous-categories/` | ✅ ACTIVE | Subcategory listing (French abbreviation — rename to `landing-subcategories/`) |
| `landing/auth/` | ✅ ACTIVE | Customer login/signup |
| `landing/account/` | ✅ ACTIVE | Customer account area (protected by ClientGuard) |
| `landing/profile/` | ❌ DEAD | Contains `ProfileComponent` and `SettingsComponent` never referenced in routing; replaced by `landing/account/settings/` |

### Customer Account Sub-pages

| Path | Status | Notes |
|------|--------|-------|
| `landing/account/dashboard/` | ✅ ACTIVE | Account overview |
| `landing/account/orders/` | ✅ ACTIVE | Order history |
| `landing/account/favorites/` | ✅ ACTIVE | Wishlist |
| `landing/account/addresses/` | ✅ ACTIVE | Saved addresses |
| `landing/account/settings/` | ✅ ACTIVE | Profile settings |
| `landing/account/shared-account.scss` | ✅ ACTIVE | Shared account styles |

---

## 6. Pages Module — Admin (`src/app/pages/`)

| Path | Status | Notes |
|------|--------|-------|
| `pages/dashboards/dashboard/` | ✅ ACTIVE | Admin dashboard (688 lines — decomposition needed) |
| `pages/dashboards/dashboard-geo/` | ✅ ACTIVE | Geographic analytics view |
| `pages/dashboards/dashboard/toast-service.ts` | ❌ DEAD | Local duplicate of `core/services/toast.service.ts` |
| `pages/ecommerce/products/` | ✅ ACTIVE | Product list (uses NgRx Ecommerce store) |
| `pages/ecommerce/products-list/` | 🔍 UNCERTAIN | Alternate product list — verify if distinct route is used |
| `pages/ecommerce/product-detail/` | ✅ ACTIVE | Admin product detail |
| `pages/ecommerce/add-product/` | ✅ ACTIVE | Create/edit product |
| `pages/ecommerce/categories/` | ✅ ACTIVE | Category management |
| `pages/ecommerce/sous-categories/` | ✅ ACTIVE | Subcategory management |
| `pages/ecommerce/orders/` | ✅ ACTIVE | Order list (676 lines — decomposition needed) |
| `pages/ecommerce/order-details/` | ✅ ACTIVE | Order detail view |
| `pages/ecommerce/customers/` | ✅ ACTIVE | Customer list |
| `pages/ecommerce/cart/` | ✅ ACTIVE | Cart management |
| `pages/ecommerce/variants-list/` | ✅ ACTIVE | Variant management |
| `pages/ecommerce/promos/` | ✅ ACTIVE | Promotion management |
| `pages/ecommerce/delivery-management/` | ✅ ACTIVE | Delivery pricing and zones |
| `pages/admin/admin-users/` | ✅ ACTIVE | Admin team management |
| `pages/media/medias/` | ✅ ACTIVE | Media upload (bypasses `media.service.ts` — direct Supabase calls) |
| `pages/charts/` | ❌ DEAD | 18+ ApexCharts/ECharts sub-directories; never routed or instantiated |
| `pages/apps/` | ❌ DEAD | Empty module — `AppsRoutingModule` has empty routes array; imports 50+ dependencies |

---

## 7. Account Module — Admin Auth (`src/app/account/`)

| Path | Status | Notes |
|------|--------|-------|
| `account/login/` | ✅ ACTIVE | Admin login |
| `account/forgot-password/` | ✅ ACTIVE | Password reset request |
| `account/reset-password/` | ✅ ACTIVE | Password reset form |
| `account/auth-callback/` | ✅ ACTIVE | Supabase OAuth callback handler |
| `account/admin-invite/` | ✅ ACTIVE | Accept admin invitation |
| `account/login/toast-service.ts` | ❌ DEAD | Local duplicate of `core/services/toast.service.ts` |
| `account/login/toasts-container.component.ts` | ❌ DEAD | Part of the above local toast duplicate |

---

## 8. Layouts Module (`src/app/layouts/`)

| Path | Status | Notes |
|------|--------|-------|
| `layouts/layout.component.*` | ✅ ACTIVE | Main admin layout wrapper |
| `layouts/topbar/` | ✅ ACTIVE | Admin topbar |
| `layouts/sidebar/` | ✅ ACTIVE | Admin sidebar (menu navigation) |
| `layouts/footer/` | ✅ ACTIVE | Admin footer |
| `layouts/vertical/` | ✅ ACTIVE | Primary admin layout mode |
| `layouts/horizontal/` | 🔍 UNCERTAIN | Conditionally rendered — verify if any live route reaches it |
| `layouts/horizontal-topbar/` | 🔍 UNCERTAIN | Paired with horizontal — same uncertainty |
| `layouts/two-column/` | 🔍 UNCERTAIN | Check theme switcher settings for reachability |
| `layouts/two-column-sidebar/` | 🔍 UNCERTAIN | Same as above |
| `layouts/rightsidebar/` | ❌ DEAD | No condition in `layout.component.html` renders it |

---

## 9. Shared Module (`src/app/shared/`)

### 9.1 Shared Components

| Path | Status | Notes |
|------|--------|-------|
| `shared/breadcrumbs/` | ✅ ACTIVE | Admin breadcrumb component |
| `shared/components/product-card/` | ✅ ACTIVE | Reusable product card across landing pages |
| `shared/components/category-card/` | ✅ ACTIVE | Reusable category card |
| `shared/components/carousel/` | ✅ ACTIVE | Product image carousel |
| `shared/components/section-title/` | ✅ ACTIVE | Section heading component |
| `shared/components/product-modal/` | ✅ ACTIVE | Quick-view modal |
| `shared/components/button/` | 🔍 UNCERTAIN | Verify active instantiation |
| `shared/components/button-hover/` | 🔍 UNCERTAIN | Verify active instantiation |
| `shared/components/video-hero/` | 🔍 UNCERTAIN | Verify active instantiation |

### 9.2 Pipes

| File | Status | Notes |
|------|--------|-------|
| `pipes/convert-price.pipe.ts` | ✅ ACTIVE | EUR/XOF display conversion |
| `pipes/currency-converter.pipe.ts` | ✅ ACTIVE | Used across landing templates |
| `pipes/truncate.pipe.ts` | ✅ ACTIVE | Text truncation |

### 9.3 Directives

| File | Status | Notes |
|------|--------|-------|
| `directives/scrollspy.directive.ts` | ✅ ACTIVE | Admin navigation scrollspy |
| `directives/landingscrollspy.directive.ts` | ✅ ACTIVE | Landing page scrollspy |

### 9.4 Landing Sub-components (`shared/landing/index/`)

| Path | Status | Notes |
|------|--------|-------|
| `shared/landing/index/topbar/` | ✅ ACTIVE | Customer-facing topbar |
| `shared/landing/index/footer/` | ✅ ACTIVE | Customer-facing footer |
| `shared/landing/index/cart-bar/` | ✅ ACTIVE | Slide-out cart |
| `shared/landing/index/banner-promo/` | ✅ ACTIVE | Promotional banner |
| `shared/landing/index/promo-bar/` | ✅ ACTIVE | Top promo bar |
| `shared/landing/index/promo-container/` | ✅ ACTIVE | Promo orchestration |
| `shared/landing/index/popup-promo/` | ✅ ACTIVE | Promo popup |
| `shared/landing/index/search-bar/` | ✅ ACTIVE | Global search |
| `shared/landing/index/contact/` | ✅ ACTIVE | Contact form |
| `shared/landing/index/faqs/` | ✅ ACTIVE | FAQ accordion |
| `shared/landing/index/services/` | ✅ ACTIVE | Brand services block |
| `shared/landing/index/work-process/` | ✅ ACTIVE | How it works section |
| `shared/landing/index/menu-bar/` | ✅ ACTIVE | Mobile menu |
| `shared/landing/index/topbar-promo/` | ✅ ACTIVE | Topbar promo variant |
| `shared/landing/index/client-logo/` | 🔍 UNCERTAIN | Verify if rendered in any active page |
| `shared/landing/index/counter/` | 🔍 UNCERTAIN | Verify if rendered in any active page |

### 9.5 Dead Shared Landing (Template Artifacts)

| Path | Status | Notes |
|------|--------|-------|
| `shared/landing/job/` | ❌ DEAD | Job portal template — 6 components, declared but never used |
| `shared/landing/nft/` | ❌ DEAD | NFT marketplace template — 6 components, declared but never used |

### 9.6 Widgets (`src/app/shared/widget/`)

| Path | Status | Notes |
|------|--------|-------|
| `widget/dashboard/stat/` | ✅ ACTIVE | Admin stat cards |
| `widget/dashboard/best-selling/` | ✅ ACTIVE | Best sellers widget |
| `widget/dashboard/recent-orders/` | ✅ ACTIVE | Recent orders widget |
| `widget/dashboard/top-selling/` | ✅ ACTIVE | Top selling widget |
| `widget/analytics/` (BestSelling, RecentOrders) | ✅ ACTIVE | Active on dashboard |
| `widget/crm/` | ❌ DEAD | 4 components exported but never instantiated |
| `widget/crypto/` | ❌ DEAD | 4 components exported but never instantiated |
| `widget/nft/` | ❌ DEAD | 1 component, never instantiated |
| `widget/projects/` | ❌ DEAD | 4 components, never instantiated |
| `widget/analytics/analatics-stat/` | ❌ DEAD | Typo in folder name; never instantiated |
| `widget/analytics/top-pages/` | ❌ DEAD | Never instantiated |

---

## 10. Extra Pages (`src/app/extraspages/`)

| Path | Status | Notes |
|------|--------|-------|
| `extraspages/coming-soon/` | ✅ ACTIVE | Routed at `/pages` |
| `extraspages/maintenance/` | ✅ ACTIVE | Routed at `/pages/maintenance` |

---

## 11. Shared Modules (`src/app/shared-modules/`)

| Path | Status | Notes |
|------|--------|-------|
| `shared-modules/feather-icons.module.ts` | ❌ DEAD | Never imported anywhere |

---

## 12. Supabase Edge Functions (`supabase/functions/`)

| Path | Status | Notes |
|------|--------|-------|
| `paystack-initialize/` | ✅ ACTIVE | **Payment critical** — server-side total computation |
| `paystack-verify/` | ✅ ACTIVE | **Payment critical** — verification + order finalization |
| `paystack-webhook/` | ✅ ACTIVE | **Payment critical** — charge.success/failed handler |
| `paystack-return/` | ✅ ACTIVE | Redirect handler with allowlist |
| `geo-default/` | ✅ ACTIVE | Geolocation with fallbacks |
| `invite-admin/` | ✅ ACTIVE | Admin invitation handler |
| `invoice-generate/` | ✅ ACTIVE | PDF invoice generation |
| `invoice-send/` | ✅ ACTIVE | Invoice email dispatch |
| `send-order-status-notification/` | ✅ ACTIVE | Order status emails |
| `product-category-redirect/` | ✅ ACTIVE | Product URL canonicalization |
| `_shared/invoice-helpers.ts` | ✅ ACTIVE | Shared by 3 functions |
| `_shared/invoice-pdf.ts` | ✅ ACTIVE | PDF generation utility |

---

## 13. Assets

| Path | Status | Notes |
|------|--------|-------|
| `assets/images/landing/` | ✅ ACTIVE | Brand images, logo variants |
| `assets/images/flags/` | ✅ ACTIVE | Country flag SVGs for locale switcher |
| `assets/images/logo/` | ✅ ACTIVE | SVG logo files |
| `assets/images/categories/` | ✅ ACTIVE | Default category hero images |
| `assets/images/landing/payment/` | ✅ ACTIVE | Payment provider logos |
| `assets/images/admin/` | ✅ ACTIVE | Admin avatar placeholder |
| `assets/videos/men-collection.mp4` | ✅ ACTIVE | Used by landing video hero |
| `assets/videos/tshirts-hero.mp4` | 🔍 UNCERTAIN | Verify if referenced in any active template |
| `assets/i18n/fr.json` | ✅ ACTIVE | Primary locale |
| `assets/i18n/en.json` | ✅ ACTIVE | English locale |
| `assets/i18n/ar.json` | 🔍 UNCERTAIN | Arabic — verify if locale switcher exposes it |
| `assets/i18n/ch.json` | 🔍 UNCERTAIN | Chinese — same |
| `assets/i18n/de.json` | 🔍 UNCERTAIN | German — same |
| `assets/i18n/es.json` | 🔍 UNCERTAIN | Spanish — same |
| `assets/i18n/it.json` | 🔍 UNCERTAIN | Italian — same |
| `assets/i18n/ru.json` | 🔍 UNCERTAIN | Russian — same |
| `assets/fonts/` | ✅ ACTIVE | Boxicons, HK Grotesk, Remix Icon, etc. |

---

## 14. Summary Counts

| Status | Count |
|--------|-------|
| ✅ ACTIVE | ~110 paths |
| ⚠️ LEGACY-DEP | ~10 paths |
| ❌ DEAD | ~30 paths |
| 🔍 UNCERTAIN | ~20 paths |

---

## 15. Top Deletion Candidates (After Verification)

These are the highest-confidence dead paths. No action in this pass.

1. `store/CRM/`, `store/Crypto/`, `store/Invoice/`, `store/Jobs/`, `store/Project/`, `store/Task/`, `store/Ticket/`, `store/Todo/`, `store/File Manager/`, `store/APIKey/`
2. `pages/charts/` (entire directory — 18+ template chart pages)
3. `pages/apps/` (empty module with 50+ dead imports)
4. `layouts/rightsidebar/`
5. `shared/landing/job/`, `shared/landing/nft/`
6. `widget/crm/`, `widget/crypto/`, `widget/nft/`, `widget/projects/`, `widget/analytics/analatics-stat/`, `widget/analytics/top-pages/`
7. `landing/profile/`
8. Local toast service duplicates in `account/login/` and `pages/dashboards/dashboard/`
9. Service duplicates: `favoris.service.ts`, `favorite.service.ts`, `panier.service.ts`, `promo.service.ts`
10. `src/typings.d.ts`, `src/app/typings.d.ts`, `src/app/shared-modules/`

---

*This document is a read-only audit. No deletions should occur before cross-referencing `docs/admin-template-dependency-map.md` and `docs/unification-roadmap.md`.*
