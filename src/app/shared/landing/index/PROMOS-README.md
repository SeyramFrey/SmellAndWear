# Promotion Display System

This directory contains the promotion display components for the Smell & Wear landing pages.

## Components Overview

### 1. **Topbar Promo** (`topbar-promo/`)
A slim promotional bar that appears fixed at the top of the page, taking 100% width.

**Features:**
- Fixed position at top of viewport
- Dismissible with X button
- Auto-dismiss after configured duration
- Supports slide, fade, and marquee animations
- Customizable theme colors (background, text, accent)
- Optional call-to-action link

**Best for:**
- Flash sales announcements
- Free shipping notifications
- Limited-time offers
- Site-wide announcements

---

### 2. **Banner Promo** (`banner-promo/`)
A full-width hero-style banner with larger content area.

**Features:**
- Full-width section display
- Large, prominent title and message
- Call-to-action button
- Dismissible with X button
- Auto-dismiss after configured duration
- Supports slide and fade animations
- Customizable theme colors

**Best for:**
- New collection launches
- Major sales events
- Feature highlights
- Brand campaigns

---

### 3. **Popup Promo** (`popup-promo/`)
A centered modal overlay that appears on top of content.

**Features:**
- Modal overlay with backdrop
- Centered display
- Icon/emoji support
- Call-to-action button
- "Maybe later" dismiss option
- Auto-dismiss after configured duration
- Prevents body scroll when open
- Click outside to dismiss (if dismissible)
- Supports slide and fade animations

**Best for:**
- Newsletter signups
- First-time visitor offers
- VIP membership promotions
- Special announcements

---

## Quick Start

### Step 1: Import the Promo Container

In your landing page component (e.g., `index.component.html`), add the promo container:

```html
<!-- Add this at the top of your landing page template -->
<app-promo-container></app-promo-container>

<!-- Your existing content -->
<app-topbar-landing></app-topbar-landing>
<!-- ... rest of your page ... -->
```

### Step 2: Import the Component

In your landing page component TypeScript file:

```typescript
import { PromoContainerComponent } from '../../shared/landing/index/promo-container/promo-container.component';

@Component({
  // ...
  imports: [
    // ... other imports
    PromoContainerComponent
  ]
})
```

That's it! The promotion system will automatically:
- Fetch active promotions from the database
- Display them according to their placement type
- Handle dismissals and rotations
- Save dismissed promotions to prevent re-showing

---

## Individual Component Usage

If you need more control, you can use individual components directly:

### Topbar Promo Example

```html
<app-topbar-promo 
  [promotion]="myPromotion"
  (dismissed)="handleDismiss()">
</app-topbar-promo>
```

### Banner Promo Example

```html
<app-banner-promo 
  [promotion]="myPromotion"
  (dismissed)="handleDismiss()">
</app-banner-promo>
```

### Popup Promo Example

```html
<app-popup-promo 
  [promotion]="myPromotion"
  (dismissed)="handleDismiss()">
</app-popup-promo>
```

---

## Service: LandingPromotionService

The `LandingPromotionService` manages promotion fetching, rotation, and dismissal.

### Key Methods:

```typescript
// Subscribe to active promotions
landingPromotionService.topbarPromo$.subscribe(promo => {
  // Handle topbar promo
});

landingPromotionService.bannerPromo$.subscribe(promo => {
  // Handle banner promo
});

landingPromotionService.popupPromo$.subscribe(promo => {
  // Handle popup promo
});

// Dismiss a promotion
landingPromotionService.dismissPromotion(promoId, 'topbar');

// Manually show next promotion in rotation
landingPromotionService.nextPromotion('topbar');

// Refresh promotions (useful when navigating)
landingPromotionService.refreshPromotions();
```

### Features:

- **Automatic Rotation**: Multiple promotions of the same type rotate every 30 seconds
- **Smart Dismissal**: Dismissed promotions are saved in localStorage
- **Re-show Logic**: Dismissed promotions can reappear after 24 hours
- **Cleanup**: Old dismissals (>7 days) are automatically cleaned up
- **Weight-based Priority**: Promotions display based on weight (higher = more important)

---

## Creating Promotions

Promotions are managed through the admin panel at `/admin/ecommerce/promos`.

### Promotion Fields:

- **Title**: Short, attention-grabbing headline (e.g., "🔥 SOLDES D'ÉTÉ")
- **Message**: Detailed description (e.g., "Jusqu'à -50% sur toute la collection!")
- **URL**: Optional link for call-to-action (e.g., "/soldes")
- **Placement**: Where to display (`topbar`, `banner`, or `popup`)
- **Status**: `draft`, `scheduled`, `running`, `paused`, or `ended`
- **Start/End Date**: Time range for display
- **Display Duration**: Auto-dismiss timer in seconds (0 = no auto-dismiss)
- **Weight**: Priority (higher weight = higher priority, displayed first)
- **Dismissible**: Whether user can close the promo
- **Animation**: `slide`, `fade`, `marquee`, or `none`
- **Theme**: Custom colors (background, text, accent)

---

## Styling and Customization

### Theme Colors

Each promotion can have custom theme colors:

```typescript
theme: {
  bg: '#ff4444',      // Background color
  fg: '#ffffff',      // Text color
  accent: '#ffff00'   // Accent color (for titles, buttons)
}
```

### Animations

Available animations:
- **slide**: Slide in from direction
- **fade**: Fade in smoothly
- **marquee**: Scrolling text (topbar only)
- **none**: No animation

### Responsive Design

All components are fully responsive:
- Mobile-optimized layouts
- Touch-friendly dismiss buttons
- Readable font sizes on all devices
- Proper spacing and padding

---

## Best Practices

1. **Don't Overload**: Use maximum 1 promotion per placement at a time
2. **Timing**: Set appropriate display durations (5-15 seconds is good)
3. **Rotation**: If multiple promos, they'll rotate automatically
4. **Weight**: Use weight to prioritize important promotions
5. **Testing**: Test on mobile devices before going live
6. **Dismissible**: Always allow users to dismiss (except critical announcements)
7. **Colors**: Ensure good contrast for readability
8. **Messages**: Keep text concise and actionable
9. **Links**: Always provide a relevant URL for call-to-action
10. **Scheduling**: Set proper start/end dates to avoid expired promos

---

## Placement Guidelines

### Topbar
- **When**: Always-visible announcements
- **Duration**: 10-15 seconds
- **Weight**: Use for time-sensitive info
- **Dismissible**: Yes (recommended)

### Banner
- **When**: Major campaigns or launches
- **Duration**: 15-20 seconds
- **Weight**: High-impact messaging
- **Dismissible**: Yes

### Popup
- **When**: Critical actions (signup, offers)
- **Duration**: 20-30 seconds
- **Weight**: Very selective use
- **Dismissible**: Yes (always)
- **Frequency**: Limit to avoid annoyance

---

## Technical Details

### Z-Index Layers
- Topbar Promo: `z-index: 1040`
- Banner Promo: Normal flow
- Popup Promo: `z-index: 1050`

### LocalStorage Keys
- `dismissed_promotions`: Array of dismissed promo IDs with timestamps

### Database Table
- Table: `promotions`
- View: `v_promotions_active` (optimized query for active promos)

---

## Troubleshooting

### Promotions not showing?
1. Check promotion status is `running` or `scheduled`
2. Verify start/end dates are correct
3. Check browser console for errors
4. Clear localStorage to reset dismissals
5. Verify database connection

### Styling issues?
1. Check theme colors are valid hex codes
2. Ensure Remix Icon library is loaded
3. Verify Angular Material styles (if used)

### Performance issues?
1. Limit number of active promotions
2. Optimize images if used in messages
3. Reduce rotation interval if needed

---

## Support

For issues or questions, contact the development team or check the main project documentation.

## Version

Current Version: 1.0.0
Last Updated: 2025

