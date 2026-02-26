import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';

import { CategorieService } from 'src/app/core/services/categorie.service';
import { Categorie } from 'src/app/core/models/models';
import { SupabaseService } from 'src/app/core/services/supabase.service';
import { ImageService, IMAGE_SIZES } from 'src/app/core/services/image.service';
import { PaginationService } from 'src/app/core/services/pagination.service';

@Component({
  selector: 'app-categories',
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})

/**
 * categories Component
 */
export class CategoriesComponent implements OnInit, OnDestroy {

  // bread crumb items
  breadCrumbItems!: Array<{}>;
  submitted = false;
  sellerList: Categorie[] = [];
  categories: Categorie[] = [];
  category: any = '';
  searchResults: Categorie[] = [];
  searchTerm: any;
  loading = false;
  error: string | null = null;
  private destroy$ = new Subject<void>();

  // Form properties
  categoryForm!: FormGroup;
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  uploading = false;
  uploadProgress = 0;
  saving = false;
  
  // Edit/Delete properties
  isEditMode = false;
  editingCategoryId: string | null = null;
  deleting = false;
  
  @ViewChild('content') modalTemplate!: TemplateRef<any>;

  constructor(
    private modalService: NgbModal,
    public service: PaginationService,
    private categorieService: CategorieService,
    private router: Router,
    private supabaseService: SupabaseService,
    private imageService: ImageService,
    private formBuilder: FormBuilder
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    /**
    * BreadCrumb
    */
    this.breadCrumbItems = [
      { label: 'Ecommerce' },
      { label: 'categories', active: true }
    ];

    /**
     * Fetches the data
     */
    this.fetchData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Fetches the data
   */
  fetchData() {
    this.loading = true;
    this.error = null;
    
    this.categorieService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          // Filter to only show main categories (those without parent_id)
          this.sellerList = data.filter((category: Categorie) => !category.parent_id);
          this.categories = this.service.changePage(this.sellerList);
          this.loading = false;
          this.hideLoader();
        },
        error: (error) => {
          console.error('Error fetching categories:', error);
          this.error = 'Erreur lors du chargement des catégories';
          this.loading = false;
          this.hideLoader();
        }
      });
  }

  private hideLoader() {
    setTimeout(() => {
      document.getElementById('elmLoader')?.classList.add('d-none');
    }, 100);
  }

  // Pagination
  changePage() {
    this.categories = this.service.changePage(this.sellerList)
  }


  // Category Filter
  categoryFilter() {
    if (this.category != 'All' && this.category != '') {
      // Filter within the already filtered main categories only
      this.searchResults = this.sellerList.filter((seller: Categorie) => 
        seller.nom === this.category
      );
      this.categories = this.service.changePage(this.searchResults);
    } else {
      this.categories = this.service.changePage(this.sellerList);
    }
  }

  // Search
  performSearch() {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.categories = this.service.changePage(this.sellerList);
      return;
    }

    const searchTermLower = this.searchTerm.toLowerCase();
    // Search within the already filtered main categories only
    this.searchResults = this.sellerList.filter((item: Categorie) => {
      return (
        (item.nom && item.nom.toLowerCase().includes(searchTermLower))
      );
    });
    this.categories = this.service.changePage(this.searchResults);
  }

  // Get unique categories for filter dropdown (main categories only)
  getUniqueCategories(): string[] {
    // sellerList is already filtered to show only main categories (no parent_id)
    const uniqueCategories = [...new Set(this.sellerList.map(item => item.nom))];
    return uniqueCategories.filter((nom): nom is string => Boolean(nom));
  }

  /**
   * Navigate to subcategories page
   */
  navigateToSubcategories(categoryId: string): void {
    this.router.navigate(['/admin/ecommerce/sous-categories', categoryId]);
  }

  /**
   * Initialize the category form
   */
  private initializeForm(): void {
    this.categoryForm = this.formBuilder.group({
      nom: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      image: [''],
      parent_id: [''] // For subcategories
    });
  }

  /**
   * Reset form when opening modal
   */
  openModal(content: any, category?: Categorie) {
    this.submitted = false;
    this.saving = false;
    this.selectedFile = null;
    this.imagePreview = null;
    
    if (category) {
      // Edit mode
      this.isEditMode = true;
      this.editingCategoryId = category.id;
      this.categoryForm.patchValue({
        nom: category.nom,
        parent_id: category.parent_id || null,
        image: category.image
      });
      this.imagePreview = category.image || null;
    } else {
      // Create mode
      this.isEditMode = false;
      this.editingCategoryId = null;
      this.categoryForm.reset();
    }
    
    this.modalService.open(content, { size: 'lg', centered: true });
  }

  /**
   * Handle file selection for category image
   */
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      
      // Create image preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Remove selected image
   */
  removeImage(): void {
    this.selectedFile = null;
    this.imagePreview = null;
    this.categoryForm.patchValue({ image: '' });
  }

  /**
   * Upload image to Supabase storage
   */
  private async uploadImageToStorage(file: File): Promise<string> {
    const fileName = `category_${Date.now()}_${file.name}`;
    
    const { data, error } = await this.supabaseService.getClient().storage
      .from('public-images')
      .upload(`categories/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw error;
    }

    return data.path; // Return storage path, not full URL
  }

  /**
   * Extract storage path from full URL
   */
  private extractStoragePathFromUrl(url: string): string | null {
    if (!url) return null;
    
    // Extract path from full Supabase URL
    const matches = url.match(/\/storage\/v1\/object\/public\/public-images\/(.+)$/);
    return matches ? matches[1] : url;
  }

  /**
   * Get the display URL for a category image
   */
  getCategoryImageUrl(imagePath: string | null | undefined): string {
    return this.imageService.resolveImageUrl(
      imagePath ?? undefined,
      IMAGE_SIZES.PRODUCT_CARD,
      75,
      'public-images',
      '/assets/images/categories/default-category.jpg'
    );
  }

  /**
   * Submit category form
   */
  async onSubmit(): Promise<void> {
    this.submitted = true;

    if (this.categoryForm.invalid) {
      return;
    }

    this.saving = true;
    this.error = null;
    
    try {
      const formData = this.categoryForm.value;
      
      // Handle image upload if a file is selected
      let imagePath: string | null = null;
      if (this.selectedFile) {
        this.uploading = true;
        imagePath = await this.uploadImageToStorage(this.selectedFile);
        this.uploading = false;
      } else if (this.isEditMode && this.imagePreview) {
        // Keep existing image path if editing and no new file selected
        imagePath = this.extractStoragePathFromUrl(this.imagePreview);
      }
      
      const categoryData: Omit<Categorie, 'id'> = {
        nom: formData.nom,
        image: imagePath || undefined,
        parent_id: formData.parent_id || null
      };

      const operation = this.isEditMode 
        ? this.categorieService.updateCategorie(this.editingCategoryId!, categoryData)
        : this.categorieService.createCategorie(categoryData);

      operation
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (category) => {
            console.log(`Category ${this.isEditMode ? 'updated' : 'created'} successfully:`, category);
            this.saving = false;
            this.submitted = false;
            
            // Close modal and refresh data
            this.modalService.dismissAll();
            this.fetchData();
            
            // Show specific success message based on operation and category type
            const isSubcategory = category.parent_id;
            const operation = this.isEditMode ? 'modifiée' : 'ajoutée';
            const categoryType = isSubcategory ? 'Sous-catégorie' : 'Catégorie principale';
            const successMessage = `${categoryType} "${category.nom}" ${operation} avec succès!`;
            
            Swal.fire({
              icon: 'success',
              title: 'Succès!',
              text: successMessage,
              timer: 3000,
              showConfirmButton: false,
              toast: true,
              position: 'top-end'
            });
          },
          error: (error) => {
            console.error(`Error ${this.isEditMode ? 'updating' : 'creating'} category:`, error);
            this.saving = false;
            this.uploading = false;
            const errorMessage = this.isEditMode 
              ? 'Erreur lors de la modification de la catégorie. Veuillez réessayer.'
              : 'Erreur lors de la création de la catégorie. Veuillez réessayer.';
            
            Swal.fire({
              icon: 'error',
              title: 'Erreur!',
              text: errorMessage,
              confirmButtonText: 'OK',
              confirmButtonColor: '#dc3545'
            });
          }
        });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      this.error = 'Erreur lors du téléchargement de l\'image';
      this.saving = false;
      this.uploading = false;
      
      Swal.fire({
        icon: 'error',
        title: 'Erreur!',
        text: 'Erreur lors du téléchargement de l\'image. Veuillez réessayer.',
        confirmButtonColor: '#dc3545'
      });
    }
  }

  /**
   * Get form control for validation
   */
  get f() {
    return this.categoryForm.controls;
  }

  /**
   * Edit category
   */
  editCategory(category: Categorie) {
    this.openModal(this.modalTemplate, category);
  }

  /**
   * Delete category with confirmation
   */
  deleteCategory(category: Categorie) {
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer la catégorie "${category.nom}" ?`;
    const warningMessage = 'Cette action est irréversible et supprimera également toutes les sous-catégories associées.';
    
    Swal.fire({
      title: 'Confirmer la suppression',
      text: confirmMessage,
      html: `<p>${confirmMessage}</p><p class="text-warning"><strong>${warningMessage}</strong></p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
      reverseButtons: true
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleting = true;
        
        this.categorieService.deleteCategorie(category.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              console.log('Category deleted successfully:', category.nom);
              this.deleting = false;
              
              // Refresh data
              this.fetchData();
              
              Swal.fire({
                icon: 'success',
                title: 'Supprimée!',
                text: `Catégorie "${category.nom}" supprimée avec succès!`,
                timer: 3000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
              });
            },
            error: (error) => {
              console.error('Error deleting category:', error);
              this.deleting = false;
              
              Swal.fire({
                icon: 'error',
                title: 'Erreur!',
                text: 'Erreur lors de la suppression de la catégorie. Veuillez réessayer.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#dc3545'
              });
            }
          });
      }
    });
  }

}
