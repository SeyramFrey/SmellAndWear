import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { DeliveryPrice, DeliveryPriceRequest } from '../models/delivery-price.model';

@Injectable({
  providedIn: 'root'
})
export class DeliveryPricesService {
  private readonly TABLE_NAME = 'livraison_tarifs';
  
  // Cache for delivery prices by country
  private pricesCache = new Map<string, DeliveryPrice[]>();
  private cacheTimestamps = new Map<string, number>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(private supabase: SupabaseService) {}

  /**
   * Get all active delivery prices for a country
   */
  getDeliveryPricesByCountry(countryCode: string, forceRefresh: boolean = false): Observable<DeliveryPrice[]> {
    const cacheKey = `${countryCode}_all`;
    
    // Check cache validity
    if (!forceRefresh && this.isCacheValid(cacheKey)) {
      const cachedData = this.pricesCache.get(cacheKey);
      if (cachedData) {
        return of(cachedData);
      }
    }

    return from(
      this.supabase.getClient()
        .from(this.TABLE_NAME)
        .select('*')
        .eq('country_code', countryCode)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching delivery prices:', error);
          throw error;
        }
        const prices = (data || []) as DeliveryPrice[];
        
        // Update cache
        this.pricesCache.set(cacheKey, prices);
        this.cacheTimestamps.set(cacheKey, Date.now());
        
        return prices;
      }),
      catchError((error: any) => {
        console.error('Error in getDeliveryPricesByCountry:', error);
        return of([]);
      })
    );
  }

  /**
   * Get standard (non-express) delivery prices for a country
   */
  getStandardDeliveryPrices(countryCode: string): Observable<DeliveryPrice[]> {
    return this.getDeliveryPricesByCountry(countryCode).pipe(
      map(prices => prices.filter(p => !p.is_express))
    );
  }

  /**
   * Get express delivery prices for a country
   */
  getExpressDeliveryPrices(countryCode: string): Observable<DeliveryPrice[]> {
    return this.getDeliveryPricesByCountry(countryCode).pipe(
      map(prices => prices.filter(p => p.is_express))
    );
  }

  /**
   * Get a specific delivery price by zone and type
   */
  getDeliveryPrice(countryCode: string, zoneCode: string, isExpress: boolean = false): Observable<DeliveryPrice | null> {
    return this.getDeliveryPricesByCountry(countryCode).pipe(
      map(prices => {
        const match = prices.find(p => 
          p.zone_code === zoneCode && p.is_express === isExpress
        );
        return match || null;
      })
    );
  }

  /**
   * Get all delivery prices (admin only)
   */
  getAllDeliveryPrices(): Observable<DeliveryPrice[]> {
    return from(
      this.supabase.getClient()
        .from(this.TABLE_NAME)
        .select('*')
        .order('country_code', { ascending: true })
        .order('display_order', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching all delivery prices:', error);
          throw error;
        }
        return (data || []) as DeliveryPrice[];
      }),
      catchError((error: any) => {
        console.error('Error in getAllDeliveryPrices:', error);
        return of([]);
      })
    );
  }

  /**
   * Create a new delivery price (admin only)
   */
  createDeliveryPrice(request: DeliveryPriceRequest): Observable<DeliveryPrice | null> {
    return from(
      this.supabase.getClient()
        .from(this.TABLE_NAME)
        .insert([request])
        .select()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error creating delivery price:', error);
          throw error;
        }
        
        // Check if the insert was successful (RLS may block it)
        if (!data || data.length === 0) {
          throw new Error('Insert failed - you may not have admin permissions');
        }
        
        // Invalidate cache
        this.invalidateCache(request.country_code);
        
        return data[0] as DeliveryPrice;
      }),
      catchError((error: any) => {
        console.error('Error in createDeliveryPrice:', error);
        throw error;
      })
    );
  }

  /**
   * Update an existing delivery price (admin only)
   */
  updateDeliveryPrice(id: string, updates: Partial<DeliveryPriceRequest>): Observable<DeliveryPrice | null> {
    // Add updated_at timestamp
    const updatesWithTimestamp = {
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    return from(
      this.supabase.getClient()
        .from(this.TABLE_NAME)
        .update(updatesWithTimestamp)
        .eq('id', id)
        .select()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error updating delivery price:', error);
          throw error;
        }
        
        // Check if the update was successful (RLS may block it)
        if (!data || data.length === 0) {
          throw new Error('Update failed - you may not have admin permissions');
        }
        
        // Invalidate cache for all countries (we don't know which one was updated)
        this.pricesCache.clear();
        this.cacheTimestamps.clear();
        
        return data[0] as DeliveryPrice;
      }),
      catchError((error: any) => {
        console.error('Error in updateDeliveryPrice:', error);
        throw error;
      })
    );
  }

  /**
   * Toggle active status of a delivery price (soft delete)
   */
  toggleDeliveryPriceStatus(id: string, isActive: boolean): Observable<boolean> {
    return from(
      this.supabase.getClient()
        .from(this.TABLE_NAME)
        .update({ is_active: isActive })
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) {
          console.error('Error toggling delivery price status:', error);
          throw error;
        }
        
        // Invalidate cache
        this.pricesCache.clear();
        this.cacheTimestamps.clear();
        
        return true;
      }),
      catchError((error: any) => {
        console.error('Error in toggleDeliveryPriceStatus:', error);
        return of(false);
      })
    );
  }

  /**
   * Delete a delivery price (hard delete - admin only, use with caution)
   */
  deleteDeliveryPrice(id: string): Observable<boolean> {
    return from(
      this.supabase.getClient()
        .from(this.TABLE_NAME)
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) {
          console.error('Error deleting delivery price:', error);
          throw error;
        }
        
        // Invalidate cache
        this.pricesCache.clear();
        this.cacheTimestamps.clear();
        
        return true;
      }),
      catchError((error: any) => {
        console.error('Error in deleteDeliveryPrice:', error);
        return of(false);
      })
    );
  }

  /**
   * Clear cache for a specific country
   */
  private invalidateCache(countryCode: string): void {
    const cacheKey = `${countryCode}_all`;
    this.pricesCache.delete(cacheKey);
    this.cacheTimestamps.delete(cacheKey);
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(cacheKey: string): boolean {
    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (!timestamp) {
      return false;
    }
    return (Date.now() - timestamp) < this.CACHE_DURATION;
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.pricesCache.clear();
    this.cacheTimestamps.clear();
  }
}

