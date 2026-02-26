import { Injectable } from '@angular/core';
import { ProduitVariation } from '../models/models';
import { SupabaseService } from './supabase.service';
import { Observable, from, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ProduitVariationService {
  private tableName = 'variant';

  constructor(private supabaseService: SupabaseService) {}

  getVariationsByProduitId(produit_id: string): Observable<ProduitVariation[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select(`
          *,
          taille:taille_id(id, libelle),
          colors:couleur_id(id, nom, hex, red, green, blue, hue, sat_hsl, light_hsl, sat_hsv, val_hsv, source)
        `)
        .eq('produit_id', produit_id)
        .order('is_primary', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.map(item => ({
          ...item,
          // Map database fields to model compatibility fields
          tailleId: item.taille_id,
          couleurId: item.couleur_id,
          produitId: item.produit_id,
          // Ensure colors id is properly typed
          colors: item.colors ? {
            ...item.colors,
            id: Number(item.colors.id) // Convert bigint to number for compatibility
          } : undefined
        })) as ProduitVariation[];
      }),
      catchError(error => throwError(() => error))
    );
  }

  getVariationById(id: string): Observable<ProduitVariation> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select(`
          *,
          taille:taille_id(id, libelle),
          colors:couleur_id(id, nom, hex, red, green, blue, hue, sat_hsl, light_hsl, sat_hsv, val_hsv, source)
        `)
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return {
          ...data,
          // Map database fields to model compatibility fields
          tailleId: data.taille_id,
          couleurId: data.couleur_id,
          produitId: data.produit_id,
          // Ensure colors id is properly typed
          colors: data.colors ? {
            ...data.colors,
            id: Number(data.colors.id) // Convert bigint to number for compatibility
          } : undefined
        } as ProduitVariation;
      }),
      catchError(error => throwError(() => error))
    );
  }

  createVariation(variation: Omit<ProduitVariation, 'id'>): Observable<ProduitVariation> {
    const { tailleId, couleurId, produitId, colors, taille, ...rest } = variation as any;
    
    const payload = {
      ...rest,
      produit_id: produitId || variation.produit_id,
      taille_id: tailleId || variation.taille_id,
      couleur_id: couleurId || variation.couleur_id
    };
    
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .insert([payload])
        .select(`
          *,
          taille:taille_id(id, libelle),
          colors:couleur_id(id, nom, hex, red, green, blue, hue, sat_hsl, light_hsl, sat_hsv, val_hsv, source)
        `)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return {
          ...data,
          tailleId: data.taille_id,
          couleurId: data.couleur_id,
          produitId: data.produit_id,
          colors: data.colors ? {
            ...data.colors,
            id: Number(data.colors.id)
          } : undefined
        } as ProduitVariation;
      }),
      catchError(error => throwError(() => error))
    );
  }

  updateVariation(id: string, variation: Partial<ProduitVariation>): Observable<ProduitVariation> {
    const payload: any = { ...variation };
    
    // Convert from camelCase to snake_case for database
    if (variation.tailleId !== undefined) {
      payload.taille_id = variation.tailleId;
      delete payload.tailleId;
    }
    
    if (variation.couleurId !== undefined) {
      payload.couleur_id = variation.couleurId;
      delete payload.couleurId;
    }

    if (variation.produitId !== undefined) {
      payload.produit_id = variation.produitId;
      delete payload.produitId;
    }

    // Remove relation objects from payload
    delete payload.colors;
    delete payload.taille;
    
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .update(payload)
        .eq('id', id)
        .select(`
          *,
          taille:taille_id(id, libelle),
          colors:couleur_id(id, nom, hex, red, green, blue, hue, sat_hsl, light_hsl, sat_hsv, val_hsv, source)
        `)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return {
          ...data,
          tailleId: data.taille_id,
          couleurId: data.couleur_id,
          produitId: data.produit_id,
          colors: data.colors ? {
            ...data.colors,
            id: Number(data.colors.id)
          } : undefined
        } as ProduitVariation;
      }),
      catchError(error => throwError(() => error))
    );
  }

  deleteVariation(id: string): Observable<boolean> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) throw error;
        return true;
      }),
      catchError(error => throwError(() => error))
    );
  }

  getVariationsByTailleId(taille_id: string): Observable<ProduitVariation[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select(`
          *,
          taille:taille_id(id, libelle),
          colors:couleur_id(id, nom, hex, red, green, blue, hue, sat_hsl, light_hsl, sat_hsv, val_hsv, source)
        `)
        .eq('taille_id', taille_id)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.map(item => ({
          ...item,
          tailleId: item.taille_id,
          couleurId: item.couleur_id,
          produitId: item.produit_id,
          colors: item.colors ? {
            ...item.colors,
            id: Number(item.colors.id)
          } : undefined
        })) as ProduitVariation[];
      }),
      catchError(error => throwError(() => error))
    );
  }

  getVariationsByCouleurId(couleur_id: number): Observable<ProduitVariation[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select(`
          *,
          taille:taille_id(id, libelle),
          colors:couleur_id(id, nom, hex, red, green, blue, hue, sat_hsl, light_hsl, sat_hsv, val_hsv, source)
        `)
        .eq('couleur_id', couleur_id)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.map(item => ({
          ...item,
          tailleId: item.taille_id,
          couleurId: item.couleur_id,
          produitId: item.produit_id,
          colors: item.colors ? {
            ...item.colors,
            id: Number(item.colors.id)
          } : undefined
        })) as ProduitVariation[];
      }),
      catchError(error => throwError(() => error))
    );
  }
} 