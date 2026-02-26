import { Injectable } from '@angular/core';
import { Panier, PanierItem } from '../models/models';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class PanierService {
  private tableName = 'paniers';
  private itemsTableName = 'panier_items';

  constructor(private supabaseService: SupabaseService) {}

  async getPanierByClientId(clientId: string): Promise<Panier | null> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('clientId', clientId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data as Panier | null;
  }

  async createPanier(clientId: string): Promise<Panier> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .insert([{ clientId, createdAt: new Date() }])
      .select()
      .single();
    if (error) throw error;
    return data as Panier;
  }

  async getPanierItems(panierId: string): Promise<PanierItem[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.itemsTableName)
      .select('*')
      .eq('panierId', panierId);
    if (error) throw error;
    return data as PanierItem[];
  }

  async addItemToPanier(panierId: string, produitVariationId: string, quantite: number): Promise<PanierItem> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.itemsTableName)
      .insert([{ panierId, produitVariationId, quantite }])
      .select()
      .single();
    if (error) throw error;
    return data as PanierItem;
  }

  async updatePanierItem(id: string, quantite: number): Promise<PanierItem> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.itemsTableName)
      .update({ quantite })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as PanierItem;
  }

  async removeItemFromPanier(id: string): Promise<void> {
    const { error } = await this.supabaseService.getClient()
      .from(this.itemsTableName)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async clearPanier(panierId: string): Promise<void> {
    const { error } = await this.supabaseService.getClient()
      .from(this.itemsTableName)
      .delete()
      .eq('panierId', panierId);
    if (error) throw error;
  }
} 