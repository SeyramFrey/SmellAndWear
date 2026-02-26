import { Injectable } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ScrollService {

  constructor(
    private viewportScroller: ViewportScroller,
    private router: Router
  ) {
    // Listen to route changes and scroll to top for specific routes
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event) => {
      // Scroll to top for product detail pages
      if (event.url.includes('/product-detail/')) {
        this.scrollToTop();
      }
    });
  }

  /**
   * Scroll to the top of the page using Angular best practices
   */
  scrollToTop(): void {
    this.viewportScroller.scrollToPosition([0, 0]);
  }

  /**
   * Scroll to a specific element by ID
   */
  scrollToElement(elementId: string): void {
    this.viewportScroller.scrollToAnchor(elementId);
  }

  /**
   * Scroll to a specific position
   */
  scrollToPosition(x: number, y: number): void {
    this.viewportScroller.scrollToPosition([x, y]);
  }

  /**
   * Get current scroll position
   */
  getScrollPosition(): [number, number] {
    return this.viewportScroller.getScrollPosition();
  }
}
