# UI/UX Features Documentation

This document describes the implemented UI/UX features for the SmellAndWear Angular storefront.

## Table of Contents

1. [Dark Mode](#dark-mode)
2. [Favorites/Wishlist](#favorites-wishlist)
3. [Phone Number Input](#phone-number-input)
4. [Icon Colors & Scroll Behavior](#icon-colors--scroll-behavior)
5. [Password Toggle](#password-toggle)

---

## Dark Mode

### Overview

A complete dark theme is implemented with toggle functionality in the topbar (desktop + mobile).

### Implementation

**Service:** `src/app/core/services/theme.service.ts`

The `ThemeService` provides:
- `themeMode$: Observable<ThemeMode>` - Current theme mode ('light' | 'dark')
- `isDarkMode$: Observable<boolean>` - Whether dark mode is active
- `isScrolled$: Observable<boolean>` - Scroll state for dynamic UI changes
- `toggleTheme()` - Toggle between light and dark modes
- `setTheme(mode, persist)` - Set specific theme mode

### Persistence

- Theme preference is stored in `localStorage` with key `sw_theme`
- On first visit, respects OS preference via `prefers-color-scheme` media query
- User selection overrides OS preference

### CSS Variables

Theme variables are defined in `src/assets/scss/_theme-variables.scss`:

```scss
:root {
  --sw-bg-primary: #ffffff;
  --sw-text-primary: #1a1a1a;
  --sw-topbar-icon-default: #ffffff;
  --sw-topbar-icon-scrolled: #1a1a1a;
  // ... more variables
}

[data-sw-theme="dark"] {
  --sw-bg-primary: #121212;
  --sw-text-primary: #f5f5f5;
  // ... dark mode overrides
}
```

### Usage in Components

```typescript
// Inject ThemeService
constructor(private themeService: ThemeService) {}

// Toggle theme
toggleTheme() {
  this.themeService.toggleTheme();
}

// Subscribe to changes
this.themeService.isDarkMode$.subscribe(isDark => {
  // React to theme changes
});
```

---

## Favorites/Wishlist

### Overview

Full favorites system with database persistence for authenticated users and localStorage for guests.

### Implementation

**Service:** `src/app/core/services/favorites.service.ts`

Key features:
- `favorites$: Observable<FavoriteItem[]>` - List of favorites with product details
- `favoritesCount$: Observable<number>` - Count for badge display
- `addToFavorites(productId, productName)` - Add with toast notification
- `removeFromFavorites(productId, productName)` - Remove with optional toast
- `toggleFavorite(productId, productName)` - Toggle favorite status
- `isFavorite$(productId): Observable<boolean>` - Check if favorited

### Behavior

| User State | Storage | Sync |
|------------|---------|------|
| Authenticated | Supabase `liste_favoris` table | Real-time |
| Guest | localStorage (`sw_favorites`) | Synced to DB on login |

### Toast Notifications

Uses `ToastService` (`src/app/core/services/toast.service.ts`):
- **Add:** Shows "Ajouté aux favoris" with product name
- **Remove:** Shows "Retiré des favoris" with product name

### Favorites Page

**Route:** `/account/favorites`
**Component:** `src/app/landing/account/favorites/account-favorites.component.ts`

Features:
- Grid display of favorite products
- Remove button on each item
- Navigate to product detail on click
- Empty state when no favorites

---

## Phone Number Input

### Overview

Phone input with country selector limited to France (+33) and Côte d'Ivoire (+225).

### Implementation

**Component:** `src/app/landing/auth/signup/signup-landing.component.ts`

Features:
- Country selector dropdown with flag emoji
- Auto-formatting as user types
- Country-specific placeholder
- Full international number stored in form

### Phone Countries

```typescript
phoneCountries = [
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'France', placeholder: '6 12 34 56 78' },
  { code: '+225', country: 'CI', flag: '🇨🇮', name: "Côte d'Ivoire", placeholder: '07 00 00 00 00' }
];
```

### Security Considerations

**Decision:** Phone is stored as profile data only, NOT used for authentication lookup.

Reasoning:
- Email-based auth is more secure (verified by Supabase)
- Phone-to-email lookup would expose user email addresses
- Login remains email + password only

If phone login is required in the future, implement a secure RPC function that:
1. Accepts phone number
2. Returns only a boolean indicating account exists
3. Uses rate limiting to prevent enumeration attacks

---

## Icon Colors & Scroll Behavior

### Overview

Dynamic icon colors that change based on scroll position and work correctly on mobile.

### Implementation

**Service:** `ThemeService.isScrolled$`

The service tracks scroll state (past 20px threshold) and exposes it as an observable.

### CSS Token-Based Approach

Icons use CSS custom properties for colors:

```scss
.topbar-icon {
  color: var(--sw-topbar-icon-default);  // White at top
  
  &.scrolled {
    color: var(--sw-topbar-icon-scrolled);  // Black after scroll
  }
  
  @media (max-width: 768px) {
    color: var(--sw-topbar-icon-mobile) !important;  // Always visible on mobile
  }
}
```

### Checkout Page Specifics

The checkout page has override styles in `checkout.component.scss` to ensure icons remain visible:

```scss
:host ::ng-deep {
  .topbar-action-btn i {
    color: var(--sw-topbar-icon-scrolled, #000000) !important;
  }
}
```

---

## Password Toggle

### Overview

Show/hide password functionality on login and signup forms.

### Implementation

Already implemented in both components:
- `src/app/landing/auth/login/login-landing.component.ts`
- `src/app/landing/auth/signup/signup-landing.component.ts`

Features:
- Click eye icon to toggle visibility
- Icon changes: `ri-eye-off-line` ↔ `ri-eye-line`
- Works on touch devices
- Does not interfere with form validation

### Usage

```html
<input [type]="fieldTextType ? 'text' : 'password'" ...>
<button type="button" class="password-toggle" (click)="toggleFieldTextType()">
  <i [class]="fieldTextType ? 'ri-eye-line' : 'ri-eye-off-line'"></i>
</button>
```

```typescript
fieldTextType = false;

toggleFieldTextType(): void {
  this.fieldTextType = !this.fieldTextType;
}
```

---

## Cart Notifications

### Note

Cart "added to cart" notifications have been **removed** as per requirements.

The cart dropdown automatically opens when items are added, providing visual feedback without intrusive toasts.

If you need to re-enable notifications, restore the Swal toast in `CartService.addToCart()`.

---

## File Summary

| Feature | Key Files |
|---------|-----------|
| Dark Mode | `theme.service.ts`, `_theme-variables.scss` |
| Favorites | `favorites.service.ts`, `toast.service.ts`, `account-favorites.component.ts` |
| Phone Input | `signup-landing.component.ts`, `signup-landing.component.html` |
| Icon Colors | `theme.service.ts`, `topbar.component.scss`, `checkout.component.scss` |
| Password Toggle | `login-landing.component.ts`, `signup-landing.component.ts` |

