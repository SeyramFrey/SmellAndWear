import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Produit, Categorie, ProduitPhoto, Colors, ProduitVariation } from "../../core/models/models";
import { SectionTitleComponent } from "../../shared/components/section-title/section-title.component";
import { VideoHeroComponent } from "../../shared/components/video-hero/video-hero.component";
import { CategoryCardComponent } from "../../shared/components/category-card/category-card.component";
import { ProductCardComponent } from "../../shared/components/product-card/product-card.component";
import { ProduitService } from "../../core/services/produit.service";
import { CategorieService } from "../../core/services/categorie.service";
import { ProduitVariationService } from "../../core/services/produit-variation.service";
import { TopbarComponent } from "../../shared/landing/index/topbar/topbar.component";
import { SharedModule } from "../../shared/shared.module";
import { ButtonComponent } from "../../shared/components/button/button.component";
import { SupabaseService } from "../../core/services/supabase.service";
import { ImageService, IMAGE_SIZES } from "../../core/services/image.service";
import { LandingMediaService } from "../../core/services/landing-media.service";
import { catchError, finalize, map, switchMap, tap, takeUntil } from "rxjs/operators";
import { Observable, from, of, forkJoin, Subject } from "rxjs";
import { trigger, transition, style, animate } from "@angular/animations";
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductModalComponent } from '../../shared/components/product-modal/product-modal.component';
import {BannerPromoComponent} from "../../shared/landing/index/banner-promo/banner-promo.component";
import {PromoContainerComponent} from "../../shared/landing/index/promo-container/promo-container.component";

interface Category {
  id: string;
  name: string;
  image: string;
  link: string;
}

// Enhanced product with variants data
export interface ProductWithVariants extends Produit {
  variants?: ProduitVariation[];
  availableColors?: Colors[];
  defaultVariant?: ProduitVariation;
}

@Component({
  selector: 'app-wear-men',
  standalone: true,
    imports: [
        CommonModule,
        SectionTitleComponent,
        VideoHeroComponent,
        CategoryCardComponent,
        ProductCardComponent,
        TopbarComponent,
        SharedModule,
        ButtonComponent,
        BannerPromoComponent,
        PromoContainerComponent
    ],
  templateUrl: './wear-men.component.html',
  styleUrl: './wear-men.component.scss',
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class WearMenComponent implements OnInit, OnDestroy {
  categories: Category[] = [];

  newProducts: ProductWithVariants[] = [];
  bestSellers: ProductWithVariants[] = [];
  loading: boolean = true;
  error: string | null = null;

  // Media URLs
  heroBackgroundStyle: { [key: string]: string } = {};
  videoSource: string = '';

  private destroy$ = new Subject<void>();

  constructor(
    private produitService: ProduitService,
    private supabaseService: SupabaseService,
    private imageService: ImageService,
    private categorieService: CategorieService,
    private produitVariationService: ProduitVariationService,
    private modalService: NgbModal,
    private landingMediaService: LandingMediaService
  ) {}

  ngOnInit(): void {
    this.loadProductSections();
    this.loadCategories();
    this.loadMediaUrls();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadMediaUrls(): void {
    // Load hero section background
    this.landingMediaService.getBackgroundImageStyle('Wear Men Banniere', '/assets/images/landing/men-hero-bg.webp')
      .pipe(takeUntil(this.destroy$))
      .subscribe(style => {
        this.heroBackgroundStyle = style;
      });

    // Load video source
    this.landingMediaService.getVideoSource('Wear Men Video', '/assets/videos/men-collection.mp4')
      .pipe(takeUntil(this.destroy$))
      .subscribe(videoUrl => {
        this.videoSource = videoUrl;
      });
  }

  /**
   * Load categories from Supabase (only main categories, not subcategories)
   */
  private loadCategories(): void {
    this.categorieService.getCategories().pipe(
      map((supabaseCategories: Categorie[]) => {
        // Filter only main categories (where parent_id is null) and have a valid name
        const mainCategories = supabaseCategories.filter(cat => !cat.parent_id && cat.nom);
        
        // Transform Supabase categories to local Category interface
        return mainCategories.map((cat: Categorie): Category => ({
          id: cat.id,
          name: cat.nom!, // Use non-null assertion since we filtered for valid names
          image: this.getCategoryImageUrl(cat.image),
          link: `/sous-categories-men/${cat.id}`
        }));
      }),
      takeUntil(this.destroy$),
      catchError((error: any) => {
        console.error('Error loading categories:', error);
        // Return empty array on error, don't break the page
        return of([] as Category[]);
      })
    ).subscribe(
      (categories: Category[]) => {
        this.categories = categories;
        console.log('Categories loaded:', categories);
      },
      (error: any) => {
        console.error('Error in categories subscription:', error);
      }
    );
  }

  /**
   * Load both product sections efficiently using parallel queries
   */
  private loadProductSections(): void {
    this.loading = true;
    this.error = null;

    // Load both sections in parallel for better performance
    forkJoin({
      newArrivals: this.loadNewArrivals(),
      bestSellers: this.loadBestSellers()
    }).pipe(
      takeUntil(this.destroy$),
      finalize(() => {
        this.loading = false;
      }),
      catchError(error => {
        console.error('Error loading product sections:', error);
        this.error = 'Erreur lors du chargement des produits. Veuillez réessayer.';
        return of({ newArrivals: [], bestSellers: [] });
      })
    ).subscribe({
      next: ({ newArrivals, bestSellers }) => {
        this.newProducts = newArrivals;
        this.bestSellers = bestSellers;
      },
      error: (error) => {
        console.error('Subscription error:', error);
        this.error = 'Une erreur inattendue est survenue.';
      }
    });
  }

  /**
   * Load new arrivals - products marked as "is_new" in admin panel
   * Falls back to recent products if none are marked
   */
  private loadNewArrivals(): Observable<ProductWithVariants[]> {
    return from(
      this.supabaseService.getClient()
        .from('products_public')
        .select('*')
        .eq('is_new', true)
        .order('created_at', { ascending: false })
        .limit(8)
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching new arrivals:', error);
          throw error;
        }
        console.log('New arrivals (is_new=true) loaded:', data?.length || 0);
        return (data as Produit[]) || [];
      }),
      switchMap(products => {
        // If no products marked as new, fallback to recent products
        if (products.length === 0) {
          console.log('No products marked as new, falling back to recent products');
          return this.getFallbackNewProducts().pipe(
            map(fallbackProducts => fallbackProducts as Produit[])
          );
        }
        return of(products);
      }),
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
      catchError(error => {
        console.warn('New arrivals query failed, using fallback');
        return this.getFallbackNewProducts();
      })
    );
  }

  /**
   * Load best sellers using the is_best_seller boolean field in produit table
   * Optimized query directly from produit table
   */
  private loadBestSellers(): Observable<ProductWithVariants[]> {
    return from(
      this.supabaseService.getClient()
        .from('products_public')
        .select('*')
        .eq('is_best_seller', true)
        .order('created_at', { ascending: false })
        .limit(8)
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching best sellers:', error);
          throw error;
        }
        
        if (!data || data.length === 0) {
          console.warn('No best sellers found with is_best_seller = true');
          return [];
        }

        console.log('Best sellers loaded:', data.length);
        return data as Produit[];
      }),
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
      catchError(error => {
        console.warn('Best sellers query failed, using fallback');
        return this.getFallbackBestSellers();
      })
    );
  }

  /**
   * Fallback for new arrivals - get recent products from general product table
   */
  private getFallbackNewProducts(): Observable<ProductWithVariants[]> {
    return from(
      this.supabaseService.getClient()
        .from('products_public')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as Produit[]) || [];
      }),
      switchMap(products => {
        if (products.length === 0) {
          return of([]);
        }
        
        // Load variants for fallback products too
        const variantRequests = products.map(product =>
          this.produitVariationService.getVariationsByProduitId(product.id).pipe(
            map(variants => this.enhanceProductWithVariants(product, variants)),
            catchError(() => of(this.enhanceProductWithVariants(product, [])))
          )
        );

        return forkJoin(variantRequests);
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Fallback for best sellers - get first few products
   */
  private getFallbackBestSellers(): Observable<ProductWithVariants[]> {
    return from(
      this.supabaseService.getClient()
        .from('products_public')
        .select('*')
        .order('created_at', { ascending: false })
        .range(0, 5)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data as Produit[]) || [];
      }),
      switchMap(products => {
        if (products.length === 0) {
          return of([]);
        }
        
        // Load variants for fallback products too
        const variantRequests = products.map(product =>
          this.produitVariationService.getVariationsByProduitId(product.id).pipe(
            map(variants => this.enhanceProductWithVariants(product, variants)),
            catchError(() => of(this.enhanceProductWithVariants(product, [])))
          )
        );

        return forkJoin(variantRequests);
      }),
      catchError(() => of([]))
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
   * Refresh data method for error recovery
   */
  refreshData(): void {
    this.loadProductSections();
  }

  /**
   * Scroll to new arrivals section
   */
  scrollToNewArrivals(): void {
    const element = document.getElementById('newArrivals');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /**
   * Convert category image storage path to public URL
   */
  private getCategoryImageUrl(imagePath: string | null | undefined): string {
    return this.imageService.resolveImageUrl(
      imagePath ?? undefined,
      IMAGE_SIZES.PRODUCT_CARD,
      75,
      'public-images',
      '/assets/images/categories/default-category.jpg'
    );
  }

  /**
   * Scroll to top of page
   */
  topFunction(): void {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }
  
  /**
   * Open product modal
   */
  openProductModal(product: Produit): void {
    const modalRef = this.modalService.open(ProductModalComponent, {
      centered: true,
      size: 'lg',
      windowClass: 'product-modal-window'
    });
    
    modalRef.componentInstance.productId = product.id;
  }


  /**
   * Handle successful add to cart
   */
  onAddToCartSuccess(result: any): void {
    console.log('Product added to cart successfully:', result);
    // Could show toast notification or update cart counter
  }

  /**
   * Handle cart modal opening
   */
  onOpenCartModal(product: Produit): void {
    this.openProductModal(product);
  }

  /**
   * Check if we have new products to display
   */
  hasNewProducts(): boolean {
    return this.newProducts.length > 0;
  }

  /**
   * Check if we have best sellers to display
   */
  hasBestSellers(): boolean {
    return this.bestSellers.length > 0;
  }

  /**
   * Get loading state for new arrivals section
   */
  isNewArrivalsLoading(): boolean {
    return this.loading;
  }

  /**
   * Get loading state for best sellers section
   */
  isBestSellersLoading(): boolean {
    return this.loading;
  }
}
