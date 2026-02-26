import { Injectable } from '@angular/core';
import { Client } from '../models/models';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private tableName = 'clients';

  constructor(private supabaseService: SupabaseService) {}

  async getClients(): Promise<Client[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*');
    if (error) throw error;
    return data as Client[];
  }

  async getClientById(id: string): Promise<Client> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Client;
  }

  // async createClient(client: Omit<Client, 'id' | 'dateInscription'>): Promise<Client> {
  //   const { data, error } = await this.supabaseService.getClient()
  //     .from(this.tableName)
  //     .insert([{ ...client, dateInscription: new Date() }])
  //     .select()
  //     .single();
  //   if (error) throw error;
  //   return data as Client;
  // }

  async updateClient(id: string, client: Partial<Client>): Promise<Client> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update(client)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Client;
  }

  async deleteClient(id: string): Promise<void> {
    const { error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
} 