import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { PromoService, PromotionConfig } from './promo.service';

/**
 * Landing Promotion Service
 * 
 * @deprecated Use PromoService instead. This service is maintained for backward compatibility.
 * 
 * The new PromoService provides:
 * - Single source of truth for all promotions
 * - Proper cooldown management with localStorage
 * - Support for bar, popup, and banner display types
 * - Route-based targeting
 * - Priority-based display
 */
@Injectable({
  providedIn: 'root'
})
export class LandingPromotionService {
  
  // Expose observables from PromoService for backward compatibility
  public topbarPromo$: Observable<PromotionConfig | null>;
  public bannerPromo$: Observable<PromotionConfig | null>;
  public popupPromo$: Observable<PromotionConfig | null>;

  constructor(private promoService: PromoService) {
    // Map new service observables to legacy names
    this.topbarPromo$ = this.promoService.barPromo$;
    this.bannerPromo$ = this.promoService.bannerPromos$.pipe(
      // Return first banner for backward compatibility
      map(banners => banners.length > 0 ? banners[0] : null)
    );
    this.popupPromo$ = this.promoService.popupPromo$;
  }

  /**
   * Dismiss a promotion
   * @deprecated Use promoService.dismissBarPromo, dismissPopupPromo, or dismissBannerPromo
   */
  dismissPromotion(promotionId: string, placement: 'topbar' | 'banner' | 'popup'): void {
    // Find the promo to dismiss
    this.promoService.allPromos$.subscribe(promos => {
      const promo = promos.find(p => p.id === promotionId);
      if (!promo) return;
      
      switch (placement) {
        case 'topbar':
          this.promoService.dismissBarPromo(promo);
          break;
        case 'banner':
          this.promoService.dismissBannerPromo(promo);
          break;
        case 'popup':
          this.promoService.dismissPopupPromo(promo);
          break;
      }
    }).unsubscribe();
  }

  /**
   * Refresh promotions
   * @deprecated Use promoService.refreshPromotions()
   */
  refreshPromotions(): void {
    this.promoService.refreshPromotions().subscribe();
  }

  /**
   * Manually show next promotion
   * @deprecated No longer supported in new system
   */
  nextPromotion(placement: 'topbar' | 'banner' | 'popup'): void {
    console.warn('[LandingPromotionService] nextPromotion is deprecated. Use PromoService instead.');
  }
}

// Import map for backward compatibility
import { map } from 'rxjs/operators';
