import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import { ProduitVariation } from '../models/models';

@Injectable({
  providedIn: 'root'
})
export class VariantService {
  constructor(private supabaseService: SupabaseService) {}

  /**
   * Récupère toutes les variantes d'un produit
   */
  getVariantsByProductId(productId: string): Observable<ProduitVariation[]> {
    return from(
      this.supabaseService.getClient()
        .from('variant')
        .select(`
          *,
          taille:taille_id(id, libelle),
          colors:couleur_id(id, nom, hex, red, green, blue, hue, sat_hsl, light_hsl, sat_hsv, val_hsv, source)
        `)
        .eq('produit_id', productId)
        .order('is_primary', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.map(item => ({
          ...item,
          // Add compatibility mapping
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

  /**
   * Récupère une variante par son ID
   */
  getVariantById(id: string): Observable<ProduitVariation> {
    return from(
      this.supabaseService.getClient()
        .from('variant')
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
          // Add compatibility mapping
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

  /**
   * Récupère les variantes par produit, taille et couleur
   */
  getVariantByAttributes(produitId: string, tailleId: string, couleurId: string | number): Observable<ProduitVariation | null> {
    const couleurIdValue = typeof couleurId === 'string' ? parseInt(couleurId, 10) : couleurId;
    
    return from(
      this.supabaseService.getClient()
        .from('variant')
        .select(`
          *,
          taille:taille_id(id, libelle),
          colors:couleur_id(id, nom, hex, red, green, blue, hue, sat_hsl, light_hsl, sat_hsv, val_hsv, source)
        `)
        .eq('produit_id', produitId)
        .eq('taille_id', tailleId)
        .eq('couleur_id', couleurIdValue)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return null;
        
        return {
          ...data,
          // Add compatibility mapping
          tailleId: data.taille_id,
          couleurId: data.couleur_id,
          produitId: data.produit_id,
          // Ensure colors id is properly typed
          colors: data.colors ? {
            ...data.colors,
            id: Number(data.colors.id)
          } : undefined
        } as ProduitVariation;
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Récupère les variantes principales (is_primary) d'un produit
   */
  getPrimaryVariants(productId: string): Observable<ProduitVariation[]> {
    return from(
      this.supabaseService.getClient()
        .from('variant')
        .select(`
          *,
          taille:taille_id(id, libelle),
          colors:couleur_id(id, nom, hex, red, green, blue, hue, sat_hsl, light_hsl, sat_hsv, val_hsv, source)
        `)
        .eq('produit_id', productId)
        .eq('is_primary', true)
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return data.map(item => ({
          ...item,
          // Add compatibility mapping
          tailleId: item.taille_id,
          couleurId: item.couleur_id,
          produitId: item.produit_id,
          // Ensure colors id is properly typed
          colors: item.colors ? {
            ...item.colors,
            id: Number(item.colors.id)
          } : undefined
        })) as ProduitVariation[];
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Met à jour une variante
   */
  updateVariant(id: string, updates: Partial<ProduitVariation>): Observable<ProduitVariation> {
    const payload: any = { ...updates };
    
    // Convert from camelCase to snake_case for database
    if (updates.tailleId !== undefined) {
      payload.taille_id = updates.tailleId;
      delete payload.tailleId;
    }
    
    if (updates.couleurId !== undefined) {
      payload.couleur_id = updates.couleurId;
      delete payload.couleurId;
    }

    if (updates.produitId !== undefined) {
      payload.produit_id = updates.produitId;
      delete payload.produitId;
    }

    // Remove relation objects from payload
    delete payload.colors;
    delete payload.taille;
    
    return from(
      this.supabaseService.getClient()
        .from('variant')
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

  /**
   * Ajoute une variante
   */
  createVariant(variant: Omit<ProduitVariation, 'id'>): Observable<ProduitVariation> {
    const { tailleId, couleurId, produitId, colors, taille, ...rest } = variant as any;
    
    const payload = {
      ...rest,
      produit_id: produitId || variant.produit_id,
      taille_id: tailleId || variant.taille_id,
      couleur_id: couleurId || variant.couleur_id
    };
    
    return from(
      this.supabaseService.getClient()
        .from('variant')
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

  /**
   * Supprime une variante
   */
  deleteVariant(id: string): Observable<void> {
    return from(
      this.supabaseService.getClient()
        .from('variant')
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
   * Vérifie le stock d'une variante
   */
  checkStock(id: string, quantite: number): Observable<boolean> {
    return from(
      this.supabaseService.getClient()
        .from('variant')
        .select('stock')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data.stock || 0) >= quantite;
      }),
      catchError(error => throwError(() => error))
    );
  }

  /**
   * Met à jour le stock d'une variante
   */
  updateStock(id: string, stock: number): Observable<ProduitVariation> {
    return from(
      this.supabaseService.getClient()
        .from('variant')
        .update({ stock })
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
} 