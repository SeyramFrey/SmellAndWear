import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { CommandeService, OrderWithItems } from '../../../core/services/commande.service';

/**
 * Order Details Component for Admin
 * 
 * Displays full order information and allows admin to:
 * - View order details, items, customer info
 * - Add/update tracking code
 * - Update order status
 * - Trigger shipping notification email
 */
@Component({
  selector: 'app-order-details',
  templateUrl: './order-details.component.html',
  styleUrls: ['./order-details.component.scss']
})
export class OrderDetailsComponent implements OnInit, OnDestroy {
  // Breadcrumb
  breadCrumbItems: Array<{}> = [];
  
  // Order data
  orderId: string = '';
  order: OrderWithItems | null = null;
  orderItems: any[] = []; // Using any[] because items include joined variant data
  loading = false;
  error: string | null = null;
  
  // Tracking form
  trackingForm!: FormGroup;
  isEditingTracking = false;
  savingTracking = false;
  
  // Status options
  statusOptions = [
    { value: 'Nouvelle', label: 'Nouvelle', class: 'bg-warning-subtle text-warning' },
    { value: 'En cours', label: 'En cours', class: 'bg-primary-subtle text-primary' },
    { value: 'Expédiée', label: 'Expédiée', class: 'bg-info-subtle text-info' },
    { value: 'Livrée', label: 'Livrée', class: 'bg-success-subtle text-success' },
    { value: 'Annulée', label: 'Annulée', class: 'bg-danger-subtle text-danger' }
  ];
  
  // Carrier options
  carrierOptions = [
    { value: 'chronopost', label: 'Chronopost' },
    { value: 'colissimo', label: 'Colissimo' },
    { value: 'dhl', label: 'DHL' },
    { value: 'ups', label: 'UPS' },
    { value: 'fedex', label: 'FedEx' },
    { value: 'other', label: 'Autre' }
  ];
  
  private destroy$ = new Subject<void>();
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: FormBuilder,
    private commandeService: CommandeService,
    private cdr: ChangeDetectorRef
  ) {}
  
  ngOnInit(): void {
    this.breadCrumbItems = [
      { label: 'Ecommerce' },
      { label: 'Orders', link: '/ecommerce/orders' },
      { label: 'Order Details', active: true }
    ];
    
    // Initialize tracking form
    this.trackingForm = this.formBuilder.group({
      trackingCode: ['', [Validators.required, Validators.minLength(3)]],
      carrier: ['chronopost', Validators.required],
      notifyCustomer: [true]
    });
    
    // Get order ID from route
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.orderId = params['orderId'];
      if (this.orderId) {
        this.loadOrderDetails();
      }
    });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Load order details from database
   */
  loadOrderDetails(): void {
    this.loading = true;
    this.error = null;
    
    this.commandeService.getCommandeById(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (order) => {
          if (order) {
            this.order = order;
            this.orderItems = order.items || [];
            
            // Populate tracking form if tracking exists
            if (order.tracking_code) {
              this.trackingForm.patchValue({
                trackingCode: order.tracking_code,
                carrier: order.shipping_carrier || 'chronopost'
              });
            }
          } else {
            this.error = 'Commande non trouvée';
          }
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading order:', error);
          this.error = 'Erreur lors du chargement de la commande';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }
  
  /**
   * Toggle tracking edit mode
   */
  toggleTrackingEdit(): void {
    this.isEditingTracking = !this.isEditingTracking;
  }
  
  /**
   * Save tracking code and update order status
   */
  saveTracking(): void {
    if (this.trackingForm.invalid || !this.order) {
      return;
    }
    
    this.savingTracking = true;
    const formValues = this.trackingForm.value;
    
    // Update order with tracking info and change status to Expédiée
    this.commandeService.updateOrderTracking(
      this.orderId,
      formValues.trackingCode,
      formValues.carrier,
      formValues.notifyCustomer
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          if (success) {
            Swal.fire({
              title: 'Succès!',
              text: formValues.notifyCustomer 
                ? 'Le code de suivi a été enregistré et le client a été notifié par email.'
                : 'Le code de suivi a été enregistré.',
              icon: 'success',
              confirmButtonText: 'OK'
            });
            
            // Reload order to reflect changes
            this.loadOrderDetails();
            this.isEditingTracking = false;
          }
          this.savingTracking = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error saving tracking:', error);
          Swal.fire({
            title: 'Erreur',
            text: 'Impossible d\'enregistrer le code de suivi.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
          this.savingTracking = false;
          this.cdr.detectChanges();
        }
      });
  }
  
  /**
   * Update order status manually
   */
  updateStatus(newStatus: string): void {
    if (!this.order) return;
    
    Swal.fire({
      title: 'Confirmer le changement de statut',
      text: `Voulez-vous changer le statut de la commande en "${newStatus}" ?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui, changer',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        this.commandeService.updateOrderStatus(this.orderId, newStatus)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              Swal.fire({
                title: 'Statut mis à jour',
                text: `La commande est maintenant "${newStatus}".`,
                icon: 'success',
                confirmButtonText: 'OK'
              });
              this.loadOrderDetails();
            },
            error: (err: Error) => {
              console.error('Error updating status:', err);
              Swal.fire({
                title: 'Erreur',
                text: 'Impossible de mettre à jour le statut.',
                icon: 'error',
                confirmButtonText: 'OK'
              });
            }
          });
      }
    });
  }
  
  /**
   * Resend shipping notification email
   */
  resendNotification(): void {
    if (!this.order || !this.order.tracking_code) {
      Swal.fire({
        title: 'Aucun code de suivi',
        text: 'Veuillez d\'abord ajouter un code de suivi.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    Swal.fire({
      title: 'Renvoyer la notification',
      text: 'Voulez-vous renvoyer l\'email de notification d\'expédition au client ?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Oui, envoyer',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        this.commandeService.sendShippingNotification(this.orderId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (success) => {
              if (success) {
                Swal.fire({
                  title: 'Email envoyé',
                  text: 'Le client a été notifié par email.',
                  icon: 'success',
                  confirmButtonText: 'OK'
                });
              }
            },
            error: (error) => {
              console.error('Error sending notification:', error);
              Swal.fire({
                title: 'Erreur',
                text: 'Impossible d\'envoyer l\'email.',
                icon: 'error',
                confirmButtonText: 'OK'
              });
            }
          });
      }
    });
  }
  
  /**
   * Go back to orders list
   */
  goBack(): void {
    this.router.navigate(['/ecommerce/orders']);
  }
  
  /**
   * Get status badge class
   */
  getStatusClass(status: string): string {
    const found = this.statusOptions.find(s => s.value === status);
    return found ? found.class : 'bg-secondary-subtle text-secondary';
  }
  
  /**
   * Format currency
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }
  
  /**
   * Format date
   */
  formatDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  /**
   * Get carrier label
   */
  getCarrierLabel(carrier: string): string {
    const found = this.carrierOptions.find(c => c.value === carrier);
    return found ? found.label : carrier;
  }
}

