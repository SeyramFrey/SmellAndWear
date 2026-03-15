import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgbModal, NgbNavChangeEvent } from '@ng-bootstrap/ng-bootstrap';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { DatePipe, CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

// Csv File Export
import { ngxCsv } from 'ngx-csv/ngx-csv';

// Sweet Alert
import Swal from 'sweetalert2';

import { CommandeService, OrderWithItems } from '../../../core/services/commande.service';
import { Commande } from '../../../core/models/models';
import { PaginationService } from 'src/app/core/services/pagination.service';

@Component({
  selector: 'app-orders',
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})

/**
 * Orders Component
 */
export class OrdersComponent implements OnInit, OnDestroy {

  // bread crumb items
  breadCrumbItems!: Array<{}>;
  ordersForm!: UntypedFormGroup;
  submitted = false;
  masterSelected!: boolean;
  checkedList: any;
  customerName?: any;

  // Status constants aligned with Supabase schema
  Nouvelle = 'Nouvelle';
  EnCours = 'En cours';
  Expedie = 'Expédiée';
  Livre = 'Livrée';
  Annule = 'Annulée';

  // Filter states
  payment: any = '';
  date: any;
  status: any = '';
  searchTerm: string = '';

  // Sorting state
  sortField: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Orders data with computed properties for template compatibility
  orderes: any[] = []; // Keep existing name for template compatibility
  allorderes: any[] = []; // Keep existing name for template compatibility
  loading = false;
  error: string | null = null;

  // Destroy subject for cleanup
  private destroy$ = new Subject<void>();

  // Search subject for debouncing
  private searchSubject = new Subject<string>();

  econtent?: any;
  deleteId?: string;

  constructor(
    private modalService: NgbModal,
    private formBuilder: UntypedFormBuilder,
    private commandeService: CommandeService,
    public service: PaginationService,
    private cdr: ChangeDetectorRef
  ) {
    // Setup search debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.performSearchFilter();
    });
  }

  ngOnInit(): void {
    /**
    * BreadCrumb
    */
    this.breadCrumbItems = [
      { label: 'Ecommerce' },
      { label: 'Orders', active: true }
    ];

    /**
     * Form Validation
     */
    this.ordersForm = this.formBuilder.group({
      orderId: [''],
      _id: [''],
      customer: ['', [Validators.required]],
      product: ['', [Validators.required]],
      orderDate: ['', [Validators.required]],
      amount: ['', [Validators.required]],
      payment: ['', [Validators.required]],
      status: ['', [Validators.required]]
    });

    // Load orders data
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Ensure loader is hidden when component is destroyed
    this.hideLoader();
  }

  /**
   * Transform Supabase orders data to match template expectations
   */
  private transformOrdersForTemplate(orders: Commande[]): any[] {
    return orders.map(order => ({
      // Original Supabase fields
      id: order.id,
      client_id: order.client_id,
      adresse_livraison_id: order.adresse_livraison_id,
      adresse_facturation_id: order.adresse_facturation_id,
      statut: order.statut,
      total: order.total,
      created_at: order.created_at,
      payment_reference: order.payment_reference,
      client: order.client,
      currency: order.currency,
      country_code: order.country_code,
      exchange_rate_eur_to_xof: order.exchange_rate_eur_to_xof,
      
      // Template compatibility fields
      _id: order.id,
      orderId: order.id,
      customer: order.client ? `${order.client.prenom} ${order.client.nom}` : 'Client inconnu',
      product: this.getProductSummary(order),
      orderDate: order.created_at,
      amount: this.formatCurrency(order.total, order.currency),
      payment: order.payment_reference || 'N/A',
      status: order.statut,
      state: false
    }));
  }

  /**
   * Load orders from Supabase
   */
  loadOrders(): void {
    this.loading = true;
    this.error = null;
    this.showLoader();
    this.cdr.detectChanges();

    console.log('Loading orders...');

    this.commandeService.getCommandes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          console.log('Orders loaded successfully:', orders.length, 'orders');
          this.allorderes = this.transformOrdersForTemplate(orders);
          this.orderes = this.service.changePage(this.allorderes);
          this.loading = false;
          this.hideLoader();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading orders:', error);
          this.error = 'Failed to load orders';
          this.loading = false;
          this.hideLoader();
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Load orders by status
   */
  loadOrdersByStatus(status: string): void {
    this.loading = true;
    this.error = null;
    this.showLoader();
    this.cdr.detectChanges();

    this.commandeService.getCommandesByStatus(status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (orders) => {
          this.allorderes = this.transformOrdersForTemplate(orders);
          this.orderes = this.service.changePage(this.allorderes);
          this.loading = false;
          this.hideLoader();
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.error = 'Failed to load orders';
          this.loading = false;
          this.hideLoader();
          console.error('Error loading orders by status:', error);
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Handle tab navigation
   */
  onNavChange(changeEvent: NgbNavChangeEvent) {
    const tabId = changeEvent.nextId;
    
    switch (tabId) {
      case 1: // All Orders
        this.loadOrders();
        break;
      case 2: // New Orders (Nouvelle)
        this.loadOrdersByStatus(this.Nouvelle);
        break;
      case 3: // Pickups (Expédiée)
        this.loadOrdersByStatus(this.Expedie);
        break;
      case 4: // Returns - for now, we'll show cancelled orders
        this.loadOrdersByStatus(this.Annule);
        break;
      case 5: // Cancelled
        this.loadOrdersByStatus(this.Annule);
        break;
      case 6: // Delivered (Livrée)
        this.loadOrdersByStatus(this.Livre);
        break;
      default:
        this.loadOrders();
        break;
    }
  }

  /**
   * Open Modal for editing/creating
  */
  openModal(content: any) {
    this.submitted = false;
    this.ordersForm.reset();
    this.modalService.open(content, { size: 'md', centered: true });
  }

  /**
   * Form validation
  */
  get form() {
    return this.ordersForm.controls;
  }

  /**
   * Save order (create/update)
  */
  saveUser() {
    if (this.ordersForm.valid) {
      if (this.ordersForm.get('orderId')?.value) {
        // Update existing order
        const updatedData = this.ordersForm.value;
        console.log('Update order:', updatedData);
        // TODO: Implement order update
        this.modalService.dismissAll();
      } else {
        // Create new order
        const newData = this.ordersForm.value;
        console.log('Create new order:', newData);
        // TODO: Implement manual order creation
        this.modalService.dismissAll();
      }
    }
    this.ordersForm.reset();
    this.submitted = true;
  }

  /**
   * Edit order
   */
  editUser(content: any, id: any) {
    this.submitted = false;
    this.modalService.open(content, { size: 'md', centered: true });
    
    var updateBtn = document.getElementById('addtoupdate-button') as HTMLAreaElement;
    updateBtn.innerHTML = "Update";
    
    const orderToEdit = this.allorderes[id];
    if (orderToEdit) {
      this.econtent = orderToEdit;
      // Map Supabase order fields to form
      this.ordersForm.controls['customer'].setValue(orderToEdit.client?.nom + ' ' + orderToEdit.client?.prenom || '');
      this.ordersForm.controls['orderDate'].setValue(orderToEdit.created_at);
      this.ordersForm.controls['amount'].setValue(orderToEdit.total);
      this.ordersForm.controls['status'].setValue(orderToEdit.statut);
      this.ordersForm.controls['orderId'].setValue(orderToEdit.id);
    }
  }

  /**
   * Validate order (change status to "En cours" and send email/PDF)
   */
  validateOrder(orderId: string): void {
    Swal.fire({
      title: 'Valider la commande',
      text: 'Voulez-vous valider cette commande ? Un email de confirmation sera envoyé au client avec la facture.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Oui, valider',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        this.performOrderValidation(orderId);
      }
    });
  }

  private performOrderValidation(orderId: string): void {
    // Show loading indicator
    Swal.fire({
      title: 'Validation en cours...',
      text: 'Génération de la facture et envoi de l\'email',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.commandeService.validateOrder(orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (success) => {
          if (success) {
            Swal.fire({
              title: 'Commande validée!',
              text: 'La commande a été mise à jour et l\'email de confirmation a été envoyé.',
              icon: 'success',
              confirmButtonText: 'OK'
            });
            
            // Reload orders to reflect status change
            this.loadOrders();
          }
        },
        error: (error) => {
          console.error('Order validation failed:', error);
          Swal.fire({
            title: 'Erreur',
            text: 'Impossible de valider la commande. Veuillez réessayer.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      });
  }

  /**
   * Delete order by Supabase ID
   */
  deleteData(orderId: string) {
    if (!orderId) return;

    Swal.fire({
      title: 'Êtes-vous sûr?',
      text: 'Cette action ne peut pas être annulée!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Oui, supprimer!',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({ title: 'Suppression...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        this.commandeService.deleteCommande(orderId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.allorderes = this.allorderes.filter(o => o.id !== orderId);
              this.orderes = this.service.changePage(this.allorderes);
              this.cdr.detectChanges();
              Swal.fire('Supprimé!', 'La commande a été supprimée.', 'success');
            },
            error: (err) => {
              console.error('Delete failed:', err);
              Swal.fire('Erreur', 'Impossible de supprimer la commande. Vérifiez vos permissions.', 'error');
            }
          });
      }
    });
  }

  /**
   * Search functionality
   */
  onSearchChange(): void {
    this.searchSubject.next(this.searchTerm);
  }

  performSearch(): void {
    this.onSearchChange();
  }

  private performSearchFilter(): void {
    let filteredOrders = [...this.allorderes];

    // Apply search filter
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase();
      filteredOrders = filteredOrders.filter(order => 
        order.id.toLowerCase().includes(searchLower) ||
        (order.client?.nom?.toLowerCase().includes(searchLower)) ||
        (order.client?.prenom?.toLowerCase().includes(searchLower)) ||
        (order.client?.email?.toLowerCase().includes(searchLower)) ||
        (order.statut?.toLowerCase().includes(searchLower))
      );
    }

    // Apply status filter
    if (this.status) {
      filteredOrders = filteredOrders.filter(order => order.statut === this.status);
    }

    // Apply payment filter
    if (this.payment) {
      filteredOrders = filteredOrders.filter(order => order.payment_reference?.includes(this.payment));
    }

    // Apply sorting
    if (this.sortField) {
      filteredOrders = this.applySorting(filteredOrders);
    }

    // Update pagination
    this.orderes = this.service.changePage(filteredOrders);
    this.cdr.detectChanges();
  }

  /**
   * Apply sorting to filtered orders
   */
  private applySorting(orders: Commande[]): Commande[] {
    return orders.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (this.sortField) {
        case 'orderId':
          valueA = a.id;
          valueB = b.id;
          break;
        case 'customer':
          valueA = a.client ? `${a.client.prenom} ${a.client.nom}` : '';
          valueB = b.client ? `${b.client.prenom} ${b.client.nom}` : '';
          break;
        case 'product':
          valueA = 'Commande'; // Since we don't have product names readily available
          valueB = 'Commande';
          break;
        case 'orderDate':
          valueA = new Date(a.created_at || 0);
          valueB = new Date(b.created_at || 0);
          break;
        case 'amount':
          valueA = a.total;
          valueB = b.total;
          break;
        case 'status':
          valueA = a.statut || '';
          valueB = b.statut || '';
          break;
        default:
          return 0;
      }

      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  /**
   * Filter by status
   */
  filterStatus(): void {
    this.performSearchFilter();
  }

  /**
   * Filter by payment method
   */
  PaymentFiletr(): void {
    this.performSearchFilter();
  }

  /**
   * Handle column sorting
   */
  onSort(field: string): void {
    if (this.sortField === field) {
      // Toggle direction if same field
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // New field, default to ascending
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.performSearchFilter();
  }

  /**
   * Checkbox functionality
   */
  onCheckboxChange(event: any): void {
    // Implementation for checkbox selection
  }

  checkUncheckAll(event: any): void {
    // Implementation for select all functionality
  }

  /**
   * Export orders to CSV
   */
  csvFileExport(): void {
    const csvData = this.allorderes.map(order => ({
      'ID': order.id,
      'Client': order.client ? `${order.client.prenom} ${order.client.nom}` : '',
      'Email': order.client?.email || '',
      'Country': order.country_code || '',
      'Currency': order.currency || '',
      'Total': order.total,
      'Status': order.statut,
      'Date': new DatePipe('en-US').transform(order.created_at, 'medium')
    }));

    new ngxCsv(csvData, 'orders', {
      fieldSeparator: ',',
      quoteStrings: '"',
      decimalseparator: '.',
      showLabels: true,
      showTitle: true,
      title: 'Orders Export',
      useBom: true,
      noDownload: false,
      headers: ['ID', 'Client', 'Email', 'Country', 'Currency', 'Total', 'Status', 'Date']
    });
  }

  /**
   * Delete all selected orders
   */
  deleteMultiple(deleteModel: any): void {
    const selected = this.allorderes.filter(o => o.state);
    if (selected.length === 0) return;

    Swal.fire({
      title: 'Êtes-vous sûr?',
      text: `Supprimer ${selected.length} commande(s) ? Cette action est irréversible.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Oui, tout supprimer!',
      cancelButtonText: 'Annuler'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({ title: 'Suppression...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const ids = selected.map(o => o.id);
        let completed = 0;
        let failed = 0;

        ids.forEach(id => {
          this.commandeService.deleteCommande(id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => { completed++; this.checkBatchDone(completed, failed, ids.length); },
              error: () => { failed++; this.checkBatchDone(completed, failed, ids.length); }
            });
        });
      }
    });
  }

  private checkBatchDone(completed: number, failed: number, total: number): void {
    if (completed + failed < total) return;
    this.loadOrders();
    if (failed === 0) {
      Swal.fire('Supprimé!', `${completed} commande(s) supprimée(s).`, 'success');
    } else {
      Swal.fire('Attention', `${completed} supprimée(s), ${failed} en erreur.`, 'warning');
    }
  }

  /**
   * Edit data get (legacy method for compatibility)
   */
  editDataGet(index: number, content: any): void {
    this.editUser(content, index);
  }

  /**
   * Confirm delete action — directly triggers deletion by Supabase ID
   */
  confirm(deleteModel: any, orderId: string): void {
    if (orderId) {
      this.deleteData(orderId);
    }
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: string): string {
    switch (status) {
      case this.Nouvelle:
        return 'bg-warning-subtle text-warning';
      case this.EnCours:
        return 'bg-primary-subtle text-primary';
      case this.Expedie:
        return 'bg-info-subtle text-info';
      case this.Livre:
        return 'bg-success-subtle text-success';
      case this.Annule:
        return 'bg-danger-subtle text-danger';
      default:
        return 'bg-secondary-subtle text-secondary';
    }
  }

  /**
   * Get status class for template compatibility (old status logic)
   */
  getStatusClassForTemplate(status: string): any {
    return {
      'bg-warning-subtle text-warning': status === this.Nouvelle,
      'bg-primary-subtle text-primary': status === this.EnCours,
      'bg-info-subtle text-info': status === this.Expedie,
      'bg-success-subtle text-success': status === this.Livre,
      'bg-danger-subtle text-danger': status === this.Annule,
      'bg-secondary-subtle text-secondary': ![this.Nouvelle, this.EnCours, this.Expedie, this.Livre, this.Annule].includes(status)
    };
  }

  /**
   * Format date
   */
  formatDate(date: any): string {
    return new DatePipe('en-US').transform(date, 'medium') || '';
  }

  /**
   * Format currency using the order's stored currency (not hardcoded EUR)
   */
  formatCurrency(amount: number, currency?: string): string {
    const cur = (currency || 'EUR').toUpperCase();
    if (cur === 'XOF') {
      return new Intl.NumberFormat('fr-FR', {
        style: 'decimal',
        maximumFractionDigits: 0
      }).format(Math.round(amount)) + ' FCFA';
    }
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: cur === 'USD' ? 'USD' : 'EUR'
    }).format(amount);
  }

  /**
   * Get new orders (status = 'Nouvelle')
   */
  getNewOrders(): any[] {
    return this.orderes.filter(order => order.status === this.Nouvelle);
  }

  /**
   * Get new orders count
   */
  getNewOrdersCount(): number {
    return this.allorderes.filter(order => order.status === this.Nouvelle).length;
  }

  /**
   * Get product summary for order
   */
  getProductSummary(order: any): string {
    if (order.items && order.items.length > 0) {
      const itemCount = order.items.length;
      const totalQuantity = order.items.reduce((sum: number, item: any) => sum + (item.quantite || 0), 0);
      
      if (itemCount === 1 && order.items[0].variant?.produit?.nom) {
        return `${order.items[0].variant.produit.nom} (x${order.items[0].quantite})`;
      } else {
        return `${itemCount} produit(s) (${totalQuantity} article(s))`;
      }
    }
    return 'Commande';
  }

  /**
   * Handle pagination change
   */
  changePage(): void {
    this.orderes = this.service.changePage(this.allorderes);
    this.cdr.detectChanges();
  }

  /**
   * Show the loading spinner
   */
  private showLoader(): void {
    document.getElementById('elmLoader')?.classList.remove('d-none');
  }

  /**
   * Hide the loading spinner
   */
  private hideLoader(): void {
    setTimeout(() => {
      document.getElementById('elmLoader')?.classList.add('d-none');
    }, 100);
  }
}