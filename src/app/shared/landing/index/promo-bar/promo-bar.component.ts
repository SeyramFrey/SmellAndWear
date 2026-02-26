import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  ChangeDetectorRef,
  HostListener,
  Inject,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable, interval, Subject, combineLatest, of } from 'rxjs';
import { 
  takeUntil, 
  map, 
  startWith, 
  switchMap, 
  distinctUntilChanged,
  filter,
  tap
} from 'rxjs/operators';
import { 
  ActivePromotion, 
  CountdownDisplay, 
  PromoBarEvent,
  AnimationConfig,
  AccessibilityConfig 
} from '../../../../core/models/promotion.models';
import { PromotionService } from '../../../../core/services/promotion.service';

@Component({
  selector: 'app-promo-bar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './promo-bar.component.html',
  styleUrl: './promo-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PromoBarComponent implements OnInit, OnDestroy {
  // Component state
  activePromotions: ActivePromotion[] = [];
  currentPromotion: ActivePromotion | null = null;
  currentIndex = 0;
  countdown: CountdownDisplay = {
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
    formatted: '00:00'
  };
  
  // UI state
  isVisible = false;
  isDismissed = false;
  isLoading = true;
  isPaused = false;
  
  // Accessibility
  reducedMotion = false;
  announceChanges = true;
  
  // Timers
  private rotationTimer?: number;
  private countdownTimer?: number;
  
  // Reactive streams
  private destroy$ = new Subject<void>();
  private manualRotation$ = new Subject<void>();
  
  // Configuration
  private readonly defaultDisplayDuration = 10000; // 10 seconds
  private readonly countdownUpdateInterval = 1000; // 1 second
  
  constructor(
    private promotionService: PromotionService,
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.checkReducedMotionPreference();
  }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.initializePromoBar();
    this.setupKeyboardNavigation();
  }

  ngOnDestroy(): void {
    this.cleanup();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize promo bar with reactive data streams
   */
  private initializePromoBar(): void {
    // Check if bar is dismissed
    this.isDismissed = this.promotionService.isPromoBarDismissed();
    
    if (this.isDismissed) {
      this.isVisible = false;
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    // Subscribe to active promotions
    this.promotionService.getTopbarPromotions().pipe(
      takeUntil(this.destroy$),
      distinctUntilChanged((prev, curr) => 
        JSON.stringify(prev.map(p => p.id)) === JSON.stringify(curr.map(p => p.id))
      )
    ).subscribe(promotions => {
      this.activePromotions = promotions.filter(p => 
        !this.promotionService.isPromotionDismissed(p.id)
      );
      
      this.isLoading = false;
      this.isVisible = this.activePromotions.length > 0;
      
      if (this.isVisible) {
        this.setupRotation();
      } else {
        this.cleanup();
      }
      
      this.cdr.markForCheck();
    });

    // Setup countdown timer
    this.setupCountdownTimer();
  }

  /**
   * Setup rotation between promotions
   */
  private setupRotation(): void {
    if (this.activePromotions.length === 0) return;

    // Cleanup existing timers
    this.cleanup();

    // Set initial promotion
    this.currentIndex = 0;
    this.currentPromotion = this.activePromotions[0];

    // Setup automatic rotation if multiple promotions
    if (this.activePromotions.length > 1) {
      this.startRotationTimer();
    }

    // Handle manual rotation triggers
    this.manualRotation$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.rotateToNext();
    });

    this.cdr.markForCheck();
  }

  /**
   * Start automatic rotation timer
   */
  private startRotationTimer(): void {
    if (!this.currentPromotion) return;

    const duration = (this.currentPromotion.display_duration_seconds || 10) * 1000;
    
    this.rotationTimer = window.setTimeout(() => {
      if (!this.isPaused) {
        this.rotateToNext();
      }
    }, duration);
  }

  /**
   * Rotate to next promotion
   */
  private rotateToNext(): void {
    if (this.activePromotions.length <= 1) return;

    // Clear current timer
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
    }

    // Move to next promotion
    this.currentIndex = (this.currentIndex + 1) % this.activePromotions.length;
    this.currentPromotion = this.activePromotions[this.currentIndex];

    // Emit rotation event
    this.promotionService.emitPromoBarEvent({
      type: 'ROTATION_NEXT',
      currentIndex: this.currentIndex
    });

    // Announce change for screen readers
    if (this.announceChanges && this.currentPromotion) {
      this.announcePromotion(this.currentPromotion);
    }

    // Start next rotation timer
    this.startRotationTimer();
    
    this.cdr.markForCheck();
  }

  /**
   * Setup countdown timer
   */
  private setupCountdownTimer(): void {
    interval(this.countdownUpdateInterval).pipe(
      takeUntil(this.destroy$),
      map(() => {
        if (!this.currentPromotion) {
          return this.promotionService.createCountdownDisplay(0);
        }

        // Calculate remaining seconds based on end_at
        const endTime = new Date(this.currentPromotion.end_at).getTime();
        const now = Date.now();
        const remainingMs = Math.max(0, endTime - now);
        const remainingSeconds = Math.floor(remainingMs / 1000);

        return this.promotionService.createCountdownDisplay(remainingSeconds);
      }),
      distinctUntilChanged((prev, curr) => prev.formatted === curr.formatted)
    ).subscribe(countdown => {
      this.countdown = countdown;
      
      // Emit countdown tick
      this.promotionService.emitPromoBarEvent({
        type: 'COUNTDOWN_TICK',
        remainingSeconds: countdown.isExpired ? 0 : 
          countdown.hours * 3600 + countdown.minutes * 60 + countdown.seconds
      });

      // Handle expired promotion
      if (countdown.isExpired && this.currentPromotion) {
        this.handlePromotionExpired();
      }

      this.cdr.markForCheck();
    });
  }

  /**
   * Handle promotion expiration
   */
  private handlePromotionExpired(): void {
    if (!this.currentPromotion) return;

    // Emit expiration event
    this.promotionService.emitPromoBarEvent({
      type: 'PROMO_ENDED',
      promotion: this.currentPromotion
    });

    // Remove expired promotion from list
    this.activePromotions = this.activePromotions.filter(p => p.id !== this.currentPromotion!.id);

    if (this.activePromotions.length === 0) {
      // No more promotions, hide bar
      this.isVisible = false;
      this.cleanup();
    } else {
      // Move to next promotion
      this.currentIndex = this.currentIndex % this.activePromotions.length;
      this.setupRotation();
    }

    this.cdr.markForCheck();
  }

  /**
   * Dismiss current promotion
   */
  dismissCurrentPromotion(): void {
    if (!this.currentPromotion) return;

    // Mark as dismissed
    this.promotionService.dismissPromotion(this.currentPromotion.id);
    
    // Emit dismiss event
    this.promotionService.emitPromoBarEvent({
      type: 'PROMO_DISMISSED',
      promotion: this.currentPromotion
    });

    // Remove from active list
    this.activePromotions = this.activePromotions.filter(p => p.id !== this.currentPromotion!.id);

    if (this.activePromotions.length === 0) {
      this.dismissEntireBar();
    } else {
      this.currentIndex = this.currentIndex % this.activePromotions.length;
      this.setupRotation();
    }
  }

  /**
   * Dismiss entire promo bar
   */
  dismissEntireBar(): void {
    this.isDismissed = true;
    this.isVisible = false;
    this.promotionService.dismissPromoBar();
    this.cleanup();
    this.cdr.markForCheck();
  }

  /**
   * Handle promotion click
   */
  onPromotionClick(promotion: ActivePromotion): void {
    this.promotionService.emitPromoBarEvent({
      type: 'USER_INTERACTION',
      action: 'click'
    });

    // If promotion has URL, it will be handled by routerLink or href
    // Additional tracking can be added here
  }

  /**
   * Pause rotation on mouse enter
   */
  @HostListener('mouseenter')
  onMouseEnter(): void {
    this.isPaused = true;
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
    }
  }

  /**
   * Resume rotation on mouse leave
   */
  @HostListener('mouseleave')
  onMouseLeave(): void {
    this.isPaused = false;
    if (this.activePromotions.length > 1) {
      this.startRotationTimer();
    }
  }

  /**
   * Setup keyboard navigation
   */
  private setupKeyboardNavigation(): void {
    // Implementation for keyboard navigation if needed
  }

  /**
   * Check for reduced motion preference
   */
  private checkReducedMotionPreference(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = mediaQuery.matches;

    mediaQuery.addEventListener('change', (e) => {
      this.reducedMotion = e.matches;
      this.cdr.markForCheck();
    });
  }

  /**
   * Announce promotion change for screen readers
   */
  private announcePromotion(promotion: ActivePromotion): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Create announcement for screen readers
    const announcement = `New promotion: ${promotion.title}. ${promotion.message}`;
    
    // This would typically use a service for screen reader announcements
    console.log('Screen reader announcement:', announcement);
  }

  /**
   * Get theme styles for current promotion
   */
  getThemeStyles(): { [key: string]: string } {
    if (!this.currentPromotion?.theme) {
      return {
        'background-color': '#000000',
        'color': '#ffffff'
      };
    }

    return {
      'background-color': this.currentPromotion.theme.bg,
      'color': this.currentPromotion.theme.fg
    };
  }

  /**
   * Get animation class for current promotion
   */
  getAnimationClass(): string {
    if (this.reducedMotion) return 'no-animation';
    
    const animation = this.currentPromotion?.animation || 'slide';
    return `promo-animation-${animation}`;
  }

  /**
   * Cleanup timers and resources
   */
  private cleanup(): void {
    if (this.rotationTimer) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = undefined;
    }
  }
}
