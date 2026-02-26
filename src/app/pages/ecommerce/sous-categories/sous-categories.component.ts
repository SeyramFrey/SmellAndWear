import { Component, OnInit, OnDestroy, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgbModal, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';

import { CategorieService } from 'src/app/core/services/categorie.service';
import { Categorie } from 'src/app/core/models/models';
import { PaginationService } from 'src/app/core/services/pagination.service';
import { SharedModule } from 'src/app/shared/shared.module';

@Component({
  selector: 'app-sous-categories',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgbPaginationModule,
    FormsModule,
    ReactiveFormsModule,
    SharedModule
  ],
  templateUrl: './sous-categories.component.html',
  styleUrl: './sous-categories.component.scss'
})
export class SousCategoriesComponent implements OnInit, OnDestroy {
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
  
  // Parent category info
  parentCategoryId: string = '';
  parentCategoryName: string = '';
  
  // Form properties
  subcategoryForm!: FormGroup;
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  saving = false;
  editingSubcategoryId: string | null = null;
  deleting = false;
  
  @ViewChild('content') modalTemplate!: TemplateRef<any>;
  
  private destroy$ = new Subject<void>();

  constructor(
    private modalService: NgbModal,
    public service: PaginationService,
    private categorieService: CategorieService,
    private route: ActivatedRoute,
    public router: Router,
    private formBuilder: FormBuilder
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    // Get parent category ID from route params
    // Also check URL segments directly
    this.route.url.pipe(
      takeUntil(this.destroy$)
    ).subscribe(segments => {
      console.log('URL segments:', segments);
      // Get the last segment which should be the categoryId
      if (segments.length > 0) {
        this.parentCategoryId = segments[segments.length - 1].path;
        console.log('Parent category ID from URL:', this.parentCategoryId);
        this.loadParentCategoryInfo();
        this.fetchData();
      } else {
        this.error = 'ID de catégorie parent manquant';
      }
    });

    // Also try paramMap as fallback
    this.route.paramMap.pipe(
      takeUntil(this.destroy$)
    ).subscribe(params => {
      const allKeys = params.keys;
      console.log('ParamMap keys:', allKeys);
      if (allKeys.length > 0) {
        const parentId = params.get(allKeys[0]);
        if (parentId && !this.parentCategoryId) {
          this.parentCategoryId = parentId;
          console.log('Parent category ID from paramMap:', this.parentCategoryId);
          this.loadParentCategoryInfo();
          this.fetchData();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load parent category information
   */
  loadParentCategoryInfo(): void {
    this.categorieService.getCategorieById(this.parentCategoryId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (parentCategory) => {
          this.parentCategoryName = parentCategory.nom || 'Catégorie';
          this.updateBreadcrumbs();
        },
        error: (error) => {
          console.error('Error loading parent category:', error);
          this.parentCategoryName = 'Catégorie';
          this.updateBreadcrumbs();
        }
      });
  }

  /**
   * Update breadcrumbs
   */
  updateBreadcrumbs(): void {
    this.breadCrumbItems = [
      { label: 'Ecommerce' },
      { label: 'Categories', routerLink: '/admin/ecommerce/categories' },
      { label: this.parentCategoryName, active: true }
    ];
  }

  /**
   * Fetches the subcategories data
   */
  fetchData(): void {
    this.loading = true;
    this.error = null;
    
    this.categorieService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          // Filter to only show subcategories of the current parent
          this.sellerList = data.filter((category: Categorie) => 
            category.parent_id === this.parentCategoryId
          );
          this.categories = this.service.changePage(this.sellerList);
          this.loading = false;
          this.hideLoader();
        },
        error: (error) => {
          console.error('Error fetching subcategories:', error);
          this.error = 'Erreur lors du chargement des sous-catégories';
          this.loading = false;
          this.hideLoader();
        }
      });
  }

  private hideLoader(): void {
    setTimeout(() => {
      const loader = document.getElementById('elmLoader');
      if (loader) {
        loader.classList.add('d-none');
      }
    }, 100);
  }

  // Pagination
  changePage(): void {
    this.categories = this.service.changePage(this.sellerList);
  }

  /**
   * Refresh data
   */
  refreshData(): void {
    this.error = null;
    if (this.parentCategoryId) {
      this.fetchData();
    } else {
      this.error = 'ID de catégorie parent manquant';
    }
  }

  /**
   * Navigate to products page for selected subcategory
   */
  navigateToProducts(subcategoryId: string): void {
    this.router.navigate(['/admin/ecommerce/products', subcategoryId]);
  }

  /**
   * Open modal
   * @param content modal content
   */
  openModal(content: any): void {
    this.submitted = false;
    this.modalService.open(content, { size: 'lg', centered: true });
  }

  // Category Filter
  categoryFilter(): void {
    if (this.category != 'All' && this.category != '') {
      // Filter within the already filtered subcategories only
      this.searchResults = this.sellerList.filter((seller: Categorie) => 
        seller.nom === this.category
      );
      this.categories = this.service.changePage(this.searchResults);
    } else {
      this.categories = this.service.changePage(this.sellerList);
    }
  }

  // Search
  performSearch(): void {
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.categories = this.service.changePage(this.sellerList);
      return;
    }

    const searchTermLower = this.searchTerm.toLowerCase();
    // Search within the already filtered subcategories only
    this.searchResults = this.sellerList.filter((item: Categorie) => {
      return (
        (item.nom && item.nom.toLowerCase().includes(searchTermLower))
      );
    });
    this.categories = this.service.changePage(this.searchResults);
  }

  // Get unique categories for filter dropdown
  getUniqueCategories(): string[] {
    const uniqueCategories = [...new Set(this.sellerList.map(item => item.nom))];
    return uniqueCategories.filter((nom): nom is string => Boolean(nom));
  }

  // TrackBy function for performance
  trackByCategoryId(index: number, category: Categorie): string {
    return category.id;
  }

  /**
   * Initialize the subcategory form
   */
  private initializeForm(): void {
    this.subcategoryForm = this.formBuilder.group({
      nom: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      image: ['']
    });
  }

  /**
   * Edit subcategory
   */
  editSubcategory(subcategory: Categorie) {
    this.editingSubcategoryId = subcategory.id;
    this.subcategoryForm.patchValue({
      nom: subcategory.nom,
      image: subcategory.image
    });
    this.imagePreview = subcategory.image || null;
    this.submitted = false;
    this.saving = false;
    this.selectedFile = null;
    
    this.modalService.open(this.modalTemplate, { size: 'lg', centered: true });
  }

  /**
   * Delete subcategory with confirmation
   */
  deleteSubcategory(subcategory: Categorie) {
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer la sous-catégorie "${subcategory.nom}" ?`;
    const warningMessage = 'Cette action est irréversible.';
    
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
        
        this.categorieService.deleteCategorie(subcategory.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              console.log('Subcategory deleted successfully:', subcategory.nom);
              this.deleting = false;
              
              // Refresh data
              this.fetchData();
              
              Swal.fire({
                icon: 'success',
                title: 'Supprimée!',
                text: `Sous-catégorie "${subcategory.nom}" supprimée avec succès!`,
                timer: 3000,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
              });
            },
            error: (error) => {
              console.error('Error deleting subcategory:', error);
              this.deleting = false;
              
              Swal.fire({
                icon: 'error',
                title: 'Erreur!',
                text: 'Erreur lors de la suppression de la sous-catégorie. Veuillez réessayer.',
                confirmButtonText: 'OK',
                confirmButtonColor: '#dc3545'
              });
            }
          });
      }
    });
  }

  /**
   * Handle file selection for subcategory image
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
    this.subcategoryForm.patchValue({ image: '' });
  }

  /**
   * Submit subcategory form
   */
  onSubmit(): void {
    this.submitted = true;

    if (this.subcategoryForm.invalid) {
      return;
    }

    this.saving = true;
    
    const formData = this.subcategoryForm.value;
    
    const subcategoryData: Partial<Categorie> = {
      nom: formData.nom,
      image: this.imagePreview || '/assets/images/categories/default-subcategory.jpg',
      parent_id: this.parentCategoryId // Always maintain parent relationship
    };

    this.categorieService.updateCategorie(this.editingSubcategoryId!, subcategoryData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updatedSubcategory) => {
          console.log('Subcategory updated successfully:', updatedSubcategory);
          this.saving = false;
          this.submitted = false;
          
          // Close modal and refresh data
          this.modalService.dismissAll();
          this.fetchData();
          
          Swal.fire({
            icon: 'success',
            title: 'Succès!',
            text: `Sous-catégorie "${updatedSubcategory.nom}" modifiée avec succès!`,
            timer: 3000,
            showConfirmButton: false,
            toast: true,
            position: 'top-end'
          });
        },
        error: (error) => {
          console.error('Error updating subcategory:', error);
          this.saving = false;
          
          Swal.fire({
            icon: 'error',
            title: 'Erreur!',
            text: 'Erreur lors de la modification de la sous-catégorie. Veuillez réessayer.',
            confirmButtonText: 'OK',
            confirmButtonColor: '#dc3545'
          });
        }
      });
  }

  /**
   * Get form control for validation
   */
  get f() {
    return this.subcategoryForm.controls;
  }

}
