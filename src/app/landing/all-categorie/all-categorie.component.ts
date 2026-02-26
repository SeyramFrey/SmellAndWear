import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Produit, Colors, ProduitVariation, Categorie, ProduitPhoto } from '../../core/models/models';
import { VideoHeroComponent } from '../../shared/components/video-hero/video-hero.component';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { TopbarComponent } from '../../shared/landing/index/topbar/topbar.component';
import { ProduitService } from '../../core/services/produit.service';
import { ProduitVariationService } from '../../core/services/produit-variation.service';
import { CategorieService } from '../../core/services/categorie.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from "../../shared/shared.module";
import { EMPTY, finalize, of, forkJoin, Subject } from "rxjs";
import { Router, ActivatedRoute } from "@angular/router";
import { catchError, tap, map, takeUntil, switchMap } from "rxjs/operators";
import { LandingMediaService } from '../../core/services/landing-media.service';

// Enhanced product with variants data
export interface ProductWithVariants extends Produit {
    variants?: ProduitVariation[];
    availableColors?: Colors[];
    defaultVariant?: ProduitVariation;
}

@Component({
  selector: 'app-all-categorie',
  standalone: true,
  imports: [
    CommonModule,
    VideoHeroComponent,
    ProductCardComponent,
    TopbarComponent,
    SharedModule
  ],
  templateUrl: './all-categorie.component.html',
  styleUrl: './all-categorie.component.scss'
})
export class AllCategorieComponent implements OnInit, OnDestroy {
    products: ProductWithVariants[] = [];
    loading: boolean = true;
    error: string | null = null;

    // Category data
    categoryId: string = '';
    categoryName: string = '';

    // Media URLs
    videoSource: string = '';

    private destroy$ = new Subject<void>();

    constructor(
        private produitService: ProduitService,
        private variationService: ProduitVariationService,
        private categorieService: CategorieService,
        private modalService: NgbModal,
        private router: Router,
        private route: ActivatedRoute,
        private landingMediaService: LandingMediaService
    ) {}

    ngOnInit() {
        // Load media URLs
        this.loadMediaUrls();
        
        // Get category ID from route parameter
        this.route.params.pipe(
            takeUntil(this.destroy$)
        ).subscribe(params => {
            this.categoryId = params['categoryId'];
            console.log('Category ID from route:', this.categoryId);
            
            if (this.categoryId) {
                this.loadCategoryProducts();
            } else {
                this.error = 'ID de catégorie manquant';
                this.loading = false;
            }
        });
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadMediaUrls(): void {
        // Load video source for all categories
        this.landingMediaService.getVideoSource('All Categorie Video', '/assets/videos/tshirts-hero.mp4')
            .pipe(takeUntil(this.destroy$))
            .subscribe(videoUrl => {
                this.videoSource = videoUrl;
            });
    }

    /**
     * Load all products from all subcategories of the selected category
     */
    loadCategoryProducts() {
        this.loading = true;
        this.error = null;

        // First, get the category details
        this.categorieService.getCategorieById(this.categoryId).pipe(
            tap(category => {
                this.categoryName = category.nom || '';
                console.log('Loaded category:', category);
            }),
            // Then get all subcategories
            switchMap(() => this.categorieService.getSubcategoriesByParentId(this.categoryId)),
            tap(subcategories => {
                console.log('Loaded subcategories:', subcategories);
            }),
            // Load all products from all subcategories
            switchMap(subcategories => {
                if (subcategories.length === 0) {
                    return of([]);
                }

                // Create requests to load products from each subcategory
                const productRequests = subcategories.map(subcategory =>
                    this.produitService.getProduitsByCategoriePublic(subcategory.id).pipe(
                        catchError(error => {
                            console.warn(`Failed to load products for subcategory ${subcategory.nom}:`, error);
                            return of([]);
                        })
                    )
                );

                return forkJoin(productRequests).pipe(
                    // Flatten the array of arrays into a single array
                    map(productsArrays => productsArrays.flat())
                );
            }),
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
            }),
            finalize(() => {
                this.loading = false;
            }),
            takeUntil(this.destroy$),
            catchError(error => {
                console.error('Error loading category products:', error);
                this.error = error.message;
                return of([]);
            })
        ).subscribe((products: ProductWithVariants[]) => {
            this.products = products;
            console.log('Loaded products:', products);
        });
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

    topFunction() {
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    }

    onProductClick(product: Produit | ProduitPhoto) {
        // Navigate to product detail page
        const productId = 'produit_id' in product ? product.produit_id : product.id;
        
        this.router.navigate(['/product-detail', productId]).then(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        });
    }

    onAddToCartSuccess(result: any) {
        console.log('Product added to cart successfully:', result);
        // You can show a toast notification here
    }

    /**
     * TrackBy function for products for performance  
     */
    trackByProduct(index: number, item: ProductWithVariants): string {
        return item.id;
    }

    /**
     * Open filter modal (to be implemented)
     */
    openFilterModal() {
        console.log('Filter button clicked - to be implemented');
        // TODO: Implement filter functionality
    }
}
