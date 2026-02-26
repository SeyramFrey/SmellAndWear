import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';

import { TopbarPromoComponent } from '../topbar-promo/topbar-promo.component';
import { BannerPromoComponent } from '../banner-promo/banner-promo.component';
import { PopupPromoComponent } from '../popup-promo/popup-promo.component';
import { PromoService, PromotionConfig } from '../../../../core/services/promo.service';

/**
 * Promo Container Component
 * 
 * Container that manages and displays all active promotions:
 * - Promo Bar (topbar)
 * - Promo Popup (modal)
 * - Promo Banner (inline)
 * 
 * Uses the PromoService as the single source of truth.
 * All logic stays in the service; this component only subscribes and renders.
 * 
 * Usage: Add <app-promo-container></app-promo-container> to your landing pages
 */
@Component({
  selector: 'app-promo-container',
  standalone: true,
  imports: [
    CommonModule,
    TopbarPromoComponent,
    BannerPromoComponent,
    PopupPromoComponent
  ],
  templateUrl: './promo-container.component.html',
  styleUrl: './promo-container.component.scss'
})
export class PromoContainerComponent implements OnInit, OnDestroy {
  // Current promotions
  barPromo: PromotionConfig | null = null;
  bannerPromos: PromotionConfig[] = [];
  popupPromo: PromotionConfig | null = null;
  
  // Loading state
  initialized = false;

  private destroy$ = new Subject<void>();

  constructor(private promoService: PromoService) {}

  ngOnInit(): void {
    // Subscribe to bar promotions
    this.promoService.barPromo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(promo => {
        this.barPromo = promo;
        console.log('[PromoContainer] Bar promo updated:', promo?.id);
      });

    // Subscribe to banner promotions
    this.promoService.bannerPromos$
      .pipe(takeUntil(this.destroy$))
      .subscribe(promos => {
        this.bannerPromos = promos;
        console.log('[PromoContainer] Banner promos updated:', promos.length);
      });

    // Subscribe to popup promotions
    this.promoService.popupPromo$
      .pipe(takeUntil(this.destroy$))
      .subscribe(promo => {
        this.popupPromo = promo;
        console.log('[PromoContainer] Popup promo updated:', promo?.id);
      });

    // Track initialization
    this.promoService.initialized$
      .pipe(
        takeUntil(this.destroy$),
        filter(init => init)
      )
      .subscribe(() => {
        this.initialized = true;
        console.log('[PromoContainer] Promo service initialized');
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  onBarDismissed(): void {
    if (this.barPromo) {
      console.log('[PromoContainer] Bar promo dismissed:', this.barPromo.id);
      this.promoService.dismissBarPromo(this.barPromo);
      this.barPromo = null;
    }
  }

  onBannerDismissed(promo: PromotionConfig): void {
    console.log('[PromoContainer] Banner promo dismissed:', promo.id);
    this.promoService.dismissBannerPromo(promo);
  }

  onPopupDismissed(): void {
    if (this.popupPromo) {
      console.log('[PromoContainer] Popup promo dismissed:', this.popupPromo.id);
      this.promoService.dismissPopupPromo(this.popupPromo);
      this.popupPromo = null;
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Get banners for a specific position
   */
  getBannersByPosition(position: 'top' | 'inline' | 'hero'): PromotionConfig[] {
    return this.bannerPromos.filter(b => 
      (b.banner_position || 'inline') === position
    );
  }

  /**
   * Track banners by ID for ngFor
   */
  trackByPromoId(index: number, promo: PromotionConfig): string {
    return promo.id;
  }
}
