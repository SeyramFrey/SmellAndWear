import { Injectable, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject, Observable, from, interval, Subscription, of } from 'rxjs';
import { map, catchError, filter, shareReplay, take, distinctUntilChanged, tap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type CooldownType = 'once_session' | 'once_day' | 'once_week' | 'custom' | 'never';
export type BannerPosition = 'top' | 'inline' | 'hero';
export type DisplayType = 'bar' | 'popup' | 'banner';

export interface PromotionConfig {
  id: string;
  title: string;
  message: string;
  url?: string;
  status: string;
  start_at: string;
  end_at: string;
  priority: number;
  is_dismissible: boolean;
  animation: string;
  theme?: {
    bg: string;
    fg: string;
    accent: string;
  };
  
  // Display flags
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
  
  // Legacy fields for backward compatibility
  placement?: string;
  display_duration_seconds?: number;
  weight?: number;
}

export interface PromoDisplayState {
  bar: PromotionConfig | null;
  popup: PromotionConfig | null;
  banners: PromotionConfig[];
}

interface CooldownRecord {
  promoId: string;
  displayType: DisplayType;
  dismissedAt: number;
  cooldownSeconds: number;
}

// ============================================================================
// PROMO SERVICE - SINGLE SOURCE OF TRUTH
// ============================================================================

@Injectable({
  providedIn: 'root'
})
export class PromoService implements OnDestroy {
  private readonly COOLDOWN_STORAGE_KEY = 'promo_cooldowns';
  private readonly SESSION_KEY = 'promo_session_id';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  
  // State subjects
  private allPromosSubject = new BehaviorSubject<PromotionConfig[]>([]);
  private barPromoSubject = new BehaviorSubject<PromotionConfig | null>(null);
  private popupPromoSubject = new BehaviorSubject<PromotionConfig | null>(null);
  private bannerPromosSubject = new BehaviorSubject<PromotionConfig[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private initializedSubject = new BehaviorSubject<boolean>(false);
  
  // Public observables
  public readonly allPromos$ = this.allPromosSubject.asObservable();
  public readonly barPromo$ = this.barPromoSubject.asObservable();
  public readonly popupPromo$ = this.popupPromoSubject.asObservable();
  public readonly bannerPromos$ = this.bannerPromosSubject.asObservable();
  public readonly loading$ = this.loadingSubject.asObservable();
  public readonly initialized$ = this.initializedSubject.asObservable();
  
  // Internal state
  private subscriptions: Subscription[] = [];
  private currentRoute: string = '';
  private sessionId: string = '';
  private lastFetchTime: number = 0;
  private cachedPromos: PromotionConfig[] = [];
  private popupShownThisPageLoad = false;
  
  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    this.initializeSession();
    this.subscribeToRouteChanges();
    this.initializePromotions();
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  private initializeSession(): void {
    // Generate or retrieve session ID for "once per session" cooldowns
    let sessionId = sessionStorage.getItem(this.SESSION_KEY);
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem(this.SESSION_KEY, sessionId);
    }
    this.sessionId = sessionId;
  }
  
  private subscribeToRouteChanges(): void {
    const routeSub = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      this.currentRoute = event.urlAfterRedirects;
      this.popupShownThisPageLoad = false;
      this.updateDisplayStates();
    });
    this.subscriptions.push(routeSub);
    
    // Set initial route
    this.currentRoute = this.router.url;
  }
  
  private initializePromotions(): void {
    this.loadActivePromotions().subscribe();
  }
  
  // ============================================================================
  // DATA LOADING
  // ============================================================================
  
  /**
   * Load all active promotions from database
   * Uses caching to prevent excessive API calls
   */
  loadActivePromotions(forceRefresh = false): Observable<PromotionConfig[]> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (!forceRefresh && this.cachedPromos.length > 0 && (now - this.lastFetchTime) < this.CACHE_DURATION) {
      return of(this.cachedPromos);
    }
    
    this.loadingSubject.next(true);
    const currentTime = new Date().toISOString();
    
    console.log('[PromoService] Loading active promotions...');
    
    return from(
      this.supabaseService.getClient()
        .from('promotions')
        .select('*')
        .in('status', ['scheduled', 'running'])
        .lte('start_at', currentTime)
        .gte('end_at', currentTime)
        .order('priority', { ascending: false })
        .order('start_at', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('[PromoService] Error loading promotions:', error);
          return [];
        }
        
        const promos = (data || []) as PromotionConfig[];
        console.log(`[PromoService] Loaded ${promos.length} active promotions`);
        
        // Update cache
        this.cachedPromos = promos;
        this.lastFetchTime = now;
        this.allPromosSubject.next(promos);
        
        // Update display states
        this.updateDisplayStates();
        
        this.loadingSubject.next(false);
        this.initializedSubject.next(true);
        
        return promos;
      }),
      catchError(error => {
        console.error('[PromoService] Error in loadActivePromotions:', error);
        this.loadingSubject.next(false);
        this.initializedSubject.next(true);
        return of([]);
      }),
      shareReplay(1)
    );
  }
  
  /**
   * Force refresh promotions data
   */
  refreshPromotions(): Observable<PromotionConfig[]> {
    return this.loadActivePromotions(true);
  }
  
  // ============================================================================
  // DISPLAY STATE MANAGEMENT
  // ============================================================================
  
  /**
   * Update all display states based on current promos and route
   */
  private updateDisplayStates(): void {
    const promos = this.cachedPromos;
    
    // Update bar promo
    const barPromo = this.getEligibleBarPromo(promos);
    this.barPromoSubject.next(barPromo);
    
    // Update popup promo (with delay for better UX)
    if (!this.popupShownThisPageLoad) {
      setTimeout(() => {
        const popupPromo = this.getEligiblePopupPromo(promos);
        if (popupPromo) {
          console.log('[PromoService] Showing popup promo:', popupPromo.id);
          this.popupPromoSubject.next(popupPromo);
          this.popupShownThisPageLoad = true;
        }
      }, 1500); // Delay popup to avoid UI flicker
    }
    
    // Update banner promos
    const bannerPromos = this.getEligibleBannerPromos(promos);
    this.bannerPromosSubject.next(bannerPromos);
  }
  
  /**
   * Get eligible bar promo (highest priority, not on cooldown)
   */
  private getEligibleBarPromo(promos: PromotionConfig[]): PromotionConfig | null {
    const barPromos = promos.filter(p => 
      (p.display_bar || p.placement === 'topbar') &&
      this.isEligibleForRoute(p, 'bar') &&
      !this.isOnCooldown(p.id, 'bar')
    );
    
    return barPromos.length > 0 ? barPromos[0] : null;
  }
  
  /**
   * Get eligible popup promo (highest priority, not on cooldown)
   */
  private getEligiblePopupPromo(promos: PromotionConfig[]): PromotionConfig | null {
    const popupPromos = promos.filter(p => 
      (p.display_popup || p.placement === 'popup') &&
      this.isEligibleForRoute(p, 'popup') &&
      !this.isOnCooldown(p.id, 'popup')
    );
    
    console.log(`[PromoService] Eligible popup promos: ${popupPromos.length}`);
    return popupPromos.length > 0 ? popupPromos[0] : null;
  }
  
  /**
   * Get eligible banner promos for current route
   */
  private getEligibleBannerPromos(promos: PromotionConfig[]): PromotionConfig[] {
    return promos.filter(p => 
      (p.display_banner || p.placement === 'banner') &&
      this.isEligibleForRoute(p, 'banner') &&
      !this.isOnCooldown(p.id, 'banner')
    );
  }
  
  /**
   * Check if promo is eligible for current route
   */
  private isEligibleForRoute(promo: PromotionConfig, displayType: DisplayType): boolean {
    // Get target pages based on display type
    let targetPages: string[] | undefined;
    
    if (displayType === 'banner') {
      targetPages = promo.banner_pages;
    } else {
      targetPages = promo.target_pages;
    }
    
    // If no target pages specified, show on all pages
    if (!targetPages || targetPages.length === 0) {
      return true;
    }
    
    // Check if current route matches any target page
    return targetPages.some(page => {
      if (page === '/') {
        return this.currentRoute === '/' || this.currentRoute === '';
      }
      return this.currentRoute.startsWith(page);
    });
  }
  
  // ============================================================================
  // COOLDOWN MANAGEMENT
  // ============================================================================
  
  /**
   * Check if a promo is on cooldown for a specific display type
   */
  isOnCooldown(promoId: string, displayType: DisplayType): boolean {
    const cooldowns = this.getCooldownRecords();
    const record = cooldowns.find(c => c.promoId === promoId && c.displayType === displayType);
    
    if (!record) {
      return false;
    }
    
    // Check if cooldown has expired
    const now = Date.now();
    const cooldownEnd = record.dismissedAt + (record.cooldownSeconds * 1000);
    
    if (now >= cooldownEnd) {
      // Cooldown expired, remove record
      this.removeCooldownRecord(promoId, displayType);
      return false;
    }
    
    return true;
  }
  
  /**
   * Get remaining cooldown time in seconds
   */
  getCooldownRemaining(promoId: string, displayType: DisplayType): number {
    const cooldowns = this.getCooldownRecords();
    const record = cooldowns.find(c => c.promoId === promoId && c.displayType === displayType);
    
    if (!record) {
      return 0;
    }
    
    const now = Date.now();
    const cooldownEnd = record.dismissedAt + (record.cooldownSeconds * 1000);
    const remaining = Math.max(0, Math.floor((cooldownEnd - now) / 1000));
    
    return remaining;
  }
  
  /**
   * Set cooldown for a promo
   */
  setCooldown(promoId: string, displayType: DisplayType, cooldownSeconds: number): void {
    if (cooldownSeconds <= 0) {
      return; // No cooldown needed
    }
    
    const cooldowns = this.getCooldownRecords();
    
    // Remove existing record for this promo/display combo
    const filteredCooldowns = cooldowns.filter(c => 
      !(c.promoId === promoId && c.displayType === displayType)
    );
    
    // Add new record
    filteredCooldowns.push({
      promoId,
      displayType,
      dismissedAt: Date.now(),
      cooldownSeconds
    });
    
    this.saveCooldownRecords(filteredCooldowns);
    console.log(`[PromoService] Set cooldown for ${promoId} (${displayType}): ${cooldownSeconds}s`);
  }
  
  /**
   * Get all cooldown records from localStorage
   */
  private getCooldownRecords(): CooldownRecord[] {
    try {
      const stored = localStorage.getItem(this.COOLDOWN_STORAGE_KEY);
      if (!stored) return [];
      
      const records = JSON.parse(stored) as CooldownRecord[];
      
      // Clean up expired records
      const now = Date.now();
      const validRecords = records.filter(r => {
        const cooldownEnd = r.dismissedAt + (r.cooldownSeconds * 1000);
        return now < cooldownEnd;
      });
      
      // Save cleaned records if different
      if (validRecords.length !== records.length) {
        this.saveCooldownRecords(validRecords);
      }
      
      return validRecords;
    } catch (error) {
      console.error('[PromoService] Error reading cooldowns:', error);
      return [];
    }
  }
  
  /**
   * Save cooldown records to localStorage
   */
  private saveCooldownRecords(records: CooldownRecord[]): void {
    try {
      localStorage.setItem(this.COOLDOWN_STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      console.error('[PromoService] Error saving cooldowns:', error);
    }
  }
  
  /**
   * Remove a specific cooldown record
   */
  private removeCooldownRecord(promoId: string, displayType: DisplayType): void {
    const cooldowns = this.getCooldownRecords();
    const filtered = cooldowns.filter(c => 
      !(c.promoId === promoId && c.displayType === displayType)
    );
    this.saveCooldownRecords(filtered);
  }
  
  /**
   * Clear all cooldowns (admin utility)
   */
  clearAllCooldowns(): void {
    localStorage.removeItem(this.COOLDOWN_STORAGE_KEY);
    console.log('[PromoService] All cooldowns cleared');
  }
  
  // ============================================================================
  // DISMISSAL HANDLING
  // ============================================================================
  
  /**
   * Dismiss a bar promo
   */
  dismissBarPromo(promo: PromotionConfig): void {
    const cooldownSeconds = promo.bar_cooldown_seconds ?? 1800; // Default 30 min
    this.setCooldown(promo.id, 'bar', cooldownSeconds);
    
    // Update state
    this.barPromoSubject.next(null);
    
    // Try to show next eligible promo
    const nextPromo = this.getEligibleBarPromo(this.cachedPromos);
    if (nextPromo) {
      this.barPromoSubject.next(nextPromo);
    }
    
    console.log(`[PromoService] Bar promo dismissed: ${promo.id}`);
  }
  
  /**
   * Dismiss a popup promo
   */
  dismissPopupPromo(promo: PromotionConfig): void {
    const cooldownSeconds = promo.popup_cooldown_seconds ?? 86400; // Default 24 hours
    this.setCooldown(promo.id, 'popup', cooldownSeconds);
    
    // Update state
    this.popupPromoSubject.next(null);
    
    console.log(`[PromoService] Popup promo dismissed: ${promo.id}`);
  }
  
  /**
   * Dismiss a banner promo
   */
  dismissBannerPromo(promo: PromotionConfig): void {
    const cooldownSeconds = promo.banner_cooldown_seconds ?? 3600; // Default 1 hour
    this.setCooldown(promo.id, 'banner', cooldownSeconds);
    
    // Update banner list
    const currentBanners = this.bannerPromosSubject.value;
    const updatedBanners = currentBanners.filter(b => b.id !== promo.id);
    this.bannerPromosSubject.next(updatedBanners);
    
    console.log(`[PromoService] Banner promo dismissed: ${promo.id}`);
  }
  
  // ============================================================================
  // PUBLIC API
  // ============================================================================
  
  /**
   * Get all active promotions
   */
  getActivePromos(): Observable<PromotionConfig[]> {
    return this.allPromos$.pipe(
      distinctUntilChanged()
    );
  }
  
  /**
   * Get current bar promo
   */
  getPromoBar(): Observable<PromotionConfig | null> {
    return this.barPromo$.pipe(
      distinctUntilChanged()
    );
  }
  
  /**
   * Get current popup promo for route
   */
  getEligiblePopup(route?: string): Observable<PromotionConfig | null> {
    if (route) {
      const originalRoute = this.currentRoute;
      this.currentRoute = route;
      const promo = this.getEligiblePopupPromo(this.cachedPromos);
      this.currentRoute = originalRoute;
      return of(promo);
    }
    return this.popupPromo$.pipe(distinctUntilChanged());
  }
  
  /**
   * Get eligible banners for route
   */
  getEligibleBanners(route?: string, position?: BannerPosition): Observable<PromotionConfig[]> {
    return this.bannerPromos$.pipe(
      map(banners => {
        let filtered = banners;
        
        if (position) {
          filtered = filtered.filter(b => b.banner_position === position);
        }
        
        return filtered;
      }),
      distinctUntilChanged()
    );
  }
  
  /**
   * Manually trigger popup display check
   */
  checkPopupEligibility(): void {
    if (!this.popupShownThisPageLoad) {
      const popupPromo = this.getEligiblePopupPromo(this.cachedPromos);
      if (popupPromo) {
        this.popupPromoSubject.next(popupPromo);
        this.popupShownThisPageLoad = true;
      }
    }
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Convert cooldown seconds to human-readable format
   */
  formatCooldown(seconds: number): string {
    if (seconds <= 0) return 'No cooldown';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} seconds`;
  }
  
  /**
   * Get cooldown seconds from preset type
   */
  getCooldownSecondsFromType(type: CooldownType, customSeconds?: number): number {
    switch (type) {
      case 'once_session': return 0; // Handled by session storage
      case 'once_day': return 86400;
      case 'once_week': return 604800;
      case 'custom': return customSeconds ?? 3600;
      case 'never': return 0;
      default: return 3600;
    }
  }
}

