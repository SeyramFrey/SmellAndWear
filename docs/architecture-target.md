# Target Architecture — SmellAndWear

> **Purpose:** Defines the intended folder structure and responsibility rules
> that all new code must follow and all refactored code must conform to.
> **Last updated:** 2026-03-15

---

## 1. Guiding Principles

1. **All Supabase access goes through services.** No `.from()` calls in components, directives, or pipes.
2. **Services are stateless by default.** Reactive state belongs in NgRx or component-local signals/observables.
3. **English naming throughout.** No French names in files, classes, interfaces, or methods.
4. **One file, one responsibility.** If a file name does not clearly express its single responsibility, it needs to be split.
5. **Components are thin.** They bind data and delegate logic. No calculations, no DB calls, no business rules.
6. **Admin and landing are isolated.** No cross-importing between `pages/` (admin) and `landing/` (customer frontend).

---

## 2. Top-Level Folder Structure

```
src/app/
├── core/                    # Singleton services, models, guards — loaded once at app root
│   ├── guards/
│   ├── models/
│   └── services/
├── shared/                  # Reusable components, directives, pipes — used by both admin and landing
│   ├── components/
│   ├── breadcrumbs/
│   ├── currency/
│   ├── pipes/
│   └── widget/
│       ├── analytics/       # RecentOrders, BestSelling — kept
│       └── dashboard/       # Ecommerce dashboard widgets — kept
├── landing/                 # Customer-facing frontend (public routes)
│   ├── account/             # My orders, settings, profile
│   ├── all-categories/      # (renamed from all-categorie)
│   ├── all-products/
│   ├── auth/                # Customer login / signup
│   ├── bestsellers/
│   ├── checkout/            # Decomposed: shell + sub-components
│   ├── index/               # Homepage
│   ├── landing-subcategories/  # (renamed from l-sous-categories)
│   ├── men/
│   ├── news/
│   ├── order-success/
│   ├── product-detail/      # Decomposed: shell + photo/variant/pricing components
│   ├── subcategory-products/   # (renamed from s-c-products)
│   ├── wear-choice/
│   ├── wear-men/
│   └── women/
├── pages/                   # Admin panel (protected routes, AdminGuard)
│   ├── admin/               # Admin user management
│   ├── dashboards/          # Dashboard (decomposed)
│   ├── ecommerce/           # Orders, products, categories, customers, variants
│   └── media/               # Media library
├── account/                 # Admin auth (login, forgot-password, invite)
├── extraspages/             # Public utility pages (coming-soon, maintenance)
├── layouts/                 # Admin layout shells (vertical only after cleanup)
├── store/                   # NgRx state
│   ├── Ecommerce/
│   ├── Authentication/
│   └── layouts/
├── app.module.ts
├── app-routing.module.ts
└── app.component.ts
```

---

## 3. `core/` Rules

### `core/services/`

**Rule: All services that access Supabase directly must live here.**

Every service must follow this contract:
- Filename: `{domain}.service.ts` in English kebab-case
- Class name: `{Domain}Service`
- Injectable at root: `@Injectable({ providedIn: 'root' })`
- Methods return `Observable<T>` or `Promise<T>` — never raw Supabase response objects
- Error handling: services catch Supabase errors and re-throw typed application errors
- No `console.log` in production-facing methods

**Allowed service categories:**

| Category | Examples |
|----------|---------|
| Domain data | `product.service.ts`, `order.service.ts`, `cart.service.ts` |
| Admin operations | `admin.service.ts`, `admin-promotion.service.ts` |
| Payment | `paystack.service.ts`, `payment.service.ts` |
| Auth | `auth.service.ts`, `supabase-auth.service.ts`, `admin-auth.service.ts` |
| Infrastructure | `supabase.service.ts`, `storage.service.ts`, `toast.service.ts` |
| UX utilities | `scroll.service.ts`, `theme.service.ts`, `language.service.ts`, `currency.service.ts` |

**Prohibited:**
- A component injecting `SupabaseService` and calling `.from()` directly
- A service that manages both data fetching AND UI state
- Two services covering the same domain (one per domain)

---

### `core/models/`

**Rule: All shared TypeScript interfaces, types, and enums live here.**

File structure:
```
core/models/
├── models.ts          # All domain interfaces and enums
└── delivery-price.model.ts   # Kept separate (focused, stable)
```

**`models.ts` must export:**
```typescript
// Enums
export enum OrderStatus { ... }
export enum PaymentCurrency { ... }

// Product domain
export interface Product { ... }
export interface Variant { ... }
export interface ProductPhoto { ... }

// Order domain
export interface Order { ... }
export interface OrderItem { ... }
export interface CartItem { ... }

// Customer domain
export interface Customer { ... }
export interface Address { ... }

// Catalog domain
export interface Category { ... }
export interface Subcategory { ... }
export interface Color { ... }
export interface Size { ... }

// Promotions
export interface Promotion { ... }
```

**Prohibited:**
- French names in interfaces (`Produit`, `Commande`, `Couleur`, etc.)
- Type aliases that mix naming styles (`ProduitVariation = Variant`)
- SQL files in the models directory
- Business logic inside model files

---

### `core/guards/`

Three guards are kept, each with a single responsibility:

| Guard | Protects | Logic |
|-------|---------|-------|
| `admin.guard.ts` | `/admin/**` | Requires active session + row in `public.admin` table |
| `auth.guard.ts` | Authenticated customer routes | Requires active Supabase session |
| `client.guard.ts` | Customer-only data routes | Session check specific to customer context |

**Rule:** Guards verify identity from the database, not only from the JWT. The JWT can be manipulated; the DB record cannot.

---

## 4. `shared/` Rules

### `shared/components/`

Reusable presentational components with **no business logic and no service injection** (exception: injecting `Router` or `TranslateService` is acceptable).

Current components to keep:
- `breadcrumb/`, `button/`, `button-hover/`, `carousel/`, `category-card/`, `product-card/`, `product-modal/`, `section-title/`, `video-hero/`

**Rule:** A shared component must be usable in both `landing/` and `pages/` without modification. If it requires admin-specific logic, it does not belong in `shared/`.

### `shared/widget/`

After cleanup, only two sub-directories remain:
- `analytics/` — `RecentOrdersComponent`, `BestSellingComponent`
- `dashboard/` — ecommerce stat widgets

**Rule:** Widgets may inject services for data fetching. They must not perform any mutations (no POST/UPDATE calls).

### `shared/pipes/` and `shared/currency/`

Remain as-is. Pure transforms only.

---

## 5. `landing/` Rules

### Routing

All customer routes are declared in `landing-routing.module.ts`. No component defines its own routes.

### Components

- Each route has exactly one **page component** (the shell) that assembles child components
- Page components are responsible for: routing params, loading state, passing data to children via `@Input`
- Page components must not contain form logic, payment logic, or direct Supabase calls

### Checkout (post-decomposition)

```
landing/checkout/
├── checkout.component.ts              # Shell: assembles sub-components, manages step state
├── checkout-address-form.component.ts # Renders address form, emits validated address
├── checkout-cart-summary.component.ts # Displays cart items and totals (read-only)
└── checkout-payment.component.ts      # Triggers Paystack init, handles result callbacks
```

A `checkout-payment-orchestrator.service.ts` in `core/services/` coordinates the sequence: validate → initialize → redirect → verify.

### Product Detail (post-decomposition)

```
landing/product-detail/
├── product-detail.component.ts           # Shell: loads product, passes data to children
├── product-photo-carousel.component.ts   # Photo display + thumbnail navigation
├── product-variant-selector.component.ts # Size/color selection, stock display
└── product-pricing.component.ts          # EUR/XOF pricing, promotions, promo badges
```

---

## 6. `pages/` (Admin) Rules

### Access

Every route under `pages/` is protected by `AdminGuard`. No exceptions.

### Components

Admin components may inject services and NgRx store selectors. They must not make direct Supabase calls.

### Allowed patterns

```typescript
// CORRECT — via service
constructor(private orderService: OrderService) {}
this.orderService.getOrders().subscribe(...)

// CORRECT — via NgRx
this.products$ = this.store.select(selectAllProducts);

// PROHIBITED — direct Supabase in component
const { data } = await this.supabase.from('commande').select('*');
```

### Dashboard (post-decomposition)

```
pages/dashboards/dashboard/
├── dashboard.component.ts         # Shell: passes data to chart widgets
└── (chart methods moved to)       # dashboard-charts.service.ts in core/services/
```

---

## 7. `store/` (NgRx) Rules

After Phase 2 cleanup, the store contains exactly three feature slices:

| Slice | Purpose |
|-------|---------|
| `Ecommerce/` | Products, orders, customers for admin views |
| `Authentication/` | Admin auth state |
| `layouts/` | Layout mode (vertical/horizontal/etc.) |

**Rule:** New features should prefer component-local state (signals or RxJS) unless state genuinely needs to be shared across multiple unrelated components. Do not add a new NgRx slice by default.

---

## 8. Supabase Access Rules

### Allowed

| Layer | Can call Supabase? | How |
|-------|--------------------|-----|
| Edge Functions | Yes | Direct, server-side only |
| `core/services/` | Yes | Via `SupabaseService` client |
| Components | **No** | Must go through a service |
| Guards | Yes (narrow use) | Single row check only (`public.admin`) |
| NgRx Effects | Yes | Via injected services only |

### Payment-specific rules

- The Angular client **never** sends a payment amount to any endpoint
- `paystack.service.ts` sends only: `order_id`, `email`, `locale`, `shipping_zone_code`, `express_delivery`
- All totals are computed by `paystack-initialize` Edge Function from database prices
- `server_computed_total` in the `commande` table is the authoritative amount

---

## 9. Naming Conventions

### Files

| Type | Convention | Example |
|------|-----------|---------|
| Component | `{name}.component.ts` | `product-card.component.ts` |
| Service | `{name}.service.ts` | `order.service.ts` |
| Guard | `{name}.guard.ts` | `admin.guard.ts` |
| Model/Interface | `models.ts` or `{domain}.model.ts` | `delivery-price.model.ts` |
| Pipe | `{name}.pipe.ts` | `currency-format.pipe.ts` |
| NgRx Action | `{domain}.actions.ts` | `ecommerce.actions.ts` |
| NgRx Selector | `{domain}.selector.ts` | `ecommerce.selector.ts` |

### Classes and Interfaces

| Type | Convention | Example |
|------|-----------|---------|
| Component class | PascalCase + `Component` | `ProductCardComponent` |
| Service class | PascalCase + `Service` | `OrderService` |
| Interface | PascalCase, no prefix | `Order`, `CartItem`, `Variant` |
| Enum | PascalCase | `OrderStatus` |

### Language

- All new code, identifiers, comments: **English**
- Database column names: unchanged (they are Supabase-managed)
- UI text strings: French (as required by the product)

### Folders

- All folder names: `kebab-case`
- No French words in folder names
- No abbreviations (`s-c-products` → `subcategory-products`)
