# Delivery Management Admin Page - Implementation Guide

## Component Generation

```bash
ng generate component pages/admin/delivery-management --standalone
```

## Required Imports

```typescript
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DeliveryPricesService } from '../../../core/services/delivery-prices.service';
import { DeliveryPrice, DeliveryPriceRequest } from '../../../core/models/delivery-price.model';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';
```

## Component Structure

```typescript
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
  
  constructor(
    private deliveryService: DeliveryPricesService,
    private fb: FormBuilder
  ) {}
  
  ngOnInit() {
    this.initForm();
    this.loadDeliveryPrices();
  }
  
  initForm() {
    this.priceForm = this.fb.group({
      country_code: ['CI', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
      zone_code: ['', [Validators.required]],
      label: ['', [Validators.required]],
      price: [0, [Validators.required, Validators.min(0)]],
      currency: ['XOF', [Validators.required]],
      is_express: [false],
      is_active: [true],
      display_order: [0, [Validators.min(0)]]
    });
  }
  
  loadDeliveryPrices() {
    this.loading = true;
    this.deliveryService.getAllDeliveryPrices().subscribe({
      next: (prices) => {
        this.deliveryPrices = prices;
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading prices:', error);
        Swal.fire('Error', 'Failed to load delivery prices', 'error');
        this.loading = false;
      }
    });
  }
  
  applyFilters() {
    this.filteredPrices = this.deliveryPrices.filter(price => {
      const countryMatch = this.filterCountry === 'all' || price.country_code === this.filterCountry;
      const activeMatch = this.filterActive === 'all' || 
                         (this.filterActive === 'active' && price.is_active) ||
                         (this.filterActive === 'inactive' && !price.is_active);
      return countryMatch && activeMatch;
    });
  }
  
  onSubmit() {
    if (this.priceForm.invalid) {
      return;
    }
    
    const formData: DeliveryPriceRequest = this.priceForm.value;
    
    if (this.isEditing && this.editingId) {
      this.updatePrice(this.editingId, formData);
    } else {
      this.createPrice(formData);
    }
  }
  
  createPrice(data: DeliveryPriceRequest) {
    this.loading = true;
    this.deliveryService.createDeliveryPrice(data).subscribe({
      next: () => {
        Swal.fire('Success', 'Delivery price created', 'success');
        this.loadDeliveryPrices();
        this.resetForm();
      },
      error: (error) => {
        console.error('Error creating price:', error);
        Swal.fire('Error', 'Failed to create delivery price', 'error');
        this.loading = false;
      }
    });
  }
  
  updatePrice(id: string, data: Partial<DeliveryPriceRequest>) {
    this.loading = true;
    this.deliveryService.updateDeliveryPrice(id, data).subscribe({
      next: () => {
        Swal.fire('Success', 'Delivery price updated', 'success');
        this.loadDeliveryPrices();
        this.resetForm();
      },
      error: (error) => {
        console.error('Error updating price:', error);
        Swal.fire('Error', 'Failed to update delivery price', 'error');
        this.loading = false;
      }
    });
  }
  
  editPrice(price: DeliveryPrice) {
    this.isEditing = true;
    this.editingId = price.id;
    this.priceForm.patchValue({
      country_code: price.country_code,
      zone_code: price.zone_code,
      label: price.label,
      price: price.price,
      currency: price.currency,
      is_express: price.is_express,
      is_active: price.is_active,
      display_order: price.display_order
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  toggleStatus(price: DeliveryPrice) {
    Swal.fire({
      title: `${price.is_active ? 'Deactivate' : 'Activate'} this price?`,
      text: price.label,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.deliveryService.toggleDeliveryPriceStatus(price.id, !price.is_active).subscribe({
          next: () => {
            Swal.fire('Success', `Price ${price.is_active ? 'deactivated' : 'activated'}`, 'success');
            this.loadDeliveryPrices();
          },
          error: (error) => {
            console.error('Error toggling status:', error);
            Swal.fire('Error', 'Failed to update status', 'error');
          }
        });
      }
    });
  }
  
  resetForm() {
    this.isEditing = false;
    this.editingId = null;
    this.priceForm.reset({
      country_code: 'CI',
      currency: 'XOF',
      is_express: false,
      is_active: true,
      display_order: 0,
      price: 0
    });
  }
  
  trackByPriceId(index: number, price: DeliveryPrice): string {
    return price.id;
  }
}
```

## HTML Template Structure

```html
<div class="container-fluid">
  <div class="row">
    <div class="col-12">
      <div class="page-title-box d-sm-flex align-items-center justify-content-between">
        <h4 class="mb-sm-0">Delivery Price Management</h4>
      </div>
    </div>
  </div>

  <!-- Form Card -->
  <div class="row mb-4">
    <div class="col-lg-12">
      <div class="card">
        <div class="card-header">
          <h5 class="card-title mb-0">
            {{ isEditing ? 'Edit Delivery Price' : 'Add New Delivery Price' }}
          </h5>
        </div>
        <div class="card-body">
          <form [formGroup]="priceForm" (ngSubmit)="onSubmit()">
            <div class="row g-3">
              <div class="col-md-2">
                <label class="form-label">Country Code</label>
                <input type="text" class="form-control" formControlName="country_code" 
                       placeholder="CI" maxlength="2">
              </div>
              <div class="col-md-3">
                <label class="form-label">Zone Code</label>
                <input type="text" class="form-control" formControlName="zone_code" 
                       placeholder="abidjan_nord">
              </div>
              <div class="col-md-4">
                <label class="form-label">Label</label>
                <input type="text" class="form-control" formControlName="label" 
                       placeholder="Abidjan Nord">
              </div>
              <div class="col-md-2">
                <label class="form-label">Price</label>
                <input type="number" class="form-control" formControlName="price" 
                       min="0" step="0.01">
              </div>
              <div class="col-md-1">
                <label class="form-label">Currency</label>
                <select class="form-select" formControlName="currency">
                  <option value="XOF">XOF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div class="col-md-2">
                <label class="form-label">Display Order</label>
                <input type="number" class="form-control" formControlName="display_order" min="0">
              </div>
              <div class="col-md-2">
                <div class="form-check mt-4">
                  <input class="form-check-input" type="checkbox" formControlName="is_express">
                  <label class="form-check-label">Express Delivery</label>
                </div>
              </div>
              <div class="col-md-2">
                <div class="form-check mt-4">
                  <input class="form-check-input" type="checkbox" formControlName="is_active">
                  <label class="form-check-label">Active</label>
                </div>
              </div>
              <div class="col-md-12">
                <button type="submit" class="btn btn-success" [disabled]="priceForm.invalid || loading">
                  <i class="ri-save-line"></i> {{ isEditing ? 'Update' : 'Create' }}
                </button>
                <button type="button" class="btn btn-secondary ms-2" (click)="resetForm()" 
                        *ngIf="isEditing">
                  <i class="ri-close-line"></i> Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="row mb-3">
    <div class="col-md-3">
      <select class="form-select" [(ngModel)]="filterCountry" (change)="applyFilters()">
        <option value="all">All Countries</option>
        <option value="CI">Côte d'Ivoire (CI)</option>
        <option value="FR">France (FR)</option>
      </select>
    </div>
    <div class="col-md-3">
      <select class="form-select" [(ngModel)]="filterActive" (change)="applyFilters()">
        <option value="all">All Status</option>
        <option value="active">Active Only</option>
        <option value="inactive">Inactive Only</option>
      </select>
    </div>
  </div>

  <!-- Table Card -->
  <div class="row">
    <div class="col-lg-12">
      <div class="card">
        <div class="card-header">
          <h5 class="card-title mb-0">Delivery Prices ({{ filteredPrices.length }})</h5>
        </div>
        <div class="card-body">
          <div class="table-responsive" *ngIf="!loading">
            <table class="table table-hover">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Zone</th>
                  <th>Label</th>
                  <th>Price</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Order</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let price of filteredPrices; trackBy: trackByPriceId">
                  <td>{{ price.country_code }}</td>
                  <td><code>{{ price.zone_code }}</code></td>
                  <td>{{ price.label }}</td>
                  <td><strong>{{ price.price }} {{ price.currency }}</strong></td>
                  <td>
                    <span class="badge" [class.bg-warning]="price.is_express" 
                          [class.bg-info]="!price.is_express">
                      {{ price.is_express ? 'Express' : 'Standard' }}
                    </span>
                  </td>
                  <td>
                    <span class="badge" [class.bg-success]="price.is_active" 
                          [class.bg-secondary]="!price.is_active">
                      {{ price.is_active ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td>{{ price.display_order }}</td>
                  <td>
                    <button class="btn btn-sm btn-soft-primary me-1" (click)="editPrice(price)">
                      <i class="ri-pencil-line"></i>
                    </button>
                    <button class="btn btn-sm" 
                            [class.btn-soft-danger]="price.is_active"
                            [class.btn-soft-success]="!price.is_active"
                            (click)="toggleStatus(price)">
                      <i [class]="price.is_active ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="text-center py-5" *ngIf="loading">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
          
          <div class="alert alert-info" *ngIf="!loading && filteredPrices.length === 0">
            No delivery prices found. Add one above.
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

## Routing Configuration

In `src/app/pages/pages-routing.module.ts`, add:

```typescript
{
  path: 'delivery-management',
  loadComponent: () => import('./admin/delivery-management/delivery-management.component')
    .then(m => m.DeliveryManagementComponent),
  canActivate: [AdminGuard]
}
```

## Sidebar Menu Entry

In sidebar configuration (likely `src/app/layouts/sidebar/menu.ts`):

```typescript
{
  id: 'delivery-management',
  label: 'MENUITEMS.DELIVERY.TEXT',
  icon: 'ri-truck-line',
  link: '/admin/delivery-management',
  parentId: 'ecommerce' // or appropriate parent
}
```

## i18n Translations

In translation files:

```json
"MENUITEMS": {
  "DELIVERY": {
    "TEXT": "Delivery Prices"
  }
}
```

## Styling (Optional)

Add to component SCSS if needed:

```scss
.card {
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.table {
  tbody tr {
    transition: background-color 0.2s;
    
    &:hover {
      background-color: rgba(0,0,0,0.02);
    }
  }
}

code {
  background-color: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.9em;
}
```

## Testing Checklist

- [ ] Can view all delivery prices
- [ ] Can filter by country
- [ ] Can filter by active status
- [ ] Can create new delivery price
- [ ] Can edit existing price
- [ ] Can toggle active/inactive
- [ ] Form validation works
- [ ] Loading states display
- [ ] Error messages display
- [ ] Success messages display
- [ ] Table updates after CRUD operations
- [ ] Responsive on mobile

## Security Notes

- Admin guard should verify user has admin role
- RLS policies in Supabase handle database-level security
- Service already includes error handling
- Form validation prevents invalid data

---

**Estimated Time**: 2-3 hours for complete implementation and testing

