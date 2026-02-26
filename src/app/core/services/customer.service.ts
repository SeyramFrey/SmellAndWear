import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, from, of, Subject } from 'rxjs';
import { map, catchError, switchMap, takeUntil, filter, take, tap } from 'rxjs/operators';
import { SupabaseAuthService } from './supabase-auth.service';
import { Client, Adresse, Commande } from '../models/models';

/**
 * Customer account data including related entities
 */
export interface CustomerAccount {
  client: Client;
  addresses: Adresse[];
  defaultAddress?: Adresse;
}

/**
 * Customer creation request
 */
export interface CreateCustomerRequest {
  email: string;
  nom: string;
  prenom: string;
  telephone?: string;
}

/**
 * Customer update request
 */
export interface UpdateCustomerRequest {
  nom?: string;
  prenom?: string;
  telephone?: string;
}

/**
 * CustomerService - Bridges Supabase Auth with the client table
 * 
 * Linking Strategy:
 * 1. When a user signs up through Supabase Auth:
 *    - Check if a client record exists with matching email (guest order)
 *    - If exists: link existing client to auth user
 *    - If not: create new client record
 * 
 * 2. When a guest places an order:
 *    - Create client record with email (no auth link yet)
 *    - If they later sign up with same email, records are linked
 * 
 * 3. Client record is linked to auth.users via email matching
 *    (the client table stores email which matches auth.users.email)
 * 
 * RLS Policy Alignment:
 * =====================
 * The `client` table has the following RLS policies:
 * 
 * SELECT:
 * - Customers can view their own client record (matched by JWT email)
 * - Admins can view all clients
 * 
 * INSERT:
 * - Customers can create their own client record (email must match JWT)
 * - Anonymous users can create records (guest checkout)
 * - Admins can create any client
 * 
 * UPDATE:
 * - Customers can update their own client record
 * - Admins can update any client
 * 
 * DELETE:
 * - Only admins can delete client records
 * 
 * The `adresse` table follows similar rules based on client_id ownership.
 */
@Injectable({
  providedIn: 'root'
})
export class CustomerService implements OnDestroy {
  private tableName = 'client';
  
  // Current customer state
  private clientSubject = new BehaviorSubject<Client | null>(null);
  private addressesSubject = new BehaviorSubject<Adresse[]>([]);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private initializedSubject = new BehaviorSubject<boolean>(false);
  
  private destroy$ = new Subject<void>();

  /**
   * Observable of the current customer (client record)
   */
  public readonly client$: Observable<Client | null> = this.clientSubject.asObservable();
  
  /**
   * Observable of the customer's addresses
   */
  public readonly addresses$: Observable<Adresse[]> = this.addressesSubject.asObservable();
  
  /**
   * Observable indicating loading state
   */
  public readonly loading$: Observable<boolean> = this.loadingSubject.asObservable();
  
  /**
   * Observable indicating if the service has been initialized
   */
  public readonly initialized$: Observable<boolean> = this.initializedSubject.asObservable();

  constructor(private authService: SupabaseAuthService) {
    this.initializeCustomerState();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize customer state based on auth state changes
   * 
   * IMPORTANT: Admin users should NOT have client records loaded/created.
   * Admins and clients are separate roles - admins should appear as guests
   * on the landing/storefront pages.
   */
  private initializeCustomerState(): void {
    // Wait for auth to initialize, then listen to user changes
    this.authService.waitForInit().pipe(
      switchMap(() => this.authService.user$),
      takeUntil(this.destroy$)
    ).subscribe(user => {
      if (user) {
        // Check if user is admin - admins should NOT be treated as clients
        const role = this.authService.getCurrentRole();
        if (role === 'admin') {
          console.log('[CustomerService] Admin user detected - skipping client loading');
          this.clearClientState();
          this.initializedSubject.next(true);
          return;
        }
        
        // User is logged in as client - load or create their client record
        this.loadOrCreateClient(user.email || '').then(() => {
          this.initializedSubject.next(true);
        });
      } else {
        // User logged out - clear client state
        this.clearClientState();
        this.initializedSubject.next(true);
      }
    });
  }

  /**
   * Load existing client or create one for the authenticated user
   */
  private async loadOrCreateClient(email: string): Promise<void> {
    if (!email) {
      console.warn('[CustomerService] No email provided for client lookup');
      return;
    }

    this.loadingSubject.next(true);

    try {
      // Try to find existing client by email
      const existingClient = await this.getClientByEmail(email);
      
      if (existingClient) {
        console.log('[CustomerService] Found existing client:', existingClient.id);
        this.clientSubject.next(existingClient);
        
        // Load addresses for this client
        await this.loadAddresses(existingClient.id);
      } else {
        // Client doesn't exist - they may need to complete signup or place first order
        console.log('[CustomerService] No client found for email:', email);
        this.clientSubject.next(null);
      }
    } catch (error) {
      console.error('[CustomerService] Error loading client:', error);
      this.clientSubject.next(null);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Clear client state on logout
   */
  private clearClientState(): void {
    this.clientSubject.next(null);
    this.addressesSubject.next([]);
  }

  /**
   * Get client by email
   */
  private async getClientByEmail(email: string): Promise<Client | null> {
    const { data, error } = await this.authService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      console.error('[CustomerService] Error fetching client by email:', error);
      return null;
    }

    return data as Client | null;
  }

  /**
   * Get client by ID
   */
  async getClientById(id: string): Promise<Client | null> {
    const { data, error } = await this.authService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[CustomerService] Error fetching client by ID:', error);
      return null;
    }

    return data as Client | null;
  }

  /**
   * Create a new client record
   * Called during:
   * 1. User signup (if they provide profile info)
   * 2. Guest checkout (to associate orders)
   */
  async createClient(data: CreateCustomerRequest): Promise<Client | null> {
    this.loadingSubject.next(true);

    try {
      // Check if client already exists
      const existing = await this.getClientByEmail(data.email);
      if (existing) {
        console.log('[CustomerService] Client already exists for email:', data.email);
        this.clientSubject.next(existing);
        return existing;
      }

      // Create new client
      const { data: newClient, error } = await this.authService.getClient()
        .from(this.tableName)
        .insert([{
          email: data.email,
          nom: data.nom,
          prenom: data.prenom,
          telephone: data.telephone || null
        }])
        .select()
        .single();

      if (error) {
        console.error('[CustomerService] Error creating client:', error);
        return null;
      }

      const client = newClient as Client;
      this.clientSubject.next(client);
      
      console.log('[CustomerService] Created new client:', client.id);
      return client;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Create client during guest checkout
   * This creates a client record that can later be linked to an auth user
   */
  async createGuestClient(email: string, nom: string, prenom: string, telephone?: string): Promise<Client | null> {
    // Check if client already exists
    const existing = await this.getClientByEmail(email);
    if (existing) {
      console.log('[CustomerService] Guest client already exists for email:', email);
      // Store marker in localStorage for later signup flow
      localStorage.setItem('guestOrderEmail', email);
      return existing;
    }

    const client = await this.createClient({ email, nom, prenom, telephone });
    
    if (client) {
      // Store marker in localStorage for later signup flow
      localStorage.setItem('guestOrderEmail', email);
    }

    return client;
  }

  /**
   * Update current client's profile
   */
  async updateProfile(updates: UpdateCustomerRequest): Promise<Client | null> {
    const currentClient = this.clientSubject.value;
    if (!currentClient) {
      console.error('[CustomerService] No client logged in');
      return null;
    }

    this.loadingSubject.next(true);

    try {
      const { data, error } = await this.authService.getClient()
        .from(this.tableName)
        .update(updates)
        .eq('id', currentClient.id)
        .select()
        .single();

      if (error) {
        console.error('[CustomerService] Error updating client:', error);
        return null;
      }

      const updatedClient = data as Client;
      this.clientSubject.next(updatedClient);
      
      console.log('[CustomerService] Updated client profile');
      return updatedClient;
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Load addresses for client
   */
  private async loadAddresses(clientId: string): Promise<void> {
    const { data, error } = await this.authService.getClient()
      .from('adresse')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CustomerService] Error loading addresses:', error);
      return;
    }

    this.addressesSubject.next(data as Adresse[]);
  }

  /**
   * Add a new address for the current client
   */
  async addAddress(address: Omit<Adresse, 'id' | 'client_id' | 'created_at'>): Promise<Adresse | null> {
    const currentClient = this.clientSubject.value;
    if (!currentClient) {
      console.error('[CustomerService] No client logged in');
      return null;
    }

    const { data, error } = await this.authService.getClient()
      .from('adresse')
      .insert([{
        ...address,
        client_id: currentClient.id
      }])
      .select()
      .single();

    if (error) {
      console.error('[CustomerService] Error adding address:', error);
      return null;
    }

    const newAddress = data as Adresse;
    const currentAddresses = this.addressesSubject.value;
    this.addressesSubject.next([newAddress, ...currentAddresses]);

    return newAddress;
  }

  /**
   * Update an address
   */
  async updateAddress(addressId: string, updates: Partial<Adresse>): Promise<Adresse | null> {
    const { data, error } = await this.authService.getClient()
      .from('adresse')
      .update(updates)
      .eq('id', addressId)
      .select()
      .single();

    if (error) {
      console.error('[CustomerService] Error updating address:', error);
      return null;
    }

    const updatedAddress = data as Adresse;
    const currentAddresses = this.addressesSubject.value;
    this.addressesSubject.next(
      currentAddresses.map(a => a.id === addressId ? updatedAddress : a)
    );

    return updatedAddress;
  }

  /**
   * Delete an address
   */
  async deleteAddress(addressId: string): Promise<boolean> {
    const { error } = await this.authService.getClient()
      .from('adresse')
      .delete()
      .eq('id', addressId);

    if (error) {
      console.error('[CustomerService] Error deleting address:', error);
      return false;
    }

    const currentAddresses = this.addressesSubject.value;
    this.addressesSubject.next(currentAddresses.filter(a => a.id !== addressId));

    return true;
  }

  /**
   * Set default address for client
   */
  async setDefaultAddress(addressId: string): Promise<boolean> {
    const currentClient = this.clientSubject.value;
    if (!currentClient) {
      return false;
    }

    const { error } = await this.authService.getClient()
      .from(this.tableName)
      .update({ adresse_id: addressId })
      .eq('id', currentClient.id);

    if (error) {
      console.error('[CustomerService] Error setting default address:', error);
      return false;
    }

    // Update local state
    this.clientSubject.next({ ...currentClient, adresse_id: addressId });
    return true;
  }

  /**
   * Get customer orders
   */
  getOrders(): Observable<Commande[]> {
    return this.client$.pipe(
      filter(client => client !== null),
      take(1),
      switchMap(client => {
        return from(
          this.authService.getClient()
            .from('commande')
            .select(`
              *,
              adresse_livraison:adresse_livraison_id (*),
              adresse_facturation:adresse_facturation_id (*),
              items:commande_item (
                *,
                variant:produit_variation_id (
                  *,
                  produit:produit_id (*),
                  taille:taille_id (*),
                  couleur:couleur_id (*)
                )
              )
            `)
            .eq('client_id', client!.id)
            .order('created_at', { ascending: false })
        ).pipe(
          map(({ data, error }) => {
            if (error) {
              console.error('[CustomerService] Error fetching orders:', error);
              return [];
            }
            return data as Commande[];
          }),
          catchError(error => {
            console.error('[CustomerService] Error fetching orders:', error);
            return of([]);
          })
        );
      })
    );
  }

  /**
   * Get single order by ID
   */
  async getOrderById(orderId: string): Promise<Commande | null> {
    const currentClient = this.clientSubject.value;
    if (!currentClient) {
      return null;
    }

    const { data, error } = await this.authService.getClient()
      .from('commande')
      .select(`
        *,
        adresse_livraison:adresse_livraison_id (*),
        adresse_facturation:adresse_facturation_id (*),
        items:commande_item (
          *,
          variant:produit_variation_id (
            *,
            produit:produit_id (*),
            taille:taille_id (*),
            couleur:couleur_id (*)
          )
        )
      `)
      .eq('id', orderId)
      .eq('client_id', currentClient.id)
      .maybeSingle();

    if (error) {
      console.error('[CustomerService] Error fetching order:', error);
      return null;
    }

    return data as Commande | null;
  }

  /**
   * Get current client synchronously
   */
  getCurrentClient(): Client | null {
    return this.clientSubject.value;
  }

  /**
   * Check if user has a client record
   */
  hasClientRecord(): boolean {
    return this.clientSubject.value !== null;
  }

  /**
   * Wait for service initialization
   */
  waitForInit(): Observable<boolean> {
    return this.initialized$.pipe(
      filter(initialized => initialized),
      take(1)
    );
  }

  /**
   * Check if there's a pending guest order email
   * Used during signup to suggest linking accounts
   */
  getPendingGuestEmail(): string | null {
    return localStorage.getItem('guestOrderEmail');
  }

  /**
   * Clear pending guest email after successful account link
   */
  clearPendingGuestEmail(): void {
    localStorage.removeItem('guestOrderEmail');
  }

  /**
   * Refresh client data from database
   */
  async refreshClient(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (user?.email) {
      await this.loadOrCreateClient(user.email);
    }
  }
}

