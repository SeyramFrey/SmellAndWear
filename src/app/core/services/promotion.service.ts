import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of, from } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { 
  ActivePromotion, 
  VariantEffectivePrice, 
  ProductEffectivePrice,
  CountdownDisplay,
  PromoBarEvent,
  DeliveryPromotion,
  DeliveryPriceWithPromo,
  ProductDiscountPromotion
} from '../models/promotion.models';

@Injectable({
  providedIn: 'root'
})
export class PromotionService {
  private readonly CACHE_DURATION = 30000; // 30 seconds
  
  // Simple cache for promotion data
  private topbarPromotionsCache: ActivePromotion[] = [];
  private variantPricesCache: VariantEffectivePrice[] = [];
  private productDiscountPromotionsCache: ProductDiscountPromotion[] = [];
  private deliveryPromotionsCache: Map<string, DeliveryPromotion[]> = new Map();
  
  private lastTopbarFetch: number = 0;
  private lastVariantPricesFetch: number = 0;
  private lastProductDiscountFetch: number = 0;
  
  // BehaviorSubjects for reactive state management
  private activePromotions$ = new BehaviorSubject<ActivePromotion[]>([]);
  private promoBarEvents$ = new BehaviorSubject<PromoBarEvent | null>(null);

  constructor(private supabaseService: SupabaseService) {
    // Initialize caches
    this.refreshTopbarPromotions();
    this.refreshProductDiscountPromotions();
  }

  // ============================================================================
  // TOPBAR PROMOTIONS
  // ============================================================================

  /**
   * Refresh topbar promotions cache
   */
  private async refreshTopbarPromotions(): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('v_topbar_promotions')
        .select('*');
      
      if (error) {
        console.error('Error fetching topbar promotions:', error);
        return;
      }

      // Filter out dismissed promotions
      const dismissedPromotions = this.getDismissedPromotions();
      const filteredData = (data || []).filter((promo: ActivePromotion) => 
        !dismissedPromotions.has(promo.id) && promo.remaining_seconds > 0
      );

      this.topbarPromotionsCache = filteredData as ActivePromotion[];
      this.lastTopbarFetch = Date.now();
      this.activePromotions$.next(this.topbarPromotionsCache);
    } catch (error) {
      console.error('Error refreshing topbar promotions:', error);
    }
  }

  /**
   * Get active topbar promotions with countdown
   */
  getTopbarPromotions(): Observable<ActivePromotion[]> {
    if (Date.now() - this.lastTopbarFetch > this.CACHE_DURATION) {
      this.refreshTopbarPromotions();
    }
    return of(this.topbarPromotionsCache);
  }

  // ============================================================================
  // PRODUCT DISCOUNT PROMOTIONS
  // ============================================================================

  /**
   * Refresh product discount promotions cache
   */
  private async refreshProductDiscountPromotions(): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('v_product_discount_promotions')
        .select('*');
      
      if (error) {
        console.error('Error fetching product discount promotions:', error);
        return;
      }

      this.productDiscountPromotionsCache = (data || []) as ProductDiscountPromotion[];
      this.lastProductDiscountFetch = Date.now();
    } catch (error) {
      console.error('Error refreshing product discount promotions:', error);
    }
  }

  /**
   * Get all active product discount promotions
   */
  getProductDiscountPromotions(): Observable<ProductDiscountPromotion[]> {
    if (Date.now() - this.lastProductDiscountFetch > this.CACHE_DURATION) {
      this.refreshProductDiscountPromotions();
    }
    return of(this.productDiscountPromotionsCache);
  }

  // ============================================================================
  // PRODUCT PRICE CALCULATION
  // ============================================================================

  /**
   * Get effective price for a product using the database function
   */
  getProductEffectivePrice(productId: string): Observable<ProductEffectivePrice | null> {
    if (!productId) {
      return of(null);
    }

    return from(
      this.supabaseService.getClient()
        .rpc('get_product_effective_price', { p_product_id: productId })
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching product price:', error);
            return null;
          }
          
          if (Array.isArray(data) && data.length > 0) {
            return data[0] as ProductEffectivePrice;
          }
          
          return null;
        })
    ).pipe(
      catchError((error: Error) => {
        console.error('Error in getProductEffectivePrice:', error);
        return of(null);
      })
    );
  }

  /**
   * Calculate effective price for a product locally (fallback)
   */
  calculateProductPrice(
    basePrice: number,
    categoryId?: string,
    subcategoryId?: string,
    productId?: string
  ): ProductEffectivePrice {
    // Default response - no discount
    const defaultResponse: ProductEffectivePrice = {
      original_price: basePrice,
      effective_price: basePrice,
      has_discount: false,
      show_strikethrough: false,
      highlight_color: '#212529',
      discount_percentage: 0
    };

    if (!basePrice || basePrice <= 0) {
      return defaultResponse;
    }

    // Find applicable promotion from cache
    const applicablePromotion = this.findBestPromotion(categoryId, subcategoryId, productId);
    
    if (!applicablePromotion) {
      return defaultResponse;
    }

    // Calculate discounted price
    let finalPrice = basePrice;
    let discountLabel: string | undefined;

    if (applicablePromotion.discount_type === 'PERCENTAGE') {
      finalPrice = basePrice * (1 - applicablePromotion.discount_value / 100);
      discountLabel = `-${applicablePromotion.discount_value}%`;
    } else if (applicablePromotion.discount_type === 'FIXED_AMOUNT') {
      finalPrice = Math.max(0, basePrice - applicablePromotion.discount_value);
      discountLabel = `-${applicablePromotion.discount_value}€`;
    }

    const discountPercentage = Math.round(((basePrice - finalPrice) / basePrice) * 100);

    return {
      original_price: basePrice,
      effective_price: Math.round(finalPrice * 100) / 100,
      has_discount: finalPrice < basePrice,
      show_strikethrough: finalPrice < basePrice,
      highlight_color: applicablePromotion.theme?.accent || '#B5190C',
      promotion_title: applicablePromotion.title,
      discount_percentage: discountPercentage,
      discount_label: discountLabel
    };
  }

  /**
   * Find the best applicable promotion for a product
   */
  private findBestPromotion(
    categoryId?: string,
    subcategoryId?: string,
    productId?: string
  ): ProductDiscountPromotion | null {
    if (this.productDiscountPromotionsCache.length === 0) {
      return null;
    }

    // Find matching promotions (sorted by weight, highest first)
    const matchingPromotions = this.productDiscountPromotionsCache.filter(promo => {
      if (promo.target_type === 'ALL_PRODUCTS') return true;
      if (promo.target_type === 'PRODUCT' && promo.target_id === productId) return true;
      if (promo.target_type === 'SUBCATEGORY' && promo.target_id === subcategoryId) return true;
      if (promo.target_type === 'CATEGORY' && promo.target_id === categoryId) return true;
      return false;
    });

    // Return the one with highest weight (already sorted by weight DESC in view)
    return matchingPromotions.length > 0 ? matchingPromotions[0] : null;
  }

  // ============================================================================
  // VARIANT PRICES
  // ============================================================================

  /**
   * Refresh variant prices cache
   */
  private async refreshVariantPrices(): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .from('v_variant_effective_price')
        .select('*');
      
      if (error) {
        console.error('Error fetching variant prices:', error);
        return;
      }

      this.variantPricesCache = (data || []) as VariantEffectivePrice[];
      this.lastVariantPricesFetch = Date.now();
    } catch (error) {
      console.error('Error refreshing variant prices:', error);
    }
  }

  /**
   * Get effective prices for all variants
   */
  getVariantEffectivePrices(): Observable<VariantEffectivePrice[]> {
    if (Date.now() - this.lastVariantPricesFetch > this.CACHE_DURATION) {
      this.refreshVariantPrices();
    }
    return of(this.variantPricesCache);
  }

  /**
   * Get effective price for a specific variant
   */
  getVariantPrice(variantId: string): Observable<VariantEffectivePrice | null> {
    if (Date.now() - this.lastVariantPricesFetch > this.CACHE_DURATION) {
      this.refreshVariantPrices();
    }
    const price = this.variantPricesCache.find(p => p.variant_id === variantId) || null;
    return of(price);
  }

  // ============================================================================
  // DELIVERY PROMOTIONS
  // ============================================================================

  /**
   * Get delivery promotions for a specific country
   */
  getDeliveryPromotions(countryCode: string): Observable<DeliveryPromotion[]> {
    // Check cache first
    const cached = this.deliveryPromotionsCache.get(countryCode);
    if (cached) {
      return of(cached);
    }

    return from(
      this.supabaseService.getClient()
        .rpc('get_delivery_promotions', { p_country_code: countryCode })
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching delivery promotions:', error);
            return [];
          }
          
          const promotions = (data || []) as DeliveryPromotion[];
          this.deliveryPromotionsCache.set(countryCode, promotions);
          return promotions;
        })
    ).pipe(
      catchError((error: Error) => {
        console.error('Error in getDeliveryPromotions:', error);
        return of([]);
      })
    );
  }

  /**
   * Calculate delivery price with applicable promotions
   */
  calculateDeliveryPrice(
    originalPrice: number,
    countryCode: string,
    orderTotal?: number
  ): Observable<DeliveryPriceWithPromo> {
    return this.getDeliveryPromotions(countryCode).pipe(
      map(promotions => {
        const defaultResult: DeliveryPriceWithPromo = {
          original_price: originalPrice,
          final_price: originalPrice,
          has_promotion: false
        };

        if (promotions.length === 0 || originalPrice <= 0) {
          return defaultResult;
        }

        // Find the best applicable promotion
        const applicablePromo = promotions.find(promo => {
          // Check minimum order amount if specified
          if (promo.min_order_amount && orderTotal !== undefined) {
            return orderTotal >= promo.min_order_amount;
          }
          return true;
        });

        if (!applicablePromo) {
          return defaultResult;
        }

        let finalPrice = originalPrice;
        let discountLabel: string | undefined;

        if (applicablePromo.discount_type === 'PERCENTAGE') {
          let discount = originalPrice * (applicablePromo.discount_value / 100);
          
          // Apply max discount cap if specified
          if (applicablePromo.max_discount_amount) {
            discount = Math.min(discount, applicablePromo.max_discount_amount);
          }
          
          finalPrice = originalPrice - discount;
          discountLabel = `-${applicablePromo.discount_value}%`;
        } else if (applicablePromo.discount_type === 'FIXED_AMOUNT') {
          finalPrice = Math.max(0, originalPrice - applicablePromo.discount_value);
          discountLabel = `-${applicablePromo.discount_value}€`;
        }

        return {
          original_price: originalPrice,
          final_price: Math.round(finalPrice * 100) / 100,
          has_promotion: finalPrice < originalPrice,
          promotion_message: applicablePromo.message,
          discount_label: discountLabel
        };
      })
    );
  }

  /**
   * Get delivery promotion message for display
   */
  getDeliveryPromotionMessage(countryCode: string): Observable<string | null> {
    return this.getDeliveryPromotions(countryCode).pipe(
      map(promotions => {
        if (promotions.length === 0) return null;
        return promotions[0].message;
      })
    );
  }

  // ============================================================================
  // PROMO BAR EVENTS
  // ============================================================================

  /**
   * Get promo bar events stream
   */
  getPromoBarEvents(): Observable<PromoBarEvent | null> {
    return this.promoBarEvents$.asObservable();
  }

  /**
   * Emit promo bar event
   */
  emitPromoBarEvent(event: PromoBarEvent): void {
    this.promoBarEvents$.next(event);
  }

  // ============================================================================
  // COUNTDOWN UTILITIES
  // ============================================================================

  /**
   * Create countdown display from remaining seconds
   */
  createCountdownDisplay(remainingSeconds: number): CountdownDisplay {
    const isExpired = remainingSeconds <= 0;
    
    if (isExpired) {
      return {
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
        formatted: '00:00'
      };
    }

    const hours = Math.floor(remainingSeconds / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = remainingSeconds % 60;

    const formatted = hours > 0 
      ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    return {
      hours,
      minutes,
      seconds,
      isExpired: false,
      formatted
    };
  }

  // ============================================================================
  // DISMISSAL MANAGEMENT
  // ============================================================================

  /**
   * Check if user has dismissed the promo bar for current session
   */
  isPromoBarDismissed(): boolean {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('promo-bar-dismissed') === 'true';
  }

  /**
   * Mark promo bar as dismissed for current session
   */
  dismissPromoBar(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('promo-bar-dismissed', 'true');
    this.emitPromoBarEvent({ type: 'BAR_DISMISSED' });
  }

  /**
   * Dismiss specific promotion for current session
   */
  dismissPromotion(promotionId: string): void {
    if (typeof window === 'undefined') return;
    const dismissed = this.getDismissedPromotions();
    dismissed.add(promotionId);
    sessionStorage.setItem('dismissed-promotions', JSON.stringify([...dismissed]));
  }

  /**
   * Check if specific promotion is dismissed
   */
  isPromotionDismissed(promotionId: string): boolean {
    return this.getDismissedPromotions().has(promotionId);
  }

  /**
   * Get set of dismissed promotion IDs
   */
  private getDismissedPromotions(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
      const dismissed = sessionStorage.getItem('dismissed-promotions');
      return new Set(dismissed ? JSON.parse(dismissed) : []);
    } catch {
      return new Set();
    }
  }

  // ============================================================================
  // PRICE UTILITIES
  // ============================================================================

  /**
   * Calculate price difference and savings
   */
  calculateSavings(originalPrice: number, effectivePrice: number): {
    savings: number;
    percentage: number;
  } {
    if (originalPrice <= 0 || effectivePrice >= originalPrice) {
      return { savings: 0, percentage: 0 };
    }

    const savings = originalPrice - effectivePrice;
    const percentage = Math.round((savings / originalPrice) * 100);

    return { savings, percentage };
  }

  /**
   * Format price for display
   */
  formatPrice(price: number, currency: string = 'EUR', locale: string = 'fr-FR'): string {
    try {
      if (currency === 'FCFA' || currency === 'XOF') {
        return `${price.toLocaleString(locale)} FCFA`;
      }
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
      }).format(price);
    } catch {
      return `${price} ${currency}`;
    }
  }

  // ============================================================================
  // REFRESH & CLEANUP
  // ============================================================================

  /**
   * Refresh all promotion data manually
   */
  refreshPromotions(): void {
    this.refreshTopbarPromotions();
    this.refreshProductDiscountPromotions();
    this.refreshVariantPrices();
    this.deliveryPromotionsCache.clear();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.topbarPromotionsCache = [];
    this.variantPricesCache = [];
    this.productDiscountPromotionsCache = [];
    this.deliveryPromotionsCache.clear();
    this.lastTopbarFetch = 0;
    this.lastVariantPricesFetch = 0;
    this.lastProductDiscountFetch = 0;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.activePromotions$.complete();
    this.promoBarEvents$.complete();
  }
}
