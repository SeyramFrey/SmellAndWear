import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SlickCarouselComponent } from 'ngx-slick-carousel';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Services
import { ProductService } from 'src/app/core/services/product.service';
import { VariantService } from 'src/app/core/services/variant.service';
import { SupabaseService } from 'src/app/core/services/supabase.service';
import { ImageService, IMAGE_SIZES } from 'src/app/core/services/image.service';

// Models
import { Colors, Produit, Taille, Variant } from 'src/app/core/models/models';


@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  // Bread crumb items
  breadCrumbItems!: Array<{}>;
  
  // Data properties
  product: Produit | null = null;
  variants: Variant[] = [];
  photos: string[] = []; // Now just storing photo URLs directly
  sizes: Taille[] = [];
  colors: Colors[] = [];
  selectedVariant: Variant | null = null;
  
  // Component state
  loading = false;
  error: string | null = null;
  productId: string = '';
  variantId: string = '';
  defaultSelect = 2;
  readonly = false;
  
  private destroy$ = new Subject<void>();

  @ViewChild('slickModal') slickModal!: SlickCarouselComponent;

  constructor(
    private route: ActivatedRoute,
    private produitService: ProductService,
    private variantService: VariantService,
    private supabaseService: SupabaseService,
    private imageService: ImageService
  ) {}

  ngOnInit(): void {
    // BreadCrumb
    this.breadCrumbItems = [
      { label: 'Ecommerce' },
      { label: 'Product Details', active: true }
    ];

    // Get parameters from route
    this.route.paramMap.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      this.productId = params.get('produitId') || '';
      this.variantId = params.get('variantId') || '';
      
      if (this.variantId) {
        // Load specific variant details
        this.loadVariantData();
      } else if (this.productId) {
        // Load product with all variants (existing behavior)
        this.loadProductData();
      } else {
        this.error = 'ID de produit manquant';
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load specific variant data when variantId is provided
   */
  private async loadVariantData(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      // Load the specific variant first
      await this.loadSpecificVariant();
      
      // Load the associated product
      if (this.selectedVariant?.produit_id) {
        this.productId = this.selectedVariant.produit_id;
        await this.loadProduct();
      }
      
      // Load all variants for this product to build size/color options
      await this.loadVariants();
      
      // Extract photos prioritizing the selected variant
      this.extractPhotosWithVariantPriority();
      
      // Extract unique sizes and colors from variants
      this.extractSizesAndColors();
      
    } catch (error) {
      console.error('Error loading variant data:', error);
      this.error = 'Erreur lors du chargement de la variante';
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load product data (existing behavior)
   */
  private async loadProductData(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      // Load product details
      await this.loadProduct();
      
      // Load variants and related data
      await this.loadVariants();
      
      // Extract photos from product and variants
      this.extractPhotos();
      
      // Extract unique sizes and colors from variants
      this.extractSizesAndColors();
      
      // Set default selected variant
      this.setDefaultVariant();
      
    } catch (error) {
      console.error('Error loading product data:', error);
      this.error = 'Erreur lors du chargement du produit';
    } finally {
      this.loading = false;
    }
  }

  /**
   * Load specific variant by ID
   */
  private async loadSpecificVariant(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.variantService.getVariantById(this.variantId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (variant) => {
            this.selectedVariant = variant;
            resolve();
          },
          error: (error) => {
            reject(error);
          }
        });
    });
  }

  private async loadProduct(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.produitService.getProduitById(this.productId)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (product) => {
            this.product = product;
            resolve();
          },
          error: (error) => {
            reject(error);
          }
        });
    });
  }

  private async loadVariants(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.supabaseService.getClient()
        .from('variant')
        .select(`
          *,
          taille:taille_id(id, libelle),
          colors:couleur_id(id, nom, hex)
        `)
        .eq('produit_id', this.productId)
        .order('is_primary', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            reject(error);
          } else {
            // Transform the data to match our interface
            this.variants = (data || []).map((variant: any) => ({
              ...variant,
              // Ensure proper data mapping from Supabase response
              taille: variant.taille ? {
                id: variant.taille.id,
                libelle: variant.taille.libelle
              } : undefined,
              colors: variant.colors ? {
                id: variant.colors.id,
                nom: variant.colors.nom,
                hex: variant.colors.hex
              } : undefined
            }));
            
            // If we loaded variants but don't have a selected one, ensure it's still selected
            if (this.variantId && this.selectedVariant) {
              const updatedSelectedVariant = this.variants.find(v => v.id === this.selectedVariant?.id);
              if (updatedSelectedVariant) {
                this.selectedVariant = updatedSelectedVariant;
              }
            }
            
            resolve();
          }
        });
    });
  }

  /**
   * Extract photos with priority for selected variant
   */
  private extractPhotosWithVariantPriority(): void {
    const photoSet = new Set<string>();
    
    // Add selected variant photos first (priority)
    if (this.selectedVariant) {
      this.addVariantPhotos(this.selectedVariant, photoSet);
    }
    
    // Add product photos
    if (this.product?.front_photo_path) {
      photoSet.add(this.getPhotoUrl(this.product.front_photo_path));
    }
    if (this.product?.back_photo_path) {
      photoSet.add(this.getPhotoUrl(this.product.back_photo_path));
    }
    
    // Add other variant photos
    this.variants.forEach(variant => {
      if (variant.id !== this.selectedVariant?.id) {
        this.addVariantPhotos(variant, photoSet);
      }
    });
    
    this.photos = Array.from(photoSet);
    
    // Fallback to default image if no photos found
    if (this.photos.length === 0) {
      this.photos = ['assets/images/products/img-1.png'];
    }
  }

  /**
   * Extract photos (existing behavior)
   */
  private extractPhotos(): void {
    const photoSet = new Set<string>();
    
    // Add product photos
    if (this.product?.front_photo_path) {
      photoSet.add(this.getPhotoUrl(this.product.front_photo_path));
    }
    if (this.product?.back_photo_path) {
      photoSet.add(this.getPhotoUrl(this.product.back_photo_path));
    }
    
    // Add variant photos
    this.variants.forEach(variant => {
      this.addVariantPhotos(variant, photoSet);
    });
    
    this.photos = Array.from(photoSet);
    
    // Fallback to default image if no photos found
    if (this.photos.length === 0) {
      this.photos = ['assets/images/products/img-1.png'];
    }
  }

  /**
   * Helper method to add variant photos to a set
   */
  private addVariantPhotos(variant: Variant, photoSet: Set<string>): void {
    if (variant.main_photo_path && Array.isArray(variant.main_photo_path)) {
      variant.main_photo_path.forEach(path => {
        if (path) photoSet.add(this.getPhotoUrl(path));
      });
    }
    if (variant.others_photos && Array.isArray(variant.others_photos)) {
      variant.others_photos.forEach(path => {
        if (path) photoSet.add(this.getPhotoUrl(path));
      });
    }
  }

  private extractSizesAndColors(): void {
    // Extract unique sizes
    const sizeMap = new Map<string, Taille>();
    this.variants.forEach(variant => {
      if (variant.taille && variant.taille.id && variant.taille.libelle) {
        sizeMap.set(variant.taille.id, {
          id: variant.taille.id,
          libelle: variant.taille.libelle
        });
      }
    });
    this.sizes = Array.from(sizeMap.values()).sort((a, b) => {
      // Sort sizes: XS, S, M, L, XL, XXL
      const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
      const aIndex = sizeOrder.indexOf(a.libelle);
      const bIndex = sizeOrder.indexOf(b.libelle);
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      return a.libelle.localeCompare(b.libelle);
    });

    // Extract unique colors
    const colorMap = new Map<number, Colors>();
    this.variants.forEach(variant => {
      if (variant.colors && variant.colors.id && variant.colors.nom) {
        colorMap.set(variant.colors.id, {
          id: variant.colors.id,
          nom: variant.colors.nom,
          hex: variant.colors.hex || '#000000'
        });
      }
    });
    this.colors = Array.from(colorMap.values()).sort((a, b) => {
      const nameA = a.nom || '';
      const nameB = b.nom || '';
      return nameA.localeCompare(nameB);
    });
  }

  private setDefaultVariant(): void {
    // Set primary variant as default, or first available variant
    this.selectedVariant = this.variants.find(v => v.is_primary) || this.variants[0] || null;
  }

  // Get photos for current variant
  getVariantPhotos(): string[] {
    if (!this.selectedVariant) return this.photos;
    
    const variantPhotos: string[] = [];
    
    // Add main photos
    if (this.selectedVariant.main_photo_path && Array.isArray(this.selectedVariant.main_photo_path)) {
      this.selectedVariant.main_photo_path.forEach(path => {
        if (path) variantPhotos.push(this.getPhotoUrl(path));
      });
    }
    
    // Add other photos
    if (this.selectedVariant.others_photos && Array.isArray(this.selectedVariant.others_photos)) {
      this.selectedVariant.others_photos.forEach(path => {
        if (path) variantPhotos.push(this.getPhotoUrl(path));
      });
    }
    
    return variantPhotos.length > 0 ? variantPhotos : this.photos;
  }

  // Get all product images for display
  getAllProductImages(): string[] {
    const variantPhotos = this.getVariantPhotos();
    return variantPhotos.length > 0 ? variantPhotos : this.photos;
  }

  // Helper method to get photo URL from path
  private getPhotoUrl(path: string): string {
    const bucket = (path.includes('produits/') || path.includes('variants/') || path.includes('categories/'))
      ? 'public-images'
      : (!path.includes('/') ? 'products' : 'public-images');
    return this.imageService.resolveImageUrl(
      path,
      IMAGE_SIZES.ADMIN_PREVIEW,
      75,
      bucket,
      'assets/images/products/img-1.png'
    );
  }

  // Select variant based on size and color
  selectVariant(sizeId?: string, colorId?: number): void {
    const variant = this.variants.find(v => 
      (!sizeId || v.taille_id === sizeId) && 
      (!colorId || v.couleur_id === colorId)
    );
    
    if (variant) {
      this.selectedVariant = variant;
    }
  }

  // Check if variant combination is available
  isVariantAvailable(sizeId: string, colorId: number): boolean {
    return this.variants.some(v => 
      v.taille_id === sizeId && 
      v.couleur_id === colorId && 
      v.stock > 0
    );
  }

  // Get total stock across all variants
  getTotalStock(): number {
    return this.variants.reduce((sum, variant) => sum + (variant.stock || 0), 0);
  }

  // Get stock for specific variant
  getVariantStock(sizeId?: string, colorId?: number): number {
    if (!sizeId && !colorId && this.selectedVariant) {
      return this.selectedVariant.stock || 0;
    }
    
    const variant = this.variants.find(v => 
      (!sizeId || v.taille_id === sizeId) && 
      (!colorId || v.couleur_id === colorId)
    );
    
    return variant ? (variant.stock || 0) : 0;
  }

  // Check if current selection is in stock
  isInStock(): boolean {
    return this.selectedVariant ? (this.selectedVariant.stock || 0) > 0 : false;
  }

  // Retry loading data (for error state)
  refreshData(): void {
    if (this.variantId) {
      this.loadVariantData();
    } else {
      this.loadProductData();
    }
  }

  /**
   * Swiper setting
   */
  config = {
    infinite: true,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    arrows: false
  };

  slidesConfig = {
    infinite: true,
    slidesToShow: 4,
    slidesToScroll: 1,
    autoplay: true,
  };

  slickChange(event: any): void {
    const swiper = document.querySelectorAll('.swiperlist');
  }

  slidePreview(id: any, event: any): void {
    const swiper = document.querySelectorAll('.swiperlist');
    swiper.forEach((el: any) => {
      el.classList.remove('swiper-slide-thumb-active');
    });
    event.target.closest('.swiperlist').classList.add('swiper-slide-thumb-active');
    this.slickModal.slickGoTo(id);
  }
}