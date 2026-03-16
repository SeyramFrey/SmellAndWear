import { Injectable } from '@angular/core';
import { Color as Couleur } from '../models/models';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class ColorService {
  private tableName = 'couleurs';

  constructor(private supabaseService: SupabaseService) {}

  async getCouleurs(): Promise<Couleur[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .order('nom');
    if (error) throw error;
    return data as Couleur[];
  }

  async getCouleurById(id: string): Promise<Couleur> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Couleur;
  }

  async createCouleur(couleur: Omit<Couleur, 'id'>): Promise<Couleur> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .insert([couleur])
      .select()
      .single();
    if (error) throw error;
    return data as Couleur;
  }

  async updateCouleur(id: string, couleur: Partial<Couleur>): Promise<Couleur> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update(couleur)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Couleur;
  }

  async deleteCouleur(id: string): Promise<void> {
    const { error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async getCouleursByProduit(produitId: string): Promise<Couleur[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from('produit_variations')
      .select('couleur:coupleur_id(*)')
      .eq('produit_id', produitId)
      .order('couleur.nom');
    if (error) throw error;
    return data.map(item => item.couleur) as unknown as Couleur[];
  }
}
