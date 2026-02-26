import { Injectable, Inject, OnDestroy } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BehaviorSubject, Observable, fromEvent, Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'sw_theme';
const SCROLL_THRESHOLD = 20;

/**
 * ThemeService - Centralized theme and scroll state management
 * 
 * Features:
 * - Dark/Light mode toggle with persistence
 * - OS preference detection on first visit
 * - Scroll state tracking for dynamic UI updates
 * - CSS variable-based theming
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService implements OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Theme state
  private themeModeSubject = new BehaviorSubject<ThemeMode>('light');
  public readonly themeMode$: Observable<ThemeMode> = this.themeModeSubject.asObservable();
  
  // Scroll state
  private isScrolledSubject = new BehaviorSubject<boolean>(false);
  public readonly isScrolled$: Observable<boolean> = this.isScrolledSubject.asObservable();
  
  // Derived observables
  public readonly isDarkMode$: Observable<boolean> = this.themeMode$.pipe(
    map(mode => mode === 'dark')
  );

  constructor(@Inject(DOCUMENT) private document: Document) {
    this.initializeTheme();
    this.initializeScrollListener();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize theme from storage or OS preference
   */
  private initializeTheme(): void {
    const storedTheme = this.getStoredTheme();
    
    if (storedTheme) {
      this.setTheme(storedTheme, false);
    } else {
      // Check OS preference
      const prefersDark = this.getOSThemePreference();
      this.setTheme(prefersDark ? 'dark' : 'light', false);
    }
    
    // Listen for OS theme changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      fromEvent<MediaQueryListEvent>(mediaQuery, 'change').pipe(
        takeUntil(this.destroy$)
      ).subscribe(event => {
        // Only update if user hasn't manually set a preference
        if (!this.getStoredTheme()) {
          this.setTheme(event.matches ? 'dark' : 'light', false);
        }
      });
    }
  }

  /**
   * Initialize scroll listener for scroll state tracking
   */
  private initializeScrollListener(): void {
    if (typeof window !== 'undefined') {
      fromEvent(window, 'scroll').pipe(
        takeUntil(this.destroy$),
        debounceTime(10),
        map(() => {
          const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
          return scrollTop > SCROLL_THRESHOLD;
        }),
        distinctUntilChanged()
      ).subscribe(isScrolled => {
        this.isScrolledSubject.next(isScrolled);
      });
    }
  }

  /**
   * Get stored theme from localStorage
   */
  private getStoredTheme(): ThemeMode | null {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    }
    return null;
  }

  /**
   * Get OS theme preference
   */
  private getOSThemePreference(): boolean {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  }

  /**
   * Set theme and optionally persist
   */
  setTheme(mode: ThemeMode, persist: boolean = true): void {
    this.themeModeSubject.next(mode);
    this.applyThemeToDocument(mode);
    
    if (persist && typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    }
  }

  /**
   * Toggle between light and dark mode
   */
  toggleTheme(): void {
    const currentMode = this.themeModeSubject.value;
    const newMode: ThemeMode = currentMode === 'light' ? 'dark' : 'light';
    this.setTheme(newMode);
  }

  /**
   * Apply theme to document
   */
  private applyThemeToDocument(mode: ThemeMode): void {
    const html = this.document.documentElement;
    
    // Set Bootstrap theme attribute
    html.setAttribute('data-bs-theme', mode);
    
    // Set custom theme attribute for additional styling
    html.setAttribute('data-sw-theme', mode);
    
    // Toggle body class
    if (mode === 'dark') {
      this.document.body.classList.add('dark-mode');
      this.document.body.classList.remove('light-mode');
    } else {
      this.document.body.classList.add('light-mode');
      this.document.body.classList.remove('dark-mode');
    }
    
    console.log('[ThemeService] Theme applied:', mode);
  }

  /**
   * Get current theme mode synchronously
   */
  getCurrentTheme(): ThemeMode {
    return this.themeModeSubject.value;
  }

  /**
   * Get current scroll state synchronously
   */
  getIsScrolled(): boolean {
    return this.isScrolledSubject.value;
  }

  /**
   * Check if dark mode is active
   */
  isDarkMode(): boolean {
    return this.themeModeSubject.value === 'dark';
  }

  /**
   * Reset theme preference (revert to OS preference)
   */
  resetThemePreference(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
    
    const prefersDark = this.getOSThemePreference();
    this.setTheme(prefersDark ? 'dark' : 'light', false);
  }
}

