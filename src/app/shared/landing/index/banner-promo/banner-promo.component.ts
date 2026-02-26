import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PromotionConfig, BannerPosition } from '../../../../core/services/promo.service';
import { ImageService, IMAGE_SIZES } from '../../../../core/services/image.service';

/**
 * Banner Promo Component
 * 
 * An inline promotion banner with:
 * - Multiple position support (top, inline, hero)
 * - Image + text + CTA support
 * - Dismissible with cooldown
 * - Responsive design
 */
@Component({
  selector: 'app-banner-promo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './banner-promo.component.html',
  styleUrl: './banner-promo.component.scss'
})
export class BannerPromoComponent implements OnInit, OnDestroy {
  @Input() promotion!: PromotionConfig;
  @Input() position: BannerPosition = 'inline';
  @Output() dismissed = new EventEmitter<void>();

  private autoDismissTimer?: any;
  isVisible = false;
  
  constructor(private imageService: ImageService) {}
  
  @HostBinding('class')
  get hostClass(): string {
    return `banner-position-${this.bannerPosition}`;
  }

  ngOnInit(): void {
    // Trigger entrance animation
    setTimeout(() => {
      this.isVisible = true;
    }, 50);
    
    // Setup auto-dismiss if configured
    const duration = this.promotion.display_duration_seconds;
    if (duration && duration > 0) {
      this.autoDismissTimer = setTimeout(() => {
        this.dismiss();
      }, duration * 1000);
    }
  }

  ngOnDestroy(): void {
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
    }
  }
  
  // ============================================================================
  // GETTERS
  // ============================================================================

  get isDismissible(): boolean {
    return this.promotion.banner_dismissible ?? this.promotion.is_dismissible ?? true;
  }
  
  get bannerTitle(): string {
    return this.promotion.banner_title || this.promotion.title || '';
  }
  
  get bannerMessage(): string {
    return this.promotion.banner_message || this.promotion.message || '';
  }
  
  get bannerImage(): string | null {
    const url = this.promotion.banner_image_url || null;
    if (!url) return null;
    return this.imageService.resolveImageUrl(
      url,
      this.bannerPosition === 'hero' ? IMAGE_SIZES.HERO_BANNER : IMAGE_SIZES.PRODUCT_DETAIL,
      this.bannerPosition === 'hero' ? 85 : 75,
      'public-images',
      ''
    ) || url;
  }
  
  get ctaLabel(): string {
    return this.promotion.banner_cta_label || 'En savoir plus';
  }
  
  get ctaUrl(): string | null {
    return this.promotion.banner_cta_url || this.promotion.url || null;
  }
  
  get bannerPosition(): BannerPosition {
    return this.promotion.banner_position || this.position || 'inline';
  }
  
  // ============================================================================
  // ACTIONS
  // ============================================================================

  dismiss(): void {
    this.isVisible = false;
    
    // Wait for exit animation
    setTimeout(() => {
      this.dismissed.emit();
    }, 300);
  }
  
  // ============================================================================
  // STYLING
  // ============================================================================

  getBackgroundStyle(): Record<string, string> {
    const theme = this.promotion.theme;
    
    if (this.bannerImage && this.bannerPosition === 'hero') {
      return {
        'background-image': `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${this.bannerImage})`,
        'background-size': 'cover',
        'background-position': 'center'
      };
    }
    
    return {
      'background-color': theme?.bg || '#000000'
    };
  }

  getTextStyle(): Record<string, string> {
    const theme = this.promotion.theme;
    return {
      'color': theme?.fg || '#ffffff'
    };
  }

  getAccentStyle(): Record<string, string> {
    const theme = this.promotion.theme;
    return {
      'color': theme?.accent || '#ff0000'
    };
  }
  
  getCtaStyle(): Record<string, string> {
    const theme = this.promotion.theme;
    return {
      'background-color': theme?.accent || '#ff0000',
      'color': theme?.bg || '#000000',
      'border': 'none'
    };
  }

  getAnimationClass(): string {
    const anim = this.promotion.animation;
    switch (anim) {
      case 'slide': return 'banner-slide';
      case 'fade': return 'banner-fade';
      default: return 'banner-fade';
    }
  }
}
