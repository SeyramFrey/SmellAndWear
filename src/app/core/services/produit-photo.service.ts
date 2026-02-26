import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import {Produit, ProduitPhoto} from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class ProduitPhotoService {

    private tableName = 'produit_photos';
  constructor(private supabaseService: SupabaseService) {}

  /**
   * Récupère toutes les photos d'un produit
   */


  getProduitPhotos(productId: string): Observable<ProduitPhoto[]> {
    return from(
      this.supabaseService.getClient()
        .from('produit_photos')
        .select('*')
        .eq('produit_id', productId)
        .order('display_order', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as ProduitPhoto[];
      }),
      catchError(error => throwError(() => error))
    );
  }

    getProduits(): Observable<ProduitPhoto[]> {
        return from(
            this.supabaseService.getClient()
                .from(this.tableName)
                .select('*')
        ).pipe(
            map(({ data, error }) => {
                if (error) throw error;
                return data as ProduitPhoto[];
            }),
            catchError(error => throwError(() => error))
        );
    }

    getProduitsPhotos(): Observable<ProduitPhoto[]> {
        return from(
            this.supabaseService.getClient()
                .from(this.tableName)
                .select('*')
        ).pipe(
            map(({ data, error }) => {
                if (error) throw error;
                return data as ProduitPhoto[];
            }),
            catchError(error => throwError(() => error))
        );
    }

    getNewsProduitsPhotos(): Observable<ProduitPhoto[]> {
        return from(
            this.supabaseService.getClient()
                .from(this.tableName)
                .select('*')
                .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false })
        ).pipe(
            map(({ data, error }) => {
                console.log(data);
                if (error) throw error;
                return data as ProduitPhoto[];
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

  /**
   * Récupère la photo principale d'un produit
   */
  getPrimaryProduitPhoto(productId: string): Observable<ProduitPhoto | null> {
    return from(
      this.supabaseService.getClient()
        .from('produit_photos')
        .select('*')
        .eq('produit_id', productId)
        .eq('is_primary', true)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
        return data as ProduitPhoto | null;
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Ajoute une photo à un produit
   */
  addProduitPhoto(productId: string, photoId: string, isPrimary: boolean = false): Observable<ProduitPhoto> {
    return from(
      this.supabaseService.getClient()
        .from('produit_photos')
        .insert({
          produit_id: productId,
          photo_id: photoId,
          is_primary: isPrimary,
          display_order: 0 // Sera mis à jour par le trigger
        })
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as ProduitPhoto;
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Met à jour une photo de produit
   */
  updateProduitPhoto(id: string, updates: Partial<ProduitPhoto>): Observable<ProduitPhoto> {
    return from(
      this.supabaseService.getClient()
        .from('produit_photos')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as ProduitPhoto;
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Supprime une photo de produit
   */
  deleteProduitPhoto(id: string): Observable<void> {
    return from(
      this.supabaseService.getClient()
        .from('produit_photos')
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
   * Met à jour l'ordre d'affichage des photos d'un produit
   */
  updateDisplayOrder(productId: string, photoIds: string[]): Observable<void> {
    const updates = photoIds.map((id, index) => ({
      id,
      display_order: index
    }));

    return from(
      this.supabaseService.getClient()
        .from('produit_photos')
        .upsert(updates)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Récupère toutes les photos pour une liste de produits
   */
  getProduitPhotosByProductIds(productIds: string[]): Observable<ProduitPhoto[]> {
    return from(
      this.supabaseService.getClient()
        .from('produit_photos')
        .select('*')
        .in('produit_id', productIds)
        .order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data as ProduitPhoto[];
      }),
      catchError(error => throwError(() => error))
    );
  }
} 