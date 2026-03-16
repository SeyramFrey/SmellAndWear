import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, switchMap, map, catchError, finalize, tap } from 'rxjs/operators';

import { Produit, Colors, Taille, ProduitVariation, Categorie } from '../../core/models/models';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { TopbarComponent } from '../../shared/landing/index/topbar/topbar.component';
import { SharedModule } from '../../shared/shared.module';
import { ProductService } from '../../core/services/product.service';
import { ProduitVariationService } from '../../core/services/produit-variation.service';
import { CategorieService } from '../../core/services/categorie.service';

// Enhanced product with variants data
export interface ProductWithVariants extends Produit {
    variants?: ProduitVariation[];
    availableColors?: Colors[];
    defaultVariant?: ProduitVariation;
}

@Component({
  selector: 'app-s-c-products',
  standalone: true,
  imports: [
    CommonModule,
    ProductCardComponent,
    TopbarComponent,
    SharedModule
  ],
  templateUrl: './s-c-products.component.html',
  styleUrl: './s-c-products.component.scss'
})
export class SCProductsComponent implements OnInit, OnDestroy {
  subcategoryId: string = '';
  subcategory: Categorie | null = null;
  products: ProductWithVariants[] = [];
  loading: boolean = true;
  error: string | null = null;
  heroImageUrl: string = '/assets/images/categories/default-hero.jpg';
  
  // Animation states
  titleAnimated: boolean = false;
  showContent: boolean = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private produitService: ProductService,
    private variationService: ProduitVariationService,
    private categorieService: CategorieService
  ) {}

  ngOnInit() {
    this.route.params.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      this.subcategoryId = params['id'];
      if (this.subcategoryId) {
        this.loadSubcategoryData();
      } else {
        this.error = 'ID de sous-catégorie manquant';
        this.loading = false;
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSubcategoryData() {
    this.loading = true;
    this.error = null;

    // Load subcategory info and products in parallel
    forkJoin({
      subcategory: this.categorieService.getCategorieById(this.subcategoryId),
      products: this.loadProductsForSubcategory()
    }).pipe(
      finalize(() => {
        this.loading = false;
      }),
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading subcategory data:', error);
        this.error = error.message || 'Erreur lors du chargement des données';
        return of({ subcategory: null, products: [] });
      })
    ).subscribe(({ subcategory, products }) => {
      this.subcategory = subcategory;
      this.products = products;
      
      if (subcategory) {
        // Set the hero image URL - use direct path like in sous-categories component
        this.heroImageUrl = subcategory.image || '/assets/images/categories/default-hero.jpg';
        // Start title animation after data loads
        this.startTitleAnimation();
      }
    });
  }

  private loadProductsForSubcategory() {
    return this.produitService.getProduitsByCategoriePublic(this.subcategoryId).pipe(
      // Load variants for each product
      switchMap(products => {
        if (products.length === 0) {
          return of([]);
        }

        const variantRequests = products.map(product =>
          this.variationService.getVariationsByProduitId(product.id).pipe(
            map(variants => this.enhanceProductWithVariants(product, variants)),
            catchError(error => {
              console.warn(`Failed to load variants for product ${product.id}:`, error);
              return of(this.enhanceProductWithVariants(product, []));
            })
          )
        );
        return forkJoin(variantRequests);
      })
    );
  }

  /**
   * Enhance product with variant data for efficient rendering
   */
  private enhanceProductWithVariants(product: Produit, variants: ProduitVariation[]): ProductWithVariants {
    // Extract unique colors from variants
    const colorMap = new Map<number, Colors>();
    variants.forEach(variant => {
      if (variant.colors && variant.colors.id) {
        colorMap.set(variant.colors.id, variant.colors);
      }
    });

    // Find default variant (primary or first available)
    const defaultVariant = variants.find(v => v.is_primary) || variants[0] || null;

    return {
      ...product,
      variants,
      availableColors: Array.from(colorMap.values()),
      defaultVariant
    };
  }

  /**
   * Start the title animation sequence
   */
  private startTitleAnimation() {
    // Start title drip animation
    setTimeout(() => {
      this.titleAnimated = true;
    }, 300);

    // Show content after title animation completes
    setTimeout(() => {
      this.showContent = true;
    }, 2000);
  }

  /**
   * Handle product click navigation
   */
  onProductClick(product: Produit | any) {
    // Handle both Produit and ProduitPhoto types
    const productId = 'produit_id' in product ? product.produit_id : product.id;
    
    this.router.navigate(['/product-detail', productId]).then(() => {
      // Force scroll to top after navigation as additional fallback
      setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }, 100);
    });
  }

  /**
   * Handle add to cart success
   */
  onAddToCartSuccess(result: any) {
    console.log('Product added to cart successfully:', result);
    // You can show a toast notification here
  }

  /**
   * Navigate back to subcategories
   */
  goBack() {
    this.router.navigate(['/sous-categories-men']);
  }

  /**
   * Scroll to top
   */
  topFunction() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }

  /**
   * TrackBy function for products performance
   */
  trackByProduct(index: number, item: ProductWithVariants): string {
    return item.id;
  }

  /**
   * Handle image load error
   */
  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = '/assets/images/categories/default-hero.jpg';
  }
}
