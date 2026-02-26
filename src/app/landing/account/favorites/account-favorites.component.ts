import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { FavoritesService, FavoriteItem } from '../../../core/services/favorites.service';
import { ImageService, IMAGE_SIZES } from '../../../core/services/image.service';

/**
 * Account Favorites Component
 * 
 * Displays the user's favorite products in a modern, responsive grid layout.
 * Features:
 * - Full viewport height layout
 * - Responsive grid (1-4 columns based on screen size)
 * - Empty state with CTA
 * - Dynamic back navigation
 * - Remove/unfavorite functionality
 */
@Component({
  selector: 'app-account-favorites',
  templateUrl: './account-favorites.component.html',
  styleUrls: ['./account-favorites.component.scss']
})
export class AccountFavoritesComponent implements OnInit, OnDestroy {
  favorites: FavoriteItem[] = [];
  loading: boolean = true;

  private destroy$ = new Subject<void>();

  constructor(
    private favoritesService: FavoritesService,
    private imageService: ImageService,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.loadFavorites();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load favorites from service
   */
  private loadFavorites(): void {
    this.favoritesService.getFavoritesWithProducts().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (favorites) => {
        this.favorites = favorites;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  /**
   * Remove product from favorites
   */
  async removeFavorite(event: Event, productId: string, productName?: string): Promise<void> {
    event.stopPropagation();
    event.preventDefault();
    await this.favoritesService.removeFromFavorites(productId, productName);
  }

  /**
   * Navigate to product detail page
   */
  navigateToProduct(productId: string): void {
    this.router.navigate(['/product-detail', productId]);
  }

  /**
   * Go back to previous page dynamically
   * Falls back to /account if no history exists
   */
  goBack(): void {
    // Check if there's navigation history
    if (window.history.length > 1) {
      this.location.back();
    } else {
      // Fallback to account dashboard
      this.router.navigate(['/account']);
    }
  }

  /**
   * Get public URL for image
   */
  getImageUrl(imagePath?: string): string {
    return this.imageService.resolveImageUrl(
      imagePath,
      IMAGE_SIZES.PRODUCT_CARD,
      75,
      'public-images',
      '/assets/images/products/placeholder.jpg'
    );
  }

  /**
   * TrackBy function for ngFor optimization
   */
  trackByProductId(index: number, item: FavoriteItem): string {
    return item.produit_id;
  }
}
