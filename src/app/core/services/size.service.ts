import { Injectable } from '@angular/core';
import { Taille } from '../models/models';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class SizeService {
  private tableName = 'tailles';

  constructor(private supabaseService: SupabaseService) {}

  async getTailles(): Promise<Taille[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .order('ordre');
    if (error) throw error;
    return data as Taille[];
  }

  async getTailleById(id: string): Promise<Taille> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Taille;
  }

  async createTaille(taille: Omit<Taille, 'id'>): Promise<Taille> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .insert([taille])
      .select()
      .single();
    if (error) throw error;
    return data as Taille;
  }

  async updateTaille(id: string, taille: Partial<Taille>): Promise<Taille> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update(taille)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Taille;
  }

  async deleteTaille(id: string): Promise<void> {
    const { error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async getTaillesByCategorie(categorieId: string): Promise<Taille[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('categorieId', categorieId)
      .order('ordre');
    if (error) throw error;
    return data as Taille[];
  }
}
