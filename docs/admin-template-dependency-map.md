# Admin Template Dependency Map — SmellAndWear
> **Generated:** 2026-03-16
> **Template:** Velzon v4.1.0 by Themesbrand
> **Rule:** Conservative — if a dependency cannot be proven removable, it is marked PRESERVE.

---

## Overview

The SmellAndWear project was bootstrapped from the **Velzon Admin & Dashboard Template v4.1.0** by Themesbrand. The entire Admin area (routes under `/admin`), the `LayoutsModule`, the `PagesModule`, and the full SCSS bundle are built on top of this template.

The Landing/customer-facing area has been significantly customized, but still inherits the template's Bootstrap layer, CSS variable system (`--vz-*` prefix), and global SCSS bundle.

This document maps every dependency on the Velzon template structure, classifies them, and flags what must be preserved.

---

## 1. Template Identity Evidence

| Evidence | Location | Value |
|----------|----------|-------|
| Template header comment | `src/assets/scss/config/default/app.scss` | `Velzon - Admin & Dashboard Template v4.1.0 by Themesbrand` |
| CSS variable prefix | `src/assets/scss/config/default/_variables.scss` | `$prefix: vz-;` |
| Deprecated API URL | `src/app/global-component.ts` | `https://api-node.themesbrand.website/` |
| Sidebar menu structure | `src/app/layouts/sidebar/menu.ts` | Velzon menu model |
| Layout classes | `layout.component.html` | `.layout-wrapper`, `.main-content`, `.page-content` |
| Bootstrap version | `node_modules/bootstrap` | Bootstrap 5.3.3 (Velzon-configured) |
| Icon systems | `src/assets/scss/icons.scss` | Boxicons, Line Awesome, Material Design Icons, Remix Icon |

---

## 2. Template Dependency Zones

### Zone A — Admin Shell (PRESERVE ALL — DO NOT TOUCH)

The admin shell is the set of layout components that wrap every `/admin` route. It is entirely Velzon-derived and must remain intact for Admin to function.

| Component | File | Template Dependency | Risk if modified |
|-----------|------|-------------------|-----------------|
| `LayoutComponent` | `layouts/layout.component.*` | Uses `.layout-wrapper`, `.main-content`, `.page-content` | Admin collapses |
| `TopbarComponent` | `layouts/topbar/` | Uses Velzon topbar classes, `topbar.model.ts`, notification bell | Admin topbar breaks |
| `SidebarComponent` | `layouts/sidebar/` | Uses Velzon sidebar CSS, `menu.ts`, `menu.model.ts`, metismenujs | Admin sidebar breaks |
| `FooterComponent` (Admin) | `layouts/footer/` | Uses Velzon footer height variables | Admin footer breaks |
| `VerticalComponent` | `layouts/vertical/` | Primary layout mode — conditionally rendered | Admin layout breaks |

**What the Admin shell depends on from Velzon:**
- `src/assets/scss/structure/_vertical.scss` — sidebar collapse behaviour
- `src/assets/scss/structure/_topbar.scss` — topbar sticky positioning
- `src/assets/scss/structure/_footer.scss` — footer offset
- `src/assets/scss/structure/_layouts.scss` — layout wrapper rules
- `src/assets/scss/structure/_page-head.scss` — page title bar
- `--vz-topbar-bg`, `--vz-sidebar-bg` CSS variables
- `metismenujs` package (sidebar accordion navigation)
- `simplebar-angular` package (custom scrollbar in sidebar)

---

### Zone B — Admin Page Components (PRESERVE — Refactor Carefully)

These are the admin feature pages. They are project-specific in logic but rely on Velzon for visual scaffolding.

| Component | Key Velzon Dependencies | Safe to Edit? |
|-----------|------------------------|--------------|
| `DashboardComponent` | `.card`, `.card-body`, ApexCharts styles, `.page-title-box` | Yes, in isolation |
| `ProductsComponent` | `.card`, `.table`, gridjs styles, `.btn-soft-*` | Yes |
| `AddProductComponent` | CKEditor styles, `.form-*`, `.card` | Yes |
| `OrdersComponent` | `.table`, pagination styles, `.badge`, `.status-*` | Yes |
| `OrderDetailsComponent` | `.card`, invoice styles from `pages/_invoice.scss` | Yes |
| `CustomersComponent` | `.table`, `.avatar`, gridjs | Yes |
| `CategoriesComponent` | `.card`, `.list-group` | Yes |
| `MediasComponent` | Dropzone styles from `plugins/_dropzone.scss` | Yes |
| `PromosComponent` | `.badge`, `.card`, `.table` | Yes |
| `DeliveryManagementComponent` | `.card`, `.form-*` | Yes |
| `AdminUsersComponent` | `.card`, `.table`, `.avatar` | Yes |
| `DashboardGeoComponent` | Leaflet styles from `plugins/_leaflet-maps.scss`, Google Maps | **High risk** — map plugins are fragile |

---

### Zone C — Shared Widgets (PRESERVE ACTIVE — DELETE TEMPLATE ONES)

| Widget | Status | Velzon Dependency |
|--------|--------|------------------|
| `stat/` | ✅ PRESERVE | Uses `.card`, `.card-body`, `.avatar` |
| `best-selling/` | ✅ PRESERVE | Uses `.table`, `.badge` |
| `recent-orders/` | ✅ PRESERVE | Uses `.table`, `.badge`, `.status` classes |
| `top-selling/` | ✅ PRESERVE | Uses `.card` |
| `analytics/` (active) | ✅ PRESERVE | Uses chart styles |
| `crm/`, `crypto/`, `nft/`, `projects/` | ❌ SAFE TO DELETE | Never instantiated |

---

### Zone D — Layout Variants (UNCERTAIN — DO NOT DELETE YET)

These four layout variants exist in Velzon to support different admin nav styles. The `layouts/layout.component.html` conditionally renders them based on `layoutType` from NgRx store.

| Variant | Status | Risk |
|---------|--------|------|
| `layouts/vertical/` | ✅ ACTIVE | **High** — Primary mode; never touch |
| `layouts/horizontal/` | 🔍 UNCERTAIN | **Medium** — May be user-selectable via theme switcher |
| `layouts/horizontal-topbar/` | 🔍 UNCERTAIN | **Medium** — Same |
| `layouts/two-column/` | 🔍 UNCERTAIN | **Medium** — Same |
| `layouts/two-column-sidebar/` | 🔍 UNCERTAIN | **Medium** — Same |
| `layouts/rightsidebar/` | ❌ SAFE TO DELETE | No condition in `layout.component.html` renders it |

**Action required before deleting horizontal/two-column variants:** Check `src/app/store/layouts/layout.ts` and `layout-action.ts` to confirm whether the theme switcher allows user selection of non-vertical modes. If the switcher is disabled in the UI, the variants can be removed. If it is active, **DO NOT DELETE**.

---

### Zone E — Template Pages (DEAD — Safe After Confirmation)

These are Velzon template demo pages that were never converted to project pages.

| Module/Folder | Content | Risk |
|---------------|---------|------|
| `pages/charts/` | 18+ chart demo pages (area, bar, pie, etc.) | ❌ None — never routed |
| `pages/apps/` | Empty apps module with 50+ template imports | ❌ None — empty routes array |

**Shared template landing demos:**

| Folder | Content | Risk |
|--------|---------|------|
| `shared/landing/job/` | Job portal landing (6 components) | ❌ None — never instantiated |
| `shared/landing/nft/` | NFT marketplace landing (6 components) | ❌ None — never instantiated |

---

### Zone F — NgRx Store Template Slices (DEAD — Safe After AppModule Cleanup)

These are Velzon template NgRx slices registered in `app.module.ts` but consuming zero state in any component.

| Store Slice | Registered? | Consumed? | Risk |
|-------------|-------------|-----------|------|
| `store/CRM/` | ✅ Yes | ❌ No | Remove registration + folder |
| `store/Crypto/` | ✅ Yes | ❌ No | Remove registration + folder |
| `store/Invoice/` | ✅ Yes | ❌ No | Invoice.service.ts is separate |
| `store/Jobs/` | ✅ Yes | ❌ No | Remove registration + folder |
| `store/Project/` | ✅ Yes | ❌ No | Remove registration + folder |
| `store/Task/` | ✅ Yes | ❌ No | Remove registration + folder |
| `store/Ticket/` | ✅ Yes | ❌ No | Remove registration + folder |
| `store/Todo/` | ✅ Yes | ❌ No | Remove registration + folder |
| `store/File Manager/` | ✅ Yes | ❌ No | Folder name has space — extra risk |
| `store/APIKey/` | ✅ Yes | ❌ No | Remove registration + folder |

**⚠️ Important:** Deleting these folders without first removing their `StoreModule.forFeature()` and `EffectsModule.forFeature()` registrations from `app.module.ts` will cause runtime errors. The `app.module.ts` cleanup **must happen first**.

---

### Zone G — Global Style Template Dependencies

The entire SCSS bundle is Velzon-derived. The following files must be kept until a custom design system replaces them.

| File | Must Keep? | Reason |
|------|-----------|--------|
| `config/default/_variables.scss` | ✅ YES | Bootstrap + Velzon variable definitions |
| `config/default/_variables-custom.scss` | ✅ YES | Admin sidebar/topbar dimensions |
| `config/default/bootstrap.scss` | ✅ YES | Bootstrap entry point |
| `config/default/app.scss` | ✅ YES | Master SCSS orchestrator |
| `structure/_vertical.scss` | ✅ YES | Admin sidebar layout |
| `structure/_topbar.scss` | ✅ YES | Admin topbar |
| `structure/_footer.scss` | ✅ YES | Admin footer |
| `structure/_layouts.scss` | ✅ YES | Layout wrapper rules |
| `components/_card.scss` | ✅ YES | Used everywhere in admin |
| `components/_buttons.scss` | ✅ YES | Button variants across admin |
| `components/_badge.scss` | ✅ YES | Status badges in orders/products |
| `components/_table.scss` | ✅ YES | Admin data tables |
| `components/_modal.scss` | ✅ YES | Admin modals |
| `plugins/_apexcharts.scss` | ✅ YES | Dashboard charts |
| `plugins/_leaflet-maps.scss` | ✅ YES | Geo dashboard |
| `plugins/_dropzone.scss` | ✅ YES | Media uploader |
| `plugins/_datatables.scss` | ✅ YES | Admin grids |
| `plugins/_ckeditor.scss` | ✅ YES | Product description editor |
| `pages/_ecommerce.scss` | ✅ YES | Admin ecommerce page layout |
| `pages/_dashboard.scss` | ✅ YES | Dashboard-specific styles |
| `pages/_authentication.scss` | ✅ YES | Admin login page |

**Template-only SCSS pages (no project content — LOW risk to remove eventually):**

| File | Template Content | Currently Used? |
|------|-----------------|----------------|
| `pages/_chat.scss` | Chat app styles | ❌ No chat feature |
| `pages/_email.scss` | Email client styles | ❌ No email feature |
| `pages/_kanban.scss` | Kanban board styles | ❌ No kanban feature |
| `pages/_timeline.scss` | Timeline styles | 🔍 Uncertain — verify |
| `pages/_file-manager.scss` | File manager styles | ❌ No file manager feature |
| `pages/_to-do.scss` | To-do app styles | ❌ No to-do feature |
| `pages/_jobs.scss` | Jobs listing styles | ❌ No jobs feature |
| `pages/_job-landing.scss` | Job landing styles | ❌ No job landing |
| `pages/_nft-landing.scss` | NFT landing styles | ❌ No NFT feature |
| `pages/_blog.scss` | Blog styles | 🔍 Uncertain — `news/` page |
| `pages/_gallery.scss` | Gallery styles | 🔍 Uncertain — media page |
| `pages/_profile.scss` | Profile page styles | 🔍 Uncertain |
| `pages/_sitemap.scss` | Sitemap styles | ❌ No sitemap |
| `pages/_team.scss` | Team page styles | ❌ No team page |
| `pages/_search-results.scss` | Search results | 🔍 Uncertain |
| `pages/_landing.scss` | Velzon landing demo | ❌ Not the brand landing |

---

## 3. CSS Variable Conflict Map

This is the core issue identified in the color audit. Two CSS token systems coexist:

| System | Prefix | Controlled by | Used where |
|--------|--------|--------------|------------|
| SmellAndWear custom | `--sw-*` | `src/assets/scss/theme-variables.scss` (missing) / inline in components | Landing area, brand tokens |
| Velzon template | `--vz-*` | `src/assets/scss/components/_root.scss` | Admin area + any element that hasn't overridden |
| Bootstrap | `--bs-*` | `config/default/bootstrap.scss` | Both areas |

**Key conflicts identified:**

| Token | Expected value | Velzon `--vz-*` value | Impact |
|-------|---------------|-----------------------|--------|
| Primary color | `#B5190C` | `--vz-primary: #405189` (blue) | Footer social icons inherit blue |
| Danger color | `#B5190C` or unused | `--vz-danger: #F06548` (coral) | Back-to-top `.btn-danger` renders coral |
| Link color | `#212529` | `--vz-link-color: #405189` (blue) | Any `<a>` without explicit override gets blue |

**The `--vz-primary` and `--vz-danger` variables are not overridden in `:root`.**
The `--sw-primary: #B5190C` token exists but is only consumed by components that explicitly reference it.

---

## 4. Package Dependencies Required by Admin Template

These `node_modules` packages are consumed exclusively by Velzon admin structures and should **not** be removed until the Admin area is fully rebuilt:

| Package | Used by | Risk if removed |
|---------|---------|----------------|
| `metismenujs` | Sidebar accordion navigation | Admin sidebar breaks |
| `simplebar-angular` | Custom scrollbar in sidebar | Admin sidebar breaks |
| `@asymmetrik/ngx-leaflet` | Geo dashboard map | DashboardGeo breaks |
| `leaflet` | Same | Same |
| `apexcharts` / `ng-apexcharts` | Dashboard charts | Dashboard charts break |
| `chart.js` / `ng2-charts` | Secondary charts | Admin charts break |
| `ngx-echarts` / `echarts` | ECharts widgets | Admin charts break |
| `@fullcalendar/*` | Template calendar pages (unused project-side) | 🔍 Verify before removing |
| `@ckeditor/*` | `AddProductComponent` rich text editor | Admin product editor breaks |
| `@ng-select/ng-select` | Admin dropdowns | Admin forms break |
| `angularx-flatpickr` | Admin date pickers | Admin date inputs break |
| `ngx-drag-drop` | Drag-and-drop in media/products | Admin DnD breaks |
| `@ctrl/ngx-emoji-mart` | Template feature (uncertain) | 🔍 Verify usage |
| `lottie-web` | Template animations | 🔍 Verify usage |
| `shepherd.js` | Template tour feature | ❌ Likely unused project-side |
| `jquery` | Velzon SCSS plugin dependencies | 🔍 Required by slick-carousel |
| `ngx-slick-carousel` / `slick-carousel` | Landing image carousel | Landing carousel breaks |

---

## 5. Risky Deletion Areas

> These areas look removable but have hidden dependencies that make deletion dangerous without full trace.

### 5.1 `app.module.ts` NgRx Registrations
**Risk:** Deleting store slice folders without removing registrations causes immediate runtime error (`Effect not found`).
**Safe order:** Remove `StoreModule.forFeature()` / `EffectsModule.forFeature()` first, then delete the folder.

### 5.2 `shared.module.ts` Declarations
**Risk:** `SharedModule` declares and exports all components including dead ones. Removing a dead component declaration while it is still exported in another barrel import causes a compile error.
**Safe order:** Remove `declarations` + `exports` entries first, then delete the folder.

### 5.3 `_variables-custom.scss` Modifications
**Risk:** This file contains all admin sidebar and topbar dimensional variables. Any modification affects the admin layout dimensions globally.
**Rule:** Do not edit — treat as immutable until dedicated admin theme file exists.

### 5.4 `config/default/_variables.scss` — `$prefix: vz-`
**Risk:** This prefix controls how all Bootstrap CSS custom properties are generated. Changing it would rename all `--vz-*` variables, breaking every component that references them.
**Rule:** Do not change `$prefix`. Override specific variables in `:root` instead.

### 5.5 Layout Variant Components
**Risk:** If the `layoutType` NgRx action is dispatched anywhere (e.g., from a user preference saved to localStorage), the layout component will attempt to instantiate the corresponding variant. Deleting a variant that is still reachable via stored state causes a rendering failure.
**Rule:** Disable the layout switcher UI first, then verify the default `layoutType` is always `vertical`, then delete.

### 5.6 `pages/_ecommerce.scss` and `pages/_dashboard.scss`
**Risk:** These template SCSS pages contain selectors that are still in active use for the admin product/order tables and dashboard cards. They cannot be removed until a custom admin design system replaces them.

---

## 6. What Is Safe to Remove (Admin Template Artifacts)

These have been verified dead in the admin context:

| Item | Type | Why Safe |
|------|------|---------|
| `layouts/rightsidebar/` | Component | No `@if` condition in `layout.component.html` |
| `pages/charts/` | Module + components | No route in `pages-routing.module.ts` |
| `pages/apps/` | Module | Empty routes array |
| `store/CRM`, `Crypto`, `Jobs`, `Project`, `Task`, `Ticket`, `Todo`, `File Manager`, `APIKey` | NgRx slices | No component consumes selectors |
| `widget/crm`, `crypto`, `nft`, `projects` | Widget components | No template instantiates their selectors |
| Dead toast duplicates (`account/login/toast-service.ts`, `pages/dashboards/dashboard/toast-service.ts`) | Local service copies | `core/services/toast.service.ts` is the canonical service |

---

## 7. Summary: What Must Be Preserved for Admin Safety

| Category | Preserve | Reason |
|----------|---------|--------|
| Layout shell | `layouts/layout`, `topbar`, `sidebar`, `footer`, `vertical` | Admin renders nothing without them |
| Admin SCSS structure | All `structure/`, all active `components/`, active `plugins/`, `pages/_ecommerce`, `pages/_dashboard` | Admin visual rendering |
| Velzon Bootstrap config | `config/default/_variables.scss`, `bootstrap.scss`, `app.scss` | Removes all Bootstrap classes from admin |
| Active NgRx | `store/Authentication`, `Ecommerce`, `layouts` | Auth and product list break |
| Active widgets | `widget/dashboard/`, `widget/analytics/` (active subset) | Dashboard breaks |
| Plugin packages | leaflet, apexcharts, ckeditor, ng-select | Admin feature pages break |

---

*This document is read-only. All removals must follow the sequencing in `docs/unification-roadmap.md`.*
