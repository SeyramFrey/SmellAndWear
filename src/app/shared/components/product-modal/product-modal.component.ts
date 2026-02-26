import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrencyConverterPipe } from '../../pipes/currency-converter.pipe';
import { Produit, Taille, Colors, ProduitVariation } from '../../../core/models/models';
import { ProduitService } from '../../../core/services/produit.service';
import { ProduitVariationService } from '../../../core/services/produit-variation.service';

import { CartService } from '../../../core/services/cart.service';
import { catchError, finalize, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { NgbActiveModal } from "@ng-bootstrap/ng-bootstrap";
import { SupabaseService } from '../../../core/services/supabase.service';
import { ImageService, IMAGE_SIZES } from '../../../core/services/image.service';


@Component({
  selector: 'app-product-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CurrencyConverterPipe
  ],
  templateUrl: './product-modal.component.html',
  styleUrl: './product-modal.component.scss'
})
export class ProductModalComponent implements OnInit, OnDestroy {
  @Input() productId!: string;
  @Input() preloadedVariants?: ProduitVariation[]; // For instant loading without extra queries
  
  @Output() addToCartEvent = new EventEmitter<{
    product: Produit;
    variant: ProduitVariation;
    quantity: number;
  }>();
  
  @Output() close = new EventEmitter<void>();
  
  // Data
  product: Produit | null = null;
  availableSizes: Taille[] = [];
  availableColors: Colors[] = [];
  variations: ProduitVariation[] = [];
  photos: string[] = [];
  selectedVariant: ProduitVariation | null = null;
  
  // UI state
  loading: boolean = true;
  error: string | null = null;
  selectedSize: string = '';
  selectedColor: string | number = '';
  selectedPhotoIndex: number = 0;
  quantity: number = 1;
  showValidationErrors: boolean = false;
  isValidCombination: boolean = true;
  
  // Photo slider properties
  autoSlideInterval: any;
  autoSlideEnabled: boolean = true;
  autoSlideDelay: number = 5000; // 5 seconds
  
  // Thumbnail properties
  maxThumbnailsVisible: number = 5;
  thumbnailStartIndex: number = 0;
  
  // Responsive properties
  isMobile: boolean = false;
  
  // Optimized variant lookup
  private variantLookupMap = new Map<string, ProduitVariation>();
  
  constructor(
    private produitService: ProduitService,
    private variationService: ProduitVariationService,
    public modal: NgbActiveModal,
    private cartService: CartService,
    private supabaseService: SupabaseService,
    private imageService: ImageService
  ) {}
  
  ngOnInit() {
    // Detect mobile device
    this.detectMobile();
    
    if (this.productId) {
      this.loadProductDetails();
    } else {
      this.error = 'ID produit manquant';
      this.loading = false;
    }
  }
  
  ngOnDestroy() {
    // Clean up auto-slide interval to prevent memory leaks
    this.stopAutoSlide();
  }
  
  /**
   * Detect if device is mobile
   */
  private detectMobile() {
    this.isMobile = window.innerWidth <= 768;
  }
  
  loadProductDetails() {
    this.loading = true;
    this.error = null;
    
    this.produitService.getProduitByIdPublic(this.productId).pipe(
      switchMap(produit => {
        if (!produit) {
          this.error = 'Ce produit n\'est plus disponible.';
          return of(null);
        }
        this.product = produit;
        if (this.preloadedVariants && this.preloadedVariants.length > 0) {
          console.log('Using preloaded variants for instant modal loading');
          return of({ variations: this.preloadedVariants });
        } else {
          return this.variationService.getVariationsByProduitId(produit.id).pipe(
            map(variations => ({ variations }))
          );
        }
      }),
      tap(result => {
        if (!result) return;
        const variations = result.variations;
        this.variations = variations;
        
        // Build optimized variant lookup map for instant switching
        this.buildVariantLookupMap(variations);
        
        // Extraire les tailles et couleurs uniques
        const sizeMap = new Map<string, Taille>();
        const colorMap = new Map<string, Colors>();
        
        variations.forEach(v => {
          if (v.taille && v.taille.id) {
            sizeMap.set(v.taille.id, {
              id: v.taille.id,
              libelle: v.taille.libelle
            });
          } else if (v.taille_id) {
            sizeMap.set(v.taille_id, {
              id: v.taille_id,
              libelle: v.taille_id
            });
          }
          
          if (v.colors && v.colors.id) {
            colorMap.set(v.colors.id.toString(), {
              id: v.colors.id,
              nom: v.colors.nom || 'Couleur',
              hex: v.colors.hex || '#000000'
            });
          } else if (v.couleur_id) {
            colorMap.set(v.couleur_id.toString(), {
              id: v.couleur_id,
              nom: 'Couleur ' + v.couleur_id,
              hex: '#000000'
            });
          }
        });
        
        this.availableSizes = Array.from(sizeMap.values());
        this.availableColors = Array.from(colorMap.values());
        
        // Sélectionner par défaut la première taille et couleur disponible
        if (this.availableSizes.length > 0) {
          this.selectedSize = this.availableSizes[0].id;
        }
        
        if (this.availableColors.length > 0) {
          this.selectedColor = this.availableColors[0].id;
        }
        
        // Load photos from product and variants first
        this.loadPhotos();
        
        // Trouver et sélectionner la variante principale pour afficher initialement
        this.selectDefaultVariant(variations);
      }),
      catchError(error => {
        console.error('Erreur lors du chargement des détails du produit', error);
        this.error = 'Impossible de charger les détails du produit.';
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
      })
    ).subscribe();
  }

  private loadPhotos() {
    const photoSet = new Set<string>();
    
    // Add product photos
    if (this.product?.front_photo_path) {
      photoSet.add(this.getPhotoUrl(this.product.front_photo_path));
    }
    if (this.product?.back_photo_path) {
      photoSet.add(this.getPhotoUrl(this.product.back_photo_path));
    }
    
    // Add variant photos
    this.variations.forEach(variant => {
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
    });
    
    this.photos = Array.from(photoSet);
    
    // Fallback to default image if no photos found
    if (this.photos.length === 0) {
      this.photos = ['/assets/images/products/placeholder.jpg'];
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
  
  selectSize(sizeId: string) {
    this.selectedSize = sizeId;
    this.updateSelectedVariant();
  }

  selectColor(colorId: number) {
    this.selectedColor = colorId;
    this.updateSelectedVariant();
  }
  
  updateSelectedVariant() {
    // Use optimized lookup map for instant variant switching
    const lookupKey = this.createVariantLookupKey(this.selectedSize, this.selectedColor);
    const variant = this.variantLookupMap.get(lookupKey);
    
    if (variant) {
      this.selectedVariant = variant;
      this.isValidCombination = true;
      this.updateVariantPhotos();
      console.log('Variant switched instantly:', variant);
    } else {
      this.selectedVariant = null;
      this.isValidCombination = false;
    }
  }

  /**
   * Build optimized variant lookup map for O(1) variant switching
   */
  private buildVariantLookupMap(variations: ProduitVariation[]): void {
    this.variantLookupMap.clear();
    
    variations.forEach(variant => {
      const sizeId = variant.taille?.id || variant.taille_id || '';
      const colorId = variant.colors?.id || variant.couleur_id || '';
      
      if (sizeId && colorId) {
        const lookupKey = this.createVariantLookupKey(sizeId, colorId);
        this.variantLookupMap.set(lookupKey, variant);
      }
    });
    
    console.log('Variant lookup map built:', this.variantLookupMap.size, 'variants');
  }

  /**
   * Create consistent lookup key for variant map
   */
  private createVariantLookupKey(sizeId: string | number, colorId: string | number): string {
    return `${sizeId}_${colorId}`;
  }

  /**
   * Select and set the default variant (primary variant or first available)
   */
  private selectDefaultVariant(variations: ProduitVariation[]) {
    // Try to find primary variant first
    let defaultVariant = variations.find(v => v.is_primary);
    
    // If no primary variant, use first available
    if (!defaultVariant && variations.length > 0) {
      defaultVariant = variations[0];
    }
    
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
      
      // Update validation state
      this.isValidCombination = true;
      
      // Load variant-specific photos
      this.updateVariantPhotos();
      
      console.log('Default variant selected:', defaultVariant);
    } else {
      console.warn('No variants found for product');
      this.isValidCombination = false;
    }
  }

  private updateVariantPhotos() {
    if (!this.selectedVariant) return;
    
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
    
    if (variantPhotos.length > 0) {
      this.photos = variantPhotos;
      this.selectedPhotoIndex = 0; // Reset to first photo
      
      // Start auto-slide if we have multiple images
      if (this.photos.length > 1) {
        this.startAutoSlide();
      }
    }
  }
  
  incrementQuantity() {
    if (this.quantity < 999) {
      this.quantity++;
    }
  }
  
  decrementQuantity() {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }
  
  addToCart() {
    if (!this.canAddToCart()) {
      this.showValidationErrors = true;
      return;
    }

    if (!this.product || !this.selectedVariant) return;

    // Get selected size and color objects
    const selectedSizeObj = this.availableSizes.find(s => s.id === this.selectedSize) || 
      { id: this.selectedSize, libelle: 'Taille' };
    
    const selectedColorObj = this.availableColors.find(c => c.id === this.selectedColor);
    const colorForCart = selectedColorObj ? 
      { id: selectedColorObj.id, nom: selectedColorObj.nom || 'Couleur', hex: selectedColorObj.hex || '#000000' } :
      { id: Number(this.selectedColor), nom: 'Couleur', hex: '#000000' };

    // Get current photo URL - use cart thumbnail size for cart display
    const photoUrl = this.photos.length > this.selectedPhotoIndex 
      ? this.photos[this.selectedPhotoIndex] 
      : '/assets/images/products/placeholder.jpg';
    const imageUrl = this.imageService.resolveImageUrl(
      photoUrl,
      IMAGE_SIZES.CART_THUMBNAIL,
      75,
      'public-images',
      '/assets/images/products/placeholder.jpg'
    );

    console.log('Product Modal - Adding to cart:', {
      product: this.product.nom,
      variant: this.selectedVariant,
      quantity: this.quantity,
      size: selectedSizeObj,
      color: colorForCart,
      imageUrl: imageUrl
    });

    this.cartService.addToCart(
      this.product,
      this.selectedVariant,
      this.quantity,
      selectedSizeObj,
      colorForCart,
      imageUrl
    );

    console.log('Product successfully added to cart from modal');

    this.addToCartEvent.emit({
      product: this.product,
      variant: this.selectedVariant,
      quantity: this.quantity
    });

    // Close modal after adding to cart
    this.modal.close();
  }
  
  closeModal() {
    this.close.emit();
    this.modal.close();
  }
  
  canAddToCart(): boolean {
    return !!(this.selectedSize && 
             this.selectedColor && 
             this.selectedVariant);
  }

  getCurrentPhoto(): string {
    return this.photos.length > this.selectedPhotoIndex 
      ? this.photos[this.selectedPhotoIndex] 
      : '/assets/images/products/placeholder.jpg';
  }

  selectPhoto(index: number) {
    this.selectedPhotoIndex = index;
    this.updateThumbnailPosition(index);
    this.resetAutoSlide(); // Reset auto slide when manually selecting
  }

  // === PHOTO SLIDER METHODS ===

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
    if (this.photos.length <= 1) return;
    
    const nextIndex = (this.selectedPhotoIndex + 1) % this.photos.length;
    this.selectPhoto(nextIndex);
  }

  /**
   * Navigate to previous photo
   */
  previousPhoto() {
    if (this.photos.length <= 1) return;
    
    const prevIndex = this.selectedPhotoIndex === 0 ? this.photos.length - 1 : this.selectedPhotoIndex - 1;
    this.selectPhoto(prevIndex);
  }

  // === THUMBNAIL NAVIGATION METHODS ===

  /**
   * Get visible thumbnails based on current position
   */
  getVisibleThumbnails(): string[] {
    const endIndex = Math.min(this.thumbnailStartIndex + this.maxThumbnailsVisible, this.photos.length);
    return this.photos.slice(this.thumbnailStartIndex, endIndex);
  }

  /**
   * Check if thumbnail navigation arrows should be shown
   */
  shouldShowThumbnailNavigation(): boolean {
    return !this.isMobile && this.photos.length > this.maxThumbnailsVisible;
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
    const maxStartIndex = Math.max(0, this.photos.length - this.maxThumbnailsVisible);
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
    return this.thumbnailStartIndex + this.maxThumbnailsVisible < this.photos.length;
  }

  /**
   * Update thumbnail position when photo is selected
   */
  private updateThumbnailPosition(selectedIndex: number) {
    // Don't adjust thumbnail position on mobile
    if (this.isMobile) return;
    
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
   * Get the current price to display (variant price if available, otherwise product price)
   */
  getCurrentPrice(): number {
    // Note: Currently variants don't have their own price in the model
    // So we use the product price. This can be extended if variant-specific pricing is added
    return this.product?.prix || 0;
  }

}
