# Smell & Wear Promotion System

## Complete Guide for Bar, Popup, and Banner Promotions

This document provides a comprehensive guide to the promotion system, covering configuration, display logic, cooldowns, and best practices.

---

## Table of Contents

1. [Overview](#overview)
2. [Display Types](#display-types)
3. [Database Schema](#database-schema)
4. [How Each Display Type Works](#how-each-display-type-works)
5. [Priority Resolution](#priority-resolution)
6. [Cooldown & Re-display Logic](#cooldown--re-display-logic)
7. [Configuration Examples](#configuration-examples)
8. [Supabase Admin Guide](#supabase-admin-guide)
9. [Frontend Architecture](#frontend-architecture)
10. [Troubleshooting](#troubleshooting)
11. [Best Practices](#best-practices)

---

## Overview

The promotion system supports **three distinct display formats** that can be used independently or in combination:

| Display Type | Description | Use Case |
|--------------|-------------|----------|
| **Bar** | Thin banner at top of page | Flash sales, shipping offers, announcements |
| **Popup** | Modal dialog overlay | Welcome offers, newsletter signup, special deals |
| **Banner** | Inline content block | Collection highlights, hero promotions, category ads |

Each promotion can enable one or more display types simultaneously.

---

## Display Types

### 1. Promo Bar (Topbar)

A slim, full-width bar that appears at the very top of the page.

**Characteristics:**
- Pushes page content down
- Auto-rotates if multiple bar promos are active
- Supports slide, fade, and marquee animations
- Can be dismissed by user

**Best for:**
- Time-sensitive offers
- Free shipping announcements
- Site-wide sales
- Quick notifications

### 2. Promo Popup (Modal)

A modal dialog that appears over the page content.

**Characteristics:**
- Blocks interaction with background (optional)
- Supports image + text + CTA
- Focus-trapped for accessibility
- ESC key closes (if dismissible)
- Delayed display to prevent UI flicker

**Best for:**
- Welcome offers for new visitors
- Email/newsletter signup incentives
- Special limited-time deals
- Exit-intent offers

### 3. Promo Banner (Inline)

A content block that can be placed at various positions.

**Positions:**
- `top` - Below the topbar, full width
- `inline` - Within page content, card-style
- `hero` - Full-width hero section with background image

**Characteristics:**
- Supports background images
- Fully responsive
- Can target specific pages
- Multiple banners can be active simultaneously

**Best for:**
- Collection highlights
- Category promotions
- Hero sections
- Seasonal campaigns

---

## Database Schema

### Core Promotion Fields

```sql
-- Identity
id                UUID PRIMARY KEY
title             VARCHAR(255)     -- Main title (used as fallback)
message           TEXT             -- Main message (used as fallback)
url               VARCHAR          -- Default CTA URL

-- Status & Timing
status            VARCHAR          -- draft, scheduled, running, paused, ended
start_at          TIMESTAMPTZ      -- When promo becomes active
end_at            TIMESTAMPTZ      -- When promo expires
priority          INTEGER          -- Higher = shown first (0-100)

-- Display Flags
display_bar       BOOLEAN          -- Show as topbar
display_popup     BOOLEAN          -- Show as popup
display_banner    BOOLEAN          -- Show as banner

-- Theme
theme             JSONB            -- { bg, fg, accent }
animation         VARCHAR          -- slide, fade, marquee, none
is_dismissible    BOOLEAN          -- Can user close it?
```

### Bar-Specific Fields

```sql
bar_cooldown_seconds    INTEGER    -- Cooldown after dismissal (default: 1800 = 30 min)
```

### Popup-Specific Fields

```sql
popup_title              VARCHAR(255)
popup_message            TEXT
popup_image_url          TEXT
popup_cta_label          VARCHAR(100)   -- Default: "Découvrir"
popup_cta_url            TEXT
popup_dismissible        BOOLEAN        -- Default: true
popup_cooldown_seconds   INTEGER        -- Default: 86400 (24 hours)
```

### Banner-Specific Fields

```sql
banner_title             VARCHAR(255)
banner_message           TEXT
banner_image_url         TEXT
banner_cta_label         VARCHAR(100)   -- Default: "En savoir plus"
banner_cta_url           TEXT
banner_position          VARCHAR(50)    -- top, inline, hero
banner_pages             TEXT[]         -- Target pages (null = all)
banner_dismissible       BOOLEAN        -- Default: true
banner_cooldown_seconds  INTEGER        -- Default: 3600 (1 hour)
```

### Targeting Fields

```sql
target_pages       TEXT[]    -- Limit to specific routes
target_categories  UUID[]    -- Limit to category pages
target_products    UUID[]    -- Limit to product pages
```

---

## How Each Display Type Works

### Promo Bar Flow

```
1. Service fetches all active promos where display_bar = true
2. Filters by:
   - Current date within start_at/end_at range
   - Status is 'scheduled' or 'running'
   - Not on cooldown for this user
3. Sorts by priority (highest first)
4. Displays the highest priority bar
5. On dismiss:
   - Stores cooldown in localStorage
   - Shows next eligible bar (if any)
```

### Popup Flow

```
1. Service fetches all active promos where display_popup = true
2. Filters by:
   - Current date within range
   - Status is 'scheduled' or 'running'
   - Not on cooldown for this user
   - Current route matches target_pages (if set)
3. Sorts by priority
4. Waits 1.5s after page load (prevents flicker)
5. Shows highest priority popup (only one per page load)
6. On dismiss:
   - Stores cooldown in localStorage
   - Won't show again on this page
```

### Banner Flow

```
1. Service fetches all active promos where display_banner = true
2. Filters by:
   - Current date within range
   - Status is 'scheduled' or 'running'
   - Not on cooldown for this user
   - Current route matches banner_pages (if set)
3. Sorts by priority
4. Returns ALL eligible banners (multiple can show)
5. Components filter by position (top/inline/hero)
6. On dismiss:
   - Stores cooldown in localStorage
   - Removes from current display
```

---

## Priority Resolution

Priority is a number from 0-100 (higher = more important).

**Resolution rules:**

1. **Bar**: Only the highest priority bar is shown
2. **Popup**: Only the highest priority popup is shown per page load
3. **Banner**: All eligible banners are shown, sorted by priority

**Example:**

| Promo | Priority | Bar | Popup | Banner |
|-------|----------|-----|-------|--------|
| A     | 100      | ✓   | ✓     |        |
| B     | 80       | ✓   |       | ✓      |
| C     | 50       |     | ✓     | ✓      |

**Result:**
- Bar: Promo A shown (priority 100)
- Popup: Promo A shown (priority 100)
- Banners: Promo B and C shown (in order)

---

## Cooldown & Re-display Logic

### Cooldown Types

| Preset | Seconds | Description |
|--------|---------|-------------|
| `once_session` | N/A | Until browser tab closes |
| `once_day` | 86400 | 24 hours |
| `once_week` | 604800 | 7 days |
| `custom` | Variable | Custom seconds |
| `never` | 0 | No cooldown (shows every time) |

### How Cooldowns Work

1. When user dismisses a promo, we store:
   ```json
   {
     "promoId": "uuid",
     "displayType": "bar|popup|banner",
     "dismissedAt": 1702684800000,
     "cooldownSeconds": 86400
   }
   ```

2. On page load, we check:
   - `currentTime >= dismissedAt + (cooldownSeconds * 1000)`
   - If true: cooldown expired, show promo
   - If false: still on cooldown, skip promo

3. Cooldowns are stored in `localStorage` under key `promo_cooldowns`

### Cooldown Independence

- Each promo has its own cooldown per display type
- Dismissing promo A as bar doesn't affect promo A as popup
- New promos are never blocked by old cooldowns
- Expired cooldown records are automatically cleaned up

---

## Configuration Examples

### Example 1: Bar-Only Flash Sale

```sql
INSERT INTO promotions (
  title, message, url,
  status, start_at, end_at, priority,
  display_bar, display_popup, display_banner,
  theme, animation, is_dismissible,
  bar_cooldown_seconds
) VALUES (
  '⚡ Flash Sale -30%',
  'Utilisez le code FLASH30 - Valable 24h!',
  '/shop',
  'running',
  '2025-12-15 00:00:00+00',
  '2025-12-16 00:00:00+00',
  90,
  true, false, false,
  '{"bg": "#ff0000", "fg": "#ffffff", "accent": "#ffff00"}'::jsonb,
  'marquee',
  true,
  1800  -- 30 min cooldown
);
```

### Example 2: Popup Every 7 Days

```sql
INSERT INTO promotions (
  title, message,
  status, start_at, end_at, priority,
  display_bar, display_popup, display_banner,
  popup_title, popup_message, popup_cta_label, popup_cta_url,
  popup_dismissible, popup_cooldown_seconds,
  theme
) VALUES (
  'Newsletter Signup',
  'Subscribe for exclusive deals',
  'running',
  '2025-01-01 00:00:00+00',
  '2025-12-31 23:59:59+00',
  50,
  false, true, false,
  '📧 Rejoignez notre newsletter!',
  'Recevez en avant-première nos offres exclusives et nouveautés.',
  'S''inscrire',
  '/newsletter',
  true,
  604800,  -- 7 days
  '{"bg": "#ffffff", "fg": "#333333", "accent": "#0066cc"}'::jsonb
);
```

### Example 3: Homepage-Only Hero Banner

```sql
INSERT INTO promotions (
  title, message,
  status, start_at, end_at, priority,
  display_bar, display_popup, display_banner,
  banner_title, banner_message, banner_image_url,
  banner_cta_label, banner_cta_url, banner_position,
  banner_pages, banner_dismissible, banner_cooldown_seconds,
  theme
) VALUES (
  'Collection Hiver',
  'Nouvelle collection disponible',
  'running',
  '2025-12-01 00:00:00+00',
  '2026-02-28 23:59:59+00',
  70,
  false, false, true,
  '❄️ Collection Hiver 2025',
  'Découvrez nos nouvelles pièces pour affronter le froid avec style.',
  'https://example.com/winter-hero.jpg',
  'Voir la collection',
  '/collections/winter',
  'hero',
  ARRAY['/'],  -- Homepage only
  false,  -- Not dismissible (hero should stay)
  0,
  '{"bg": "#1a1a2e", "fg": "#ffffff", "accent": "#00cec9"}'::jsonb
);
```

### Example 4: Popup + Banner Combo

```sql
INSERT INTO promotions (
  title, message, url,
  status, start_at, end_at, priority,
  display_bar, display_popup, display_banner,
  -- Popup config
  popup_title, popup_message, popup_cta_label, popup_cta_url,
  popup_dismissible, popup_cooldown_seconds,
  -- Banner config  
  banner_title, banner_message, banner_cta_label, banner_cta_url,
  banner_position, banner_dismissible, banner_cooldown_seconds,
  theme
) VALUES (
  'Black Friday',
  'Jusqu''à -50% sur tout le site',
  '/black-friday',
  'running',
  '2025-11-29 00:00:00+00',
  '2025-11-30 23:59:59+00',
  100,
  false, true, true,
  -- Popup
  '🖤 BLACK FRIDAY',
  'Profitez de -50% sur tout le site pendant 24h seulement!',
  'Foncer!',
  '/black-friday',
  true, 3600,
  -- Banner
  '🖤 BLACK FRIDAY - Jusqu''à -50%',
  'Offre limitée à 24h. Ne ratez pas cette occasion!',
  'Voir les offres',
  '/black-friday',
  'top', true, 1800,
  '{"bg": "#000000", "fg": "#ffffff", "accent": "#ff4444"}'::jsonb
);
```

---

## Supabase Admin Guide

### Step-by-Step: Create a New Promotion

1. **Go to Supabase Dashboard** → Table Editor → `promotions`

2. **Click "Insert row"**

3. **Fill required fields:**
   - `title`: Main title (fallback for all display types)
   - `message`: Main message
   - `status`: Set to `draft` initially
   - `start_at`: Start date/time (UTC)
   - `end_at`: End date/time (UTC)
   - `priority`: 0-100 (higher = more important)

4. **Choose display type(s):**
   - `display_bar`: true/false
   - `display_popup`: true/false
   - `display_banner`: true/false

5. **Configure each display type:**
   - For bar: Set `bar_cooldown_seconds`
   - For popup: Set `popup_*` fields
   - For banner: Set `banner_*` fields

6. **Set theme:**
   ```json
   {"bg": "#000000", "fg": "#ffffff", "accent": "#ff0000"}
   ```

7. **Set targeting (optional):**
   - `target_pages`: Array of routes like `["/", "/shop"]`
   - Leave null for all pages

8. **When ready, set `status` to `running`**

### Quick Reference: Status Values

| Status | Description |
|--------|-------------|
| `draft` | Not visible, still editing |
| `scheduled` | Ready, will activate at start_at |
| `running` | Currently active |
| `paused` | Temporarily disabled |
| `ended` | Permanently finished |

### Viewing Active Promotions

```sql
SELECT * FROM v_active_promotions;
```

This view automatically filters to show only currently active promotions.

---

## Frontend Architecture

### Service Layer

```
PromoService (src/app/core/services/promo.service.ts)
├── Single source of truth
├── Fetches and caches promotions
├── Manages cooldowns via localStorage
├── Exposes observables for each display type
└── Handles route-based eligibility
```

### Component Layer

```
PromoContainerComponent
├── TopbarPromoComponent (bar)
├── PopupPromoComponent (modal)
└── BannerPromoComponent (inline/top/hero)
```

### Data Flow

```
┌─────────────────┐
│  Supabase DB    │
└────────┬────────┘
         │ fetch
         ▼
┌─────────────────┐
│   PromoService  │ ◄── localStorage (cooldowns)
├─────────────────┤
│ barPromo$       │
│ popupPromo$     │
│ bannerPromos$   │
└────────┬────────┘
         │ observables
         ▼
┌─────────────────┐
│ PromoContainer  │
├─────────────────┤
│ TopbarPromo     │
│ PopupPromo      │
│ BannerPromo     │
└─────────────────┘
```

---

## Troubleshooting

### Promo Not Showing

**Check:**
1. `status` is `running` or `scheduled`
2. Current time is between `start_at` and `end_at`
3. At least one display type is enabled
4. Not on cooldown (clear localStorage to test)
5. Route matches `target_pages` (if set)

**Debug in browser console:**
```javascript
// Check localStorage cooldowns
JSON.parse(localStorage.getItem('promo_cooldowns'))

// Clear all cooldowns
localStorage.removeItem('promo_cooldowns')
```

### Popup Shows Multiple Times

**Check:**
1. `popup_cooldown_seconds` is set correctly
2. localStorage is accessible
3. `popup_dismissible` is true (otherwise it can't be dismissed)

### Banner Not Showing on Specific Page

**Check:**
1. `banner_pages` array includes the route
2. Route format matches (e.g., `/shop` not `/shop/`)

### Priority Not Working

**Check:**
1. Higher priority values mean more important
2. For bar/popup: only highest priority shows
3. For banner: all eligible show (but sorted by priority)

---

## Best Practices

### Do's ✓

1. **Always set end dates** - Prevent stale promos from lingering
2. **Use priority wisely** - Reserve 90-100 for critical promos
3. **Test cooldowns** - Verify they work before going live
4. **Keep messages concise** - Especially for bar promos
5. **Use appropriate display types** - Bar for quick info, popup for important offers
6. **Set reasonable cooldowns** - Don't annoy users

### Don'ts ✗

1. **Don't enable all display types for one promo** - Choose the most appropriate
2. **Don't set cooldown to 0 unless intended** - Users will see it constantly
3. **Don't forget mobile** - All components are responsive
4. **Don't use popup for non-important info** - Popups are intrusive
5. **Don't overlap similar promos** - Confuses users

### Recommended Cooldowns

| Display Type | Use Case | Recommended Cooldown |
|--------------|----------|----------------------|
| Bar | Flash sale | 30 min - 2 hours |
| Bar | Shipping info | 1 hour - 24 hours |
| Popup | Welcome offer | 7 days |
| Popup | Newsletter | 7-30 days |
| Banner | Collection | 1 hour - 24 hours |
| Banner | Hero | 0 (always show) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-15 | Initial implementation with bar, popup, banner support |

---

## Support

For issues or questions, contact the development team or create an issue in the repository.

