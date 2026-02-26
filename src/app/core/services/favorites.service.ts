import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, from, of, Subject } from 'rxjs';
import { map, catchError, switchMap, takeUntil, filter, take, tap } from 'rxjs/operators';
import { SupabaseAuthService } from './supabase-auth.service';
import { CustomerService } from './customer.service';
import { ToastService } from './toast.service';
import { ListeFavoris, Produit } from '../models/models';

/**
 * Favorite item with product details
 */
export interface FavoriteItem {
  id: string;
  produit_id: string;
  created_at?: Date;
  product?: Produit;
}

const LOCAL_STORAGE_KEY = 'sw_favorites';

/**
 * FavoritesService - Manages user favorites/wishlist
 * 
 * Behavior:
 * - For authenticated users: Stores in Supabase `liste_favoris` table
 * - For guests: Stores in localStorage
 * - On login: Syncs localStorage favorites to database
 * 
 * The service provides reactive observables for real-time UI updates
 * 
 * RLS Policy Alignment:
 * =====================
 * The `liste_favoris` table has the following RLS policies:
 * 
 * SELECT:
 * - Customers can view their own favorites (via client_id linked to JWT email)
 * - Admins can view all favorites
 * 
 * INSERT:
 * - Customers can add to their own favorites (client_id must match their record)
 * - Admins can add favorites for any client
 * 
 * DELETE:
 * - Customers can remove their own favorites
 * - Admins can delete any favorites
 * 
 * Note: Anonymous users CANNOT access the database favorites table.
 * Guest favorites are stored in localStorage and synced to DB upon login.
 */
@Injectable({
  providedIn: 'root'
})
export class FavoritesService implements OnDestroy {
  private tableName = 'liste_favoris';
  
  // State
  private favoritesSubject = new BehaviorSubject<FavoriteItem[]>([]);
  private favoriteIdsSubject = new BehaviorSubject<Set<string>>(new Set());
  private loadingSubject = new BehaviorSubject<boolean>(false);
  
  private destroy$ = new Subject<void>();
  private isAuthenticated = false;
  private clientId: string | null = null;

  /**
   * Observable of favorite items with product details
   */
  public readonly favorites$: Observable<FavoriteItem[]> = this.favoritesSubject.asObservable();
  
  /**
   * Observable of favorite product IDs (for quick lookup)
   */
  public readonly favoriteIds$: Observable<Set<string>> = this.favoriteIdsSubject.asObservable();
  
  /**
   * Observable of favorites count
   */
  public readonly favoritesCount$: Observable<number> = this.favoritesSubject.pipe(
    map(favorites => favorites.length)
  );
  
  /**
   * Observable indicating loading state
   */
  public readonly loading$: Observable<boolean> = this.loadingSubject.asObservable();

  constructor(
    private authService: SupabaseAuthService,
    private customerService: CustomerService,
    private toastService: ToastService
  ) {
    this.initializeFavorites();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize favorites based on auth state
   */
  private initializeFavorites(): void {
    // First load local favorites
    this.loadLocalFavorites();

    // Listen to customer changes
    this.customerService.client$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(client => {
      if (client) {
        this.isAuthenticated = true;
        this.clientId = client.id;
        // User logged in - sync and load from database
        this.syncAndLoadFavorites(client.id);
      } else {
        this.isAuthenticated = false;
        this.clientId = null;
        // User logged out - load from localStorage
        this.loadLocalFavorites();
      }
    });
  }

  /**
   * Load favorites from localStorage (for guests)
   */
  private loadLocalFavorites(): void {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const productIds: string[] = JSON.parse(stored);
        const favorites: FavoriteItem[] = productIds.map(id => ({
          id: `local_${id}`,
          produit_id: id
        }));
        this.favoritesSubject.next(favorites);
        this.favoriteIdsSubject.next(new Set(productIds));
      } else {
        this.favoritesSubject.next([]);
        this.favoriteIdsSubject.next(new Set());
      }
    } catch (error) {
      console.error('[FavoritesService] Error loading local favorites:', error);
      this.favoritesSubject.next([]);
      this.favoriteIdsSubject.next(new Set());
    }
  }

  /**
   * Save favorites to localStorage
   */
  private saveLocalFavorites(productIds: string[]): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(productIds));
    } catch (error) {
      console.error('[FavoritesService] Error saving local favorites:', error);
    }
  }

  /**
   * Sync local favorites to database and load all favorites
   */
  private async syncAndLoadFavorites(clientId: string): Promise<void> {
    this.loadingSubject.next(true);

    try {
      // Get local favorites to sync
      const localFavorites = this.getLocalFavoriteIds();
      
      if (localFavorites.length > 0) {
        console.log('[FavoritesService] Syncing local favorites to database:', localFavorites.length);
        
        // Add each local favorite to database (if not already exists)
        for (const productId of localFavorites) {
          await this.addToDatabase(clientId, productId);
        }
        
        // Clear local storage after successful sync
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }

      // Load all favorites from database
      await this.loadFromDatabase(clientId);
    } catch (error) {
      console.error('[FavoritesService] Error syncing favorites:', error);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  /**
   * Get local favorite product IDs
   */
  private getLocalFavoriteIds(): string[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Load favorites from database
   */
  private async loadFromDatabase(clientId: string): Promise<void> {
    const { data, error } = await this.authService.getClient()
      .from(this.tableName)
      .select(`
        id,
        produit_id,
        created_at,
        produit:produit_id (*)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[FavoritesService] Error loading favorites from database:', error);
      return;
    }

    const favorites: FavoriteItem[] = (data || []).map((item: any) => ({
      id: item.id,
      produit_id: item.produit_id,
      created_at: item.created_at,
      product: item.produit
    }));

    this.favoritesSubject.next(favorites);
    this.favoriteIdsSubject.next(new Set(favorites.map(f => f.produit_id)));
    
    console.log('[FavoritesService] Loaded favorites from database:', favorites.length);
  }

  /**
   * Add favorite to database
   */
  private async addToDatabase(clientId: string, productId: string): Promise<boolean> {
    // Check if already exists
    const { data: existing } = await this.authService.getClient()
      .from(this.tableName)
      .select('id')
      .eq('client_id', clientId)
      .eq('produit_id', productId)
      .maybeSingle();

    if (existing) {
      // Already in favorites
      return true;
    }

    const { error } = await this.authService.getClient()
      .from(this.tableName)
      .insert([{
        client_id: clientId,
        produit_id: productId
      }]);

    if (error) {
      console.error('[FavoritesService] Error adding to database:', error);
      return false;
    }

    return true;
  }

  /**
   * Remove favorite from database
   */
  private async removeFromDatabase(clientId: string, productId: string): Promise<boolean> {
    const { error } = await this.authService.getClient()
      .from(this.tableName)
      .delete()
      .eq('client_id', clientId)
      .eq('produit_id', productId);

    if (error) {
      console.error('[FavoritesService] Error removing from database:', error);
      return false;
    }

    return true;
  }

  // ==================== Public API ====================

  /**
   * Add product to favorites
   */
  async addToFavorites(productId: string, productName?: string): Promise<boolean> {
    if (this.isAuthenticated && this.clientId) {
      // Add to database
      const success = await this.addToDatabase(this.clientId, productId);
      if (success) {
        // Reload from database to get complete data
        await this.loadFromDatabase(this.clientId);
        // Show toast notification
        this.toastService.favoriteAdded(productName);
      }
      return success;
    } else {
      // Add to localStorage
      const currentIds = this.getLocalFavoriteIds();
      if (!currentIds.includes(productId)) {
        currentIds.push(productId);
        this.saveLocalFavorites(currentIds);
        
        // Update state
        const newFavorite: FavoriteItem = {
          id: `local_${productId}`,
          produit_id: productId
        };
        this.favoritesSubject.next([...this.favoritesSubject.value, newFavorite]);
        this.favoriteIdsSubject.next(new Set([...this.favoriteIdsSubject.value, productId]));
        
        // Show toast notification
        this.toastService.favoriteAdded(productName);
      }
      return true;
    }
  }

  /**
   * Remove product from favorites
   */
  async removeFromFavorites(productId: string, productName?: string, showToast: boolean = true): Promise<boolean> {
    if (this.isAuthenticated && this.clientId) {
      // Remove from database
      const success = await this.removeFromDatabase(this.clientId, productId);
      if (success) {
        // Update local state
        const currentFavorites = this.favoritesSubject.value;
        this.favoritesSubject.next(currentFavorites.filter(f => f.produit_id !== productId));
        
        const currentIds = this.favoriteIdsSubject.value;
        currentIds.delete(productId);
        this.favoriteIdsSubject.next(new Set(currentIds));
        
        // Show toast notification (optional)
        if (showToast) {
          this.toastService.favoriteRemoved(productName);
        }
      }
      return success;
    } else {
      // Remove from localStorage
      const currentIds = this.getLocalFavoriteIds();
      const newIds = currentIds.filter(id => id !== productId);
      this.saveLocalFavorites(newIds);
      
      // Update state
      const currentFavorites = this.favoritesSubject.value;
      this.favoritesSubject.next(currentFavorites.filter(f => f.produit_id !== productId));
      this.favoriteIdsSubject.next(new Set(newIds));
      
      // Show toast notification (optional)
      if (showToast) {
        this.toastService.favoriteRemoved(productName);
      }
      
      return true;
    }
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(productId: string, productName?: string): Promise<boolean> {
    const isCurrentlyFavorite = this.isFavorite(productId);
    
    if (isCurrentlyFavorite) {
      return this.removeFromFavorites(productId, productName);
    } else {
      return this.addToFavorites(productId, productName);
    }
  }

  /**
   * Check if product is in favorites (synchronous)
   */
  isFavorite(productId: string): boolean {
    return this.favoriteIdsSubject.value.has(productId);
  }

  /**
   * Check if product is in favorites (observable)
   */
  isFavorite$(productId: string): Observable<boolean> {
    return this.favoriteIds$.pipe(
      map(ids => ids.has(productId))
    );
  }

  /**
   * Get favorites count (synchronous)
   */
  getFavoritesCount(): number {
    return this.favoritesSubject.value.length;
  }

  /**
   * Get all favorites (synchronous)
   */
  getFavorites(): FavoriteItem[] {
    return this.favoritesSubject.value;
  }

  /**
   * Get favorites with full product details
   * Loads product data for local favorites
   */
  getFavoritesWithProducts(): Observable<FavoriteItem[]> {
    return this.favorites$.pipe(
      switchMap(favorites => {
        // If we already have products, return as is
        const needsProductData = favorites.some(f => !f.product);
        
        if (!needsProductData || favorites.length === 0) {
          return of(favorites);
        }

        // Load product data for items that don't have it
        const productIds = favorites
          .filter(f => !f.product)
          .map(f => f.produit_id);

        if (productIds.length === 0) {
          return of(favorites);
        }

        return from(
          this.authService.getClient()
            .from('produit')
            .select('*')
            .in('id', productIds)
        ).pipe(
          map(({ data, error }) => {
            if (error || !data) {
              return favorites;
            }

            const productMap = new Map(data.map((p: Produit) => [p.id, p]));
            
            return favorites.map(f => ({
              ...f,
              product: f.product || productMap.get(f.produit_id)
            }));
          }),
          catchError(() => of(favorites))
        );
      })
    );
  }

  /**
   * Clear all favorites
   */
  async clearFavorites(): Promise<void> {
    if (this.isAuthenticated && this.clientId) {
      await this.authService.getClient()
        .from(this.tableName)
        .delete()
        .eq('client_id', this.clientId);
    }
    
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    this.favoritesSubject.next([]);
    this.favoriteIdsSubject.next(new Set());
  }

  /**
   * Refresh favorites from storage
   */
  async refresh(): Promise<void> {
    if (this.isAuthenticated && this.clientId) {
      await this.loadFromDatabase(this.clientId);
    } else {
      this.loadLocalFavorites();
    }
  }
}

