import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { FavoritesService, FavoriteItem } from '../../../core/services/favorites.service';
import { Produit, ProduitPhoto } from '../../../core/models/models';

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

  /** Returns only favorites that have resolved product data */
  get validFavorites(): FavoriteItem[] {
    return this.favorites.filter(f => !!f.product);
  }

  /** Load favorites from service */
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

  /** Navigate to product detail page */
  onProductClick(product: Produit | ProduitPhoto): void {
    const productId = 'produit_id' in product ? product.produit_id : product.id;
    this.router.navigate(['/product-detail', productId]).then(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    });
  }

  /** Called when add-to-cart succeeds inside the product card modal */
  onAddToCartSuccess(result: unknown): void {
    // Toast or feedback is handled inside CartService / ProductModalComponent
    console.log('Product added to cart from favorites:', result);
  }

  /**
   * Go back to previous page dynamically.
   * Falls back to /account if no history exists.
   */
  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/account']);
    }
  }

  /** TrackBy function for ngFor */
  trackByProductId(index: number, item: FavoriteItem): string {
    return item.produit_id;
  }
}
