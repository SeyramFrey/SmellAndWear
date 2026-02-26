import { Injectable } from '@angular/core';
import { ListeFavoris } from '../models/models';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class FavorisService {
  private tableName = 'liste_favoris';

  constructor(private supabaseService: SupabaseService) {}

  async getFavorisByClientId(clientId: string): Promise<ListeFavoris[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('clientId', clientId)
      .order('createdAt', { ascending: false });
    if (error) throw error;
    return data as ListeFavoris[];
  }

  async addToFavoris(clientId: string, produitId: string): Promise<ListeFavoris> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .insert([{ clientId, produitId, createdAt: new Date() }])
      .select()
      .single();
    if (error) throw error;
    return data as ListeFavoris;
  }

  async removeFromFavoris(id: string): Promise<void> {
    const { error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async isInFavoris(clientId: string, produitId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('id')
      .eq('clientId', clientId)
      .eq('produitId', produitId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }

  async toggleFavoris(clientId: string, produitId: string): Promise<boolean> {
    const isInFavoris = await this.isInFavoris(clientId, produitId);
    
    if (isInFavoris) {
      const { data } = await this.supabaseService.getClient()
        .from(this.tableName)
        .select('id')
        .eq('clientId', clientId)
        .eq('produitId', produitId)
        .single();
      await this.removeFromFavoris(data!.id);
      return false;
    } else {
      await this.addToFavoris(clientId, produitId);
      return true;
    }
  }
} 