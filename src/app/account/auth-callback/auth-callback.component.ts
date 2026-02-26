import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

import { AdminAuthService } from '../../core/services/admin-auth.service';

/**
 * Auth Callback Component
 * 
 * Handles ONLY standard auth callbacks from Supabase:
 * - Email confirmation (signup)
 * - OAuth login (Google, GitHub, etc.)
 * - Magic links
 * 
 * Route: /auth/callback
 * 
 * This component does NOT handle:
 * - Admin invitations → use /auth/invite
 * - Password resets → use /auth/reset-password
 * 
 * Flow:
 * 1. Supabase redirects here after successful auth
 * 2. Parse tokens from URL hash
 * 3. Establish session
 * 4. Verify admin status
 * 5. Redirect to appropriate page
 * 
 * Expected URL formats:
 * - OAuth: /auth/callback#access_token=...&refresh_token=...
 * - Email confirm: /auth/callback#access_token=...&type=signup
 * - Magic link: /auth/callback#access_token=...&type=magiclink
 */
@Component({
  selector: 'app-auth-callback',
  templateUrl: './auth-callback.component.html',
  styleUrls: ['./auth-callback.component.scss']
})
export class AuthCallbackComponent implements OnInit, OnDestroy {
  // Component state
  loading = true;
  error = '';

  // Current year for footer
  year: number = new Date().getFullYear();

  // For cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private adminAuthService: AdminAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.processCallback();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Process the authentication callback from URL
   * 
   * This component handles:
   * - OAuth callbacks
   * - Email signup confirmation  
   * - Magic link sign-in
   * 
   * If `type=invite` or `type=recovery` is detected, it redirects to the 
   * dedicated routes. Otherwise it processes the auth and redirects appropriately.
   */
  private async processCallback(): Promise<void> {
    try {
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.replace('#', ''));
      
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      const errorParam = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      console.log('[AuthCallback] Processing:', { 
        hasHash: !!hash, 
        hasAccessToken: !!accessToken, 
        type 
      });

      // Check for errors in URL
      if (errorParam) {
        this.error = errorDescription || errorParam;
        this.loading = false;
        return;
      }

      // Only redirect to dedicated routes if we have a type AND tokens
      // This prevents redirect loops when type is missing
      if (type === 'invite' && accessToken && refreshToken) {
        console.log('[AuthCallback] Detected invite flow with tokens, redirecting to /auth/invite');
        window.location.href = '/auth/invite' + window.location.hash;
        return;
      }

      if (type === 'recovery' && accessToken && refreshToken) {
        console.log('[AuthCallback] Detected recovery flow with tokens, redirecting to /auth/reset-password');
        window.location.href = '/auth/reset-password' + window.location.hash;
        return;
      }

      // Handle standard auth flows (OAuth, signup confirm, magic link, or no type specified)
      if (accessToken && refreshToken) {
        const { data, error } = await this.adminAuthService.getClient().auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('[AuthCallback] Session error:', error);
          this.error = error.message || 'Failed to establish session.';
          this.loading = false;
          return;
        }

        if (data.session?.user) {
          // Check if user is admin
          const isAdmin = await this.checkAdminStatus(data.session.user.id);

          if (isAdmin) {
            // Admin - redirect to admin panel
            console.log('[AuthCallback] Admin verified, redirecting to /admin');
            this.router.navigate(['/admin'], { replaceUrl: true });
          } else {
            // Not an admin - redirect to home (or customer account)
            console.log('[AuthCallback] User is not admin, redirecting to home');
            this.router.navigate(['/'], { replaceUrl: true });
          }
          return;
        }
      }

      // Check for existing session (browser was already authenticated)
      const session = await this.adminAuthService.getClient().auth.getSession();
      
      if (session.data.session?.user) {
        const isAdmin = await this.checkAdminStatus(session.data.session.user.id);
        
        if (isAdmin) {
          this.router.navigate(['/admin'], { replaceUrl: true });
        } else {
          this.router.navigate(['/'], { replaceUrl: true });
        }
        return;
      }

      // No tokens and no session
      this.error = 'No authentication data found. The link may have expired.';
      this.loading = false;

    } catch (error: any) {
      console.error('[AuthCallback] Error:', error);
      this.error = error.message || 'An unexpected error occurred.';
      this.loading = false;
    }
  }

  /**
   * Check if user is in admin table
   */
  private async checkAdminStatus(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.adminAuthService.getClient()
        .from('admin')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[AuthCallback] Admin check error:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('[AuthCallback] Admin check exception:', error);
      return false;
    }
  }

  /**
   * Navigate to login page
   */
  goToLogin(): void {
    this.router.navigate(['/auth/login'], { replaceUrl: true });
  }
}
