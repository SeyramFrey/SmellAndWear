import { Injectable } from '@angular/core';
import { Utilisateur } from '../models/models';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class UtilisateurService {
  private tableName = 'utilisateurs';

  constructor(private supabaseService: SupabaseService) {}

  async getUtilisateurs(): Promise<Utilisateur[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .order('nom');
    if (error) throw error;
    return data as Utilisateur[];
  }

  async getUtilisateurById(id: string): Promise<Utilisateur> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Utilisateur;
  }

  async getUtilisateurByEmail(email: string): Promise<Utilisateur> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .eq('email', email)
      .single();
    if (error) throw error;
    return data as Utilisateur;
  }

  async createUtilisateur(utilisateur: Omit<Utilisateur, 'id'>): Promise<Utilisateur> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .insert([utilisateur])
      .select()
      .single();
    if (error) throw error;
    return data as Utilisateur;
  }

  async updateUtilisateur(id: string, utilisateur: Partial<Utilisateur>): Promise<Utilisateur> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update(utilisateur)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Utilisateur;
  }

  async deleteUtilisateur(id: string): Promise<void> {
    const { error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async searchUtilisateurs(searchTerm: string): Promise<Utilisateur[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('*')
      .or(`nom.ilike.%${searchTerm}%,prenom.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .order('nom');
    if (error) throw error;
    return data as Utilisateur[];
  }

  async updateMotDePasse(id: string, nouveauMotDePasse: string): Promise<void> {
    const { error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update({ mot_de_passe: nouveauMotDePasse })
      .eq('id', id);
    if (error) throw error;
  }
} 