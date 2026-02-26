import { Injectable } from '@angular/core';
import { SupabaseClient, User, Session } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { SupabaseAuthService, UserRole } from './supabase-auth.service';

/**
 * Supabase Service - Provides access to the Supabase client and utilities.
 * 
 * This service delegates authentication to SupabaseAuthService and provides
 * a unified interface for database operations, storage, and real-time subscriptions.
 * 
 * All services that need Supabase access should inject this service
 * to ensure they use the shared authenticated client.
 */
@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  constructor(private authService: SupabaseAuthService) {}

  /**
   * Get the shared Supabase client instance.
   * This client automatically includes auth tokens for RLS policy evaluation.
   */
  getClient(): SupabaseClient {
    return this.authService.getClient();
  }

  /**
   * Get the current user observable.
   * @deprecated Use SupabaseAuthService.user$ directly for new code.
   */
  getCurrentUser(): Observable<User | null> {
    return this.authService.user$;
  }

  /**
   * Get the current session observable.
   */
  get session$(): Observable<Session | null> {
    return this.authService.session$;
  }

  /**
   * Get the current user role observable.
   */
  get role$(): Observable<UserRole> {
    return this.authService.role$;
  }

  /**
   * Sign up a new user.
   * @param email User's email
   * @param password User's password
   */
  async signUp(email: string, password: string): Promise<{ user: User | null; error: unknown }> {
    const client = this.getClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
    });
    return { user: data?.user || null, error };
  }

  /**
   * Sign in with email and password.
   * @param email User's email
   * @param password User's password
   */
  async signIn(email: string, password: string): Promise<{ user: User | null; error: unknown }> {
    const result = await this.authService.signIn(email, password);
    return { user: result.user, error: result.error };
  }

  /**
   * Sign out the current user.
   */
  async signOut(): Promise<{ error: unknown }> {
    try {
      await this.authService.signOut();
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Send password reset email.
   * @param email User's email
   */
  async resetPassword(email: string): Promise<{ error: unknown }> {
    const client = this.getClient();
    const { error } = await client.auth.resetPasswordForEmail(email);
    return { error };
  }

  /**
   * Update user's password.
   * @param newPassword New password
   */
  async updatePassword(newPassword: string): Promise<{ error: unknown }> {
    const client = this.getClient();
    const { error } = await client.auth.updateUser({
      password: newPassword
    });
    return { error };
  }

  /**
   * Get current session.
   */
  async getSession(): Promise<{ session: Session | null; error: unknown }> {
    const client = this.getClient();
    const { data, error } = await client.auth.getSession();
    return { session: data?.session || null, error };
  }

  /**
   * Refresh the current session.
   */
  async refreshSession(): Promise<{ session: Session | null; error: unknown }> {
    const client = this.getClient();
    const { data, error } = await client.auth.refreshSession();
    return { session: data?.session || null, error };
  }

  // ==================== Storage Methods ====================

  /**
   * Upload a file to Supabase Storage.
   * @param bucket Storage bucket name
   * @param path File path within the bucket
   * @param file File to upload
   */
  async uploadFile(bucket: string, path: string, file: File): Promise<{ data: unknown; error: unknown }> {
    return await this.getClient().storage
      .from(bucket)
      .upload(path, file);
  }

  /**
   * Delete a file from Supabase Storage.
   * @param bucket Storage bucket name
   * @param path File path within the bucket
   */
  async deleteFile(bucket: string, path: string): Promise<{ data: unknown; error: unknown }> {
    return await this.getClient().storage
      .from(bucket)
      .remove([path]);
  }

  /**
   * Get the public URL for a file in Supabase Storage.
   * @param bucket Storage bucket name
   * @param path File path within the bucket
   */
  getFileUrl(bucket: string, path: string): string {
    return this.getClient().storage
      .from(bucket)
      .getPublicUrl(path).data.publicUrl;
  }

  // ==================== Real-time Methods ====================

  /**
   * Subscribe to real-time changes on a table.
   * @param table Table name to subscribe to
   * @param callback Callback function for changes
   */
  subscribeToChanges(table: string, callback: (payload: unknown) => void) {
    return this.getClient()
      .channel('table_db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();
  }

  /**
   * Subscribe to a specific channel.
   * @param channelName Channel name
   */
  subscribeToChannel(channelName: string) {
    return this.getClient().channel(channelName);
  }

  // ==================== Helper Methods ====================

  /**
   * Check if user is authenticated.
   */
  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  /**
   * Check if user is an admin.
   */
  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  /**
   * Get current role synchronously.
   */
  getCurrentRole(): UserRole {
    return this.authService.getCurrentRole();
  }
}
