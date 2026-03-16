import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, TemplateRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Observable, Subject, of, forkJoin } from 'rxjs';
import { takeUntil, map, catchError, finalize } from 'rxjs/operators';

// Services
import { VariantService } from '../../../core/services/variant.service';
import { ProductService } from '../../../core/services/product.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ImageService, IMAGE_SIZES } from '../../../core/services/image.service';

// Models
import { Variant, ProduitVariation, Produit, Taille, Colors } from '../../../core/models/models';

// Dropzone import
import { DropzoneConfigInterface } from 'ngx-dropzone-wrapper';

// Sweet Alert
import Swal from 'sweetalert2';

interface TailleOption {
  id: string;
  libelle: string;
}

interface ColorOption {
  id: number;
  nom: string;
  hex: string;
}

interface UploadedFile {
  file: File;
  path?: string;
  url?: string;
  progress: number;
  uploading: boolean;
  error?: string;
  preview?: string;
}

@Component({
  selector: 'app-variants-list',
  templateUrl: './variant-list.component.html',
  styleUrls: ['./variant-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

/**
 * VariantList Component
 */
export class VariantListComponent implements OnInit, OnDestroy {
  @ViewChild('addVariantModal', { static: false }) addVariantModal!: TemplateRef<any>;
  @ViewChild('editVariantModal', { static: false }) editVariantModal!: TemplateRef<any>;

  // bread crumb items
  breadCrumbItems!: Array<{}>;
  submitted = false;

  // Data properties
  produitId: string = '';
  produit: Produit | null = null;
  variants$: Observable<ProduitVariation[]> = of([]);
  variants: ProduitVariation[] = [];
  loading = false;
  error: string | null = null;
  
  // Modal and form properties
  addVariantForm!: FormGroup;
  editVariantForm!: FormGroup;
  modalRef: NgbModalRef | null = null;
  formSubmitting = false;
  formError: string | null = null;
  formSuccess = false;
  
  // Edit mode properties
  editingVariant: ProduitVariation | null = null;
  isEditMode = false;
  editFormSubmitting = false;
  editFormError: string | null = null;
  editFormSuccess = false;
  
  // Form options
  availableSizes: TailleOption[] = [];
  availableColors: ColorOption[] = [];
  
  // File upload properties
  mainPhotoFiles: UploadedFile[] = [];
  otherPhotoFiles: UploadedFile[] = [];
  uploadingFiles = false;
  
  // Edit modal file upload properties
  editMainPhotoFiles: UploadedFile[] = [];
  editOtherPhotoFiles: UploadedFile[] = [];
  editingPhotosToRemove: string[] = []; // Paths of photos to remove
  editingMainPhotoToRemove: string | null = null; // Main photo to remove
  
  // Dropzone configurations
  mainPhotoConfig: DropzoneConfigInterface = {
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
    dictDefaultMessage: 'Cliquez ou glissez la photo principale ici',
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

  otherPhotosConfig: DropzoneConfigInterface = {
    url: 'placeholder', // Will be handled manually
    maxFiles: 5,
    acceptedFiles: 'image/*',
    maxFilesize: 10, // 10MB
    addRemoveLinks: true,
    autoProcessQueue: false,
    uploadMultiple: true,
    parallelUploads: 3,
    clickable: true,
    createImageThumbnails: true,
    thumbnailWidth: 120,
    thumbnailHeight: 120,
    dictDefaultMessage: 'Cliquez ou glissez les autres photos ici',
    dictFallbackMessage: 'Votre navigateur ne supporte pas le glisser-déposer.',
    dictInvalidFileType: 'Ce type de fichier n\'est pas accepté.',
    dictFileTooBig: 'Le fichier est trop volumineux ({{filesize}}MB). Taille max: {{maxFilesize}}MB.',
    dictResponseError: 'Erreur lors de l\'upload ({{statusCode}})',
    dictRemoveFile: 'Supprimer',
    dictCancelUpload: 'Annuler',
    dictUploadCanceled: 'Upload annulé',
    dictCancelUploadConfirmation: 'Voulez-vous vraiment annuler cet upload?',
    dictMaxFilesExceeded: 'Vous ne pouvez pas ajouter plus de {{maxFiles}} fichiers.'
  };
  
  private destroy$ = new Subject<void>();

  constructor(
    private modalService: NgbModal,
    private route: ActivatedRoute,
    private variantService: VariantService,
    private produitService: ProductService,
    private supabaseService: SupabaseService,
    private imageService: ImageService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    /**
    * BreadCrumb
    */
    this.breadCrumbItems = [
      { label: 'Ecommerce' },
      { label: 'Variant Details', active: true }
    ];

    // Get produit ID from route parameters
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.produitId = params['produitId'];
      if (this.produitId) {
        this.loadProductAndVariants();
        this.loadFormOptions();
      } else {
        this.error = 'Product ID is required';
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupOrphanedUploads();
  }

  private initializeForm(): void {
    this.addVariantForm = this.fb.group({
      taille_id: ['', [Validators.required]],
      couleur_id: ['', [Validators.required]],
      stock: [0, [Validators.required, Validators.min(0)]],
      is_primary: [false]
    });

    this.editVariantForm = this.fb.group({
      taille_id: ['', [Validators.required]],
      couleur_id: ['', [Validators.required]],
      stock: [0, [Validators.required, Validators.min(0)]],
      is_primary: [false]
    });
  }

  private loadFormOptions(): void {
    // Load available sizes and colors
    forkJoin({
      sizes: this.getSizes(),
      colors: this.getColors()
    }).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading form options:', error);
        return of({ sizes: [], colors: [] });
      })
    ).subscribe(({ sizes, colors }) => {
      this.availableSizes = sizes;
      this.availableColors = colors;
      this.cdr.detectChanges();
    });
  }

  private getSizes(): Observable<TailleOption[]> {
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

  private loadProductAndVariants(): void {
    this.loading = true;
    this.error = null;

    // Load product information first
    this.produitService.getProduitById(this.produitId).pipe(
      takeUntil(this.destroy$),
      catchError(error => {
        console.error('Error loading product:', error);
        this.error = 'Unable to load product information';
        this.loading = false;
        this.cdr.detectChanges();
        return of(null);
      })
    ).subscribe(produit => {
      if (produit) {
        this.produit = produit;
        this.loadVariants();
      }
    });
  }

  private loadVariants(): void {
    // Load variants for the product
    this.variants$ = this.variantService.getVariantsByProductId(this.produitId).pipe(
      takeUntil(this.destroy$),
      map(variants => {
        this.variants = variants;
        this.loading = false;
        this.cdr.detectChanges();
        return variants;
      }),
      catchError(error => {
        console.error('Error loading variants:', error);
        this.error = 'Unable to load product variants';
        this.loading = false;
        this.cdr.detectChanges();
        return of([]);
      })
    );

    // Subscribe to load the data
    this.variants$.subscribe();
  }

  /**
   * Open the add variant modal
   */
  openAddVariantModal(): void {
    this.resetForm();
    this.modalRef = this.modalService.open(this.addVariantModal, { 
      size: 'xl', 
      centered: true,
      backdrop: 'static'
    });
  }

  /**
   * Open the edit variant modal
   */
  openEditVariantModal(variant: ProduitVariation): void {
    this.editingVariant = variant;
    this.isEditMode = true;
    this.resetEditForm();
    
    // Wait for form to be reset, then populate
    setTimeout(() => {
      const formData = {
        taille_id: variant.taille_id || '',
        couleur_id: variant.couleur_id || '',
        stock: variant.stock || 0,
        is_primary: variant.is_primary || false
      };
      
      this.editVariantForm.patchValue(formData);
      this.editVariantForm.markAsDirty();
      this.cdr.detectChanges();
    }, 0);

    this.modalRef = this.modalService.open(this.editVariantModal, { 
      size: 'lg', 
      centered: true,
      backdrop: 'static'
    });
  }

  /**
   * Reset form and clear any previous state
   */
  private resetForm(): void {
    this.addVariantForm.reset({
      taille_id: '',
      couleur_id: '',
      stock: 0,
      is_primary: false
    });
    this.formError = null;
    this.formSuccess = false;
    this.formSubmitting = false;
    this.clearAllFiles();
  }

  /**
   * Reset edit form and clear any previous state
   */
  private resetEditForm(): void {
    this.editFormError = null;
    this.editFormSuccess = false;
    this.editFormSubmitting = false;
    
    // Clear photo arrays
    this.editMainPhotoFiles = [];
    this.editOtherPhotoFiles = [];
    this.editingPhotosToRemove = [];
    this.editingMainPhotoToRemove = null;
    
    // Reset form with initial values
    this.editVariantForm.reset({
      taille_id: '',
      couleur_id: '',
      stock: 0,
      is_primary: false
    });
    
    // Clear all validation states
    this.editVariantForm.markAsUntouched();
    this.editVariantForm.markAsPristine();
  }

  /**
   * Handle main photo file addition
   */
  onMainPhotoAdded(file: File): void {
    if (!file) return;
    this.clearMainPhotos();
    const uploadedFile: UploadedFile = {
      file,
      progress: 0,
      uploading: false,
      preview: this.createFilePreview(file)
    };
    this.mainPhotoFiles = [uploadedFile];
    this.cdr.markForCheck();
  }

  /**
   * Handle other photos file addition
   */
  onOtherPhotoAdded(file: File): void {
    if (!file) return;
    const uploadedFile: UploadedFile = {
      file,
      progress: 0,
      uploading: false,
      preview: this.createFilePreview(file)
    };
    this.otherPhotoFiles.push(uploadedFile);
    this.cdr.markForCheck();
  }

  /**
   * Handle file removal
   */
  onFileRemoved(file: File, type: 'main' | 'other'): void {
    if (type === 'main') {
      this.clearMainPhotos();
    } else {
      // Find and remove the specific file from other photos
      const index = this.otherPhotoFiles.findIndex(f => f.file === file);
      if (index !== -1) {
        const removedFile = this.otherPhotoFiles[index];
        if (removedFile.preview) URL.revokeObjectURL(removedFile.preview);
        this.otherPhotoFiles.splice(index, 1);
      }
    }
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
    this.clearMainPhotos();
    this.clearOtherPhotos();
  }

  /**
   * Clear main photos
   */
  private clearMainPhotos(): void {
    this.mainPhotoFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    this.mainPhotoFiles = [];
  }

  /**
   * Clear other photos
   */
  private clearOtherPhotos(): void {
    this.otherPhotoFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    this.otherPhotoFiles = [];
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
        .upload(`variants/${fileName}`, uploadedFile.file, {
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
          
          return data.path; // Store path, not full URL
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
   * Submit the edit variant form to update an existing variant
   */
  async onSubmitEditVariant(): Promise<void> {
    if (this.editVariantForm.invalid || !this.editingVariant) {
      this.editVariantForm.markAllAsTouched();
      return;
    }

    this.editFormSubmitting = true;
    this.editFormError = null;
    this.editFormSuccess = false;
    this.cdr.detectChanges();

    try {
      const formValue = this.editVariantForm.value;
      
      // Handle photo operations first
      await this.handleEditPhotoOperations();
      
      // Prepare updated variant data with new photo paths
      // Note: Price comes from product, not variant
      const updateData: any = {
        taille_id: formValue.taille_id,
        couleur_id: Number(formValue.couleur_id),
        stock: formValue.stock,
        is_primary: formValue.is_primary
      };

      // Add photo paths if they've been modified
      if (this.editMainPhotoFiles.length > 0 || this.editingMainPhotoToRemove) {
        if (this.editMainPhotoFiles.length > 0 && this.editMainPhotoFiles[0].path) {
          updateData.main_photo_path = [this.editMainPhotoFiles[0].path];
        } else if (this.editingMainPhotoToRemove) {
          updateData.main_photo_path = [];
        }
      }

      if (this.editOtherPhotoFiles.length > 0 || this.editingPhotosToRemove.length > 0) {
        // Combine existing photos (not marked for removal) with new uploads
        const existingPhotos = this.editingVariant.others_photos || [];
        const remainingPhotos = existingPhotos.filter(path => !this.editingPhotosToRemove.includes(path));
        const newPhotoPaths = this.editOtherPhotoFiles
          .filter(f => f.path)
          .map(f => f.path!);
        updateData.others_photos = [...remainingPhotos, ...newPhotoPaths];
      }

      // Update variant in database
      const { data, error } = await this.supabaseService.getClient()
        .from('variant')
        .update(updateData)
        .eq('id', this.editingVariant.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      this.editFormSuccess = true;
      this.cdr.detectChanges();
      
      // Close modal after a short delay
      setTimeout(() => {
        this.modalRef?.close();
        this.loadVariants(); // Refresh the variants list
      }, 1500);

    } catch (error: any) {
      console.error('Error updating variant:', error);
      this.editFormError = error.message || 'An error occurred while updating the variant';
      
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
      if (this.editingMainPhotoToRemove) {
        await this.deletePhotoFromStorage(this.editingMainPhotoToRemove);
      }
      
      for (const photoPath of this.editingPhotosToRemove) {
        await this.deletePhotoFromStorage(photoPath);
      }

      // Upload new main photo
      if (this.editMainPhotoFiles.length > 0) {
        const mainPhotoUrls = await this.uploadFiles(this.editMainPhotoFiles, 'variants');
        if (mainPhotoUrls.length > 0) {
          this.editMainPhotoFiles[0].path = mainPhotoUrls[0];
        }
      }

      // Upload new other photos
      if (this.editOtherPhotoFiles.length > 0) {
        const otherPhotoUrls = await this.uploadFiles(this.editOtherPhotoFiles, 'variants');
        this.editOtherPhotoFiles.forEach((file, index) => {
          if (index < otherPhotoUrls.length) {
            file.path = otherPhotoUrls[index];
          }
        });
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
   * Submit the form to create a new variant
   */
  async onSubmitVariant(): Promise<void> {
    if (this.addVariantForm.invalid) {
      this.addVariantForm.markAllAsTouched();
      return;
    }

    this.formSubmitting = true;
    this.formError = null;
    this.formSuccess = false;
    this.uploadingFiles = true;
    this.cdr.detectChanges();

    try {
      const formValue = this.addVariantForm.value;
      
      // Upload files if present
      let mainPhotoPath: string | null = null;
      let otherPhotoPaths: string[] = [];
      
      if (this.mainPhotoFiles.length > 0) {
        const mainUrls = await this.uploadFiles(this.mainPhotoFiles, 'main');
        mainPhotoPath = mainUrls[0];
      }
      
      if (this.otherPhotoFiles.length > 0) {
        otherPhotoPaths = await this.uploadFiles(this.otherPhotoFiles, 'others');
      }

      // Prepare variant data matching the model structure
      const variantData = {
        produit_id: this.produitId,
        taille_id: formValue.taille_id,
        couleur_id: Number(formValue.couleur_id),
        stock: formValue.stock,
        is_primary: formValue.is_primary,
        main_photo_path: mainPhotoPath ? [mainPhotoPath] : null,
        others_photos: otherPhotoPaths.length > 0 ? otherPhotoPaths : null
      };

      // Insert variant into database
      const { data, error } = await this.supabaseService.getClient()
        .from('variant')
        .insert([variantData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      this.formSuccess = true;
      this.cdr.detectChanges();
      
      // Close modal after a short delay
      setTimeout(() => {
        this.modalRef?.close();
        this.loadVariants(); // Refresh the variants list
      }, 1500);

    } catch (error: any) {
      console.error('Error creating variant:', error);
      this.formError = error.message || 'An error occurred while creating the variant';
      
      // Cleanup uploaded files if insertion failed
      await this.cleanupFailedUpload();
      
    } finally {
      this.formSubmitting = false;
      this.uploadingFiles = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Cleanup failed uploads
   */
  private async cleanupFailedUpload(): Promise<void> {
    const pathsToDelete: string[] = [];
    
    this.mainPhotoFiles.forEach(f => {
      if (f.path) pathsToDelete.push(f.path);
    });
    
    this.otherPhotoFiles.forEach(f => {
      if (f.path) pathsToDelete.push(f.path);
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
    this.mainPhotoFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    
    this.otherPhotoFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
  }

  /**
   * Close the modal
   */
  closeModal(): void {
    this.modalRef?.close();
  }

  /**
   * Get the primary image URL for a variant
   */
  getVariantImageUrl(variant: ProduitVariation): string {
    // Try main_photo_path first
    if (variant.main_photo_path && Array.isArray(variant.main_photo_path) && variant.main_photo_path.length > 0) {
      return this.getPhotoUrl(variant.main_photo_path[0]);
    }
    
    // Try other photos
    if (variant.others_photos && Array.isArray(variant.others_photos) && variant.others_photos.length > 0) {
      return this.getPhotoUrl(variant.others_photos[0]);
    }
    
    // Fallback to product images
    if (this.produit?.front_photo_path) {
      return this.getPhotoUrl(this.produit.front_photo_path);
    }
    
    // Default placeholder
    return 'assets/images/products/img-8.png';
  }

  /**
   * Convert storage path to public URL
   */
  private getPhotoUrl(path: string): string {
    return this.imageService.resolveImageUrl(
      path,
      IMAGE_SIZES.ADMIN_PREVIEW,
      75,
      'public-images',
      'assets/images/products/img-8.png'
    );
  }

  /**
   * Get formatted price
   */
  getPrice(): string {
    return this.produit?.prix ? `${this.produit.prix}` : 'N/A';
  }

  /**
   * Get variant display name
   */
  getVariantName(variant: ProduitVariation): string {
    const productName = this.produit?.nom || 'Product';
    const colorName = variant.colors?.nom || 'Unknown Color';
    const sizeName = variant.taille?.libelle || 'Unknown Size';
    
    return `${productName} (${colorName} - ${sizeName})`;
  }

  /**
   * Open modal
   * @param content modal content
   */
  openModal(content: any) {
    this.submitted = false;
    this.modalService.open(content, { size: 'md', centered: true });
  }

  /**
   * Delete variant with confirmation
   */
  deleteVariant(variant: ProduitVariation): void {
    Swal.fire({
      title: 'Êtes-vous sûr?',
      text: `Voulez-vous vraiment supprimer cette variante ? Cette action est irréversible.`,
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
        this.performVariantDeletion(variant);
      }
    });
  }

  /**
   * Perform the actual variant deletion
   */
  private performVariantDeletion(variant: ProduitVariation): void {
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

    this.variantService.deleteVariant(variant.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Remove from local array
          this.variants = this.variants.filter(v => v.id !== variant.id);
          this.cdr.detectChanges();

          // Show success message
          Swal.fire({
            title: 'Supprimé!',
            text: 'La variante a été supprimée avec succès.',
            icon: 'success',
            confirmButtonText: 'OK'
          });

          // Reload data to ensure consistency
          this.loadProductAndVariants();
        },
        error: (error) => {
          console.error('Error deleting variant:', error);
          Swal.fire({
            title: 'Erreur',
            text: 'Une erreur est survenue lors de la suppression de la variante.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      });
  }

  /**
   * Get star rating display (placeholder for now)
   */
  getStarRating(): string {
    return '★★★★☆'; // Placeholder - could be enhanced with actual rating data
  }

  /**
   * Calculate total for variant (price × stock as example)
   */
  calculateVariantTotal(variant: ProduitVariation): string {
    if (!this.produit?.prix || !variant.stock) return '0';
    
    const total = this.produit.prix * variant.stock;
    return `${total}`;
  }

  /**
   * TrackBy function for *ngFor performance optimization
   */
  trackByVariantId(index: number, variant: ProduitVariation): string {
    return variant.id;
  }

  /**
   * Check if form field has error
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.addVariantForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Check if edit form field has error
   */
  isEditFieldInvalid(fieldName: string): boolean {
    const field = this.editVariantForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  /**
   * Get field error message
   */
  getFieldError(fieldName: string): string {
    const field = this.addVariantForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) {
        return `${fieldName} est requis`;
      }
      if (field.errors['min']) {
        return `${fieldName} doit être au moins ${field.errors['min'].min}`;
      }
    }
    return '';
  }

  /**
   * Get edit field error message
   */
  getEditFieldError(fieldName: string): string {
    const field = this.editVariantForm.get(fieldName);
    if (field && field.errors) {
      if (field.errors['required']) {
        return `${fieldName} est requis`;
      }
      if (field.errors['min']) {
        return `${fieldName} doit être au moins ${field.errors['min'].min}`;
      }
      if (field.errors['pattern']) {
        return `Format invalide pour ${fieldName}`;
      }
    }
    return '';
  }

  /**
   * Get the selected color from the form
   */
  getSelectedColor(): ColorOption | null {
    const colorId = this.addVariantForm.get('couleur_id')?.value;
    if (!colorId) return null;
    return this.availableColors.find(c => c.id == colorId) || null;
  }

  /**
   * Get the selected color from the edit form
   */
  getSelectedEditColor(): ColorOption | null {
    const colorId = this.editVariantForm.get('couleur_id')?.value;
    if (!colorId) return null;
    return this.availableColors.find(c => c.id == colorId) || null;
  }

  /**
   * Get upload progress for display
   */
  getUploadProgress(): number {
    const allFiles = [...this.mainPhotoFiles, ...this.otherPhotoFiles];
    if (allFiles.length === 0) return 0;
    
    const totalProgress = allFiles.reduce((sum, file) => sum + file.progress, 0);
    return Math.round(totalProgress / allFiles.length);
  }

  /**
   * Check if any files are uploading
   */
  isUploading(): boolean {
    return [...this.mainPhotoFiles, ...this.otherPhotoFiles].some(f => f.uploading);
  }

  /**
   * Check if there are any upload errors
   */
  hasUploadErrors(): boolean {
    return [...this.mainPhotoFiles, ...this.otherPhotoFiles].some(f => f.error);
  }

  /**
   * Get upload error messages
   */
  getUploadErrors(): string[] {
    return [...this.mainPhotoFiles, ...this.otherPhotoFiles]
      .filter(f => f.error)
      .map(f => f.error!);
  }

  // === EDIT MODAL PHOTO METHODS ===

  /**
   * Get main photo URL for a variant
   */
  getMainPhotoUrl(variant: ProduitVariation): string | null {
    if (variant.main_photo_path && variant.main_photo_path.length > 0) {
      const path = variant.main_photo_path[0];
      return this.imageService.resolveImageUrl(
        path,
        IMAGE_SIZES.ADMIN_PREVIEW,
        75,
        'public-images',
        'assets/images/products/img-8.png'
      );
    }
    return null;
  }

  /**
   * Get other photos URLs for a variant
   */
  getOtherPhotosUrls(variant: ProduitVariation): string[] {
    if (!variant.others_photos || variant.others_photos.length === 0) {
      return [];
    }
    
    return variant.others_photos.map(path => this.getPhotoUrl(path));
  }

  /**
   * Handle edit main photo selection
   */
  onEditMainPhotoSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const uploadedFile: UploadedFile = {
        file,
        progress: 0,
        uploading: false,
        preview: this.createFilePreview(file)
      };
      this.editMainPhotoFiles = [uploadedFile];
      this.cdr.detectChanges();
    }
  }

  /**
   * Handle edit other photos selection
   */
  onEditOtherPhotosSelected(event: any): void {
    const files = Array.from(event.target.files) as File[];
    files.forEach(file => {
      const uploadedFile: UploadedFile = {
        file,
        progress: 0,
        uploading: false,
        preview: this.createFilePreview(file)
      };
      this.editOtherPhotoFiles.push(uploadedFile);
    });
    this.cdr.detectChanges();
  }

  /**
   * Remove edit main photo
   */
  removeEditMainPhoto(event: Event): void {
    event.stopPropagation();
    this.editMainPhotoFiles.forEach(f => {
      if (f.preview) {
        URL.revokeObjectURL(f.preview);
      }
    });
    this.editMainPhotoFiles = [];
    this.cdr.detectChanges();
  }

  /**
   * Remove edit other photo
   */
  removeEditOtherPhoto(event: Event, index: number): void {
    event.stopPropagation();
    const file = this.editOtherPhotoFiles[index];
    if (file.preview) {
      URL.revokeObjectURL(file.preview);
    }
    this.editOtherPhotoFiles.splice(index, 1);
    this.cdr.detectChanges();
  }

  /**
   * Remove current main photo (mark for deletion)
   */
  removeCurrentMainPhoto(): void {
    if (this.editingVariant && this.editingVariant.main_photo_path && this.editingVariant.main_photo_path.length > 0) {
      this.editingMainPhotoToRemove = this.editingVariant.main_photo_path[0];
      // Clear the main photo from display
      this.editingVariant.main_photo_path = [];
      this.cdr.detectChanges();
    }
  }

  /**
   * Remove current other photo (mark for deletion)
   */
  removeCurrentOtherPhoto(index: number): void {
    if (this.editingVariant && this.editingVariant.others_photos && this.editingVariant.others_photos.length > index) {
      const photoPath = this.editingVariant.others_photos[index];
      this.editingPhotosToRemove.push(photoPath);
      // Remove from display
      this.editingVariant.others_photos.splice(index, 1);
      this.cdr.detectChanges();
    }
  }

  /**
   * Trigger edit main photo input click
   */
  triggerEditMainPhotoInput(): void {
    document.getElementById('editMainPhoto')?.click();
  }

  /**
   * Trigger edit other photos input click
   */
  triggerEditOtherPhotosInput(): void {
    document.getElementById('editOtherPhotos')?.click();
  }
}
