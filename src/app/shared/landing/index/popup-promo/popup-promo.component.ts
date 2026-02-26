import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, HostListener, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PromotionConfig } from '../../../../core/services/promo.service';
import { ImageService, IMAGE_SIZES } from '../../../../core/services/image.service';

/**
 * Popup Promo Component
 * 
 * A modal-style promotion popup with:
 * - Proper accessibility (focus trap, ESC close, aria labels)
 * - Prevent background scroll
 * - Configurable animations
 * - Image + text + CTA support
 * - Proper z-index handling
 */
@Component({
  selector: 'app-popup-promo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './popup-promo.component.html',
  styleUrl: './popup-promo.component.scss'
})
export class PopupPromoComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() promotion!: PromotionConfig;
  @Output() dismissed = new EventEmitter<void>();
  
  @ViewChild('closeButton') closeButton!: ElementRef<HTMLButtonElement>;
  @ViewChild('popupContainer') popupContainer!: ElementRef<HTMLDivElement>;
  
  private autoDismissTimer?: any;
  
  constructor(private imageService: ImageService) {}
  private previousActiveElement: Element | null = null;
  isVisible = false;
  
  // Keyboard navigation
  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    if (this.isDismissible) {
      event.preventDefault();
      this.dismiss();
    }
  }
  
  @HostListener('document:keydown.tab', ['$event'])
  onTabKey(event: KeyboardEvent): void {
    this.trapFocus(event);
  }
  
  ngOnInit(): void {
    // Store previous active element for restoration
    this.previousActiveElement = document.activeElement;
    
    // Prevent body scroll when popup is open
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = this.getScrollbarWidth() + 'px';
    
    // Setup auto-dismiss if configured
    const duration = this.promotion.display_duration_seconds;
    if (duration && duration > 0) {
      this.autoDismissTimer = setTimeout(() => {
        this.dismiss();
      }, duration * 1000);
    }
    
    // Trigger entrance animation
    setTimeout(() => {
      this.isVisible = true;
    }, 50);
    
    console.log('[PopupPromo] Mounted with promotion:', this.promotion.id);
  }
  
  ngAfterViewInit(): void {
    // Focus the close button for accessibility
    setTimeout(() => {
      if (this.closeButton?.nativeElement) {
        this.closeButton.nativeElement.focus();
      }
    }, 100);
  }
  
  ngOnDestroy(): void {
    // Restore body scroll
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    
    // Clear timer
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
    }
    
    // Restore focus
    if (this.previousActiveElement && this.previousActiveElement instanceof HTMLElement) {
      this.previousActiveElement.focus();
    }
  }
  
  // ============================================================================
  // GETTERS
  // ============================================================================
  
  get isDismissible(): boolean {
    return this.promotion.popup_dismissible ?? this.promotion.is_dismissible ?? true;
  }
  
  get popupTitle(): string {
    return this.promotion.popup_title || this.promotion.title || '';
  }
  
  get popupMessage(): string {
    return this.promotion.popup_message || this.promotion.message || '';
  }
  
  get popupImage(): string | null {
    const url = this.promotion.popup_image_url || null;
    if (!url) return null;
    const optimized = this.imageService.resolveImageUrl(
      url,
      IMAGE_SIZES.PRODUCT_DETAIL,
      75,
      'public-images',
      ''
    );
    return optimized || url;
  }
  
  get ctaLabel(): string {
    return this.promotion.popup_cta_label || 'Découvrir';
  }
  
  get ctaUrl(): string | null {
    return this.promotion.popup_cta_url || this.promotion.url || null;
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
  
  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && this.isDismissible) {
      this.dismiss();
    }
  }
  
  onCtaClick(): void {
    // Optionally dismiss after CTA click
    this.dismiss();
  }
  
  // ============================================================================
  // STYLING
  // ============================================================================
  
  getBackgroundStyle(): Record<string, string> {
    const theme = this.promotion.theme;
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
      case 'slide': return 'popup-slide';
      case 'fade': return 'popup-fade';
      default: return 'popup-fade';
    }
  }
  
  // ============================================================================
  // ACCESSIBILITY
  // ============================================================================
  
  private trapFocus(event: KeyboardEvent): void {
    if (!this.popupContainer?.nativeElement) return;
    
    const focusableElements = this.popupContainer.nativeElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    if (event.shiftKey && document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable?.focus();
    } else if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable?.focus();
    }
  }
  
  private getScrollbarWidth(): number {
    const outer = document.createElement('div');
    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll';
    document.body.appendChild(outer);
    
    const inner = document.createElement('div');
    outer.appendChild(inner);
    
    const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
    outer.parentNode?.removeChild(outer);
    
    return scrollbarWidth;
  }
}
