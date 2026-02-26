import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SupabaseAuthService } from '../../../core/services/supabase-auth.service';
import { CustomerService } from '../../../core/services/customer.service';
import { FavoritesService } from '../../../core/services/favorites.service';
import { Client, Commande, Adresse } from '../../../core/models/models';

/**
 * Account Dashboard Component
 * 
 * Main customer account page showing:
 * - Personal information summary
 * - Recent orders
 * - Quick links to other sections
 */
@Component({
  selector: 'app-account-dashboard',
  templateUrl: './account-dashboard.component.html',
  styleUrls: ['./account-dashboard.component.scss']
})
export class AccountDashboardComponent implements OnInit, OnDestroy {
  client: Client | null = null;
  addresses: Adresse[] = [];
  recentOrders: Commande[] = [];
  favoritesCount: number = 0;
  loading: boolean = true;
  activeTab: number = 1;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: SupabaseAuthService,
    private customerService: CustomerService,
    private favoritesService: FavoritesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadData(): void {
    // Subscribe to client data
    this.customerService.client$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(client => {
      this.client = client;
      this.loading = false;
    });

    // Subscribe to addresses
    this.customerService.addresses$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(addresses => {
      this.addresses = addresses;
    });

    // Load recent orders
    this.customerService.getOrders().pipe(
      takeUntil(this.destroy$)
    ).subscribe(orders => {
      this.recentOrders = orders.slice(0, 5); // Show last 5 orders
    });

    // Subscribe to favorites count
    this.favoritesService.favoritesCount$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(count => {
      this.favoritesCount = count;
    });
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  async logout(): Promise<void> {
    try {
      await this.authService.signOut();
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'en_attente':
        return 'bg-warning';
      case 'validee':
      case 'confirmee':
        return 'bg-info';
      case 'en_cours':
      case 'expedie':
        return 'bg-primary';
      case 'livree':
        return 'bg-success';
      case 'annulee':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  getStatusLabel(status: string): string {
    switch (status?.toLowerCase()) {
      case 'en_attente':
        return 'Pending';
      case 'validee':
      case 'confirmee':
        return 'Confirmed';
      case 'en_cours':
        return 'Processing';
      case 'expedie':
        return 'Shipped';
      case 'livree':
        return 'Delivered';
      case 'annulee':
        return 'Cancelled';
      default:
        return status || 'Unknown';
    }
  }
}

