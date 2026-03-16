import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductService } from '../../core/services/product.service';
import { ProduitVariationService } from '../../core/services/produit-variation.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Produit, ProduitVariation, Colors } from '../../core/models/models';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { TopbarComponent } from '../../shared/landing/index/topbar/topbar.component';
import { SharedModule } from '../../shared/shared.module';
import { from, of, forkJoin } from 'rxjs';
import { map, switchMap, catchError, finalize } from 'rxjs/operators';

// Enhanced product interface
export interface ProductWithVariants extends Produit {
  variants?: ProduitVariation[];
  availableColors?: Colors[];
  defaultVariant?: ProduitVariation;
}

@Component({
  selector: 'app-bestsellers',
  standalone: true,
  imports: [CommonModule, ProductCardComponent, TopbarComponent, SharedModule],
  templateUrl: './bestsellers.component.html',
  styleUrl: './bestsellers.component.scss'
})
export class BestsellersComponent implements OnInit {
  products: ProductWithVariants[] = [];
  loading: boolean = true;
  error: string | null = null;

  constructor(
    private produitService: ProductService,
    private produitVariationService: ProduitVariationService,
    private supabaseService: SupabaseService
  ) {}

  ngOnInit(): void {
    this.loadBestsellers();
  }

  loadBestsellers(): void {
    this.loading = true;
    this.error = null;

    this.produitService.getBestsellersPublic().pipe(
      switchMap(products => {
        if (products.length === 0) {
          return of([]);
        }

        // Load variants for each product
        const variantRequests = products.map(product =>
          this.produitVariationService.getVariationsByProduitId(product.id).pipe(
            map(variants => this.enhanceProductWithVariants(product, variants)),
            catchError(() => of(this.enhanceProductWithVariants(product, [])))
          )
        );

        return forkJoin(variantRequests);
      }),
      finalize(() => {
        this.loading = false;
      }),
      catchError(error => {
        console.error('Error loading bestsellers:', error);
        this.error = 'Failed to load bestsellers';
        return of([]);
      })
    ).subscribe({
      next: (products) => {
        this.products = products;
        console.log('Enhanced bestsellers ready for display:', products.length);
      },
      error: (error) => {
        console.error('Subscription error:', error);
      }
    });
  }

  /**
   * Enhance product with variant data
   */
  private enhanceProductWithVariants(product: Produit, variants: ProduitVariation[]): ProductWithVariants {
    const colorMap = new Map<number, Colors>();
    variants.forEach(variant => {
      if (variant.colors && variant.colors.id) {
        colorMap.set(variant.colors.id, variant.colors);
      }
    });

    const defaultVariant = variants.find(v => v.is_primary) || variants[0] || null;

    return {
      ...product,
      variants,
      availableColors: Array.from(colorMap.values()),
      defaultVariant
    };
  }

  /**
   * Scroll to top when button clicked
   */
  topFunction(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Track products by ID for better performance
   */
  trackByProduct(index: number, product: Produit): string {
    return product.id;
  }
}
