# SCSS Import Map — SmellAndWear
> **Generated:** 2026-03-16
> **Auditor:** Senior Angular Codebase Auditor
> **Scope:** All global SCSS, all `:root`-level CSS custom properties, all color/token control points

---

## 1. Global SCSS Bundle Load Order

Angular CLI compiles the following stylesheets in this exact order (from `angular.json`):

```
1.  node_modules/prismjs/themes/prism.css           ← code syntax highlighting
2.  node_modules/shepherd.js/dist/css/shepherd.css  ← template tour (likely unused)
3.  node_modules/flatpickr/dist/flatpickr.css        ← date picker base
4.  src/styles.scss                                  ← project global entry point
5.  node_modules/slick-carousel/slick/slick.scss     ← carousel base
6.  node_modules/slick-carousel/slick/slick-theme.scss ← carousel theme
7.  @ctrl/ngx-emoji-mart/picker.css                  ← emoji picker (uncertain usage)
8.  src/assets/scss/config/default/bootstrap.scss    ← Bootstrap 5 via Velzon config
9.  src/assets/scss/config/default/app.scss          ← Velzon full template bundle
10. src/assets/scss/icons.scss                       ← Boxicons, Remix, MDI, Line Awesome
```

**Key insight:** `styles.scss` (item 4) loads before the full Velzon bundle (items 8–9). This means any `:root` overrides in `styles.scss` or its imports will be **overwritten** by the Velzon `_root.scss` which is imported inside `app.scss`. Only overrides placed *after* the Velzon bundle or with higher specificity survive.

---

## 2. `src/styles.scss` — Project Global Entry Point

```
src/styles.scss
├── @import 'assets/scss/theme-variables'   ← SW custom tokens (--sw-*) — FILE MISSING on disk
│                                              (referenced but not found in glob results)
└── @import 'assets/scss/landing-typography.scss' ← Landing font system (Bebas Neue / Open Sans / Montserrat)
    └── Scoped to: .layout-wrapper.landing, .landing-page, [class*="landing-"]
        ├── Headings → Bebas Neue
        ├── Body text → Open Sans
        ├── Links/buttons → Montserrat
        └── Responsive + utility overrides

Inline rules in styles.scss:
├── .layout-wrapper.landing { background-color: #ffffff !important }
├── Slick carousel custom overrides (.coverflowslide, .space)
├── Calendar dark-mode overrides ([data-bs-theme="dark"] .fc ...)
└── NFT landing dot styles (#landingnft .slick-dots) — template residue
```

---

## 3. `src/assets/scss/config/default/app.scss` — Velzon Master Bundle

This is the root of 170+ SCSS files. Load order inside `app.scss`:

### 3.1 Core Config Layer

```
config/default/app.scss
├── ../../fonts/fonts                   ← HK Grotesk (primary admin font)
├── node_modules/bootstrap/scss/functions
├── node_modules/bootstrap/scss/variables
├── ./variables                         ← _variables.scss: $prefix: vz-, color system, Bootstrap overrides
├── ./variables-custom                  ← _variables-custom.scss: sidebar/topbar dimensions, layout vars
├── ./variables-dark                    ← _variables-dark.scss: dark mode overrides
└── node_modules/bootstrap/scss/mixins
```

### 3.2 Structure Layer (Admin Shell)

```
├── ../../structure/topbar              ← Admin topbar positioning, height
├── ../../structure/page-head           ← Page title bar (breadcrumbs area)
├── ../../structure/footer              ← Admin footer offset
├── ../../structure/vertical            ← Sidebar layout (primary mode)
├── ../../structure/horizontal          ← Horizontal layout (uncertain usage)
├── ../../structure/two-column          ← Two-column layout (uncertain usage)
└── ../../structure/layouts             ← Layout wrapper, main-content offsets
```

### 3.3 Component Layer

```
├── components/waves, avatar, accordion, helper, preloader
├── components/forms, widgets, demos, print, ribbons, toast, scrollspy
├── components/root         ← ⚠️ Defines all --vz-* CSS custom properties on :root
├── components/reboot       ← Global reset overrides
├── components/alerts, badge, buttons, breadcrumb, card, dropdown
├── components/nav, table, modal, pagination, progress, popover
├── components/type, form-check, form-control, list-group
└── components/_utilities
```

### 3.4 Plugin Layer

```
├── plugins/custom-scrollbar, prismjs, sweetalert2, dropzone
├── plugins/range-slider, sortablejs, tour, swiper, multijs
├── plugins/colorpicker, filepond, form-input-spin, ckeditor, quilljs
├── plugins/gridjs, listjs, apexcharts, chartjs, echarts
├── plugins/google-map, autocomplete, vector-maps, leaflet-maps
├── plugins/fullcalendar, emoji-picker, datatables, select2
├── plugins/toastify, choices, flatpicker, flag-input, form-wizard
```

### 3.5 Page Layer

```
├── pages/authentication      ← Admin login/register pages
├── pages/dashboard           ← Admin dashboard layout
├── pages/timeline            ← Template page (uncertain project usage)
├── pages/gallery             ← Template page (uncertain — media page uses it?)
├── pages/errors              ← 404/500 error pages
├── pages/profile             ← Template page (uncertain project usage)
├── pages/sitemap             ← Template page (no sitemap feature)
├── pages/team                ← Template page (no team feature)
├── pages/coming-soon         ← Active (extraspages module)
├── pages/search-results      ← Template page (uncertain)
├── pages/ecommerce           ← ✅ Active — admin product/order tables
├── pages/invoice             ← ✅ Active — admin invoice view
├── pages/chat                ← Template page (no chat feature)
├── pages/email               ← Template page (no email client feature)
├── pages/kanban              ← Template page (no kanban feature)
├── pages/landing             ← Velzon landing demo (NOT the SmellAndWear landing)
├── pages/nft-landing         ← Template page (no NFT feature)
├── pages/file-manager        ← Template page (no file manager feature)
├── pages/to-do               ← Template page (no to-do feature)
├── pages/jobs                ← Template page (no jobs feature)
├── pages/job-landing         ← Template page (no job landing)
├── angular-custom.scss       ← Angular-specific selector tweaks
└── pages/blog                ← Template page (uncertain — news page?)
```

### 3.6 RTL Layer (DISABLED)

```
// @import "../../rtl/components-rtl";   ← commented out
// @import "../../rtl/layouts-rtl";      ← commented out
// @import "../../rtl/pages-rtl";        ← commented out
// @import "../../rtl/plugins-rtl";      ← commented out
```

### 3.7 Icons (`src/assets/scss/icons.scss`)

```
icons.scss
├── icons/boxicons              ← Used in admin sidebar and landing icons
├── icons/remixicon             ← Used extensively in landing components
├── icons/materialdesignicons   ← Template icons (uncertain project usage)
└── icons/line-awesome          ← Template icons (uncertain project usage)
```

---

## 4. CSS Custom Property Control Points

### 4.1 SmellAndWear Brand Tokens (`--sw-*`)

**Declared in:** `src/assets/scss/theme-variables.scss` *(file referenced in styles.scss but NOT FOUND on disk — likely lost or gitignored)*

**Currently active in DOM** (discovered via browser computed styles):

```css
:root {
  /* Brand identity */
  --sw-primary:            #B5190C;
  --sw-primary-dark:       #8a1309;
  --sw-primary-light:      #d41e10;
  --sw-primary-soft:       rgba(181, 25, 12, 0.12);

  /* Backgrounds */
  --sw-bg-primary:         #ffffff;
  --sw-bg-secondary:       #f8f9fa;
  --sw-bg-tertiary:        #e9ecef;
  --sw-bg-surface:         #ffffff;
  --sw-bg-elevated:        #ffffff;

  /* Text */
  --sw-text-primary:       #1a1a1a;
  --sw-text-secondary:     #666666;
  --sw-text-muted:         #999999;
  --sw-text-inverse:       #ffffff;

  /* Borders */
  --sw-border-primary:     #e5e7eb;
  --sw-border-secondary:   #f0f0f0;
  --sw-border-focus:       var(--sw-primary);

  /* Shadows */
  --sw-shadow-sm:          0 2px 4px rgba(0, 0, 0, 0.05);
  --sw-shadow-md:          0 4px 12px rgba(0, 0, 0, 0.10);
  --sw-shadow-lg:          0 10px 25px rgba(0, 0, 0, 0.15);

  /* Icons */
  --sw-icon-primary:       #1a1a1a;
  --sw-icon-secondary:     #666666;
  --sw-icon-muted:         #999999;
  --sw-icon-inverse:       #ffffff;

  /* Topbar */
  --sw-topbar-bg:          #ffffff;
  --sw-topbar-bg-scrolled: #ffffff;
  --sw-topbar-icon-default: #ffffff;
  --sw-topbar-icon-scrolled: #1a1a1a;
  --sw-topbar-icon-mobile: #1a1a1a;
  --sw-topbar-border:      rgba(0, 0, 0, 0.08);

  /* Cards */
  --sw-card-bg:            #ffffff;
  --sw-card-border:        #e5e7eb;
  --sw-card-shadow:        0 2px 8px rgba(0, 0, 0, 0.08);

  /* Inputs */
  --sw-input-bg:           #ffffff;
  --sw-input-border:       #ced4da;
  --sw-input-focus-border: var(--sw-primary);
  --sw-input-placeholder:  #999999;

  /* Buttons */
  --sw-btn-primary-bg:     var(--sw-primary);
  --sw-btn-primary-text:   #ffffff;
  --sw-btn-secondary-bg:   #ffffff;
  --sw-btn-secondary-text: #1a1a1a;
  --sw-btn-secondary-border: #e5e7eb;

  /* Navigation */
  --sw-nav-link:           #ffffff;
  --sw-nav-link-scrolled:  #1a1a1a;
  --sw-nav-link-hover:     #f3f4f6;

  /* Overlay */
  --sw-overlay-bg:         rgba(0, 0, 0, 0.5);
  --sw-overlay-backdrop:   blur(4px);

  /* Status */
  --sw-success:            #10b981;
  --sw-warning:            #f59e0b;
  --sw-error:              #ef4444;
  --sw-info:               #3b82f6;
}
```

**⚠️ Critical gap:** The file that declares these tokens (`theme-variables.scss`) does not exist on disk in its expected location (`src/assets/scss/`). They must currently be declared somewhere inside a component's host styles or inside a file that was renamed. This must be located and formalized.

---

### 4.2 Velzon Template Tokens (`--vz-*`)

**Declared in:** `src/assets/scss/components/_root.scss`

Key tokens that conflict with brand identity:

```css
:root {
  --vz-primary:          #405189;   /* ❌ Blue — bleeds into social icons, links */
  --vz-primary-rgb:      64, 81, 137;
  --vz-danger:           #f06548;   /* ❌ Coral — bleeds into .btn-danger (back-to-top) */
  --vz-danger-rgb:       240, 101, 72;
  --vz-link-color:       #405189;   /* ❌ Blue — bleeds into any unstyled <a> */
  --vz-body-bg:          #ffffff;   /* ✅ Matches brand */
  --vz-body-color:       #212529;   /* ✅ Matches brand */
  --vz-success:          #0ab39c;   /* neutral */
  --vz-warning:          #f7b84b;   /* neutral */
  --vz-info:             #299cdb;   /* neutral */
}
```

---

### 4.3 Bootstrap Tokens (`--bs-*`)

Bootstrap 5.3.3 generates its own `--bs-*` tokens from the Velzon variable configuration. These are computed at build time from `$primary`, `$danger`, etc. in `_variables.scss`.

**Current computed values:**
- `--bs-primary` → `#405189` (from Velzon `$primary`)
- `--bs-danger` → `#f06548` (from Velzon `$danger`)
- `--bs-body-bg` → `#ffffff`
- `--bs-body-color` → `#212529`

---

## 5. Color Control Map — Where Each Color Is Defined

| Color Token | Value | Defined In | Override Status |
|-------------|-------|-----------|----------------|
| `--sw-primary` | `#B5190C` | `theme-variables.scss` (missing on disk) | ⚠️ Source file unlocated |
| `--vz-primary` | `#405189` | `components/_root.scss` | ❌ NOT overridden |
| `--vz-danger` | `#F06548` | `components/_root.scss` | ❌ NOT overridden |
| `--vz-link-color` | `#405189` | `components/_root.scss` | ❌ NOT overridden |
| Promo badge bg | `#FF0000` | Hardcoded in component CSS | ❌ Not using design token |
| Cart count badge | `#CD1C0E` | Hardcoded in component CSS | ⚠️ Close to brand but not exact |
| Back-to-top button | `#F06548` | `--vz-danger` via `.btn-danger` | ❌ Wrong class used |
| Social icon color | `#405189` | `--vz-primary` via `.social-icon` | ❌ Wrong token inherited |
| Body bg | `#FFFFFF` | `--vz-body-bg` | ✅ Matches brand |
| Body text | `#212529` | `--vz-body-color` | ✅ Matches brand |
| `.btn-primary` bg | `#B5190C` | `--sw-btn-primary-bg → --sw-primary` | ✅ Correct |
| Section titles | `#212529` | Inherited from body | ✅ Correct |
| Sub-text muted | `#666666` | `--sw-text-secondary` | ✅ Correct |
| Card bg | `#FFFFFF` | `--sw-card-bg` | ✅ Correct |
| Card border | `#E5E7EB` | `--sw-card-border` | ✅ Correct |

---

## 6. Font System Map

### 6.1 Landing (customer-facing) — Controlled by `landing-typography.scss`

| Element | Font | Weight | Applied via |
|---------|------|--------|------------|
| Headings (h1–h6) | Bebas Neue | — | `.layout-wrapper.landing h1–h6` |
| Body text, paragraphs | Open Sans | 400 | `.layout-wrapper.landing p, div, span` |
| Links, nav | Montserrat | 600–700 | `.layout-wrapper.landing a, .nav-link` |
| Buttons | Montserrat | 700 | `.layout-wrapper.landing button, .btn` |
| Form inputs | Open Sans | 400 | `.layout-wrapper.landing input, .form-control` |

**Google Fonts imports:** Bebas Neue, Open Sans, and Montserrat must be imported in `index.html` or a global CSS file. Verify these are present in `src/index.html`.

### 6.2 Admin — Controlled by Velzon `_variables.scss`

| Element | Font | Defined in |
|---------|------|-----------|
| Primary admin font | Poppins | `$font-family-primary: 'Poppins', sans-serif` |
| Secondary admin font | HK Grotesk | `$font-family-secondary: 'hkgrotesk', sans-serif` |
| HK Grotesk files | Local | `src/assets/fonts/hkgrotesk/` |

---

## 7. Identified Risks in SCSS Architecture

### Risk 1: Missing `theme-variables.scss`

The `--sw-*` tokens appear in computed styles, meaning they are loaded at runtime. However, the source file `src/assets/scss/theme-variables.scss` was not found on disk. The tokens may be:
- Defined inline in a component's host SCSS
- In a file with a different name or path
- Generated at build time via another mechanism

**Action:** Locate the actual source of `--sw-*` declarations before any cleanup.

### Risk 2: `--vz-primary` and `--vz-danger` Not Overridden

Until a global `:root` override is added, any component using Bootstrap's `.btn-danger`, `.text-primary`, `.link-*` classes or `--vz-primary` will render in Velzon blue/coral instead of brand red.

**Minimum fix (no refactor required):**
```scss
// In theme-variables.scss or styles.scss, AFTER the Velzon bundle loads:
:root {
  --vz-primary:        #B5190C;
  --vz-primary-rgb:    181, 25, 12;
  --vz-danger:         #B5190C;
  --vz-danger-rgb:     181, 25, 12;
  --vz-link-color:     #212529;
  --vz-link-color-rgb: 33, 37, 41;
}
```

### Risk 3: Hardcoded Colors in Component SCSS

The discount badge (`#FF0000`) and cart badge (`#CD1C0E`) use hardcoded colors instead of `var(--sw-primary)`. These are not in a central token file — they are in component-level SCSS.

**Files to check:**
- `shared/landing/index/promo-bar/` (promo badge)
- `shared/components/product-card/` (discount badge)
- `shared/landing/index/topbar/` or `shared/landing/index/cart-bar/` (cart count)

### Risk 4: `#landingnft` Styles in `styles.scss`

The NFT landing carousel dot styles (`#landingnft .slick-dots`) are in the global `styles.scss`. The NFT landing page itself is dead template code. These rules add dead CSS weight globally.

### Risk 5: Load Order Override Problem

The `src/styles.scss` (which imports `theme-variables`) loads **before** `app.scss` (which loads `_root.scss` and defines `--vz-*`). This means any `--vz-*` override in `styles.scss` or `theme-variables` will be **overwritten** by `_root.scss`.

**Correct override approach:** Place `:root` overrides in a file that is loaded **after** `app.scss`, or use a `:root` block directly in `angular.json` after the template bundle, or increase specificity.

---

## 8. Active vs Unused SCSS Pages Summary

| SCSS File | Active? | Project feature |
|-----------|---------|----------------|
| `pages/_authentication.scss` | ✅ Active | Admin login |
| `pages/_dashboard.scss` | ✅ Active | Admin dashboard |
| `pages/_ecommerce.scss` | ✅ Active | Admin products/orders |
| `pages/_invoice.scss` | ✅ Active | Admin order invoice view |
| `pages/_coming-soon.scss` | ✅ Active | `/pages` route |
| `pages/_errors.scss` | ✅ Active | Error pages |
| `pages/_gallery.scss` | 🔍 Uncertain | Media page? |
| `pages/_profile.scss` | 🔍 Uncertain | Account settings? |
| `pages/_blog.scss` | 🔍 Uncertain | `news/` page? |
| `pages/_search-results.scss` | 🔍 Uncertain | Search feature? |
| `pages/_timeline.scss` | 🔍 Uncertain | Order timeline? |
| `pages/_landing.scss` | ❌ Dead | Velzon demo landing |
| `pages/_chat.scss` | ❌ Dead | No chat feature |
| `pages/_email.scss` | ❌ Dead | No email client |
| `pages/_kanban.scss` | ❌ Dead | No kanban |
| `pages/_nft-landing.scss` | ❌ Dead | No NFT feature |
| `pages/_file-manager.scss` | ❌ Dead | No file manager |
| `pages/_to-do.scss` | ❌ Dead | No to-do |
| `pages/_jobs.scss` | ❌ Dead | No jobs |
| `pages/_job-landing.scss` | ❌ Dead | No job landing |
| `pages/_sitemap.scss` | ❌ Dead | No sitemap |
| `pages/_team.scss` | ❌ Dead | No team page |

---

## 9. Recommended SCSS Architecture Target State

```
Global load order (target):
1. node_modules → third-party base styles (unchanged)
2. src/assets/scss/config/default/bootstrap.scss → Bootstrap variables + framework
3. src/assets/scss/config/default/app.scss → Velzon template bundle (unchanged)
4. src/assets/scss/icons.scss → Icon fonts
5. src/assets/scss/sw-brand-overrides.scss   ← NEW: overrides --vz-* with brand values
6. src/assets/scss/landing-typography.scss → Landing font system
7. src/styles.scss → Project-specific global rules (slimmed down)

sw-brand-overrides.scss content:
:root {
  --vz-primary:        #B5190C;
  --vz-primary-rgb:    181, 25, 12;
  --vz-danger:         #B5190C;
  --vz-danger-rgb:     181, 25, 12;
  --vz-link-color:     #212529;
  --vz-link-color-rgb: 33, 37, 41;
}
```

This approach ensures the template CSS loads first, then brand overrides win at `:root` level without touching any Velzon source files.

---

*This document is read-only. For implementation steps, see `docs/unification-roadmap.md`.*
