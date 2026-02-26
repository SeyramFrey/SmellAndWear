import { Injectable, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, from, of, Subject, combineLatest } from 'rxjs';
import { map, catchError, filter, take, takeUntil, switchMap, tap } from 'rxjs/operators';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { SupabaseAuthService, AuthResult } from './supabase-auth.service';

/**
 * Admin record from public.admin table
 */
export interface AdminRecord {
  user_id: string;
  created_at?: string;
}

/**
 * Admin authentication result
 */
export interface AdminAuthResult extends AuthResult {
  isAdmin: boolean;
}

/**
 * Callback handling result
 */
export interface CallbackResult {
  success: boolean;
  requiresPasswordSetup: boolean;
  isAdmin: boolean;
  error: string | null;
}

/**
 * AdminAuthService - Secure Admin Authentication
 * 
 * This service manages admin-specific authentication for the SmellAndWear admin panel.
 * Admin status is verified by checking presence in the `public.admin` table,
 * NOT just by JWT claims. This provides an additional security layer.
 * 
 * Security Model:
 * - Admin accounts are created via Supabase "Invite user" flow
 * - NO public admin signup is allowed
 * - After authentication, admin status is verified from `public.admin` table
 * - Non-admin users are immediately signed out
 * 
 * Key Features:
 * - session$: Observable of current Supabase session
 * - user$: Observable of current user
 * - isAdmin$: Observable that verifies admin status from DB
 * - Handles invite callback flow with password setup
 * 
 * Database Requirement:
 * Table: public.admin
 * - user_id: uuid PRIMARY KEY REFERENCES auth.users(id)
 * - created_at: timestamptz DEFAULT now()
 * 
 * RLS Policy for public.admin:
 * - SELECT: Only authenticated users can check their own admin status
 * - INSERT/UPDATE/DELETE: Only existing admins can modify
 */
@Injectable({
  providedIn: 'root'
})
export class AdminAuthService implements OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Admin status state
  private isAdminSubject = new BehaviorSubject<boolean>(false);
  private adminCheckingSubject = new BehaviorSubject<boolean>(false);
  private initializedSubject = new BehaviorSubject<boolean>(false);

  /**
   * Observable indicating if current user is an admin (verified from DB)
   */
  public readonly isAdmin$: Observable<boolean> = this.isAdminSubject.asObservable();

  /**
   * Observable indicating if admin check is in progress
   */
  public readonly adminChecking$: Observable<boolean> = this.adminCheckingSubject.asObservable();

  /**
   * Observable indicating service initialization complete
   */
  public readonly initialized$: Observable<boolean> = this.initializedSubject.asObservable();

  /**
   * Delegate session$ from base auth service
   */
  public readonly session$: Observable<Session | null>;

  /**
   * Delegate user$ from base auth service
   */
  public readonly user$: Observable<User | null>;

  constructor(
    private authService: SupabaseAuthService,
    private router: Router
  ) {
    // Delegate observables
    this.session$ = this.authService.session$;
    this.user$ = this.authService.user$;

    // Initialize admin status tracking
    this.initializeAdminTracking();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize admin status tracking.
   * Listens to user changes and verifies admin status from DB.
   */
  private initializeAdminTracking(): void {
    // Wait for base auth to initialize, then track user changes
    this.authService.waitForInit().pipe(
      switchMap(() => this.authService.user$),
      takeUntil(this.destroy$)
    ).subscribe(user => {
      if (user) {
        // User is authenticated - verify admin status from DB
        this.verifyAdminStatus(user.id);
      } else {
        // No user - not an admin
        this.isAdminSubject.next(false);
        this.initializedSubject.next(true);
      }
    });
  }

  /**
   * Verify if user is an admin by checking public.admin table
   */
  private async verifyAdminStatus(userId: string): Promise<void> {
    this.adminCheckingSubject.next(true);

    try {
      const { data, error } = await this.authService.getClient()
        .from('admin')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[AdminAuthService] Error checking admin status:', error);
        this.isAdminSubject.next(false);
      } else {
        const isAdmin = !!data;
        console.log('[AdminAuthService] Admin status verified:', isAdmin);
        this.isAdminSubject.next(isAdmin);
      }
    } catch (error) {
      console.error('[AdminAuthService] Exception checking admin status:', error);
      this.isAdminSubject.next(false);
    } finally {
      this.adminCheckingSubject.next(false);
      this.initializedSubject.next(true);
    }
  }

  /**
   * Refresh admin status from database.
   * Call this after any operation that might change admin status.
   */
  async refreshAdminStatus(): Promise<boolean> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      this.isAdminSubject.next(false);
      return false;
    }

    await this.verifyAdminStatus(user.id);
    return this.isAdminSubject.value;
  }

  /**
   * Sign in with email and password.
   * Verifies admin status after successful authentication.
   * Signs out immediately if user is not an admin.
   * 
   * @param email Admin email
   * @param password Admin password
   * @returns Result with user, session, isAdmin flag, and any error
   */
  async signIn(email: string, password: string): Promise<AdminAuthResult> {
    try {
      // First, authenticate with Supabase
      const authResult = await this.authService.signIn(email, password);

      if (authResult.error || !authResult.user) {
        return {
          ...authResult,
          isAdmin: false
        };
      }

      // Verify admin status from database
      const isAdmin = await this.checkAdminInDatabase(authResult.user.id);

      if (!isAdmin) {
        // User is authenticated but not an admin - sign them out
        console.warn('[AdminAuthService] User is not an admin, signing out');
        await this.authService.signOut();
        
        return {
          user: null,
          session: null,
          error: { 
            name: 'AdminAccessDenied',
            message: 'Access denied. You are not authorized as an administrator.'
          } as AuthError,
          isAdmin: false
        };
      }

      // Success - user is an admin
      this.isAdminSubject.next(true);
      
      return {
        ...authResult,
        isAdmin: true
      };
    } catch (error) {
      console.error('[AdminAuthService] Sign in exception:', error);
      return {
        user: null,
        session: null,
        error: error as AuthError,
        isAdmin: false
      };
    }
  }

  /**
   * Sign out the current admin user
   */
  async signOut(): Promise<void> {
    try {
      await this.authService.signOut();
      this.isAdminSubject.next(false);
    } catch (error) {
      console.error('[AdminAuthService] Sign out error:', error);
      // Force reset state even on error
      this.isAdminSubject.next(false);
      throw error;
    }
  }

  /**
   * Handle callback from Supabase auth (invite links, password recovery, etc.)
   * This should be called on the /admin/auth/callback page.
   * 
   * @returns CallbackResult with success status and any required actions
   */
  async handleCallbackFromUrl(): Promise<CallbackResult> {
    try {
      // Get the URL hash/query params
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(window.location.search);
      
      // Check for error in URL
      const errorParam = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      
      if (errorParam) {
        return {
          success: false,
          requiresPasswordSetup: false,
          isAdmin: false,
          error: errorDescription || errorParam
        };
      }

      // Parse the hash for tokens (Supabase sends tokens in hash)
      const hashParams = new URLSearchParams(hash.replace('#', ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      // Check if this is an invite or recovery flow
      const requiresPasswordSetup = type === 'invite' || type === 'recovery';

      if (accessToken && refreshToken) {
        // Set the session manually from the tokens
        const { data, error } = await this.authService.getClient().auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          return {
            success: false,
            requiresPasswordSetup: false,
            isAdmin: false,
            error: error.message
          };
        }

        if (data.session?.user) {
          // Verify admin status
          const isAdmin = await this.checkAdminInDatabase(data.session.user.id);

          if (!isAdmin) {
            // Not an admin - sign out
            await this.authService.signOut();
            return {
              success: false,
              requiresPasswordSetup: false,
              isAdmin: false,
              error: 'Access denied. You are not authorized as an administrator.'
            };
          }

          this.isAdminSubject.next(true);

          return {
            success: true,
            requiresPasswordSetup,
            isAdmin: true,
            error: null
          };
        }
      }

      // No tokens in URL - check if already authenticated
      const session = await this.authService.getSession();
      
      if (session?.user) {
        const isAdmin = await this.checkAdminInDatabase(session.user.id);
        
        return {
          success: isAdmin,
          requiresPasswordSetup: false,
          isAdmin,
          error: isAdmin ? null : 'Access denied. You are not authorized as an administrator.'
        };
      }

      return {
        success: false,
        requiresPasswordSetup: false,
        isAdmin: false,
        error: 'No authentication token found. The link may have expired.'
      };
    } catch (error) {
      console.error('[AdminAuthService] Callback handling error:', error);
      return {
        success: false,
        requiresPasswordSetup: false,
        isAdmin: false,
        error: 'An error occurred while processing the authentication link.'
      };
    }
  }

  /**
   * Update password (used after invite flow)
   * 
   * @param newPassword The new password
   * @returns Error if any
   */
  async updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
    return this.authService.updatePassword(newPassword);
  }

  /**
   * Check if a user is in the admin table
   */
  private async checkAdminInDatabase(userId: string): Promise<boolean> {
    try {
      const { data, error } = await this.authService.getClient()
        .from('admin')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[AdminAuthService] Admin check query error:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('[AdminAuthService] Admin check exception:', error);
      return false;
    }
  }

  /**
   * Get current admin status synchronously
   */
  isAdminSync(): boolean {
    return this.isAdminSubject.value;
  }

  /**
   * Wait for admin service initialization
   */
  waitForInit(): Observable<boolean> {
    return this.initialized$.pipe(
      filter(initialized => initialized),
      take(1)
    );
  }

  /**
   * Get current session synchronously
   */
  getCurrentSession(): Session | null {
    return this.authService.getCurrentSession();
  }

  /**
   * Get current user synchronously
   */
  getCurrentUser(): User | null {
    return this.authService.getCurrentUser();
  }

  /**
   * Get the Supabase client
   */
  getClient() {
    return this.authService.getClient();
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(error: AuthError | null): string {
    if (!error) {
      return 'An unknown error occurred';
    }

    if (error.name === 'AdminAccessDenied') {
      return error.message;
    }

    return this.authService.getErrorMessage(error);
  }
}

