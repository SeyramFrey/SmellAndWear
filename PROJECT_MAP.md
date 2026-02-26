# PROJECT MAP - Smell_Wear

## 1. Overview

**Project:** Smell_Wear - Angular 18 E-Commerce Platform
**Version:** 4.3.0
**Stack:**
- **Frontend:** Angular 18.0.4, Bootstrap 5.3.3, NgRx 18
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Payment:** CinetPay gateway
- **Charts:** ApexCharts, Chart.js, ECharts

**Entry Points:**
- Customer Site: `/` → `landing.module.ts`
- Admin Dashboard: `/admin` → `pages.module.ts`
- Admin Auth: `/auth` → `account.module.ts`

**Main Business Flows:**
1. **WEAR** - Fashion/clothing category browsing (men's & women's collections)
2. **SMELL** - Fragrance categories (handled via category system)
3. **CHECKOUT** - Payment flow with CinetPay integration
4. **Admin Management** - Products, orders, customers, promotions

---

## 2. Directory Tree

```
Smell_Wear/
├── .angular/                         # Angular CLI cache
├── .cursor/                          # Cursor IDE config
├── .vscode/                          # VS Code workspace settings
├── dist/                             # Build output (dist/smellwear)
├── docs/                             # Documentation files
├── node_modules/                     # Dependencies
├── supabase/                         # Supabase backend config
│   ├── config.toml                   # Local dev configuration
│   ├── seed.sql                      # Database seeding
│   ├── migrations/                   # DB migrations (RLS fixes)
│   └── functions/                    # Edge Functions (Deno)
│       ├── cinetpay-notification/    # Payment webhook handler
│       ├── cinetpay-return/          # Payment return handler
│       └── invite-admin/             # Admin invitation function
│
├── src/
│   ├── environments/                 # Environment configs
│   │   ├── environment.ts            # Dev config (Supabase URL/keys)
│   │   └── environment.prod.ts       # Production config
│   │
│   ├── assets/                       # Static assets (images, fonts)
│   ├── styles.scss                   # Global styles
│   ├── index.html                    # App entry HTML
│   ├── main.ts                       # Bootstrap entry
│   │
│   └── app/
│       ├── app.module.ts             # Root module
│       ├── app-routing.module.ts     # Root routes
│       ├── app.component.ts          # Root component
│       │
│       ├── account/                  # Admin authentication module
│       │   ├── login/                # Admin login page
│       │   ├── reset-password/       # Password reset
│       │   ├── admin-invite/         # Admin invitation flow
│       │   └── auth-callback/        # OAuth callback
│       │
│       ├── core/                     # Core services & utilities
│       │   ├── data/                 # Mock/seed data (40+ files)
│       │   ├── guards/               # Route guards
│       │   │   ├── admin.guard.ts    # Admin-only (DB-verified)
│       │   │   ├── auth.guard.ts     # Authenticated users
│       │   │   └── client.guard.ts   # Client/non-admin users
│       │   ├── helpers/              # Interceptors
│       │   ├── models/               # TypeScript interfaces
│       │   │   └── models.ts         # Core models (Produit, Variante, etc.)
│       │   └── services/             # 45+ business services
│       │       ├── supabase.service.ts
│       │       ├── supabase-auth.service.ts
│       │       ├── cart.service.ts
│       │       ├── commande.service.ts
│       │       ├── produit.service.ts
│       │       └── ...
│       │
│       ├── landing/                  # Customer-facing pages (E-commerce)
│       │   ├── index/                # Homepage
│       │   ├── auth/                 # Customer authentication
│       │   │   ├── login/            # Customer login
│       │   │   └── signup/           # Customer signup
│       │   │
│       │   ├── checkout/             # CHECKOUT - Payment flow
│       │   ├── wear-choice/          # WEAR - Category selection (men/women)
│       │   ├── wear-men/             # WEAR - Men's collection
│       │   ├── women/                # WEAR - Women's collection
│       │   ├── l-sous-categories/    # Subcategories by category
│       │   ├── s-c-products/         # Products in subcategory
│       │   ├── all-categorie/        # All categories view
│       │   ├── all-products/         # Shop-all products
│       │   ├── product-detail/       # Product detail page
│       │   ├── bestsellers/          # Best sellers section
│       │   ├── news/                 # News/blog
│       │   │
│       │   └── account/              # Customer account (protected)
│       │       ├── dashboard/        # Account dashboard
│       │       ├── addresses/        # Saved addresses
│       │       ├── orders/           # Order history
│       │       ├── favorites/        # Wishlist
│       │       └── settings/         # Account settings
│       │
│       ├── pages/                    # Admin dashboard pages
│       │   ├── dashboards/           # Dashboard views
│       │   ├── ecommerce/            # E-commerce management
│       │   │   ├── products/         # Product list
│       │   │   ├── add-product/      # Add/edit product
│       │   │   ├── categories/       # Category management
│       │   │   ├── sous-categories/  # Subcategory management
│       │   │   ├── promos/           # Promotion management
│       │   │   ├── variants-list/    # Variant management
│       │   │   ├── orders/           # Order management
│       │   │   ├── order-details/    # Order details
│       │   │   ├── customers/        # Customer management
│       │   │   └── delivery-management/ # Shipping setup
│       │   ├── admin/                # Admin-specific pages
│       │   │   └── admin-users/      # User management
│       │   ├── charts/               # Chart pages (ApexCharts, etc.)
│       │   ├── apps/                 # Application widgets
│       │   └── media/                # Media management
│       │
│       ├── layouts/                  # Layout components
│       │   ├── topbar/               # Top navigation
│       │   ├── sidebar/              # Admin sidebar
│       │   ├── footer/               # Footer
│       │   ├── vertical/             # Vertical layout
│       │   └── horizontal/           # Horizontal layout
│       │
│       ├── shared/                   # Shared/reusable components
│       │   ├── components/           # UI components
│       │   │   ├── product-card/     # Reusable product card
│       │   │   ├── product-modal/    # Product quick view
│       │   │   ├── category-card/    # Category card
│       │   │   └── ...
│       │   ├── landing/              # Landing page components
│       │   │   └── index/            # Homepage components
│       │   │       ├── topbar/       # Landing topbar
│       │   │       ├── footer/       # Landing footer
│       │   │       ├── cart-bar/     # Shopping cart
│       │   │       └── banner-promo/ # Promotional banners
│       │   ├── widget/               # Dashboard widgets
│       │   └── pipes/                # Custom pipes
│       │
│       ├── store/                    # NgRx state management
│       │   ├── Authentication/       # Auth state
│       │   ├── Ecommerce/            # E-commerce state
│       │   └── layouts/              # Layout state
│       │
│       └── extraspages/              # Extra pages (coming-soon, maintenance)
│
├── angular.json                      # Angular CLI configuration
├── package.json                      # Dependencies & scripts
├── tsconfig.json                     # TypeScript configuration
└── karma.conf.js                     # Test configuration
```

---

## 3. Folder Context Index

### Root Level

| Folder | Context |
|--------|---------|
| `supabase/` | **Supabase backend config** - Edge Functions for CinetPay webhooks, DB migrations for RLS policies, local dev config |
| `src/environments/` | **Environment configuration** - Supabase URL/keys, Firebase config (mostly unused) |
| `dist/` | **Build output** - Production-ready Angular app (dist/smellwear) |
| `docs/` | **Documentation** - Project documentation files |

### src/app/account/
- **Purpose:** Admin authentication module
- **Technical role:** Handles admin login, password reset, OAuth callbacks, admin invitations
- **Routes:** `/auth/login`, `/auth/reset-password`, `/auth/admin-invite`
- **Key files:** `login.component.ts`, `admin-invite.component.ts`

### src/app/core/
- **Purpose:** Core singleton services, guards, models, and helpers
- **Responsibilities:**
  - Business services (cart, orders, products, categories)
  - Authentication services (Supabase auth, admin auth)
  - Route guards (admin, auth, client)
  - TypeScript interfaces for all entities
  - HTTP interceptors (JWT, error handling)
- **Key files:** `supabase-auth.service.ts`, `cart.service.ts`, `commande.service.ts`

### src/app/core/guards/
- **Purpose:** Route protection via Angular guards
- **Contents:**
  - `admin.guard.ts` - Admin-only access (DB-verified via `public.admin` table)
  - `auth.guard.ts` - Authenticated users only
  - `client.guard.ts` - Client/non-admin users (redirects admins to `/admin`)

### src/app/core/services/
- **Purpose:** 45+ business logic services
- **Key services:**
  - `supabase.service.ts` - Supabase client wrapper
  - `supabase-auth.service.ts` - Session, user, role management
  - `cart.service.ts` - Shopping cart (localStorage-based)
  - `commande.service.ts` - Order creation & management
  - `produit.service.ts` - Product CRUD
  - `categorie.service.ts` - Category/subcategory management
  - `variant.service.ts` - Product variants (size, color)
  - `delivery-prices.service.ts` - Shipping zones/costs

### src/app/landing/
- **Purpose:** Customer-facing e-commerce pages
- **Technical role:** Lazy-loaded module for the shopping experience
- **Routes:** `/` (homepage), `/wear`, `/checkout`, `/product-detail/:id`, etc.

### src/app/landing/checkout/
- **Purpose:** **CHECKOUT - Payment page flow**
- **Business meaning:** Complete purchase with CinetPay payment gateway
- **Responsibilities:**
  - Cart loading & display
  - Delivery address management
  - Shipping cost calculation
  - CinetPay payment initialization
  - Order creation via `CommandeService`
- **Key file:** `checkout.component.ts`

### src/app/landing/wear-choice/
- **Purpose:** **WEAR - Category browsing UI**
- **Business meaning:** Men/Women clothing selection page
- **Routes:** `/wear`
- **Key file:** `wear-choice.component.ts`

### src/app/landing/wear-men/ & women/
- **Purpose:** **WEAR - Collection browsing**
- **Business meaning:** Men's and Women's fashion collections
- **Routes:** `/wear-men`, `/women`

### src/app/landing/l-sous-categories/
- **Purpose:** Subcategory listing (Tops, Bottoms, etc.)
- **Routes:** `/under-categories-men/:categoryId`

### src/app/landing/s-c-products/
- **Purpose:** Products within a subcategory
- **Routes:** `/subcategory-products/:id`

### src/app/landing/product-detail/
- **Purpose:** Single product view with variants, images, add-to-cart
- **Routes:** `/product-detail/:id`

### src/app/landing/account/
- **Purpose:** Customer account management (protected by ClientGuard)
- **Routes:** `/account/dashboard`, `/account/orders`, `/account/addresses`, `/account/favorites`

### src/app/pages/
- **Purpose:** Admin dashboard pages
- **Technical role:** Lazy-loaded module for admin management
- **Guard:** AdminGuard (DB-verified admin role)
- **Routes:** `/admin/*`

### src/app/pages/ecommerce/
- **Purpose:** E-commerce management for admins
- **Responsibilities:**
  - Product CRUD (`products/`, `add-product/`)
  - Category management (`categories/`, `sous-categories/`)
  - Order management (`orders/`, `order-details/`)
  - Customer management (`customers/`)
  - Promotion management (`promos/`)
  - Variant management (`variants-list/`)
  - Delivery/shipping setup (`delivery-management/`)

### src/app/pages/dashboards/
- **Purpose:** Admin analytics dashboard
- **Contents:** Sales stats, order summaries, charts

### src/app/pages/charts/
- **Purpose:** Chart visualization pages
- **Contents:** ApexCharts (20+ types), Chart.js, ECharts

### src/app/layouts/
- **Purpose:** Layout wrapper components
- **Contents:**
  - `topbar/` - Top navigation bar
  - `sidebar/` - Admin left sidebar
  - `footer/` - Footer component
  - `vertical/`, `horizontal/`, `two-column/` - Layout variants

### src/app/shared/
- **Purpose:** Reusable components, pipes, directives
- **Contents:**
  - `components/` - UI components (product-card, product-modal, category-card)
  - `landing/` - Landing page sections (topbar, footer, cart-bar, promos)
  - `widget/` - Dashboard widgets (stats, charts, analytics)
  - `pipes/` - Custom pipes (currency-converter)

### src/app/store/
- **Purpose:** NgRx state management
- **Modules:**
  - `Authentication/` - Auth state & effects
  - `Ecommerce/` - Products, carts, orders
  - `layouts/` - UI layout state

### supabase/functions/
- **Purpose:** Supabase Edge Functions (Deno runtime)
- **Contents:**
  - `cinetpay-notification/` - Payment webhook handler
  - `cinetpay-return/` - Payment return handler
  - `invite-admin/` - Admin invitation function

---

## 4. Key Files

| File | Purpose |
|------|---------|
| `angular.json` | Angular CLI config (project: smellwear, SCSS, build budget 8MB) |
| `package.json` | Dependencies & npm scripts (v4.3.0) |
| `src/app/app.module.ts` | Root module, NgRx store config, provider setup |
| `src/app/app-routing.module.ts` | Root routes with guard application |
| `src/app/landing/landing-routing.module.ts` | Customer site routes |
| `src/app/pages/pages-routing.module.ts` | Admin dashboard routes |
| `src/environments/environment.ts` | Supabase URL & anon key |
| `src/app/core/services/supabase-auth.service.ts` | Central auth service |
| `src/app/core/services/cart.service.ts` | Shopping cart logic |
| `src/app/core/services/commande.service.ts` | Order management |
| `src/app/landing/checkout/checkout.component.ts` | Payment processing |
| `src/app/core/models/models.ts` | Core TypeScript interfaces |
| `supabase/config.toml` | Supabase local dev config |
| `supabase/functions/cinetpay-notification/index.ts` | Payment webhook |

---

## 5. Routing Summary

### Customer Routes (Landing Module)
```
/                           → Homepage (IndexComponent)
/wear                       → WEAR category selection
/wear-men                   → Men's collection
/women                      → Women's collection
/under-categories-men/:id   → Subcategories
/subcategory-products/:id   → Products in subcategory
/product-detail/:id         → Product detail
/checkout                   → CHECKOUT (payment)
/shop-all                   → All products
/best-sellers               → Best sellers
/customer/login             → Customer login
/customer/signup            → Customer signup
/account/*                  → Customer account (protected)
```

### Admin Routes (Pages Module)
```
/admin/dashboards/dashboard      → Analytics dashboard
/admin/ecommerce/produits        → Product list
/admin/ecommerce/add-product/:id → Add/edit product
/admin/ecommerce/categories      → Category management
/admin/ecommerce/orders          → Order list
/admin/ecommerce/customers       → Customer list
/admin/ecommerce/promos          → Promotions
/admin/ecommerce/delivery-prices → Shipping config
```

---

## 6. Open Questions

None - all folders were confidently identified based on file names, routes, and component analysis.
