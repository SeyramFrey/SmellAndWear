import { Injectable } from '@angular/core';
import { Adresse } from '../models/models';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AdresseService {
  private tableName = 'adresses';

  constructor(private supabaseService: SupabaseService) {}

  async getAdresses(): Promise<Adresse[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*');
    if (error) throw error;
    return data as Adresse[];
  }

  async getAdresseById(id: string): Promise<Adresse> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Adresse;
  }

  async getAdressesByClientId(clientId: string): Promise<Adresse[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('clientId', clientId);
    if (error) throw error;
    return data as Adresse[];
  }

  async createAdresse(adresse: Omit<Adresse, 'id'>): Promise<Adresse> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .insert([adresse])
      .select()
      .single();
    if (error) throw error;
    return data as Adresse;
  }

  async updateAdresse(id: string, adresse: Partial<Adresse>): Promise<Adresse> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update(adresse)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Adresse;
  }

  async deleteAdresse(id: string): Promise<void> {
    const { error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
} 