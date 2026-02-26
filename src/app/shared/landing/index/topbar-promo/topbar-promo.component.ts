import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PromotionConfig } from '../../../../core/services/promo.service';

@Component({
  selector: 'app-topbar-promo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './topbar-promo.component.html',
  styleUrl: './topbar-promo.component.scss'
})
export class TopbarPromoComponent implements OnInit, OnDestroy {
  @Input() promotion!: PromotionConfig;
  @Output() dismissed = new EventEmitter<void>();

  private autoDismissTimer?: any;
  private promoHeight = 40; // Default height in pixels

  ngOnInit(): void {
    // Set CSS custom property for topbar offset
    this.updateTopbarOffset(this.promoHeight);
    
    // Setup auto-dismiss if configured
    const duration = this.promotion.display_duration_seconds;
    if (duration && duration > 0) {
      this.autoDismissTimer = setTimeout(() => {
        this.dismiss();
      }, duration * 1000);
    }
  }

  ngOnDestroy(): void {
    // Reset topbar offset when promo is dismissed
    this.updateTopbarOffset(0);
    
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
    }
  }
  
  private updateTopbarOffset(height: number): void {
    document.documentElement.style.setProperty('--promo-bar-height', `${height}px`);
  }

  dismiss(): void {
    this.dismissed.emit();
  }

  getBackgroundStyle(): any {
    if (!this.promotion.theme) {
      return { 'background-color': '#000000' };
    }
    return { 'background-color': this.promotion.theme.bg };
  }

  getTextStyle(): any {
    if (!this.promotion.theme) {
      return { color: '#ffffff' };
    }
    return { color: this.promotion.theme.fg };
  }

  getAccentStyle(): any {
    if (!this.promotion.theme) {
      return { color: '#ff0000' };
    }
    return { color: this.promotion.theme.accent };
  }

  getAnimationClass(): string {
    switch (this.promotion.animation) {
      case 'slide':
        return 'promo-slide';
      case 'fade':
        return 'promo-fade';
      case 'marquee':
        return 'promo-marquee';
      default:
        return '';
    }
  }
}

