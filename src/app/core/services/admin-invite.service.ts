import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AdminAuthService } from './admin-auth.service';
import { environment } from 'src/environments/environment';

/**
 * Admin invitation result
 */
export interface InviteResult {
  success: boolean;
  message: string;
  userId?: string;
  error?: string;
}

/**
 * Pending admin invitation
 */
export interface PendingInvite {
  id: string;
  email: string;
  invited_at: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'expired';
}

/**
 * AdminInviteService - Handles admin user invitations
 * 
 * Security Model:
 * - Admin invitations should ONLY be processed via a secure Edge Function
 * - The Edge Function uses the service_role key (never exposed to frontend)
 * - The caller must be an authenticated admin (verified via JWT + public.admin check)
 * 
 * Flow:
 * 1. Admin submits email to invite
 * 2. Frontend calls Edge Function with email
 * 3. Edge Function verifies caller is admin
 * 4. Edge Function calls Supabase Admin API to invite user
 * 5. Edge Function adds entry to public.admin table
 * 6. Invited user receives email with callback URL
 * 
 * Edge Function Requirements:
 * - Endpoint: /functions/v1/invite-admin
 * - Method: POST
 * - Body: { email: string }
 * - Auth: Bearer token (Supabase JWT)
 * - Response: { success: boolean, message: string, userId?: string }
 * 
 * TODO: Deploy the Edge Function (see supabase/functions/invite-admin/index.ts)
 */
@Injectable({
  providedIn: 'root'
})
export class AdminInviteService {
  
  constructor(private adminAuthService: AdminAuthService) {}

  /**
   * Invite a new admin by email.
   * Calls the secure Edge Function which handles the actual invitation.
   * 
   * @param email Email address to invite
   * @returns Observable with invite result
   */
  inviteAdmin(email: string): Observable<InviteResult> {
    // Validate email format
    if (!email || !this.isValidEmail(email)) {
      return of({
        success: false,
        message: 'Invalid email address',
        error: 'Please provide a valid email address'
      });
    }

    // Check if current user is admin
    if (!this.adminAuthService.isAdminSync()) {
      return of({
        success: false,
        message: 'Unauthorized',
        error: 'You must be an admin to invite other admins'
      });
    }

    return from(this.callInviteFunction(email)).pipe(
      catchError(error => {
        console.error('[AdminInviteService] Error inviting admin:', error);
        return of({
          success: false,
          message: 'Failed to send invitation',
          error: error.message || 'An unexpected error occurred'
        });
      })
    );
  }

  /**
   * Call the Edge Function to invite an admin
   */
  private async callInviteFunction(email: string): Promise<InviteResult> {
    const session = this.adminAuthService.getCurrentSession();
    
    if (!session?.access_token) {
      return {
        success: false,
        message: 'Not authenticated',
        error: 'Please log in to invite admins'
      };
    }

    try {
      // Get Supabase URL from environment configuration
      const supabaseUrl = environment.supabase.url;

      // Call Edge Function
      const response = await fetch(`${supabaseUrl}/functions/v1/invite-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          message: 'Invitation failed',
          error: errorData.error || `Server error: ${response.status}`
        };
      }

      const data = await response.json();
      return {
        success: data.success ?? true,
        message: data.message || 'Invitation sent successfully',
        userId: data.userId
      };
    } catch (error: any) {
      // Check if Edge Function doesn't exist
      if (error.message?.includes('fetch') || error.message?.includes('network')) {
        return {
          success: false,
          message: 'Edge Function not available',
          error: 'The invite-admin Edge Function is not deployed. See README for setup instructions.'
        };
      }
      throw error;
    }
  }

  /**
   * Get list of admin users
   */
  getAdmins(): Observable<any[]> {
    return from(this.fetchAdmins()).pipe(
      catchError(error => {
        console.error('[AdminInviteService] Error fetching admins:', error);
        return of([]);
      })
    );
  }

  /**
   * Fetch admin users from database
   */
  private async fetchAdmins(): Promise<any[]> {
    const { data, error } = await this.adminAuthService.getClient()
      .from('admin')
      .select(`
        user_id,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AdminInviteService] Error fetching admins:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Remove an admin (revoke admin access)
   * Note: This only removes from public.admin table, doesn't delete the user
   */
  removeAdmin(userId: string): Observable<{ success: boolean; error?: string }> {
    // Prevent removing yourself
    const currentUser = this.adminAuthService.getCurrentUser();
    if (currentUser?.id === userId) {
      return of({
        success: false,
        error: 'You cannot remove your own admin access'
      });
    }

    return from(this.performRemoveAdmin(userId)).pipe(
      catchError(error => {
        console.error('[AdminInviteService] Error removing admin:', error);
        return of({
          success: false,
          error: error.message || 'Failed to remove admin'
        });
      })
    );
  }

  /**
   * Perform admin removal
   */
  private async performRemoveAdmin(userId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.adminAuthService.getClient()
      .from('admin')
      .delete()
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    return { success: true };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

