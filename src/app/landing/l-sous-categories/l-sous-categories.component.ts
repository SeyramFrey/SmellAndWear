import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Produit, Colors, Taille, ProduitPhoto, ProduitVariation, Categorie } from '../../core/models/models';
import { VideoHeroComponent } from '../../shared/components/video-hero/video-hero.component';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { TopbarComponent } from '../../shared/landing/index/topbar/topbar.component';
import { ProductService } from '../../core/services/product.service';
import { ProduitVariationService } from '../../core/services/produit-variation.service';
import { CategorieService } from '../../core/services/categorie.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from "../../shared/shared.module";
import {EMPTY, finalize, of, forkJoin, Subject, Observable} from "rxjs";
import { Router, ActivatedRoute } from "@angular/router";
import { catchError, tap, map, takeUntil, switchMap } from "rxjs/operators";
import { ProductModalComponent } from '../../shared/components/product-modal/product-modal.component';
import { CurrencyConverterPipe } from '../../shared/pipes/currency-converter.pipe';
import { LandingMediaService } from '../../core/services/landing-media.service';

// Enhanced product with variants data
export interface ProductWithVariants extends Produit {
    variants?: ProduitVariation[];
    availableColors?: Colors[];
    defaultVariant?: ProduitVariation;
}

// Subcategory with its products
export interface SubcategoryWithProducts {
    subcategory: Categorie;
    products: ProductWithVariants[];
}

@Component({
    selector: 'app-tshirts-men',
    standalone: true,
    imports: [
        CommonModule,
        VideoHeroComponent,
        ProductCardComponent,
        TopbarComponent,
        SharedModule
    ],
    templateUrl: './l-sous-categories.component.html',
    styleUrl: './l-sous-categories.component.scss'
})
export class LSousCategoriesComponent {
    subcategoriesWithProducts: SubcategoryWithProducts[] = [];
    loading: boolean = true;
    error: string | null = null;

    // Category ID from route parameter
    categoryId: string = '';
    categoryName: string = '';

    selectedSize: string = '';
    selectedColor: string = '';
    quantity: number = 1;

    // Media URLs
    videoSource: string = '';

    private destroy$ = new Subject<void>();

    constructor(
        private produitService: ProductService,
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
                this.loadSubcategoriesWithProducts();
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
        // Load video source
        this.landingMediaService.getVideoSource('Sous Categorie Men Video', '/assets/videos/tshirts-hero.mp4')
            .pipe(takeUntil(this.destroy$))
            .subscribe(videoUrl => {
                this.videoSource = videoUrl;
            });
    }

    loadSubcategoriesWithProducts() {
        this.loading = true;
        this.error = null;

        // First, get the category name
        this.categorieService.getCategorieById(this.categoryId).pipe(
            tap(category => {
                this.categoryName = category.nom || '';
                console.log('Loaded category:', category);
            }),
            // Then get all subcategories of the selected category
            switchMap(() => this.categorieService.getSubcategoriesByParentId(this.categoryId)),
            tap(subcategories => {
                console.log('Loaded subcategories:', subcategories);
            }),
            // For each subcategory, load its products (limit to 4 per subcategory)
            switchMap(subcategories => {
                if (subcategories.length === 0) {
                    return of([]);
                }

                const subcategoryRequests = subcategories.map(subcategory =>
                    this.loadProductsForSubcategory(subcategory).pipe(
                        map(products => ({
                            subcategory,
                            products
                        } as SubcategoryWithProducts)),
                        catchError(error => {
                            console.warn(`Failed to load products for subcategory ${subcategory.nom}:`, error);
                            return of({
                                subcategory,
                                products: []
                            } as SubcategoryWithProducts);
                        })
                    )
                );
                return forkJoin(subcategoryRequests);
            }),
            finalize(() => {
                this.loading = false;
            }),
            takeUntil(this.destroy$),
            catchError(error => {
                console.error('Error loading subcategories with products:', error);
                this.error = error.message;
                return of([]);
            })
        ).subscribe((subcategoriesWithProducts: SubcategoryWithProducts[]) => {
            this.subcategoriesWithProducts = subcategoriesWithProducts;
            console.log('Loaded subcategories with products:', subcategoriesWithProducts);
        });
    }

    private loadProductsForSubcategory(subcategory: Categorie): Observable<ProductWithVariants[]> {
        return this.produitService.getProduitsByCategorie(subcategory.id).pipe(
            // Limit to 4 products per subcategory
            map(products => products.slice(0, 4)),
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

    topFunction() {
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;
    }

    onProductClick(product: Produit | ProduitPhoto) {
        // Navigate to product detail page
        const productId = 'produit_id' in product ? product.produit_id : product.id;
        
        this.router.navigate(['/product-detail', productId]).then(() => {

        });
    }

    onAddToCartSuccess(result: any) {
        console.log('Product added to cart successfully:', result);
        // You can show a toast notification here
    }

    /**
     * Navigate to see all products in a subcategory
     */
    navigateToSubcategoryProducts(subcategoryId: string) {
        this.router.navigate(['/subcategory-products', subcategoryId]);
    }

    /**
     * Navigate to see all products in the category
     */
    navigateToAllCategory() {
        this.router.navigate(['/all-categorie', this.categoryId]);
    }

    /**
     * TrackBy function for subcategories for performance
     */
    trackBySubcategory(index: number, item: SubcategoryWithProducts): string {
        return item.subcategory.id;
    }

    /**
     * TrackBy function for products for performance  
     */
    trackByProduct(index: number, item: ProductWithVariants): string {
        return item.id;
    }
}
