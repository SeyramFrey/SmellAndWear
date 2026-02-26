import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, ViewportScroller } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { 
  Produit, 
  ProduitVariation, 
  Taille, 
  Colors
} from '../../core/models/models';
import { ProduitService } from '../../core/services/produit.service';
import { ProductRedirectService } from '../../core/services/product-redirect.service';
import { ProduitVariationService } from '../../core/services/produit-variation.service';
import { CartService } from '../../core/services/cart.service';
import { PromotionService } from '../../core/services/promotion.service';
import { TopbarComponent } from '../../shared/landing/index/topbar/topbar.component';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { SharedModule } from '../../shared/shared.module';
import { SupabaseService } from '../../core/services/supabase.service';
import { ImageService, IMAGE_SIZES } from '../../core/services/image.service';
import { CurrencyConverterPipe } from '../../shared/pipes/currency-converter.pipe';
import { ProductEffectivePrice, DeliveryPromotion } from '../../core/models/promotion.models';
import { Subscription, EMPTY, of } from 'rxjs';
import { 
  tap, 
  catchError, 
  finalize, 
  switchMap 
} from 'rxjs/operators';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    TopbarComponent,
    ProductCardComponent,
    SharedModule,
    CurrencyConverterPipe
  ],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  produitId: string = '';
  produit: Produit | null = null;
  variations: ProduitVariation[] = [];
  availableSizes: Taille[] = [];
  availableColors: Colors[] = [];
  selectedVariant: ProduitVariation | null = null;
  relatedProducts: Produit[] = [];

  // UI state
  loading: boolean = true;
  error: string | null = null;
  selectedSize: string = '';
  selectedColor: string | number = '';
  quantity: number = 1;
  photos: string[] = [];
  mainPhoto: string = '/assets/images/products/placeholder.jpg';
  selectedPhotoIndex: number = 0;
  
  // Photo slider properties
  autoSlideInterval: any;
  autoSlideEnabled: boolean = true;
  autoSlideDelay: number = 5000; // 5 seconds
  
  // Thumbnail properties
  maxThumbnailsVisible: number = 5;
  thumbnailStartIndex: number = 0;
  
  // Responsive properties
  isMobile: boolean = false;
  
  // Accordion state
  activeAccordion: string | null = null;

  // Price and promotion state
  basePrice: number = 0;
  finalPrice: number = 0;
  hasActiveDiscount: boolean = false;
  discountLabel: string | null = null;
  priceHighlightColor: string = '#212529';
  
  // Delivery promotions
  deliveryPromotions: DeliveryPromotion[] = [];
  deliveryPromotionMessage: string | null = null;
  
  private priceSubscription?: Subscription;
  private deliveryPromoSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private produitService: ProduitService,
    private variationService: ProduitVariationService,
    private productRedirectService: ProductRedirectService,
    private cartService: CartService,
    private supabaseService: SupabaseService,
    private imageService: ImageService,
    private viewportScroller: ViewportScroller,
    private promotionService: PromotionService
  ) {}

  ngOnInit() {
    // Scroll to top when component initializes
    this.scrollToTop();
    
    // Initialize with placeholder to ensure we always have something to display
    this.initializePhotos();
    
    // Detect mobile device
    this.detectMobile();
    
    this.route.params.subscribe(params => {
      // Check for both parameter names to support different routing configurations
      this.produitId = params['produitId'] || params['id'];
      
      console.log('Product Detail ngOnInit, produitId:', this.produitId);
      
      // Scroll to top when navigating to a different product
      this.scrollToTop();
      
      if (this.produitId) {
        this.loadProductDetails();
      } else {
        this.error = 'ID de produit manquant';
        this.loading = false;
      }
    });
  }

  ngOnDestroy(): void {
    // Clean up auto-slide interval to prevent memory leaks
    this.stopAutoSlide();
    this.priceSubscription?.unsubscribe();
    this.deliveryPromoSubscription?.unsubscribe();
  }

  private initializePhotos() {
    this.photos = ['/assets/images/products/placeholder.jpg'];
    this.mainPhoto = '/assets/images/products/placeholder.jpg';
    this.selectedPhotoIndex = 0;
    console.log('Photos initialized with placeholder');
  }
  
  loadProductDetails() {
    this.loading = true;
    this.error = null;
    
    // Charger le produit (public view - returns null if hidden/scheduled/unpublished)
    this.produitService.getProduitByIdPublic(this.produitId).pipe(
      switchMap(produit => {
        // Product not found or not visible - get redirect URL
        if (!produit) {
          return this.productRedirectService.getRedirectForProduct(this.produitId).pipe(
            tap(res => {
              const url = res.redirectUrl || '/wear';
              this.router.navigateByUrl(url);
            }),
            switchMap(() => EMPTY)
          );
        }
        return of(produit);
      }),
      tap((produit: Produit) => {
        this.produit = produit;
        // Initialize price tracking
        this.initializePriceTracking(produit.id, produit.prix);
        // Load delivery promotions
        this.loadDeliveryPromotions();
      }),
      // Charger les variantes du produit
      switchMap(produit => {
        return this.variationService.getVariationsByProduitId(produit.id);
      }),
      tap(variations => {
        this.variations = variations;
        
        // Extraire les tailles et couleurs uniques des variations
        const sizeMap = new Map<string, Taille>();
        const colorMap = new Map<string, Colors>();
        
        variations.forEach(v => {
          if (v.taille && v.taille.id && v.taille.libelle) {
            sizeMap.set(v.taille.id, {
              id: v.taille.id,
              libelle: v.taille.libelle
            });
          } else if (v.taille_id) {
            // Essayer d'utiliser taille_id si taille.id n'existe pas
            sizeMap.set(v.taille_id, {
              id: v.taille_id,
              libelle: v.taille_id // Fallback si on n'a pas le libellé
            });
          }
          
          if (v.colors && v.colors.id && v.colors.nom) {
            colorMap.set(v.colors.id.toString(), {
              id: v.colors.id,
              nom: v.colors.nom || 'Couleur',
              hex: v.colors.hex || '#000000'
            });
          } else if (v.couleur_id) {
            // Essayer d'utiliser couleur_id si colors.id n'existe pas
            colorMap.set(v.couleur_id.toString(), {
              id: v.couleur_id,
              nom: 'Couleur ' + v.couleur_id,
              hex: '#000000' // Couleur par défaut
            });
          }
        });
        
        this.availableSizes = Array.from(sizeMap.values());
        this.availableColors = Array.from(colorMap.values());
        
        // Select and set the default variant first (this will load variant-specific photos)
        this.selectDefaultVariant(variations);
        
        // If no variant photos were loaded, fallback to loading all product photos
        if (this.photos.length === 0 || this.mainPhoto === '/assets/images/products/placeholder.jpg') {
          console.log('No variant photos found, loading all product photos');
          this.loadPhotos();
        }
        
        // Final safety check to ensure we always have photos
        if (this.photos.length === 0) {
          console.log('Still no photos found, setting placeholder');
          this.photos = ['/assets/images/products/placeholder.jpg'];
          this.mainPhoto = '/assets/images/products/placeholder.jpg';
          this.selectedPhotoIndex = 0;
        }
      }),
      // Charger les produits similaires (de la même catégorie)
      switchMap(() => {
        const categorieId = (this.produit as any).sous_categorie_id || (this.produit as any).categorie_id || '';
        if (!categorieId) return of([]);
        
        return this.produitService.getProduitsByCategoriePublic(categorieId).pipe(
          tap(relatedProducts => {
            this.relatedProducts = relatedProducts
              .filter(p => p.id !== this.produitId) // Exclure le produit actuel
              .slice(0, 4); // Limiter à 4 produits similaires
          })
        );
      }),
      catchError(error => {
        console.error('Erreur lors du chargement des détails du produit', error);
        this.error = 'Impossible de charger les détails du produit.';
        return EMPTY;
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe();
  }
  
  private loadPhotos() {
    console.log('Loading photos for product:', this.produit);
    console.log('Available variations:', this.variations);
    
    const photoSet = new Set<string>();
    
    // Add product photos
    if (this.produit?.front_photo_path) {
      console.log('Adding front photo:', this.produit.front_photo_path);
      photoSet.add(this.getPhotoUrl(this.produit.front_photo_path));
    }
    if (this.produit?.back_photo_path) {
      console.log('Adding back photo:', this.produit.back_photo_path);
      photoSet.add(this.getPhotoUrl(this.produit.back_photo_path));
    }
    
    // Add variant photos using helper method
    this.variations.forEach(variant => {
      this.addVariantPhotos(variant, photoSet);
    });
    
    this.photos = Array.from(photoSet);
    console.log('Final photos array:', this.photos);
    
    // Set main photo
    if (this.photos.length > 0) {
      this.mainPhoto = this.photos[0];
      this.selectedPhotoIndex = 0;
      console.log('Main photo set to:', this.mainPhoto);
    } else {
      this.mainPhoto = '/assets/images/products/placeholder.jpg';
      this.photos = [this.mainPhoto];
      this.selectedPhotoIndex = 0;
      console.log('No photos found, using placeholder');
    }
  }

  private getPhotoUrl(path: string): string {
    return this.imageService.resolveImageUrl(
      path,
      IMAGE_SIZES.PRODUCT_DETAIL,
      75,
      'public-images',
      '/assets/images/products/placeholder.jpg'
    );
  }

  updateSelectedVariant() {
    if (!this.selectedSize || !this.selectedColor) return;
    
    // Convert selectedColor to string for consistent comparison
    const selectedColorStr = this.selectedColor.toString();
    
    const variant = this.variations.find(v => {
      const sizeMatch = v.taille_id === this.selectedSize || v.taille?.id === this.selectedSize;
      const colorMatch = v.couleur_id?.toString() === selectedColorStr || v.colors?.id?.toString() === selectedColorStr;
      
      return sizeMatch && colorMatch;
    });
    
    console.log('Looking for variant with color:', selectedColorStr, 'size:', this.selectedSize);
    console.log('Found variant:', variant);
    
    if (variant) {
      this.selectedVariant = variant;
      this.updateVariantPhotos();
    } else {
      console.warn('No variant found for selected color and size');
    }
  }

  private updateVariantPhotos() {
    if (!this.selectedVariant) {
      console.warn('No selected variant for photo update');
      return;
    }
    
    console.log('Updating photos for variant:', this.selectedVariant);
    
    // Get variant-specific photos using the new method
    const variantPhotos = this.getVariantPhotos();
    
    // Set main photo from variant photos or fallback to all images
    const allImages = this.getAllProductImages();
    if (allImages.length > 0) {
      this.mainPhoto = allImages[0];
      this.selectedPhotoIndex = 0;
      console.log('Updated main photo to:', this.mainPhoto);
    } else {
      this.initializePhotos();
    }
    
    console.log('Variant photos:', variantPhotos.length);
    console.log('All images:', allImages.length);
    
    // Start auto-slide if we have multiple images
    if (allImages.length > 1) {
      this.startAutoSlide();
    }
  }

  selectSize(sizeId: string) {
    this.selectedSize = sizeId;
    this.updateSelectedVariant();
  }

  selectColor(colorId: string | number) {
    console.log('Color selected:', colorId, 'Type:', typeof colorId);
    this.selectedColor = colorId;
    this.updateSelectedVariant();
  }

  changeMainPhoto(photoUrl: string) {
    this.mainPhoto = photoUrl;
  }

  selectPhoto(index: number) {
    this.selectedPhotoIndex = index;
    const allImages = this.getAllProductImages();
    if (allImages.length > index) {
      this.mainPhoto = allImages[index];
    }
    this.updateThumbnailPosition(index);
    this.resetAutoSlide(); // Reset auto slide when manually selecting
  }

  // === PHOTO SLIDER METHODS ===

  /**
   * Detect if device is mobile
   */
  private detectMobile() {
    this.isMobile = window.innerWidth <= 768;
    // Listen for window resize
    window.addEventListener('resize', () => {
      this.isMobile = window.innerWidth <= 768;
    });
  }

  /**
   * Start automatic photo slider
   */
  startAutoSlide() {
    if (!this.autoSlideEnabled) return;
    
    this.stopAutoSlide(); // Clear any existing interval
    this.autoSlideInterval = setInterval(() => {
      this.nextPhoto();
    }, this.autoSlideDelay);
  }

  /**
   * Stop automatic photo slider
   */
  stopAutoSlide() {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
      this.autoSlideInterval = null;
    }
  }

  /**
   * Reset automatic slider (restart)
   */
  resetAutoSlide() {
    if (this.autoSlideEnabled) {
      this.stopAutoSlide();
      this.startAutoSlide();
    }
  }

  /**
   * Navigate to next photo
   */
  nextPhoto() {
    const allImages = this.getAllProductImages();
    if (allImages.length <= 1) return;
    
    const nextIndex = (this.selectedPhotoIndex + 1) % allImages.length;
    this.selectPhoto(nextIndex);
  }

  /**
   * Navigate to previous photo
   */
  previousPhoto() {
    const allImages = this.getAllProductImages();
    if (allImages.length <= 1) return;
    
    const prevIndex = this.selectedPhotoIndex === 0 ? allImages.length - 1 : this.selectedPhotoIndex - 1;
    this.selectPhoto(prevIndex);
  }

  // === THUMBNAIL NAVIGATION METHODS ===

  /**
   * Get visible thumbnails based on current position
   */
  getVisibleThumbnails(): string[] {
    const allImages = this.getAllProductImages();
    const endIndex = Math.min(this.thumbnailStartIndex + this.maxThumbnailsVisible, allImages.length);
    return allImages.slice(this.thumbnailStartIndex, endIndex);
  }

  /**
   * Get thumbnail index in the context of visible thumbnails
   */
  getThumbnailDisplayIndex(globalIndex: number): number {
    return globalIndex - this.thumbnailStartIndex;
  }

  /**
   * Check if thumbnail navigation arrows should be shown (desktop/tablet only)
   */
  shouldShowThumbnailNavigation(): boolean {
    const allImages = this.getAllProductImages();
    return !this.isMobile && allImages.length > this.maxThumbnailsVisible;
  }

  /**
   * Navigate thumbnails to the left
   */
  previousThumbnails() {
    if (this.thumbnailStartIndex > 0) {
      this.thumbnailStartIndex = Math.max(0, this.thumbnailStartIndex - 1);
    }
  }

  /**
   * Navigate thumbnails to the right
   */
  nextThumbnails() {
    const allImages = this.getAllProductImages();
    const maxStartIndex = Math.max(0, allImages.length - this.maxThumbnailsVisible);
    if (this.thumbnailStartIndex < maxStartIndex) {
      this.thumbnailStartIndex = Math.min(maxStartIndex, this.thumbnailStartIndex + 1);
    }
  }

  /**
   * Check if can navigate thumbnails left
   */
  canNavigateThumbnailsLeft(): boolean {
    return this.thumbnailStartIndex > 0;
  }

  /**
   * Check if can navigate thumbnails right
   */
  canNavigateThumbnailsRight(): boolean {
    const allImages = this.getAllProductImages();
    return this.thumbnailStartIndex + this.maxThumbnailsVisible < allImages.length;
  }

  /**
   * Update thumbnail position when photo is selected
   */
  private updateThumbnailPosition(selectedIndex: number) {
    // Don't adjust thumbnail position on mobile (uses scroll)
    if (this.isMobile) return;
    
    const allImages = this.getAllProductImages();
    
    // If selected photo is outside visible range, adjust thumbnail position
    if (selectedIndex < this.thumbnailStartIndex) {
      this.thumbnailStartIndex = selectedIndex;
    } else if (selectedIndex >= this.thumbnailStartIndex + this.maxThumbnailsVisible) {
      this.thumbnailStartIndex = Math.max(0, selectedIndex - this.maxThumbnailsVisible + 1);
    }
  }

  /**
   * Select photo from thumbnail click
   */
  selectPhotoFromThumbnail(thumbnailIndex: number) {
    const globalIndex = this.thumbnailStartIndex + thumbnailIndex;
    this.selectPhoto(globalIndex);
  }

  /**
   * Get thumbnail global index for mobile scroll
   */
  getThumbnailGlobalIndex(localIndex: number): number {
    return this.thumbnailStartIndex + localIndex;
  }

  incrementQuantity() {
    this.quantity++;
  }

  decrementQuantity() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  /**
   * Toggle accordion section
   * @param section The section identifier (details, delivery, returns, care, review)
   */
  toggleAccordion(section: string): void {
    if (this.activeAccordion === section) {
      this.activeAccordion = null;
    } else {
      this.activeAccordion = section;
    }
  }

  addToCart() {
    if (!this.produit || !this.selectedVariant) {
      this.error = 'Veuillez sélectionner une variante';
      return;
    }

    // Get selected size and color objects
    const selectedSizeObj = this.availableSizes.find(s => s.id === this.selectedSize) || 
      { id: this.selectedSize, libelle: 'Taille' };
    
    const selectedColorObj = this.availableColors.find(c => c.id.toString() === this.selectedColor.toString());
    const colorForCart = selectedColorObj ? 
      { id: selectedColorObj.id, nom: selectedColorObj.nom || 'Couleur', hex: selectedColorObj.hex || '#000000' } :
      { id: Number(this.selectedColor), nom: 'Couleur', hex: '#000000' };

    console.log('Product Detail - Adding to cart:', {
      product: this.produit.nom,
      variant: this.selectedVariant,
      quantity: this.quantity,
      size: selectedSizeObj,
      color: colorForCart,
      mainPhoto: this.mainPhoto
    });

    const imageUrl = this.imageService.resolveImageUrl(
      this.mainPhoto,
      IMAGE_SIZES.CART_THUMBNAIL,
      75,
      'public-images',
      '/assets/images/products/placeholder.jpg'
    );
    this.cartService.addToCart(
      this.produit,
      this.selectedVariant,
      this.quantity,
      selectedSizeObj,
      colorForCart,
      imageUrl
    );
    
    console.log('Product successfully added to cart from product detail page');
  }

  buyNow() {
    this.addToCart();
    // Redirect to checkout page
    this.router.navigate(['/checkout']);
  }

  trackByProductId(_index: number, product: Produit): string {
    return product.id;
  }

  // Getter pour vérifier si toutes les options sont sélectionnées
  get canAddToCart(): boolean {
    return !!(this.selectedSize && this.selectedColor && this.selectedVariant);
  }

  /**
   * Scroll to top of the page using Angular ViewportScroller (best practice)
   */
  scrollToTop(): void {
    this.viewportScroller.scrollToPosition([0, 0]);
  }

  /**
   * Legacy method for scroll to top (kept for backward compatibility)
   */
  topFunction() {
    this.scrollToTop();
  }
  
  // Debug method to force photo refresh
  refreshPhotos() {
    console.log('Manually refreshing photos...');
    if (this.selectedVariant) {
      this.updateVariantPhotos();
    } else {
      this.loadPhotos();
    }
  }

  // Get photos for current variant (like admin component)
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

  // Get all product images for display (like admin component)
  getAllProductImages(): string[] {
    const variantPhotos = this.getVariantPhotos();
    const allImages = variantPhotos.length > 0 ? variantPhotos : this.photos;
    
    // Ensure we always have at least a placeholder
    if (allImages.length === 0) {
      return ['/assets/images/products/placeholder.jpg'];
    }
    
    return allImages;
  }

  /**
   * Helper method to add variant photos to a set (from admin component)
   */
  private addVariantPhotos(variant: ProduitVariation, photoSet: Set<string>): void {
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

  goBack() {
    this.router.navigate(['/wear-men']);
  }

  /**
   * Get selected color name for display
   */
  getSelectedColorName(): string {
    const selectedColor = this.availableColors.find(c => c.id === this.selectedColor);
    return selectedColor?.nom || '';
  }

  /**
   * Get selected size name for display
   */
  getSelectedSizeName(): string {
    const selectedSize = this.availableSizes.find(s => s.id === this.selectedSize);
    return selectedSize?.libelle || '';
  }

  /**
   * Select and set the default variant (primary variant or first available)
   * Reuses logic from product-modal component
   */
  private selectDefaultVariant(variations: ProduitVariation[]) {
    console.log('Selecting default variant from:', variations);
    
    // Try to find primary variant first
    let defaultVariant = variations.find(v => v.is_primary);
    
    // If no primary variant, use first available
    if (!defaultVariant && variations.length > 0) {
      defaultVariant = variations[0];
    }
    
    console.log('Default variant selected:', defaultVariant);
    
    if (defaultVariant) {
      this.selectedVariant = defaultVariant;
      
      // Set selected size from variant
      if (defaultVariant.taille?.id) {
        this.selectedSize = defaultVariant.taille.id;
      } else if (defaultVariant.taille_id) {
        this.selectedSize = defaultVariant.taille_id;
      }
      
      // Set selected color from variant
      if (defaultVariant.colors?.id) {
        this.selectedColor = defaultVariant.colors.id;
      } else if (defaultVariant.couleur_id) {
        this.selectedColor = defaultVariant.couleur_id;
      }
      
      console.log('Default selections - Size:', this.selectedSize, 'Color:', this.selectedColor);
      
      // Load variant-specific photos
      this.updateVariantPhotos();
    } else {
      // Fallback to first available options if no variants
      console.log('No default variant found, using first available options');
      
      if (this.availableSizes.length > 0) {
        this.selectedSize = this.availableSizes[0].id;
      }
      
      if (this.availableColors.length > 0) {
        this.selectedColor = this.availableColors[0].id;
      }
      
      // Try to find a variant with the fallback selections
      this.updateSelectedVariant();
    }
  }

  // ============================================================================
  // PRICE TRACKING
  // ============================================================================

  /**
   * Initialize price tracking with promotions
   */
  private initializePriceTracking(productId: string, fallbackPrice: number = 0): void {
    this.resetPriceState(fallbackPrice);

    if (!productId) {
      return;
    }

    this.priceSubscription?.unsubscribe();
    this.priceSubscription = this.promotionService
      .getProductEffectivePrice(productId)
      .subscribe({
        next: (priceInfo: ProductEffectivePrice | null) => {
          if (priceInfo && priceInfo.has_discount && priceInfo.effective_price > 0) {
            // We have an active discount
            this.basePrice = priceInfo.original_price;
            this.finalPrice = priceInfo.effective_price;
            this.hasActiveDiscount = priceInfo.show_strikethrough;
            this.priceHighlightColor = priceInfo.highlight_color || '#B5190C';
            this.discountLabel = priceInfo.discount_label || null;
          } else if (priceInfo && priceInfo.original_price > 0) {
            // No discount, use original price
            this.basePrice = priceInfo.original_price;
            this.finalPrice = priceInfo.original_price;
            this.hasActiveDiscount = false;
            this.priceHighlightColor = '#212529';
            this.discountLabel = null;
          } else {
            // Fallback to default
            this.resetPriceState(fallbackPrice);
          }
        },
        error: () => {
          this.resetPriceState(fallbackPrice);
        }
      });
  }

  /**
   * Reset price state to defaults
   */
  private resetPriceState(basePrice: number = 0): void {
    this.basePrice = basePrice;
    this.finalPrice = basePrice;
    this.hasActiveDiscount = false;
    this.priceHighlightColor = '#212529';
    this.discountLabel = null;
  }

  // ============================================================================
  // DELIVERY PROMOTIONS
  // ============================================================================

  /**
   * Load delivery promotions (default to CI for now)
   */
  private loadDeliveryPromotions(): void {
    // Load promotions for Côte d'Ivoire by default
    this.deliveryPromoSubscription?.unsubscribe();
    this.deliveryPromoSubscription = this.promotionService
      .getDeliveryPromotions('CI')
      .subscribe({
        next: (promotions: DeliveryPromotion[]) => {
          this.deliveryPromotions = promotions;
          if (promotions.length > 0) {
            this.deliveryPromotionMessage = promotions[0].message;
          } else {
            this.deliveryPromotionMessage = null;
          }
        },
        error: () => {
          this.deliveryPromotions = [];
          this.deliveryPromotionMessage = null;
        }
      });
  }

  /**
   * Get display price (final price after discount)
   */
  getDisplayPrice(): number {
    return this.finalPrice || this.produit?.prix || 0;
  }

  /**
   * Check if we should show the original price (striked)
   */
  shouldShowOriginalPrice(): boolean {
    return this.hasActiveDiscount && this.basePrice > this.finalPrice;
  }
}
