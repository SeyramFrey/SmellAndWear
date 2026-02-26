import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { NgbModal, NgbPaginationModule, NgbDropdownModule, NgbTooltipModule, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { 
  Promotion, 
  PromotionType, 
  DiscountType, 
  TargetType,
  CategoryOption,
  ProductOption,
  DeliveryZoneOption,
  PromotionPriceRule
} from '../../../core/models/promotion.models';
import { AdminPromotionService, PromotionFilters, PromotionStats, PromotionWithRules } from '../../../core/services/admin-promotion.service';
import {TruncatePipe} from "../../../shared/pipes/truncate.pipe";

@Component({
  selector: 'app-promos',
  standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        FormsModule,
        ReactiveFormsModule,
        NgbPaginationModule,
        NgbDropdownModule,
        NgbTooltipModule,
        NgbNavModule,
        TruncatePipe
    ],
  templateUrl: './promos.component.html',
  styleUrl: './promos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PromosComponent implements OnInit, OnDestroy {
  // Data
  promotions: Promotion[] = [];
  filteredPromotions: Promotion[] = [];
  stats: PromotionStats | null = null;
  
  // Reference data for selectors
  categories: CategoryOption[] = [];
  mainCategories: CategoryOption[] = [];
  subcategories: CategoryOption[] = [];
  products: ProductOption[] = [];
  deliveryZones: DeliveryZoneOption[] = [];
  
  // UI State
  loading = false;
  error: string | null = null;
  activeTab = 1;
  
  // Forms
  promotionForm!: FormGroup;
  searchForm!: FormGroup;
  
  // Modal state
  isModalOpen = false;
  modalMode: 'create' | 'edit' | 'view' = 'create';
  selectedPromotion: PromotionWithRules | null = null;
  
  // Constants
  readonly statusOptions = [
    { value: 'draft', label: 'Brouillon', class: 'bg-secondary' },
    { value: 'scheduled', label: 'Programmée', class: 'bg-info' },
    { value: 'running', label: 'Active', class: 'bg-success' },
    { value: 'paused', label: 'En pause', class: 'bg-warning' },
    { value: 'ended', label: 'Terminée', class: 'bg-danger' }
  ];

  readonly promotionTypeOptions: { value: PromotionType; label: string; icon: string }[] = [
    { value: 'DISPLAY', label: 'Affichage uniquement', icon: 'ri-megaphone-line' },
    { value: 'PRODUCT_DISCOUNT', label: 'Réduction produit', icon: 'ri-price-tag-3-line' },
    { value: 'DELIVERY_DISCOUNT', label: 'Réduction livraison', icon: 'ri-truck-line' }
  ];

  readonly discountTypeOptions: { value: DiscountType; label: string }[] = [
    { value: 'PERCENTAGE', label: 'Pourcentage (%)' },
    { value: 'FIXED_AMOUNT', label: 'Montant fixe (€)' }
  ];

  readonly targetTypeOptions: { value: TargetType; label: string; forType: PromotionType[] }[] = [
    { value: 'ALL_PRODUCTS', label: 'Tous les produits', forType: ['PRODUCT_DISCOUNT'] },
    { value: 'CATEGORY', label: 'Catégorie principale', forType: ['PRODUCT_DISCOUNT'] },
    { value: 'SUBCATEGORY', label: 'Sous-catégorie', forType: ['PRODUCT_DISCOUNT'] },
    { value: 'PRODUCT', label: 'Produit spécifique', forType: ['PRODUCT_DISCOUNT'] },
    { value: 'ALL_DELIVERY', label: 'Toutes les livraisons', forType: ['DELIVERY_DISCOUNT'] },
    { value: 'DELIVERY_ZONE', label: 'Zone de livraison', forType: ['DELIVERY_DISCOUNT'] }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private adminPromotionService: AdminPromotionService,
    private modalService: NgbModal,
    private formBuilder: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadPromotions();
    this.loadStats();
    this.loadReferenceData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================================
  // FORM INITIALIZATION
  // ============================================================================

  private initializeForms(): void {
    this.promotionForm = this.formBuilder.group({
      // Basic info
      title: ['', [Validators.required, Validators.maxLength(255)]],
      message: ['', [Validators.required]],
      url: [''],
      placement: ['topbar', Validators.required],
      
      // Dates
      start_at: ['', Validators.required],
      end_at: ['', Validators.required],
      
      // Display settings
      display_duration_seconds: [10, [Validators.required, Validators.min(1)]],
      weight: [0, [Validators.required, Validators.min(0)]],
      is_dismissible: [true],
      animation: ['slide', Validators.required],
      
      // Theme colors
      theme_bg: ['#000000', Validators.required],
      theme_fg: ['#ffffff', Validators.required],
      theme_accent: ['#ff0000', Validators.required],
      
      // NEW: Promotion type and discount
      promotion_type: ['DISPLAY', Validators.required],
      discount_type: [null],
      discount_value: [null],
      min_order_amount: [null],
      max_discount_amount: [null],
      
      // NEW: Target rules
      rules: this.formBuilder.array([])
    });

    this.searchForm = this.formBuilder.group({
      query: ['']
    });

    // Watch promotion_type changes to update validation
    this.promotionForm.get('promotion_type')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(type => this.onPromotionTypeChange(type));
  }

  private onPromotionTypeChange(type: PromotionType): void {
    const discountTypeControl = this.promotionForm.get('discount_type');
    const discountValueControl = this.promotionForm.get('discount_value');

    if (type === 'PRODUCT_DISCOUNT' || type === 'DELIVERY_DISCOUNT') {
      discountTypeControl?.setValidators([Validators.required]);
      discountValueControl?.setValidators([Validators.required, Validators.min(0.01)]);
    } else {
      discountTypeControl?.clearValidators();
      discountValueControl?.clearValidators();
      discountTypeControl?.setValue(null);
      discountValueControl?.setValue(null);
    }

    discountTypeControl?.updateValueAndValidity();
    discountValueControl?.updateValueAndValidity();
    this.cdr.markForCheck();
  }

  // ============================================================================
  // RULES MANAGEMENT
  // ============================================================================

  get rulesArray(): FormArray {
    return this.promotionForm.get('rules') as FormArray;
  }

  addRule(): void {
    const ruleGroup = this.formBuilder.group({
      target_type: ['', Validators.required],
      target_id: [null],
      target_code: [null]
    });

    this.rulesArray.push(ruleGroup);
    this.cdr.markForCheck();
  }

  removeRule(index: number): void {
    this.rulesArray.removeAt(index);
    this.cdr.markForCheck();
  }

  clearRules(): void {
    while (this.rulesArray.length > 0) {
      this.rulesArray.removeAt(0);
    }
  }

  getAvailableTargetTypes(): { value: TargetType; label: string }[] {
    const promotionType = this.promotionForm.get('promotion_type')?.value as PromotionType;
    return this.targetTypeOptions.filter(opt => opt.forType.includes(promotionType));
  }

  onTargetTypeChange(index: number): void {
    const ruleGroup = this.rulesArray.at(index) as FormGroup;
    ruleGroup.get('target_id')?.setValue(null);
    ruleGroup.get('target_code')?.setValue(null);
    this.cdr.markForCheck();
  }

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  loadPromotions(): void {
    this.loading = true;
    this.adminPromotionService.getPromotions().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (promotions) => {
        this.promotions = promotions;
        this.filteredPromotions = promotions;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading promotions:', error);
        this.error = 'Erreur lors du chargement des promotions';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadStats(): void {
    this.adminPromotionService.getPromotionStats().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (stats) => {
        this.stats = stats;
        this.cdr.markForCheck();
      }
    });
  }

  loadReferenceData(): void {
    // Load categories
    this.adminPromotionService.getCategories().pipe(
      takeUntil(this.destroy$)
    ).subscribe(categories => {
      this.categories = categories;
      this.mainCategories = categories.filter(c => !c.isSubcategory);
      this.subcategories = categories.filter(c => c.isSubcategory);
      this.cdr.markForCheck();
    });

    // Load products
    this.adminPromotionService.getProducts().pipe(
      takeUntil(this.destroy$)
    ).subscribe(products => {
      this.products = products;
      this.cdr.markForCheck();
    });

    // Load delivery zones
    this.adminPromotionService.getDeliveryZones().pipe(
      takeUntil(this.destroy$)
    ).subscribe(zones => {
      this.deliveryZones = zones;
      this.cdr.markForCheck();
    });
  }

  // ============================================================================
  // MODAL MANAGEMENT
  // ============================================================================

  openCreateModal(content: unknown): void {
    this.modalMode = 'create';
    this.selectedPromotion = null;
    this.resetPromotionForm();
    this.modalService.open(content, { size: 'xl', backdrop: 'static' });
  }

  openEditModal(content: unknown, promotion: Promotion): void {
    this.modalMode = 'edit';
    this.loading = true;
    
    // Load promotion with rules
    this.adminPromotionService.getPromotionById(promotion.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (promoWithRules) => {
        if (promoWithRules) {
          this.selectedPromotion = promoWithRules;
          this.populatePromotionForm(promoWithRules);
          this.modalService.open(content, { size: 'xl', backdrop: 'static' });
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        Swal.fire({
          icon: 'error',
          title: 'Erreur!',
          text: 'Impossible de charger la promotion.'
        });
        this.cdr.markForCheck();
      }
    });
  }

  private resetPromotionForm(): void {
    this.clearRules();
    this.promotionForm.reset({
      title: '',
      message: '',
      url: '',
      placement: 'topbar',
      start_at: '',
      end_at: '',
      display_duration_seconds: 10,
      weight: 0,
      is_dismissible: true,
      animation: 'slide',
      theme_bg: '#000000',
      theme_fg: '#ffffff',
      theme_accent: '#ff0000',
      promotion_type: 'DISPLAY',
      discount_type: null,
      discount_value: null,
      min_order_amount: null,
      max_discount_amount: null
    });
  }

  private populatePromotionForm(promotion: PromotionWithRules): void {
    this.promotionForm.patchValue({
      title: promotion.title,
      message: promotion.message,
      url: promotion.url || '',
      placement: promotion.placement,
      start_at: this.formatDateForInput(promotion.start_at),
      end_at: this.formatDateForInput(promotion.end_at),
      display_duration_seconds: promotion.display_duration_seconds,
      weight: promotion.weight,
      is_dismissible: promotion.is_dismissible,
      animation: promotion.animation,
      theme_bg: promotion.theme?.bg || '#000000',
      theme_fg: promotion.theme?.fg || '#ffffff',
      theme_accent: promotion.theme?.accent || '#ff0000',
      promotion_type: promotion.promotion_type || 'DISPLAY',
      discount_type: promotion.discount_type || null,
      discount_value: promotion.discount_value || null,
      min_order_amount: promotion.min_order_amount || null,
      max_discount_amount: promotion.max_discount_amount || null
    });

    // Populate rules
    this.clearRules();
    if (promotion.rules && promotion.rules.length > 0) {
      promotion.rules.forEach(rule => {
        const ruleGroup = this.formBuilder.group({
          target_type: [rule.target_type, Validators.required],
          target_id: [rule.target_id || null],
          target_code: [rule.target_code || null]
        });
        this.rulesArray.push(ruleGroup);
      });
    }

    this.cdr.markForCheck();
  }

  private formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
  }

  // ============================================================================
  // FORM SUBMISSION
  // ============================================================================

  onSubmitPromotion(): void {
    if (this.promotionForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.promotionForm.controls).forEach(key => {
        this.promotionForm.get(key)?.markAsTouched();
      });
      return;
    }

    const formValue = this.promotionForm.value;
    
    const promotionData = {
      title: formValue.title,
      message: formValue.message,
      url: formValue.url || undefined,
      placement: formValue.placement,
      start_at: new Date(formValue.start_at).toISOString(),
      end_at: new Date(formValue.end_at).toISOString(),
      display_duration_seconds: formValue.display_duration_seconds,
      weight: formValue.weight,
      is_dismissible: formValue.is_dismissible,
      animation: formValue.animation,
      theme: {
        bg: formValue.theme_bg,
        fg: formValue.theme_fg,
        accent: formValue.theme_accent
      },
      promotion_type: formValue.promotion_type,
      discount_type: formValue.discount_type || undefined,
      discount_value: formValue.discount_value || undefined,
      min_order_amount: formValue.min_order_amount || undefined,
      max_discount_amount: formValue.max_discount_amount || undefined
    };

    // Extract rules with proper typing
    const rules: { target_type: TargetType; target_id?: string; target_code?: string }[] = (formValue.rules || [])
      .filter((rule: { target_type: string }) => rule.target_type)
      .map((rule: { target_type: TargetType; target_id: string; target_code: string }) => ({
        target_type: rule.target_type,
        target_id: rule.target_id || undefined,
        target_code: rule.target_code || undefined
      }));

    if (this.modalMode === 'create') {
      this.createPromotion(promotionData, rules);
    } else if (this.modalMode === 'edit' && this.selectedPromotion) {
      this.updatePromotion(this.selectedPromotion.id, promotionData, rules);
    }
  }

  private createPromotion(data: unknown, rules: { target_type: TargetType; target_id?: string; target_code?: string }[]): void {
    this.adminPromotionService.createPromotionWithRules(data as Parameters<typeof this.adminPromotionService.createPromotionWithRules>[0], rules).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Succès!',
          text: 'Promotion créée avec succès!',
          timer: 3000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        this.modalService.dismissAll();
        this.loadPromotions();
        this.loadStats();
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Erreur!',
          text: 'Erreur lors de la création de la promotion.'
        });
      }
    });
  }

  private updatePromotion(id: string, data: unknown, rules: { target_type: TargetType; target_id?: string; target_code?: string }[]): void {
    this.adminPromotionService.updatePromotionWithRules(id, data as Parameters<typeof this.adminPromotionService.updatePromotionWithRules>[1], rules).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Succès!',
          text: 'Promotion modifiée avec succès!',
          timer: 3000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        this.modalService.dismissAll();
        this.loadPromotions();
        this.loadStats();
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Erreur!',
          text: 'Erreur lors de la modification de la promotion.'
        });
      }
    });
  }

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  deletePromotion(promotion: Promotion): void {
    Swal.fire({
      title: 'Confirmer la suppression',
      text: `Êtes-vous sûr de vouloir supprimer la promotion "${promotion.title}" ?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        this.adminPromotionService.deletePromotion(promotion.id).pipe(
          takeUntil(this.destroy$)
        ).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Supprimée!',
              text: 'Promotion supprimée avec succès!',
              timer: 3000,
              showConfirmButton: false,
              toast: true,
              position: 'top-end'
            });
            this.loadPromotions();
            this.loadStats();
          },
          error: () => {
            Swal.fire({
              icon: 'error',
              title: 'Erreur!',
              text: 'Erreur lors de la suppression de la promotion.'
            });
          }
        });
      }
    });
  }

  updateStatus(promotion: Promotion, newStatus: string): void {
    this.adminPromotionService.updatePromotionStatus(promotion.id, newStatus).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Statut mis à jour!',
          timer: 2000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        this.loadPromotions();
        this.loadStats();
      }
    });
  }

  duplicatePromotion(promotion: Promotion): void {
    this.adminPromotionService.duplicatePromotion(promotion.id).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Dupliquée!',
          text: 'Promotion dupliquée avec succès!',
          timer: 3000,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        this.loadPromotions();
        this.loadStats();
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Erreur!',
          text: 'Erreur lors de la duplication de la promotion.'
        });
      }
    });
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  getStatusBadgeClass(status: string): string {
    const option = this.statusOptions.find(opt => opt.value === status);
    return option?.class || 'bg-secondary';
  }

  getStatusLabel(status: string): string {
    const option = this.statusOptions.find(opt => opt.value === status);
    return option?.label || status;
  }

  getPromotionTypeLabel(type: PromotionType): string {
    const option = this.promotionTypeOptions.find(opt => opt.value === type);
    return option?.label || type;
  }

  getPromotionTypeIcon(type: PromotionType): string {
    const option = this.promotionTypeOptions.find(opt => opt.value === type);
    return option?.icon || 'ri-megaphone-line';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('fr-FR');
  }

  formatDiscount(promotion: Promotion): string {
    if (!promotion.discount_type || !promotion.discount_value) {
      return '-';
    }
    if (promotion.discount_type === 'PERCENTAGE') {
      return `-${promotion.discount_value}%`;
    }
    return `-${promotion.discount_value}€`;
  }

  get f() {
    return this.promotionForm.controls;
  }

  trackByPromotionId(index: number, promotion: Promotion): string {
    return promotion.id;
  }
}
