import { Component, Input, OnInit, Output, EventEmitter, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Produit, ProduitPhoto, Colors, ProduitVariation } from "../../../core/models/models";
import { CurrencyConverterPipe } from '../../pipes/currency-converter.pipe';
import { FavoritesService } from '../../../core/services/favorites.service';
import { catchError, tap } from 'rxjs/operators';
import { EMPTY, Subscription } from 'rxjs';
import { ProduitService } from "../../../core/services/produit.service";
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductModalComponent } from '../product-modal/product-modal.component';
import { ImageService, IMAGE_SIZES } from '../../../core/services/image.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { PromotionService } from '../../../core/services/promotion.service';
import { ProductEffectivePrice } from '../../../core/models/promotion.models';

// Enhanced product interface with variants
export interface ProductWithVariants extends Produit {
  variants?: ProduitVariation[];
  availableColors?: Colors[];
  defaultVariant?: ProduitVariation;
}

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, CurrencyConverterPipe],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss'
})
export class ProductCardComponent implements OnInit, OnDestroy {
  @Input({ required: true }) produit!: Produit | ProduitPhoto | ProductWithVariants;
  @Output() productClick = new EventEmitter<ProduitPhoto>();
  @Output() addToCartSuccess = new EventEmitter<unknown>();

  currentImage: string = '';
  frontImage: string = '';
  backImage: string = '';
  currentImagePath: string | null = null;
  isFavorite: boolean = false;
  isHovering: boolean = false;
  produitM!: Produit;

  // Color display properties
  availableColors: Colors[] = [];
  showColorPalette: boolean = false;
  selectedColorId: number | null = null;

  // Price display properties
  basePrice: number = 0;
  finalPrice: number = 0;
  hasActiveDiscount: boolean = false;
  priceHighlightColor: string = '#212529';
  discountLabel: string | null = null;

  private priceSubscription?: Subscription;
  private favoriteSubscription?: Subscription;

  constructor(
    private favoritesService: FavoritesService,
    private produitService: ProduitService,
    private imageService: ImageService,
    private supabaseService: SupabaseService,
    private router: Router,
    private modalService: NgbModal,
    private promotionService: PromotionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Check if it's a ProductWithVariants (enhanced product)
    if ('availableColors' in this.produit) {
      const enhancedProduct = this.produit as ProductWithVariants;
      this.produitM = enhancedProduct;
      this.availableColors = enhancedProduct.availableColors || [];
      this.showColorPalette = this.availableColors.length > 1;
      this.loadProductImages(enhancedProduct);
      this.initializePriceTracking(enhancedProduct.id, enhancedProduct.prix);
    }
    // Check if it's a standard Produit
    else if ('nom' in this.produit && 'prix' in this.produit) {
      const produit = this.produit as Produit;
      this.produitM = produit;
      this.loadProductImages(produit);
      this.initializePriceTracking(produit.id, produit.prix);
    }
    // Handle ProduitPhoto case if needed
    else if ('produit_id' in this.produit) {
      const produitPhoto = this.produit as ProduitPhoto;
      if (produitPhoto.produit_id) {
        this.produitService.getProduitById(produitPhoto.produit_id)
          .pipe(
            tap(produit => {
              this.produitM = produit;
              this.loadProductImages(produit);
              this.initializePriceTracking(produit.id, produit.prix);
            }),
            catchError(err => {
              console.error('Error loading produit:', err);
              this.setDefaultImages();
              return EMPTY;
            })
          )
          .subscribe();
      }
    } else {
      this.setDefaultImages();
    }

    // Check if produit is in favorites
    this.isFavorite = this.favoritesService.isFavorite(this.produit.id);

    // Subscribe to favorite changes
    this.favoriteSubscription = this.favoritesService.favoriteIds$.subscribe(ids => {
      this.isFavorite = ids.has(this.produit.id);
    });
  }

  ngOnDestroy(): void {
    this.priceSubscription?.unsubscribe();
    this.favoriteSubscription?.unsubscribe();
  }

  // ============================================================================
  // PRICE TRACKING
  // ============================================================================

  private initializePriceTracking(productId: string, fallbackPrice: number = 0): void {
    const fallback = fallbackPrice || 0;
    this.resetPriceState(fallback);

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
            this.resetPriceState(fallback);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.resetPriceState(fallback);
          this.cdr.markForCheck();
        }
      });
  }

  private resetPriceState(basePrice: number = 0): void {
    this.basePrice = basePrice;
    this.finalPrice = basePrice;
    this.hasActiveDiscount = false;
    this.priceHighlightColor = '#212529';
    this.discountLabel = null;
  }

  // ============================================================================
  // IMAGE LOADING
  // ============================================================================

  private loadProductImages(produit: Produit): void {
    // Load front image from product
    if (produit.front_photo_path) {
      this.frontImage = this.getPhotoUrl(produit.front_photo_path);
      this.currentImage = this.frontImage;
      this.currentImagePath = this.isStoragePath(produit.front_photo_path) ? produit.front_photo_path : null;
    }

    // Load back image from product
    if (produit.back_photo_path) {
      this.backImage = this.getPhotoUrl(produit.back_photo_path);
    }

    // If no product images, try to get from primary variant
    if (!this.frontImage && !this.backImage) {
      this.loadVariantImages(produit.id);
    }

    // Fallback to default if still no images
    if (!this.frontImage) {
      this.setDefaultImages();
    }
  }

  private loadVariantImages(productId: string): void {
    this.supabaseService.getClient()
      .from('variant')
      .select('main_photo_path, others_photos')
      .eq('produit_id', productId)
      .eq('is_primary', true)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error loading variant images:', error);
          this.setDefaultImages();
          return;
        }

        if (data) {
          // Use main photo path if available
          if (data.main_photo_path && Array.isArray(data.main_photo_path) && data.main_photo_path.length > 0) {
            const path = data.main_photo_path[0];
            this.frontImage = this.getPhotoUrl(path);
            this.currentImage = this.frontImage;
            this.currentImagePath = this.isStoragePath(path) ? path : null;
          }

          // Use first other photo as back image if available
          if (data.others_photos && Array.isArray(data.others_photos) && data.others_photos.length > 0) {
            this.backImage = this.getPhotoUrl(data.others_photos[0]);
          }
        }

        // Fallback to default if still no images
        if (!this.frontImage) {
          this.setDefaultImages();
        }
      });
  }

  private isStoragePath(path: string): boolean {
    return !!path && !path.startsWith('http') && !path.startsWith('assets/') && !path.startsWith('/assets/');
  }

  private getPhotoUrl(path: string): string {
    return this.imageService.resolveImageUrl(
      path,
      undefined,
      95,
      'public-images',
      '/assets/images/products/placeholder.jpg'
    );
  }

  getCurrentSrcSet(): string {
    if (!this.currentImagePath) return '';
    return this.imageService.getSrcSet('public-images', this.currentImagePath, [400, 800], 75);
  }

  private setDefaultImages(): void {
    this.frontImage = '/assets/images/products/placeholder.jpg';
    this.currentImage = this.frontImage;
    this.backImage = '';
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  getProductName(): string {
    if ('nom' in this.produit) {
      return this.produit.nom;
    }
    if (this.produitM?.nom) {
      return this.produitM.nom;
    }
    return 'Produit';
  }

  getProductPrice(): number {
    return this.finalPrice || this.produitM?.prix || 0;
  }

  showBackImage(): void {
    if (this.backImage) {
      this.currentImage = this.backImage;
      const backPath = (this.produit as Produit).back_photo_path;
      this.currentImagePath = backPath && this.isStoragePath(backPath) ? backPath : null;
      this.isHovering = true;
    }
  }

  showFrontImage(): void {
    this.currentImage = this.frontImage || '/assets/images/products/placeholder.jpg';
    const frontPath = (this.produit as Produit).front_photo_path;
    this.currentImagePath = frontPath && this.isStoragePath(frontPath) ? frontPath : null;
    this.isHovering = false;
  }

  toggleFavorite(event: Event): void {
    event.stopPropagation();
    const productName = this.getProductName();
    this.favoritesService.toggleFavorite(this.produit.id, productName);
  }

  navigateToProductDetail(): void {
    const productId = 'produit_id' in this.produit ? this.produit.produit_id : this.produit.id;

    this.router.navigate(['/product-detail', productId]).then(() => {
      setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }, 100);
    });
  }

  openProductModal(event: Event): void {
    event.stopPropagation();

    let productId: string;

    if ('produit_id' in this.produit) {
      productId = this.produit.produit_id;
    } else {
      productId = this.produit.id;
    }

    const modalRef = this.modalService.open(ProductModalComponent, {
      centered: true,
      size: 'lg',
      windowClass: 'product-modal-window',
      backdrop: 'static'
    });

    modalRef.componentInstance.productId = productId;

    // Pass variants data to modal if available
    if ('variants' in this.produit && (this.produit as ProductWithVariants).variants) {
      modalRef.componentInstance.preloadedVariants = (this.produit as ProductWithVariants).variants;
    }

    modalRef.componentInstance.addToCartEvent.subscribe((result: unknown) => {
      this.addToCartSuccess.emit(result);
    });
  }

  // ============================================================================
  // COLOR SELECTION
  // ============================================================================

  getAvailableColors(): Colors[] {
    return this.availableColors;
  }

  hasMultipleColors(): boolean {
    return this.availableColors.length > 1;
  }

  onColorSelect(color: Colors, event: Event): void {
    event.stopPropagation();
    this.selectedColorId = color.id;
    this.loadImageForColor(color.id);
  }

  private loadImageForColor(colorId: number): void {
    if (!this.produit?.id) return;

    this.supabaseService.getClient()
      .from('variant')
      .select('main_photo_path, others_photos')
      .eq('produit_id', this.produit.id)
      .eq('couleur_id', colorId)
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          console.warn('Error loading variant image for color:', error);
          return;
        }

        if (data && data.length > 0) {
          const variant = data[0];

          if (variant.main_photo_path && variant.main_photo_path.length > 0) {
            this.frontImage = this.getPhotoUrl(variant.main_photo_path[0]);
            this.currentImage = this.frontImage;
          }

          if (variant.others_photos && variant.others_photos.length > 0) {
            this.backImage = this.getPhotoUrl(variant.others_photos[0]);
          } else if (variant.main_photo_path && variant.main_photo_path.length > 1) {
            this.backImage = this.getPhotoUrl(variant.main_photo_path[1]);
          }
        }
      });
  }
}
