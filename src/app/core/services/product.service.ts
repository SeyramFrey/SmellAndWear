import { Injectable } from '@angular/core';
import { Produit } from '../models/models';
import { SupabaseService } from './supabase.service';
import { from, Observable, throwError } from "rxjs";
import { catchError, map } from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private tableName = 'produit';
  private publicTableName = 'products_public';

  constructor(private supabaseService: SupabaseService) {}

  /** Public: visible products only (uses products_public view) */
  getProduitsPublic(): Observable<Produit[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.publicTableName)
        .select('*')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit[];
      }),
      catchError(error => throwError(() => error))
    );
  }

  /** Public: get product by id (returns null if hidden/scheduled/unpublished) */
  getProduitByIdPublic(id: string): Observable<Produit | null> {
    return from(
      this.supabaseService.getClient()
        .from(this.publicTableName)
        .select('*')
        .eq('id', id)
        .maybeSingle()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit | null;
      }),
      catchError(error => throwError(() => error))
    );
  }

  /** Public: products by category */
  getProduitsByCategoriePublic(sousCategorieId: string): Observable<Produit[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.publicTableName)
        .select('*')
        .eq('sous_categorie_id', sousCategorieId)
        .order('nom')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit[];
      }),
      catchError(error => throwError(() => error))
    );
  }

  /** Public: search products */
  searchProduitsPublic(searchTerm: string): Observable<Produit[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.publicTableName)
        .select('*')
        .ilike('nom', `%${searchTerm}%`)
        .order('nom')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit[];
      }),
      catchError(error => throwError(() => error))
    );
  }

  /** Public: advanced search */
  advancedSearchPublic(term: string, searchBy: 'name' | 'description' | 'price' | 'all'): Observable<Produit[]> {
    let query = this.supabaseService.getClient().from(this.publicTableName).select('*');
    if (searchBy === 'name') {
      query = query.ilike('nom', `%${term}%`);
    } else if (searchBy === 'description') {
      query = query.ilike('description', `%${term}%`);
    } else if (searchBy === 'price') {
      const priceNum = parseFloat(term);
      if (!isNaN(priceNum)) {
        query = query.gte('prix', priceNum - 10).lte('prix', priceNum + 10);
      }
    } else {
      query = query.or(`nom.ilike.%${term}%,description.ilike.%${term}%`);
    }
    return from(query.order('nom')).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit[];
      }),
      catchError(error => throwError(() => error))
    );
  }

  /** Public: new products */
  getNewProductsPublic(): Observable<Produit[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return from(
      this.supabaseService.getClient()
        .from(this.publicTableName)
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.shuffleArray(data as Produit[]);
      }),
      catchError(error => throwError(() => error))
    );
  }

  /** Public: bestsellers */
  getBestsellersPublic(): Observable<Produit[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.publicTableName)
        .select('*')
        .eq('is_best_seller', true)
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.shuffleArray(data as Produit[]);
      }),
      catchError(error => throwError(() => error))
    );
  }

  /** Public: all products shuffled */
  getAllProductsShuffledPublic(): Observable<Produit[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.publicTableName)
        .select('*')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.shuffleArray(data as Produit[]);
      }),
      catchError(error => throwError(() => error))
    );
  }

  /** Public: check if product IDs are still visible (for cart validation) */
  getVisibleProductIds(ids: string[]): Observable<Set<string>> {
    if (ids.length === 0) {
      return from([new Set<string>()]);
    }
    return from(
      this.supabaseService.getClient()
        .from(this.publicTableName)
        .select('id')
        .in('id', ids)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return new Set((data || []).map((r: { id: string }) => r.id));
      }),
      catchError(() => from([new Set<string>()]))
    );
  }

  /** Admin: all products (including hidden/scheduled) */
  getProduits(): Observable<Produit[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit[];
      }),
      catchError(error => throwError(() => error))
    );
  }

  getProduitById(id: string): Observable<Produit> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit;
      }),
      catchError(error => throwError(() => error))
    );
  }

  getProduitsByCategorie(sousCategotieId: string): Observable<Produit[]> {
      console.log("Cette fonction est appelée")
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
        .eq('sous_categorie_id', sousCategotieId)
        .order('nom')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        console.log(data);
        return data as Produit[];

      }),
      catchError(error => throwError(() => error))
    );
  }

  getProduitsByMarque(marqueId: string): Observable<Produit[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
        .eq('marque_id', marqueId)
        .order('nom')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit[];
      }),
      catchError(error => throwError(() => error))
    );
  }

  createProduit(produit: Omit<Produit, 'id'>): Observable<Produit> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .insert([produit])
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit;
      }),
      catchError(error => throwError(() => error))
    );
  }

  updateProduit(id: string, produit: Partial<Produit>): Observable<Produit> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .update(produit)
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit;
      }),
      catchError(error => throwError(() => error))
    );
  }

  deleteProduit(id: string): Observable<void> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError(error => throwError(() => error))
    );
  }

  updateStock(id: string, newStock: number): Observable<Produit> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .update({ stock: newStock })
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit;
      }),
      catchError(error => throwError(() => error))
    );
  }

  updatePrix(id: string, newPrix: number): Observable<Produit> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .update({ prix: newPrix })
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit;
      }),
      catchError(error => throwError(() => error))
    );
  }

  searchProduits(searchTerm: string): Observable<Produit[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
        .ilike('nom', `%${searchTerm}%`)
        .order('nom')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit[];
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Delete a product by ID
   */
  deleteProduct(id: string): Observable<void> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Get new products (products created in last 7 days)
   */
  getNewProducts(): Observable<Produit[]> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.shuffleArray(data as Produit[]);
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Get bestseller products
   */
  getBestsellers(): Observable<Produit[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
        .eq('is_best_seller', true)
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.shuffleArray(data as Produit[]);
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Get all products shuffled
   */
  getAllProductsShuffled(): Observable<Produit[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return this.shuffleArray(data as Produit[]);
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Advanced search by name, description, or price
   */
  advancedSearch(term: string, searchBy: 'name' | 'description' | 'price' | 'all'): Observable<Produit[]> {
    let query = this.supabaseService.getClient().from(this.tableName).select('*');

    if (searchBy === 'name') {
      query = query.ilike('nom', `%${term}%`);
    } else if (searchBy === 'description') {
      query = query.ilike('description', `%${term}%`);
    } else if (searchBy === 'price') {
      const priceNum = parseFloat(term);
      if (!isNaN(priceNum)) {
        query = query.gte('prix', priceNum - 10).lte('prix', priceNum + 10);
      }
    } else {
      // Search all fields
      query = query.or(`nom.ilike.%${term}%,description.ilike.%${term}%`);
    }

    return from(query.order('nom')).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as Produit[];
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Shuffle array utility
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
