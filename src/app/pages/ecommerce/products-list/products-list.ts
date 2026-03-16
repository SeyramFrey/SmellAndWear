import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, TemplateRef } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgbPaginationModule, NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { DropzoneModule, DropzoneConfigInterface } from 'ngx-dropzone-wrapper';
import { PaginationService } from 'src/app/core/services/pagination.service';
import { SharedModule } from 'src/app/shared/shared.module';
import { CategorieService } from 'src/app/core/services/categorie.service';
import { ProductService } from 'src/app/core/services/product.service';
import { SupabaseService } from 'src/app/core/services/supabase.service';
import { ImageService, IMAGE_SIZES } from 'src/app/core/services/image.service';
import { Categorie, Produit } from 'src/app/core/models/models';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { takeUntil, finalize, catchError, tap } from 'rxjs/operators';

// Sweet Alert
import Swal from 'sweetalert2';


interface UploadedFile {
  file: File;
  path?: string;
  url?: string;
  progress: number;
  uploading: boolean;
  error?: string;
  preview?: string;
}

interface ColorImageSet {
  colorId: number;
  colorName: string;
  colorHex: string;
  primaryImage: UploadedFile | null;
  galleryImages: UploadedFile[];
}

interface ColorOption {
  id: number;
  nom: string;
  hex: string;
}

interface SizeOption {
  id: string;
  libelle: string;
}

interface CategoryOption {
  id: string;
  nom: string;
}

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    NgbPaginationModule, 
    SharedModule, 
    ReactiveFormsModule,
    FormsModule,
    DropzoneModule
  ],
  templateUrl: './products-list.html',
  styleUrl: './products-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsList implements OnInit, OnDestroy {
  @ViewChild('addProductModal', { static: false }) addProductModal!: TemplateRef<any>;
  @ViewChild('editProductModal', { static: false }) editProductModal!: TemplateRef<any>;

  // bread crumb items
  breadCrumbItems!: Array<{}>;
  
  // Data properties
  subcategoryId: string = '';
  subcategory: Categorie | null = null;
  allProducts: Produit[] = [];
  listview: Produit[] = [];
  
  // Component state
  loading = false;
  error: string | null = null;
  
  // Modal and form properties
  addProductForm!: FormGroup;
  editProductForm!: FormGroup;
  modalRef: NgbModalRef | null = null;
  formSubmitting = false;
  formError: string | null = null;
  formSuccess = false;
  
  // Edit modal properties
  editingProduct: Produit | null = null;
  editFormSubmitting = false;
  editFormError: string | null = null;
  editFormSuccess = false;
  
  // Form options
  availableCategories: CategoryOption[] = [];
  
  // Enhanced variant system properties
  availableColors: ColorOption[] = [];
  availableSizes: SizeOption[] = [];
  selectedColors: number[] = [];
  selectedSizes: string[] = [];
  colorImageSets: ColorImageSet[] = [];
  uploadingFiles = false;
  
  // Color search functionality
  colorSearchTerm: string = '';
  
  // Legacy file upload properties (for backward compatibility)
  frontPhotoFiles: UploadedFile[] = [];
  backPhotoFiles: UploadedFile[] = [];
  
  // Edit modal file upload properties
  editFrontPhotoFiles: UploadedFile[] = [];
  editBackPhotoFiles: UploadedFile[] = [];
  editingFrontPhotoToRemove: string | null = null;
  editingBackPhotoToRemove: string | null = null;
  
  // Dropzone configurations
  frontPhotoConfig: DropzoneConfigInterface = {
    url: 'placeholder', // Will be handled manually
    maxFiles: 1,
    acceptedFiles: 'image/*',
    maxFilesize: 10, // 10MB
    addRemoveLinks: true,
    autoProcessQueue: false,
    uploadMultiple: false,
    parallelUploads: 1,
    clickable: true,
    createImageThumbnails: true,
    thumbnailWidth: 120,
    thumbnailHeight: 120,
    dictDefaultMessage: 'Cliquez ou glissez l\'image de face ici',
    dictFallbackMessage: 'Votre navigateur ne supporte pas le glisser-déposer.',
    dictInvalidFileType: 'Ce type de fichier n\'est pas accepté.',
    dictFileTooBig: 'Le fichier est trop volumineux ({{filesize}}MB). Taille max: {{maxFilesize}}MB.',
    dictResponseError: 'Erreur lors de l\'upload ({{statusCode}})',
    dictRemoveFile: 'Supprimer',
    dictCancelUpload: 'Annuler',
    dictUploadCanceled: 'Upload annulé',
    dictCancelUploadConfirmation: 'Voulez-vous vraiment annuler cet upload?',
    dictMaxFilesExceeded: 'Vous ne pouvez pas ajouter plus de fichiers.'
  };

  backPhotoConfig: DropzoneConfigInterface = {
    ...this.frontPhotoConfig,
    dictDefaultMessage: 'Cliquez ou glissez l\'image de dos ici'
  };
  
  private destroy$ = new Subject<void>();

  constructor(
    public service: PaginationService,
    private route: ActivatedRoute,
    private categorieService: CategorieService,
    private produitService: ProductService,
    private supabaseService: SupabaseService,
    private imageService: ImageService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.service.pageSize = 6; // Page size for products
    this.initializeForm();
  }

  ngOnInit(): void {
    // Get subcategory ID from route params
    this.route.params.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      // The subcategory ID is passed as the URL segment from sous-categories navigation
      const subcategoryId = params['subcategoryId'] || params['id'] || params['categoryId'];
      console.log('Route params:', params, 'subcategoryId found:', subcategoryId);
      
      if (subcategoryId) {
        this.subcategoryId = subcategoryId;
        this.loadSubcategoryAndProducts();
        this.loadFormOptions();
      } else {
        this.error = 'ID de sous-catégorie manquant';
      }
    });

    // Also try URL segments as fallback
    this.route.url.pipe(
      takeUntil(this.destroy$)
    ).subscribe(segments => {
      if (segments.length > 0 && !this.subcategoryId) {
        this.subcategoryId = segments[segments.length - 1].path;
        console.log('Subcategory ID from URL segments:', this.subcategoryId);
        this.loadSubcategoryAndProducts();
        this.loadFormOptions();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupOrphanedUploads();
  }

  private initializeForm(): void {
    this.addProductForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
      description: ['', [Validators.maxLength(2000)]],
      prix: ['', [Validators.required, Validators.min(0), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
      sous_categorie_id: [this.subcategoryId, [Validators.required]],
      selectedColors: [[], [Validators.required, Validators.minLength(1)]],
      selectedSizes: [[], [Validators.required, Validators.minLength(1)]],
      is_hidden: [false],
      visibility_mode: ['immediate'],
      publish_at: [null as string | null],
      unpublish_at: [null as string | null]
    });

    this.editProductForm = this.fb.group({
      nom: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
      description: ['', [Validators.maxLength(2000)]],
      prix: ['', [Validators.required, Validators.min(0), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
      sous_categorie_id: [''],
      is_best_seller: [false],
      is_new: [false],
      is_hidden: [false],
      visibility_mode: ['immediate'],
      publish_at: [null as string | null],
      unpublish_at: [null as string | null]
    });
  }

  private loadFormOptions(): void {
    // Load available categories, colors, and sizes
    forkJoin({
      categories: this.categorieService.getCategories().pipe(
        catchError(error => {
          console.error('Error loading categories:', error);
          return of([]);
        })
      ),
      colors: this.getColors(),
      sizes: this.getSizes()
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe(({ categories, colors, sizes }) => {
      // Filter to only show subcategories (categories with parent_id)
      const subcategories = categories.filter(cat => cat.parent_id);
      this.availableCategories = subcategories.map(cat => ({
        id: cat.id,
        nom: cat.nom || 'Catégorie sans nom'
      }));
      this.availableColors = colors;
      this.availableSizes = sizes;
      this.cdr.detectChanges();
    });
  }

  private getColors(): Observable<ColorOption[]> {
    return new Observable(observer => {
      this.supabaseService.getClient()
        .from('colors')
        .select('id, nom, hex')
        .order('nom')
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
          } else {
            observer.next(data.map(item => ({
              id: Number(item.id),
              nom: item.nom || `Color ${item.id}`,
              hex: item.hex || '#000000'
            })));
            observer.complete();
          }
        });
    });
  }

  private getSizes(): Observable<SizeOption[]> {
    return new Observable(observer => {
      this.supabaseService.getClient()
        .from('taille')
        .select('id, libelle')
        .order('libelle')
        .then(({ data, error }) => {
          if (error) {
            observer.error(error);
          } else {
            observer.next(data.map(item => ({
              id: item.id,
              libelle: item.libelle?.trim() || item.id
            })));
            observer.complete();
          }
        });
    });
  }

  private loadSubcategoryAndProducts(): void {
    this.loading = true;
    this.error = null;

    // Load subcategory first
    this.categorieService.getCategorieById(this.subcategoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (subcategory) => {
          this.subcategory = subcategory;
          this.loadParentCategoryForBreadcrumbs();
          this.loadProducts();
        },
        error: (error) => {
          console.error('Error fetching subcategory:', error);
          this.error = 'Erreur lors du chargement de la sous-catégorie';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  private loadProducts(): void {
    this.produitService.getProduitsByCategorie(this.subcategoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          console.log('Products loaded for subcategory:', this.subcategoryId, products);
          this.allProducts = products;
          this.updateListView();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error fetching products for subcategory:', error);
          this.error = 'Erreur lors du chargement des produits';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  private loadParentCategoryForBreadcrumbs(): void {
    if (this.subcategory?.parent_id) {
      this.categorieService.getCategorieById(this.subcategory.parent_id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (parentCategory) => {
            this.updateBreadcrumbs(parentCategory);
          },
          error: (error) => {
            console.error('Error fetching parent category:', error);
            this.updateBreadcrumbs();
          }
        });
    } else {
      this.updateBreadcrumbs();
    }
  }

  private updateBreadcrumbs(parentCategory?: Categorie): void {
    this.breadCrumbItems = [
      { label: 'Ecommerce' },
      { label: 'Categories', routerLink: '/admin/ecommerce/categories' }
    ];

    if (parentCategory) {
      this.breadCrumbItems.push({
        label: parentCategory.nom,
        routerLink: `/admin/ecommerce/sous-categories/${parentCategory.id}`
      });
    }

    this.breadCrumbItems.push({
      label: this.subcategory?.nom || 'Produits',
      active: true
    });
  }

  private updateListView(): void {
    this.listview = this.service.changePage(this.allProducts);
  }

  /**
   * Refresh data
   */
  refreshData(): void {
    this.error = null;
    if (this.subcategoryId) {
      this.loadSubcategoryAndProducts();
    } else {
      this.error = 'ID de sous-catégorie manquant';
    }
  }

  /**
   * Get filtered colors based on search term
   * Optimized for instant filtering while typing
   */
  get filteredColors(): ColorOption[] {
    if (!this.colorSearchTerm?.trim()) {
      return this.availableColors;
    }
    
    const searchTerm = this.colorSearchTerm.toLowerCase().trim();
    return this.availableColors.filter(color => 
      color.nom?.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Clear color search
   */
  clearColorSearch(): void {
    this.colorSearchTerm = '';
    this.cdr.detectChanges(); // Trigger immediate UI update
  }

  /**
   * Handle color search input changes for instant filtering
   */
  onColorSearchChange(): void {
    this.cdr.detectChanges(); // Ensure immediate filtering response
  }

  /**
   * TrackBy function for colors for performance optimization
   */
  trackByColorId(index: number, color: ColorOption): number {
    return color.id;
  }

  // Pagination
  changePage(): void {
    this.updateListView();
  }


  // TrackBy function for performance
  trackByProductId(index: number, product: Produit): string {
    return product.id;
  }

  /** Convert UTC ISO string to local datetime-local input value (Europe/Paris) */
  toLocalDatetimeString(iso: string): string {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}`;
  }

  /** Convert local datetime-local value to UTC ISO string */
  toUtcIsoString(localValue: string | null): string | null {
    if (!localValue) return null;
    return new Date(localValue).toISOString();
  }

  /** Get visibility payload for API from form value */
  getVisibilityPayload(formValue: any): { is_hidden: boolean; publish_at: string | null; unpublish_at: string | null } {
    const is_hidden = !!formValue.is_hidden;
    const mode = formValue.visibility_mode || 'immediate';
    let publish_at: string | null = null;
    let unpublish_at: string | null = null;
    if (mode === 'schedule' && formValue.publish_at) {
      publish_at = this.toUtcIsoString(formValue.publish_at);
    } else if (mode === 'range') {
      publish_at = formValue.publish_at ? this.toUtcIsoString(formValue.publish_at) : null;
      unpublish_at = formValue.unpublish_at ? this.toUtcIsoString(formValue.unpublish_at) : null;
    }
    return { is_hidden, publish_at, unpublish_at };
  }

  /** Get visibility status badge for product list */
  getProductVisibilityStatus(product: Produit & { is_hidden?: boolean; publish_at?: string; unpublish_at?: string }): { label: string; badge: string } {
    const now = new Date();
    if (product.is_hidden) return { label: 'Masqué', badge: 'bg-secondary' };
    const pub = product.publish_at ? new Date(product.publish_at) : null;
    const unpub = product.unpublish_at ? new Date(product.unpublish_at) : null;
    if (pub && now < pub) return { label: 'Programmé', badge: 'bg-info' };
    if (unpub && now >= unpub) return { label: 'Dépublié', badge: 'bg-warning' };
    return { label: 'Visible', badge: 'bg-success' };
  }

  /** Format date for display (Europe/Paris) */
  formatDateParis(iso: string | null | undefined): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' });
  }

  /**
   * Open the add product modal
   */
  openAddProductModal(): void {
    this.resetForm();
    this.modalRef = this.modalService.open(this.addProductModal, { 
      size: 'xl', 
      centered: true,
      backdrop: 'static'
    });
  }

  /**
   * Reset form and clear any previous state
   */
  private resetForm(): void {
    this.addProductForm.reset({
      nom: '',
      description: '',
      prix: '',
      sous_categorie_id: this.subcategoryId,
      selectedColors: [],
      selectedSizes: [],
      is_hidden: false,
      visibility_mode: 'immediate',
      publish_at: null,
      unpublish_at: null
    });
    this.formError = null;
    this.formSuccess = false;
    this.formSubmitting = false;
    this.selectedColors = [];
    this.selectedSizes = [];
    this.colorImageSets = [];
    this.colorSearchTerm = ''; // Reset color search
    this.clearAllFiles();
  }

  /**
   * Handle front photo file addition
   */
  onFrontPhotoAdded(file: File): void {
      if (!file) return;
      this.clearFrontPhotos();
      const uploadedFile: UploadedFile = {
          file,
          progress: 0,
          uploading: false,
          preview: this.createFilePreview(file)
      };
      this.frontPhotoFiles = [uploadedFile];
      this.cdr.markForCheck();
  }

  /**
   * Handle back photo file addition
   */
  onBackPhotoAdded(file: File): void {
      if (!file) return;
      this.clearBackPhotos();
      const uploadedFile: UploadedFile = {
          file,
          progress: 0,
          uploading: false,
          preview: this.createFilePreview(file)
      };
      this.backPhotoFiles = [uploadedFile];
      this.cdr.markForCheck();
  }

  /**
   * Handle file removal
   */
  onFileRemoved(_file: File, type: 'front' | 'back'): void {
      if (type === 'front') this.clearFrontPhotos();
      else this.clearBackPhotos();
      this.cdr.markForCheck();
  }

  /**
   * Create preview URL for file
   */
  private createFilePreview(file: File): string {
    return URL.createObjectURL(file);
  }

  /**
   * Clear all files
   */
  private clearAllFiles(): void {
    this.clearFrontPhotos();
    this.clearBackPhotos();
    this.clearColorImageSets();
  }

  /**
   * Clear color image sets
   */
  private clearColorImageSets(): void {
    this.colorImageSets.forEach(colorSet => {
      if (colorSet.primaryImage?.preview) {
        URL.revokeObjectURL(colorSet.primaryImage.preview);
      }
      colorSet.galleryImages.forEach(img => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });
    });
    this.colorImageSets = [];
  }

  // === COLOR AND SIZE SELECTION METHODS ===

  /**
   * Toggle color selection
   */
  onColorToggle(colorId: number): void {
    const index = this.selectedColors.indexOf(colorId);
    if (index > -1) {
      // Remove color
      this.selectedColors.splice(index, 1);
      this.removeColorImageSet(colorId);
    } else {
      // Add color
      this.selectedColors.push(colorId);
      this.addColorImageSet(colorId);
    }
    this.addProductForm.patchValue({ selectedColors: this.selectedColors });
    this.cdr.detectChanges();
  }

  /**
   * Toggle size selection
   */
  onSizeToggle(sizeId: string): void {
    const index = this.selectedSizes.indexOf(sizeId);
    if (index > -1) {
      this.selectedSizes.splice(index, 1);
    } else {
      this.selectedSizes.push(sizeId);
    }
    this.addProductForm.patchValue({ selectedSizes: this.selectedSizes });
    this.cdr.detectChanges();
  }

  /**
   * Check if color is selected
   */
  isColorSelected(colorId: number): boolean {
    return this.selectedColors.includes(colorId);
  }

  /**
   * Check if size is selected
   */
  isSizeSelected(sizeId: string): boolean {
    return this.selectedSizes.includes(sizeId);
  }

  /**
   * Add color image set
   */
  private addColorImageSet(colorId: number): void {
    const color = this.availableColors.find(c => c.id === colorId);
    if (color) {
      this.colorImageSets.push({
        colorId: color.id,
        colorName: color.nom,
        colorHex: color.hex,
        primaryImage: null,
        galleryImages: []
      });
    }
  }

  /**
   * Remove color image set
   */
  private removeColorImageSet(colorId: number): void {
    const index = this.colorImageSets.findIndex(cs => cs.colorId === colorId);
    if (index > -1) {
      const colorSet = this.colorImageSets[index];
      // Clean up object URLs
      if (colorSet.primaryImage?.preview) {
        URL.revokeObjectURL(colorSet.primaryImage.preview);
      }
      colorSet.galleryImages.forEach(img => {
        if (img.preview) URL.revokeObjectURL(img.preview);
      });
      this.colorImageSets.splice(index, 1);
    }
  }

  /**
   * Get color image set by color ID
   */
  getColorImageSet(colorId: number): ColorImageSet | undefined {
    return this.colorImageSets.find(cs => cs.colorId === colorId);
  }

  // === COLOR IMAGE MANAGEMENT METHODS ===

  /**
   * Handle primary image selection for a color
   */
  onColorPrimaryImageSelected(event: any, colorId: number): void {
    const file = event.target.files[0];
    if (file) {
      const colorSet = this.getColorImageSet(colorId);
      if (colorSet) {
        // Clean up previous primary image
        if (colorSet.primaryImage?.preview) {
          URL.revokeObjectURL(colorSet.primaryImage.preview);
        }
        
        colorSet.primaryImage = {
          file,
          progress: 0,
          uploading: false,
          preview: this.createFilePreview(file)
        };
        this.cdr.detectChanges();
      }
    }
  }

  /**
   * Handle gallery images selection for a color
   */
  onColorGalleryImagesSelected(event: any, colorId: number): void {
    const files = Array.from(event.target.files) as File[];
    const colorSet = this.getColorImageSet(colorId);
    if (colorSet && files.length > 0) {
      files.forEach(file => {
        colorSet.galleryImages.push({
          file,
          progress: 0,
          uploading: false,
          preview: this.createFilePreview(file)
        });
      });
      this.cdr.detectChanges();
    }
  }

  /**
   * Remove primary image for a color
   */
  removeColorPrimaryImage(colorId: number): void {
    const colorSet = this.getColorImageSet(colorId);
    if (colorSet && colorSet.primaryImage) {
      if (colorSet.primaryImage.preview) {
        URL.revokeObjectURL(colorSet.primaryImage.preview);
      }
      colorSet.primaryImage = null;
      this.cdr.detectChanges();
    }
  }

  /**
   * Remove gallery image for a color
   */
  removeColorGalleryImage(colorId: number, imageIndex: number): void {
    const colorSet = this.getColorImageSet(colorId);
    if (colorSet && colorSet.galleryImages[imageIndex]) {
      const image = colorSet.galleryImages[imageIndex];
      if (image.preview) {
        URL.revokeObjectURL(image.preview);
      }
      colorSet.galleryImages.splice(imageIndex, 1);
      this.cdr.detectChanges();
    }
  }

  /**
   * Trigger primary image input for a color
   */
  triggerColorPrimaryImageInput(colorId: number): void {
    document.getElementById(`primaryImage_${colorId}`)?.click();
  }

  /**
   * Trigger gallery images input for a color
   */
  triggerColorGalleryImagesInput(colorId: number): void {
    document.getElementById(`galleryImages_${colorId}`)?.click();
  }

  /**
   * Clear front photos
   */
  private clearFrontPhotos(): void {
    this.frontPhotoFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    this.frontPhotoFiles = [];
  }

  /**
   * Clear back photos
   */
  private clearBackPhotos(): void {
    this.backPhotoFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    this.backPhotoFiles = [];
  }

  /**
   * Upload files to Supabase storage
   */
  private async uploadFiles(files: UploadedFile[], prefix: string): Promise<string[]> {
    const uploadPromises: Promise<string>[] = [];
    
    for (const uploadedFile of files) {
      uploadedFile.uploading = true;
      uploadedFile.progress = 0;
      this.cdr.detectChanges();
      
      const fileName = `${prefix}_${Date.now()}_${uploadedFile.file.name}`;
      
      const uploadPromise = this.supabaseService.getClient().storage
        .from('public-images')
        .upload(`produits/${fileName}`, uploadedFile.file, {
          cacheControl: '3600',
          upsert: false
        })
        .then(({ data, error }) => {
          if (error) {
            uploadedFile.error = error.message;
            throw error;
          }
          uploadedFile.path = data.path;
          uploadedFile.progress = 100;
          uploadedFile.uploading = false;
          
          // Use optimized WEBP URL for preview (admin)
          uploadedFile.url = this.imageService.getOptimizedImageUrl(
            'public-images',
            data.path,
            IMAGE_SIZES.ADMIN_PREVIEW,
            75
          );
          this.cdr.detectChanges();
          
          return data.path; // Return storage path, not full URL
        })
        .catch(error => {
          uploadedFile.uploading = false;
          uploadedFile.error = error.message;
          this.cdr.detectChanges();
          throw error;
        });
      
      uploadPromises.push(uploadPromise);
    }
    
    return Promise.all(uploadPromises);
  }

  /**
   * Upload color images to storage
   */
  private async uploadColorImages(): Promise<void> {
    for (const colorSet of this.colorImageSets) {
      // Upload primary image
      if (colorSet.primaryImage) {
        const primaryPaths = await this.uploadFiles([colorSet.primaryImage], `color_${colorSet.colorId}_primary`);
        colorSet.primaryImage.path = primaryPaths[0];
      }
      
      // Upload gallery images
      if (colorSet.galleryImages.length > 0) {
        const galleryPaths = await this.uploadFiles(colorSet.galleryImages, `color_${colorSet.colorId}_gallery`);
        colorSet.galleryImages.forEach((img, index) => {
          img.path = galleryPaths[index];
        });
      }
    }
  }

  /**
   * Submit the form to create a new product with variants
   */
  async onSubmitProduct(): Promise<void> {
    if (this.addProductForm.invalid) {
      this.addProductForm.markAllAsTouched();
      // Prevent scroll/jump on validation - just mark fields
      // Don't use scrollIntoView or focus() that causes zoom
      return;
    }

    // Validate that each selected color has at least a primary image
    const missingImages = this.colorImageSets.filter(cs => !cs.primaryImage);
    if (missingImages.length > 0) {
      this.formError = `Veuillez ajouter une image principale pour chaque couleur sélectionnée.`;
      return;
    }

    this.formSubmitting = true;
    this.formError = null;
    this.formSuccess = false;
    this.uploadingFiles = true;
    this.cdr.detectChanges();

    try {
      const formValue = this.addProductForm.value;
      
      // Upload product front and back photos first
      let frontPhotoPath: string | null = null;
      let backPhotoPath: string | null = null;
      
      if (this.frontPhotoFiles.length > 0) {
        const frontPaths = await this.uploadFiles(this.frontPhotoFiles, 'front');
        frontPhotoPath = frontPaths[0];
      }
      
      if (this.backPhotoFiles.length > 0) {
        const backPaths = await this.uploadFiles(this.backPhotoFiles, 'back');
        backPhotoPath = backPaths[0];
      }
      
      // Upload all color images
      await this.uploadColorImages();
      
      const { is_hidden, publish_at, unpublish_at } = this.getVisibilityPayload(formValue);
      const productData = {
        nom: formValue.nom.trim(),
        description: formValue.description?.trim() || null,
        prix: parseFloat(formValue.prix),
        sous_categorie_id: formValue.sous_categorie_id || null,
        selected_colors: this.selectedColors,
        selected_sizes: this.selectedSizes,
        front_photo_path: this.frontPhotoFiles[0]?.url || frontPhotoPath,
        back_photo_path: this.backPhotoFiles[0]?.url || backPhotoPath,
        is_hidden,
        publish_at,
        unpublish_at
      };

      // Insert product into database
      const { data: productData_inserted, error: productError } = await this.supabaseService.getClient()
        .from('produit')
        .insert([productData])
        .select()
        .single();

      if (productError) {
        throw productError;
      }

      const productId = productData_inserted.id;

      // Insert color images
      await this.insertColorImages(productId);
      
      // Generate and insert variants
      await this.generateVariants(productId, formValue.prix);

      this.formSuccess = true;
      this.cdr.detectChanges();
      
      // Close modal after a short delay and refresh products
      setTimeout(() => {
        this.modalRef?.close();
        this.loadProducts(); // Refresh the products list
      }, 1500);

    } catch (error: any) {
      console.error('Error creating product:', error);
      this.formError = error.message || 'Une erreur est survenue lors de la création du produit';
      
      // Cleanup uploaded files if insertion failed
      await this.cleanupFailedUpload();
      
    } finally {
      this.formSubmitting = false;
      this.uploadingFiles = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Insert color images into database
   */
  private async insertColorImages(productId: string): Promise<void> {
    const colorImageData = this.colorImageSets.map(colorSet => ({
      produit_id: productId,
      couleur_id: colorSet.colorId,
      primary_image_path: colorSet.primaryImage?.path || '',
      gallery_images_paths: colorSet.galleryImages.map(img => img.path || '').filter(path => path)
    }));

    const { error } = await this.supabaseService.getClient()
      .from('product_color_images')
      .insert(colorImageData);

    if (error) {
      throw error;
    }
  }

  /**
   * Generate variants as cartesian product of colors × sizes
   */
  private async generateVariants(productId: string, price: number): Promise<void> {
    const variants = [];
    
    for (const colorId of this.selectedColors) {
      // Get the color image set for this color
      const colorImageSet = this.colorImageSets.find(cs => cs.colorId === colorId);
      
      // Prepare photo arrays for this color
      const mainPhotoPath: string[] = [];
      const othersPhotos: string[] = [];
      
      if (colorImageSet) {
        // Add primary image to main_photo_path array
        if (colorImageSet.primaryImage?.path) {
          mainPhotoPath.push(colorImageSet.primaryImage.path);
        }
        
        // Add gallery images to others_photos array
        colorImageSet.galleryImages.forEach(img => {
          if (img.path) {
            othersPhotos.push(img.path);
          }
        });
        
        console.log(`Color ${colorId} - Main photos: ${mainPhotoPath.length}, Other photos: ${othersPhotos.length}`);
      } else {
        console.warn(`No image set found for color ${colorId}`);
      }
      
      // Create variants for all sizes of this color
      // Note: Price is stored on product, not variant
      for (const sizeId of this.selectedSizes) {
        variants.push({
          produit_id: productId,
          couleur_id: colorId,
          taille_id: sizeId,
          stock: 0, // Default stock
          is_primary: false, // Will be set manually later if needed
          main_photo_path: mainPhotoPath.length > 0 ? mainPhotoPath : null,
          others_photos: othersPhotos.length > 0 ? othersPhotos : null
        });
      }
    }

    if (variants.length > 0) {
      console.log('Creating variants with photo data:', variants);
      
      const { error } = await this.supabaseService.getClient()
        .from('variant')
        .insert(variants);

      if (error) {
        console.error('Error inserting variants:', error);
        throw error;
      }
      
      console.log(`Successfully created ${variants.length} variants with photos`);
    }
  }

  /**
   * Cleanup failed uploads
   */
  private async cleanupFailedUpload(): Promise<void> {
    const pathsToDelete: string[] = [];
    
    // Legacy files
    this.frontPhotoFiles.forEach(f => {
      if (f.path) pathsToDelete.push(f.path);
    });
    
    this.backPhotoFiles.forEach(f => {
      if (f.path) pathsToDelete.push(f.path);
    });
    
    // Color image files
    this.colorImageSets.forEach(colorSet => {
      if (colorSet.primaryImage?.path) {
        pathsToDelete.push(colorSet.primaryImage.path);
      }
      colorSet.galleryImages.forEach(img => {
        if (img.path) pathsToDelete.push(img.path);
      });
    });
    
    if (pathsToDelete.length > 0) {
      try {
        await this.supabaseService.getClient().storage
          .from('public-images')
          .remove(pathsToDelete);
      } catch (error) {
        console.warn('Failed to cleanup uploaded files:', error);
      }
    }
  }

  /**
   * Cleanup orphaned uploads on component destroy
   */
  private cleanupOrphanedUploads(): void {
    // Revoke object URLs to prevent memory leaks
    this.frontPhotoFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    
    this.backPhotoFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    
    // Clean up color image sets
    this.clearColorImageSets();
  }

  /**
   * Close the modal
   */
  closeModal(): void {
    this.modalRef?.close();
  }

  /**
   * Check if form field has error
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.addProductForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Get field error message
   */
  getFieldError(fieldName: string): string {
    const field = this.addProductForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) {
        return `${fieldName} est requis`;
      }
      if (field.errors['minlength']) {
        return `${fieldName} doit contenir au moins ${field.errors['minlength'].requiredLength} caractères`;
      }
      if (field.errors['maxlength']) {
        return `${fieldName} ne peut pas dépasser ${field.errors['maxlength'].requiredLength} caractères`;
      }
      if (field.errors['min']) {
        return `${fieldName} doit être supérieur ou égal à ${field.errors['min'].min}`;
      }
      if (field.errors['pattern']) {
        return `Format invalide pour ${fieldName}`;
      }
    }
    return '';
  }

  /**
   * Get upload progress for display
   */
  getUploadProgress(): number {
    const allFiles = [...this.frontPhotoFiles, ...this.backPhotoFiles];
    
    // Add color image files
    this.colorImageSets.forEach(colorSet => {
      if (colorSet.primaryImage) allFiles.push(colorSet.primaryImage);
      allFiles.push(...colorSet.galleryImages);
    });
    
    if (allFiles.length === 0) return 0;
    
    const totalProgress = allFiles.reduce((sum, file) => sum + file.progress, 0);
    return Math.round(totalProgress / allFiles.length);
  }

  /**
   * Check if any files are uploading
   */
  isUploading(): boolean {
    const allFiles = [...this.frontPhotoFiles, ...this.backPhotoFiles];
    
    // Add color image files
    this.colorImageSets.forEach(colorSet => {
      if (colorSet.primaryImage) allFiles.push(colorSet.primaryImage);
      allFiles.push(...colorSet.galleryImages);
    });
    
    return allFiles.some(f => f.uploading);
  }

  /**
   * Check if there are any upload errors
   */
  hasUploadErrors(): boolean {
    const allFiles = [...this.frontPhotoFiles, ...this.backPhotoFiles];
    
    // Add color image files
    this.colorImageSets.forEach(colorSet => {
      if (colorSet.primaryImage) allFiles.push(colorSet.primaryImage);
      allFiles.push(...colorSet.galleryImages);
    });
    
    return allFiles.some(f => f.error);
  }

  /**
   * Get upload error messages
   */
  getUploadErrors(): string[] {
    const allFiles = [...this.frontPhotoFiles, ...this.backPhotoFiles];
    
    // Add color image files
    this.colorImageSets.forEach(colorSet => {
      if (colorSet.primaryImage) allFiles.push(colorSet.primaryImage);
      allFiles.push(...colorSet.galleryImages);
    });
    
    return allFiles
      .filter(f => f.error)
      .map(f => f.error!);
  }

  // === EDIT AND DELETE PRODUCT METHODS ===

  /**
   * Edit product - open edit modal
   */
  editProduct(product: Produit): void {
    this.editingProduct = product;
    this.resetEditForm();
    
    // Populate the form with product data
    const p = product as Produit & { is_hidden?: boolean; publish_at?: string; unpublish_at?: string };
    const mode = p.publish_at && p.unpublish_at ? 'range' : p.publish_at ? 'schedule' : 'immediate';
    this.editProductForm.patchValue({
      nom: product.nom,
      description: product.description || '',
      prix: product.prix,
      sous_categorie_id: product.sous_categorie_id || '',
      is_best_seller: product.is_best_seller || false,
      is_new: (product as any).is_new || false,
      is_hidden: p.is_hidden || false,
      visibility_mode: mode,
      publish_at: p.publish_at ? this.toLocalDatetimeString(p.publish_at) : null,
      unpublish_at: p.unpublish_at ? this.toLocalDatetimeString(p.unpublish_at) : null
    });

    // Open the modal
    this.modalRef = this.modalService.open(this.editProductModal, { 
      size: 'lg', 
      centered: true,
      backdrop: 'static'
    });
  }

  /**
   * Delete product with SweetAlert confirmation
   */
  deleteProduct(product: Produit): void {
    Swal.fire({
      title: 'Êtes-vous sûr?',
      text: `Voulez-vous vraiment supprimer le produit "${product.nom}" ? Cette action est irréversible et supprimera également toutes ses variantes.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Confirmer',
      cancelButtonText: 'Annuler',
      customClass: {
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-secondary'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.performProductDeletion(product);
      }
    });
  }

  /**
   * Perform the actual product deletion
   */
  private performProductDeletion(product: Produit): void {
    // Show loading state
    Swal.fire({
      title: 'Suppression en cours...',
      text: 'Veuillez patienter',
      icon: 'info',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.produitService.deleteProduct(product.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Remove from local arrays
          this.allProducts = this.allProducts.filter(p => p.id !== product.id);
          this.updateListView();
          this.cdr.detectChanges();

          // Show success message
          Swal.fire({
            title: 'Supprimé!',
            text: 'Le produit a été supprimé avec succès.',
            icon: 'success',
            confirmButtonText: 'OK'
          });
        },
        error: (error) => {
          console.error('Error deleting product:', error);
          Swal.fire({
            title: 'Erreur',
            text: 'Une erreur est survenue lors de la suppression du produit.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      });
  }

  /**
   * Submit edit product form
   */
  async onSubmitEditProduct(): Promise<void> {
    if (this.editProductForm.invalid || !this.editingProduct) {
      this.editProductForm.markAllAsTouched();
      return;
    }

    this.editFormSubmitting = true;
    this.editFormError = null;
    this.editFormSuccess = false;
    this.cdr.detectChanges();

    try {
      const formValue = this.editProductForm.value;
      
      // Handle photo operations first
      await this.handleEditPhotoOperations();
      
      // Prepare updated product data
      const { is_hidden, publish_at, unpublish_at } = this.getVisibilityPayload(formValue);
      const updateData: any = {
        nom: formValue.nom,
        description: formValue.description,
        prix: Number(formValue.prix),
        sous_categorie_id: formValue.sous_categorie_id || null,
        is_best_seller: formValue.is_best_seller,
        is_new: formValue.is_new,
        is_hidden,
        publish_at,
        unpublish_at
      };

      // Add photo paths if they've been modified
      if (this.editFrontPhotoFiles.length > 0 || this.editingFrontPhotoToRemove) {
        if (this.editFrontPhotoFiles.length > 0 && this.editFrontPhotoFiles[0].path) {
          updateData.front_photo_path = this.editFrontPhotoFiles[0].path;
        } else if (this.editingFrontPhotoToRemove) {
          updateData.front_photo_path = null;
        }
      }

      if (this.editBackPhotoFiles.length > 0 || this.editingBackPhotoToRemove) {
        if (this.editBackPhotoFiles.length > 0 && this.editBackPhotoFiles[0].path) {
          updateData.back_photo_path = this.editBackPhotoFiles[0].path;
        } else if (this.editingBackPhotoToRemove) {
          updateData.back_photo_path = null;
        }
      }

      // Update product in database
      const { data, error } = await this.supabaseService.getClient()
        .from('produit')
        .update(updateData)
        .eq('id', this.editingProduct.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      this.editFormSuccess = true;
      this.cdr.detectChanges();
      
      // Update local array
      const index = this.allProducts.findIndex(p => p.id === this.editingProduct!.id);
      if (index !== -1) {
        this.allProducts[index] = { ...this.allProducts[index], ...updateData };
        this.updateListView();
      }
      
      // Close modal after a short delay
      setTimeout(() => {
        this.closeEditModal();
        this.loadSubcategoryAndProducts(); // Refresh the data
      }, 1500);

    } catch (error: any) {
      console.error('Error updating product:', error);
      this.editFormError = error.message || 'An error occurred while updating the product';
      
    } finally {
      this.editFormSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Handle photo upload and deletion operations for editing
   */
  private async handleEditPhotoOperations(): Promise<void> {
    try {
      // Delete photos marked for removal
      if (this.editingFrontPhotoToRemove) {
        await this.deletePhotoFromStorage(this.editingFrontPhotoToRemove);
      }
      
      if (this.editingBackPhotoToRemove) {
        await this.deletePhotoFromStorage(this.editingBackPhotoToRemove);
      }

      // Upload new front photo
      if (this.editFrontPhotoFiles.length > 0) {
        const frontPhotoUrls = await this.uploadFiles(this.editFrontPhotoFiles, 'front');
        if (frontPhotoUrls.length > 0) {
          this.editFrontPhotoFiles[0].path = frontPhotoUrls[0];
        }
      }

      // Upload new back photo
      if (this.editBackPhotoFiles.length > 0) {
        const backPhotoUrls = await this.uploadFiles(this.editBackPhotoFiles, 'back');
        if (backPhotoUrls.length > 0) {
          this.editBackPhotoFiles[0].path = backPhotoUrls[0];
        }
      }

    } catch (error) {
      console.error('Error handling photo operations:', error);
      throw error;
    }
  }

  /**
   * Delete a photo from storage
   */
  private async deletePhotoFromStorage(photoPath: string): Promise<void> {
    try {
      const { error } = await this.supabaseService.getClient()
        .storage
        .from('public-images')
        .remove([photoPath]);
      
      if (error && error.message !== 'Object not found') {
        console.warn('Error deleting photo:', photoPath, error);
      }
    } catch (error) {
      console.warn('Error deleting photo:', photoPath, error);
    }
  }

  /**
   * Reset edit form and clear any previous state
   */
  private resetEditForm(): void {
    this.editFormSubmitting = false;
    this.editFormError = null;
    this.editFormSuccess = false;
    
    // Clear photo arrays
    this.editFrontPhotoFiles = [];
    this.editBackPhotoFiles = [];
    this.editingFrontPhotoToRemove = null;
    this.editingBackPhotoToRemove = null;
    
    // Reset form with initial values
    this.editProductForm.reset({
      nom: '',
      description: '',
      prix: '',
      sous_categorie_id: '',
      is_best_seller: false,
      is_new: false,
      is_hidden: false,
      visibility_mode: 'immediate',
      publish_at: null,
      unpublish_at: null
    });
    
    // Clear all validation states
    this.editProductForm.markAsUntouched();
    this.editProductForm.markAsPristine();
  }

  /**
   * Close edit modal
   */
  closeEditModal(): void {
    this.modalRef?.close();
    this.editingProduct = null;
    this.resetEditForm();
  }

  // === EDIT PHOTO HANDLING METHODS ===

  /**
   * Handle edit front photo selection
   */
  onEditFrontPhotoSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const uploadedFile: UploadedFile = {
        file,
        progress: 0,
        uploading: false,
        preview: this.createFilePreview(file)
      };
      this.editFrontPhotoFiles = [uploadedFile];
      this.cdr.detectChanges();
    }
  }

  /**
   * Handle edit back photo selection
   */
  onEditBackPhotoSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const uploadedFile: UploadedFile = {
        file,
        progress: 0,
        uploading: false,
        preview: this.createFilePreview(file)
      };
      this.editBackPhotoFiles = [uploadedFile];
      this.cdr.detectChanges();
    }
  }

  /**
   * Remove edit front photo
   */
  removeEditFrontPhoto(event: Event): void {
    event.stopPropagation();
    this.editFrontPhotoFiles.forEach(f => {
      if (f.preview) {
        URL.revokeObjectURL(f.preview);
      }
    });
    this.editFrontPhotoFiles = [];
    this.cdr.detectChanges();
  }

  /**
   * Remove edit back photo
   */
  removeEditBackPhoto(event: Event): void {
    event.stopPropagation();
    this.editBackPhotoFiles.forEach(f => {
      if (f.preview) {
        URL.revokeObjectURL(f.preview);
      }
    });
    this.editBackPhotoFiles = [];
    this.cdr.detectChanges();
  }

  /**
   * Remove current front photo (mark for deletion)
   */
  removeCurrentFrontPhoto(): void {
    if (this.editingProduct && this.editingProduct.front_photo_path) {
      this.editingFrontPhotoToRemove = this.editingProduct.front_photo_path;
      // Clear the front photo from display
      this.editingProduct.front_photo_path = undefined;
      this.cdr.detectChanges();
    }
  }

  /**
   * Remove current back photo (mark for deletion)
   */
  removeCurrentBackPhoto(): void {
    if (this.editingProduct && this.editingProduct.back_photo_path) {
      this.editingBackPhotoToRemove = this.editingProduct.back_photo_path;
      // Clear the back photo from display
      this.editingProduct.back_photo_path = undefined;
      this.cdr.detectChanges();
    }
  }

  /**
   * Trigger edit front photo input click
   */
  triggerEditFrontPhotoInput(): void {
    document.getElementById('editFrontPhoto')?.click();
  }

  /**
   * Trigger edit back photo input click
   */
  triggerEditBackPhotoInput(): void {
    document.getElementById('editBackPhoto')?.click();
  }

  // === FORM VALIDATION HELPERS FOR EDIT ===

  /**
   * Check if edit form field has error
   */
  isEditFieldInvalid(fieldName: string): boolean {
    const field = this.editProductForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Get edit field error message
   */
  getEditFieldError(fieldName: string): string {
    const field = this.editProductForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) {
        return `${fieldName} est requis`;
      }
      if (field.errors['min']) {
        return `${fieldName} doit être au moins ${field.errors['min'].min}`;
      }
      if (field.errors['minlength']) {
        return `${fieldName} doit contenir au moins ${field.errors['minlength'].requiredLength} caractères`;
      }
      if (field.errors['maxlength']) {
        return `${fieldName} ne peut pas dépasser ${field.errors['maxlength'].requiredLength} caractères`;
      }
      if (field.errors['pattern']) {
        return `${fieldName} format invalide`;
      }
    }
    return '';
  }

  /**
   * Get the display URL for a product image
   */
  getProductImageUrl(imagePath: string | null | undefined): string {
    return this.imageService.resolveImageUrl(
      imagePath ?? undefined,
      IMAGE_SIZES.ADMIN_PREVIEW,
      75,
      'public-images',
      '/assets/images/products/placeholder.jpg'
    );
  }
}