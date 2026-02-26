import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { CustomerService } from '../../../core/services/customer.service';
import { Commande } from '../../../core/models/models';

/**
 * Account Orders Component
 * 
 * Displays the user's order history with:
 * - Loading skeleton state
 * - Empty state with CTA
 * - Error state with retry
 * - Order cards with status badges
 * - Tracking information for shipped orders
 * - Responsive layout (cards on mobile, enhanced on desktop)
 */
@Component({
  selector: 'app-account-orders',
  templateUrl: './account-orders.component.html',
  styleUrls: ['./account-orders.component.scss']
})
export class AccountOrdersComponent implements OnInit, OnDestroy {
  orders: Commande[] = [];
  loading: boolean = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private customerService: CustomerService,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load orders from service
   */
  loadOrders(): void {
    this.loading = true;
    this.error = null;
    
    this.customerService.getOrders().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (orders) => {
        this.orders = orders;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading orders:', err);
        this.error = 'Unable to load your orders. Please try again.';
        this.loading = false;
      }
    });
  }

  /**
   * Go back to previous page dynamically
   */
  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/account']);
    }
  }

  /**
   * Navigate to order details
   */
  viewOrderDetails(orderId: string): void {
    // TODO: Implement order details page for client
    // For now, show the order ID in a different way or navigate to a detail page
    this.router.navigate(['/account/orders', orderId]);
  }

  /**
   * Get status badge class for styling
   */
  getStatusBadgeClass(status: string): string {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'en_attente':
      case 'nouvelle':
        return 'status-badge--pending';
      case 'validee':
      case 'confirmee':
      case 'confirmée':
        return 'status-badge--confirmed';
      case 'en_cours':
        return 'status-badge--processing';
      case 'expedie':
      case 'expédiée':
        return 'status-badge--shipped';
      case 'livree':
      case 'livrée':
        return 'status-badge--delivered';
      case 'annulee':
      case 'annulée':
        return 'status-badge--cancelled';
      default:
        return 'status-badge--default';
    }
  }

  /**
   * Get human-readable status label
   */
  getStatusLabel(status: string): string {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'en_attente':
      case 'nouvelle':
        return 'Pending';
      case 'validee':
      case 'confirmee':
      case 'confirmée':
        return 'Confirmed';
      case 'en_cours':
        return 'Processing';
      case 'expedie':
      case 'expédiée':
        return 'Shipped';
      case 'livree':
      case 'livrée':
        return 'Delivered';
      case 'annulee':
      case 'annulée':
        return 'Cancelled';
      default:
        return status || 'Unknown';
    }
  }

  /**
   * TrackBy function for ngFor optimization
   */
  trackByOrderId(index: number, order: Commande): string {
    return order.id;
  }
}
