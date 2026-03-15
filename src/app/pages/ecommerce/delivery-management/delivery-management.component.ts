import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DeliveryPricesService } from '../../../core/services/delivery-prices.service';
import { DeliveryPrice, DeliveryPriceRequest } from '../../../core/models/delivery-price.model';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-delivery-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './delivery-management.component.html',
  styleUrl: './delivery-management.component.scss'
})
export class DeliveryManagementComponent implements OnInit {
  deliveryPrices: DeliveryPrice[] = [];
  filteredPrices: DeliveryPrice[] = [];
  loading: boolean = false;
  
  // Form
  priceForm!: FormGroup;
  isEditing: boolean = false;
  editingId: string | null = null;
  
  // Filters
  filterCountry: string = 'all';
  filterActive: string = 'all';
  filterExpress: string = 'all';
  
  constructor(
    private deliveryService: DeliveryPricesService,
    private fb: FormBuilder
  ) {}
  
  ngOnInit(): void {
    this.initForm();
    this.loadDeliveryPrices();
  }
  
  initForm(): void {
    this.priceForm = this.fb.group({
      country_code: ['CI', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
      zone_code: ['', [Validators.required]],
      label: ['', [Validators.required]],
      description: [null],
      price: [0, [Validators.required, Validators.min(0)]],
      currency: ['XOF', [Validators.required]],
      is_express: [false],
      is_active: [true],
      display_order: [0, [Validators.min(0)]]
    });
  }
  
  loadDeliveryPrices(): void {
    this.loading = true;
    this.deliveryService.getAllDeliveryPrices().subscribe({
      next: (prices) => {
        this.deliveryPrices = prices;
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading prices:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Impossible de charger les tarifs de livraison'
        });
        this.loading = false;
      }
    });
  }
  
  applyFilters(): void {
    this.filteredPrices = this.deliveryPrices.filter(price => {
      const countryMatch = this.filterCountry === 'all' || price.country_code === this.filterCountry;
      const activeMatch = this.filterActive === 'all' || 
                         (this.filterActive === 'active' && price.is_active) ||
                         (this.filterActive === 'inactive' && !price.is_active);
      const expressMatch = this.filterExpress === 'all' ||
                          (this.filterExpress === 'express' && price.is_express) ||
                          (this.filterExpress === 'standard' && !price.is_express);
      return countryMatch && activeMatch && expressMatch;
    });
  }
  
  onSubmit(): void {
    if (this.priceForm.invalid) {
      Object.keys(this.priceForm.controls).forEach(key => {
        const control = this.priceForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }
    
    const formData: DeliveryPriceRequest = this.priceForm.value;

    // Warn admin when an express delivery is saved with price = 0:
    // it will be invisible to customers at checkout.
    if (formData.is_express && formData.price === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Express à 0',
        text: 'Ce tarif express a un prix de 0. Il ne sera pas affiché aux clients sur la page de paiement. Augmentez le prix si vous souhaitez qu\'il soit visible.',
        confirmButtonText: 'Continuer quand même',
        showCancelButton: true,
        cancelButtonText: 'Corriger le prix',
        confirmButtonColor: '#f06548',
        cancelButtonColor: '#405189'
      }).then(result => {
        if (result.isConfirmed) {
          this.isEditing && this.editingId
            ? this.updatePrice(this.editingId, formData)
            : this.createPrice(formData);
        }
      });
      return;
    }

    if (this.isEditing && this.editingId) {
      this.updatePrice(this.editingId, formData);
    } else {
      this.createPrice(formData);
    }
  }
  
  createPrice(data: DeliveryPriceRequest): void {
    this.loading = true;
    this.deliveryService.createDeliveryPrice(data).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Succès',
          text: 'Tarif de livraison créé avec succès',
          timer: 2000,
          showConfirmButton: false
        });
        this.loadDeliveryPrices();
        this.resetForm();
      },
      error: (error) => {
        console.error('Error creating price:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: error.message || 'Impossible de créer le tarif'
        });
        this.loading = false;
      }
    });
  }
  
  updatePrice(id: string, data: Partial<DeliveryPriceRequest>): void {
    this.loading = true;
    this.deliveryService.updateDeliveryPrice(id, data).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Succès',
          text: 'Tarif de livraison mis à jour',
          timer: 2000,
          showConfirmButton: false
        });
        this.loadDeliveryPrices();
        this.resetForm();
      },
      error: (error) => {
        console.error('Error updating price:', error);
        Swal.fire({
          icon: 'error',
          title: 'Erreur',
          text: 'Impossible de mettre à jour le tarif'
        });
        this.loading = false;
      }
    });
  }
  
  editPrice(price: DeliveryPrice): void {
    this.isEditing = true;
    this.editingId = price.id;
    this.priceForm.patchValue({
      country_code: price.country_code,
      zone_code: price.zone_code,
      label: price.label,
      description: price.description,
      price: price.price,
      currency: price.currency,
      is_express: price.is_express,
      is_active: price.is_active,
      display_order: price.display_order
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  toggleStatus(price: DeliveryPrice): void {
    const action = price.is_active ? 'désactiver' : 'activer';
    Swal.fire({
      title: `Voulez-vous ${action} ce tarif ?`,
      text: price.label,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#405189',
      cancelButtonColor: '#f06548'
    }).then((result) => {
      if (result.isConfirmed) {
        this.deliveryService.toggleDeliveryPriceStatus(price.id, !price.is_active).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Succès',
              text: `Tarif ${price.is_active ? 'désactivé' : 'activé'}`,
              timer: 2000,
              showConfirmButton: false
            });
            this.loadDeliveryPrices();
          },
          error: (error) => {
            console.error('Error toggling status:', error);
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: 'Impossible de modifier le statut'
            });
          }
        });
      }
    });
  }
  
  deletePrice(price: DeliveryPrice): void {
    Swal.fire({
      title: 'Êtes-vous sûr ?',
      text: `Supprimer définitivement "${price.label}" ? Cette action est irréversible.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Oui, supprimer',
      cancelButtonText: 'Annuler',
      confirmButtonColor: '#f06548',
      cancelButtonColor: '#405189'
    }).then((result) => {
      if (result.isConfirmed) {
        this.deliveryService.deleteDeliveryPrice(price.id).subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Supprimé',
              text: 'Le tarif a été supprimé',
              timer: 2000,
              showConfirmButton: false
            });
            this.loadDeliveryPrices();
          },
          error: (error) => {
            console.error('Error deleting price:', error);
            Swal.fire({
              icon: 'error',
              title: 'Erreur',
              text: 'Impossible de supprimer le tarif'
            });
          }
        });
      }
    });
  }
  
  resetForm(): void {
    this.isEditing = false;
    this.editingId = null;
    this.priceForm.reset({
      country_code: 'CI',
      currency: 'XOF',
      description: null,
      is_express: false,
      is_active: true,
      display_order: 0,
      price: 0
    });
  }
  
  trackByPriceId(index: number, price: DeliveryPrice): string {
    return price.id;
  }
  
  // Helper methods for template
  isFieldInvalid(fieldName: string): boolean {
    const field = this.priceForm.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }
  
  getFieldError(fieldName: string): string {
    const field = this.priceForm.get(fieldName);
    if (field?.errors) {
      if (field.errors['required']) return 'Ce champ est requis';
      if (field.errors['min']) return `Minimum: ${field.errors['min'].min}`;
      if (field.errors['minlength']) return `Minimum ${field.errors['minlength'].requiredLength} caractères`;
      if (field.errors['maxlength']) return `Maximum ${field.errors['maxlength'].requiredLength} caractères`;
    }
    return '';
  }
}
