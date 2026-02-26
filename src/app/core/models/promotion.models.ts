// Promotion Models for Smell & Wear
// TypeScript interfaces for the promotions system

// ============================================================================
// ENUMS AND TYPES
// ============================================================================

export type PromotionType = 'DISPLAY' | 'PRODUCT_DISCOUNT' | 'DELIVERY_DISCOUNT';
export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type PromotionStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'ended';
export type PromotionPlacement = 'topbar' | 'banner' | 'popup';
export type PromotionAnimation = 'slide' | 'fade' | 'marquee' | 'none';
export type TargetType = 'CATEGORY' | 'SUBCATEGORY' | 'PRODUCT' | 'VARIANT' | 'DELIVERY_ZONE' | 'ALL_PRODUCTS' | 'ALL_DELIVERY';

// ============================================================================
// CORE PROMOTION INTERFACES
// ============================================================================

export interface PromotionTheme {
  bg: string;
  fg: string;
  accent: string;
}

export interface Promotion {
  id: string;
  title: string;
  message: string;
  url?: string;
  status: PromotionStatus;
  placement: PromotionPlacement;
  start_at: string; // ISO string
  end_at: string; // ISO string
  display_duration_seconds: number;
  weight: number;
  is_dismissible: boolean;
  animation: PromotionAnimation;
  theme?: PromotionTheme;
  // New discount fields
  promotion_type: PromotionType;
  discount_type?: DiscountType;
  discount_value?: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface ActivePromotion extends Promotion {
  remaining_seconds: number;
  is_currently_active: boolean;
}

// ============================================================================
// PROMOTION RULES
// ============================================================================

export interface PromotionPriceRule {
  id: string;
  promotion_id: string;
  target_type: TargetType;
  target_id?: string;
  target_code?: string;
  created_at: string;
}

export interface ActivePromotionRule extends PromotionPriceRule {
  promotion_weight: number;
  promotion_title: string;
  start_at: string;
  end_at: string;
}

// ============================================================================
// PRICE CALCULATION INTERFACES
// ============================================================================

export interface ProductEffectivePrice {
  original_price: number;
  effective_price: number;
  has_discount: boolean;
  show_strikethrough: boolean;
  highlight_color: string;
  promotion_title?: string;
  discount_percentage: number;
  discount_label?: string;
}

export interface VariantEffectivePrice {
  variant_id: string;
  original_price: number;
  effective_price: number;
  has_discount: boolean;
  show_strikethrough: boolean;
  highlight_color: string;
  promotion_weight: number;
  promotion_title?: string;
  discount_percentage: number;
}

// ============================================================================
// DELIVERY PROMOTION INTERFACES
// ============================================================================

export interface DeliveryPromotion {
  promotion_id: string;
  title: string;
  message: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount?: number;
  max_discount_amount?: number;
  target_zone_id?: string;
}

export interface DeliveryPriceWithPromo {
  original_price: number;
  final_price: number;
  has_promotion: boolean;
  promotion_message?: string;
  discount_label?: string;
}

// ============================================================================
// PRODUCT DISCOUNT VIEW
// ============================================================================

export interface ProductDiscountPromotion {
  promotion_id: string;
  title: string;
  message: string;
  promotion_type: PromotionType;
  discount_type: DiscountType;
  discount_value: number;
  weight: number;
  start_at: string;
  end_at: string;
  theme?: PromotionTheme;
  rule_id: string;
  target_type: TargetType;
  target_id?: string;
  target_code?: string;
}

// ============================================================================
// PROMO BAR INTERFACES
// ============================================================================

export interface PromoBarState {
  activePromotions: ActivePromotion[];
  currentIndex: number;
  isVisible: boolean;
  isDismissed: boolean;
  rotationTimer?: number;
}

export interface CountdownDisplay {
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  formatted: string; // HH:MM:SS or MM:SS
}

// ============================================================================
// DISPLAY CONFIGURATION
// ============================================================================

export interface PriceDisplayConfig {
  showOriginalPrice: boolean;
  showDiscountBadge: boolean;
  showDiscountPercentage: boolean;
  currencySymbol: string;
  locale: string;
}

export interface AnimationConfig {
  type: PromotionAnimation;
  duration: number; // milliseconds
  easing: string;
  respectReducedMotion: boolean;
}

export interface AccessibilityConfig {
  announcePromotions: boolean;
  pauseOnFocus: boolean;
  keyboardNavigation: boolean;
  reducedMotion: boolean;
}

// ============================================================================
// SERVICE RESPONSE TYPES
// ============================================================================

export interface PromotionServiceResponse<T> {
  data: T;
  error?: string;
  loading: boolean;
}

export interface PriceCalculationResult {
  originalPrice: number;
  finalPrice: number;
  savings: number;
  discountPercentage: number;
  appliedRules: ActivePromotionRule[];
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export type PromoBarEvent = 
  | { type: 'PROMO_STARTED'; promotion: ActivePromotion }
  | { type: 'PROMO_ENDED'; promotion: ActivePromotion }
  | { type: 'PROMO_DISMISSED'; promotion: ActivePromotion }
  | { type: 'BAR_DISMISSED' }
  | { type: 'COUNTDOWN_TICK'; remainingSeconds: number }
  | { type: 'ROTATION_NEXT'; currentIndex: number }
  | { type: 'USER_INTERACTION'; action: string };

// ============================================================================
// PROMO BAR CONFIGURATION
// ============================================================================

export interface PromoBarConfig {
  enableRotation: boolean;
  respectDismissal: boolean;
  sessionStorage: boolean;
  countdownUpdateInterval: number; // milliseconds
  animationConfig: AnimationConfig;
  accessibilityConfig: AccessibilityConfig;
}

// ============================================================================
// ADMIN FORM INTERFACES
// ============================================================================

export interface CreatePromotionRequest {
  title: string;
  message: string;
  url?: string;
  placement: PromotionPlacement;
  start_at: string;
  end_at: string;
  display_duration_seconds: number;
  weight: number;
  is_dismissible: boolean;
  animation: PromotionAnimation;
  theme?: PromotionTheme;
  promotion_type: PromotionType;
  discount_type?: DiscountType;
  discount_value?: number;
  min_order_amount?: number;
  max_discount_amount?: number;
}

export interface UpdatePromotionRequest extends Partial<CreatePromotionRequest> {
  status?: PromotionStatus;
}

export interface PromotionRuleRequest {
  promotion_id: string;
  target_type: TargetType;
  target_id?: string;
  target_code?: string;
}

// ============================================================================
// CATEGORY SELECTION FOR ADMIN
// ============================================================================

export interface CategoryOption {
  id: string;
  name: string;
  parent_id?: string;
  isSubcategory: boolean;
}

export interface ProductOption {
  id: string;
  name: string;
  category_name?: string;
}

export interface DeliveryZoneOption {
  id: string;
  label: string;
  country_code: string;
}

// ============================================================================
// EXTENDED PROMOTION CONFIG (V2 - With full display configuration)
// ============================================================================

export type BannerPosition = 'top' | 'inline' | 'hero';
export type CooldownType = 'once_session' | 'once_day' | 'once_week' | 'custom' | 'never';

export interface ExtendedPromotion extends Promotion {
  // Priority (higher = more important)
  priority: number;
  
  // Display flags - can enable multiple
  display_bar: boolean;
  display_popup: boolean;
  display_banner: boolean;
  
  // Bar config
  bar_cooldown_seconds?: number;
  
  // Popup config
  popup_title?: string;
  popup_message?: string;
  popup_image_url?: string;
  popup_cta_label?: string;
  popup_cta_url?: string;
  popup_dismissible: boolean;
  popup_cooldown_seconds?: number;
  
  // Banner config
  banner_title?: string;
  banner_message?: string;
  banner_image_url?: string;
  banner_cta_label?: string;
  banner_cta_url?: string;
  banner_position: BannerPosition;
  banner_pages?: string[];
  banner_dismissible: boolean;
  banner_cooldown_seconds?: number;
  
  // Targeting
  target_pages?: string[];
  target_categories?: string[];
  target_products?: string[];
}

// ============================================================================
// ADMIN EXTENDED FORM INTERFACES
// ============================================================================

export interface CreateExtendedPromotionRequest {
  title: string;
  message: string;
  url?: string;
  start_at: string;
  end_at: string;
  priority: number;
  is_dismissible: boolean;
  animation: PromotionAnimation;
  theme?: PromotionTheme;
  promotion_type: PromotionType;
  
  // Display flags
  display_bar: boolean;
  display_popup: boolean;
  display_banner: boolean;
  
  // Display-specific configs
  bar_cooldown_seconds?: number;
  
  popup_title?: string;
  popup_message?: string;
  popup_image_url?: string;
  popup_cta_label?: string;
  popup_cta_url?: string;
  popup_dismissible?: boolean;
  popup_cooldown_seconds?: number;
  
  banner_title?: string;
  banner_message?: string;
  banner_image_url?: string;
  banner_cta_label?: string;
  banner_cta_url?: string;
  banner_position?: BannerPosition;
  banner_pages?: string[];
  banner_dismissible?: boolean;
  banner_cooldown_seconds?: number;
  
  // Targeting
  target_pages?: string[];
  target_categories?: string[];
  target_products?: string[];
  
  // Discount fields (optional)
  discount_type?: DiscountType;
  discount_value?: number;
  min_order_amount?: number;
  max_discount_amount?: number;
}