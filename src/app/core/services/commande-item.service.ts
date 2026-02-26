import { Injectable } from '@angular/core';
import { CommandeItem } from '../models/models';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class CommandeItemService {
  private tableName = 'commande_items';

  constructor(private supabaseService: SupabaseService) {}

  async getCommandeItems(): Promise<CommandeItem[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*');
    if (error) throw error;
    return data as CommandeItem[];
  }

  async getCommandeItemById(id: string): Promise<CommandeItem> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as CommandeItem;
  }

  async getCommandeItemsByCommande(commandeId: string): Promise<CommandeItem[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('commande_id', commandeId);
    if (error) throw error;
    return data as CommandeItem[];
  }

  async getCommandeItemsByProduit(produitId: string): Promise<CommandeItem[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('produit_id', produitId);
    if (error) throw error;
    return data as CommandeItem[];
  }

  async createCommandeItem(commandeItem: Omit<CommandeItem, 'id'>): Promise<CommandeItem> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .insert([commandeItem])
      .select()
      .single();
    if (error) throw error;
    return data as CommandeItem;
  }

  async updateCommandeItem(id: string, commandeItem: Partial<CommandeItem>): Promise<CommandeItem> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update(commandeItem)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CommandeItem;
  }

  async deleteCommandeItem(id: string): Promise<void> {
    const { error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async updateQuantite(id: string, newQuantite: number): Promise<CommandeItem> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update({ quantite: newQuantite })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CommandeItem;
  }

  async updatePrixUnitaire(id: string, newPrixUnitaire: number): Promise<CommandeItem> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update({ prix_unitaire: newPrixUnitaire })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CommandeItem;
  }
} 