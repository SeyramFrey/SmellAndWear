import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError, filter, take } from 'rxjs/operators';
import { 
  SupabaseClient, 
  createClient, 
  Session, 
  User, 
  AuthError,
  AuthChangeEvent
} from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Business role type that maps to Supabase RLS policies.
 * 
 * - 'admin': Full access - user has app_metadata.role = 'admin'
 * - 'user': Authenticated user with limited access (default for authenticated users)
 * - 'unknown': Not authenticated / anonymous
 * 
 * The RLS policies in Supabase use:
 *   (SELECT auth.jwt())->'app_metadata'->>'role' = 'admin'
 * to check for admin access.
 */
export type UserRole = 'admin' | 'user' | 'unknown';

/**
 * Authentication result interface for sign-in operations
 */
export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

/**
 * Pure helper function to extract user role from Supabase User object.
 * 
 * Role extraction logic:
 * 1. If user is null → 'unknown' (not authenticated)
 * 2. If user.app_metadata.role === 'admin' → 'admin'
 * 3. If authenticated but no admin role → 'user' (default authenticated role)
 * 
 * This role MUST match what the RLS policies expect:
 * - app_metadata.role = "admin" for admin write access
 * - Any authenticated user for basic read access
 * - Anonymous (anon) for public read access
 * 
 * @param user The Supabase User object or null
 * @returns The business role: 'admin', 'user', or 'unknown'
 */
export function getUserRole(user: User | null): UserRole {
  if (!user) {
    return 'unknown';
  }
  
  // Check app_metadata for role
  // Supabase stores custom claims in app_metadata
  const role = user.app_metadata?.['role'];
  
  if (role === 'admin') {
    return 'admin';
  }
  
  // Default to 'user' for any authenticated user without admin role
  return 'user';
}

/**
 * Central Supabase Authentication Service
 * 
 * This service manages all authentication operations using Supabase Auth.
 * It maintains reactive state for session, user, and role that can be
 * subscribed to throughout the application.
 * 
 * Features:
 * - Single Supabase client instance (v2)
 * - Reactive session/user/role state via BehaviorSubjects
 * - Automatic session restoration on app startup
 * - Automatic auth state synchronization via onAuthStateChange
 * - Role extraction from JWT app_metadata for RLS integration
 * 
 * Usage:
 * - Inject this service instead of creating new Supabase clients
 * - Use session$/user$/role$ observables for reactive state
 * - Use signIn/signOut for authentication operations
 */
@Injectable({
  providedIn: 'root'
})
export class SupabaseAuthService implements OnDestroy {
  // Single Supabase client instance
  private supabaseClient: SupabaseClient;
  
  // Internal state subjects
  private sessionSubject = new BehaviorSubject<Session | null>(null);
  private userSubject = new BehaviorSubject<User | null>(null);
  private roleSubject = new BehaviorSubject<UserRole>('unknown');
  private initializedSubject = new BehaviorSubject<boolean>(false);
  
  // Auth state change subscription
  private authSubscription: { unsubscribe: () => void } | null = null;

  /**
   * Observable of the current session.
   * Emits null when not authenticated.
   */
  public readonly session$: Observable<Session | null> = this.sessionSubject.asObservable();
  
  /**
   * Observable of the current user.
   * Emits null when not authenticated.
   */
  public readonly user$: Observable<User | null> = this.userSubject.asObservable();
  
  /**
   * Observable of the current user role.
   * Emits 'unknown' when not authenticated, 'user' for regular users, 'admin' for admins.
   */
  public readonly role$: Observable<UserRole> = this.roleSubject.asObservable();
  
  /**
   * Observable indicating whether the initial session check has completed.
   * Guards should wait for this to be true before making auth decisions.
   */
  public readonly initialized$: Observable<boolean> = this.initializedSubject.asObservable();

  constructor() {
    // Initialize single Supabase client with proper auth configuration
    this.supabaseClient = createClient(
      environment.supabase.url,
      environment.supabase.key,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          // Store session in localStorage for persistence across tabs
          storage: typeof window !== 'undefined' ? window.localStorage : undefined
        }
      }
    );

    // Initialize auth state
    this.initializeAuth();
  }

  ngOnDestroy(): void {
    // Cleanup auth subscription
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  /**
   * Initialize authentication state.
   * - Restores existing session from storage
   * - Sets up auth state change listener
   */
  private async initializeAuth(): Promise<void> {
    try {
      // Subscribe to auth state changes FIRST
      // This ensures we catch any changes during initialization
      const { data: { subscription } } = this.supabaseClient.auth.onAuthStateChange(
        (event: AuthChangeEvent, session: Session | null) => {
          this.handleAuthStateChange(event, session);
        }
      );
      this.authSubscription = subscription;

      // Get initial session
      const { data: { session }, error } = await this.supabaseClient.auth.getSession();
      
      if (error) {
        console.error('[SupabaseAuthService] Error getting initial session:', error);
      }

      // Update state with initial session
      this.updateAuthState(session);
      
      // Mark as initialized
      this.initializedSubject.next(true);
      
      console.log('[SupabaseAuthService] Initialized:', {
        hasSession: !!session,
        role: this.roleSubject.value
      });
    } catch (error) {
      console.error('[SupabaseAuthService] Initialization error:', error);
      this.initializedSubject.next(true); // Mark as initialized even on error
    }
  }

  /**
   * Handle auth state changes from Supabase
   */
  private handleAuthStateChange(event: AuthChangeEvent, session: Session | null): void {
    console.log('[SupabaseAuthService] Auth state changed:', event);
    
    // Update internal state
    this.updateAuthState(session);
    
    // Handle specific events if needed
    switch (event) {
      case 'SIGNED_IN':
        console.log('[SupabaseAuthService] User signed in');
        break;
      case 'SIGNED_OUT':
        console.log('[SupabaseAuthService] User signed out');
        break;
      case 'TOKEN_REFRESHED':
        console.log('[SupabaseAuthService] Token refreshed');
        break;
      case 'USER_UPDATED':
        console.log('[SupabaseAuthService] User updated');
        break;
    }
  }

  /**
   * Update internal auth state based on session
   */
  private updateAuthState(session: Session | null): void {
    const user = session?.user ?? null;
    const role = getUserRole(user);
    
    this.sessionSubject.next(session);
    this.userSubject.next(user);
    this.roleSubject.next(role);
  }

  /**
   * Get the Supabase client instance.
   * Use this to make database queries that will automatically include
   * the auth token for RLS policy evaluation.
   */
  getClient(): SupabaseClient {
    return this.supabaseClient;
  }

  /**
   * Sign in with email and password.
   * 
   * @param email User's email address
   * @param password User's password
   * @returns Promise with user, session, and any error
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await this.supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('[SupabaseAuthService] Sign in error:', error);
        return { user: null, session: null, error };
      }

      return {
        user: data.user,
        session: data.session,
        error: null
      };
    } catch (error) {
      console.error('[SupabaseAuthService] Sign in exception:', error);
      return {
        user: null,
        session: null,
        error: error as AuthError
      };
    }
  }

  /**
   * Sign out the current user.
   * Clears the session and resets all auth state.
   */
  async signOut(): Promise<void> {
    try {
      const { error } = await this.supabaseClient.auth.signOut();
      
      if (error) {
        console.error('[SupabaseAuthService] Sign out error:', error);
        throw error;
      }
      
      // State will be updated via onAuthStateChange
    } catch (error) {
      console.error('[SupabaseAuthService] Sign out exception:', error);
      // Force clear state even on error
      this.updateAuthState(null);
      throw error;
    }
  }

  /**
   * Get the current session.
   * Useful for one-time checks or when you need the session synchronously.
   */
  async getSession(): Promise<Session | null> {
    const { data: { session }, error } = await this.supabaseClient.auth.getSession();
    
    if (error) {
      console.error('[SupabaseAuthService] Error getting session:', error);
      return null;
    }
    
    return session;
  }

  /**
   * Get the current user.
   * Fetches fresh user data from Supabase.
   */
  async getUser(): Promise<User | null> {
    const { data: { user }, error } = await this.supabaseClient.auth.getUser();
    
    if (error) {
      console.error('[SupabaseAuthService] Error getting user:', error);
      return null;
    }
    
    return user;
  }

  /**
   * Get current session synchronously from cache.
   * Note: Prefer using session$ observable for reactive updates.
   */
  getCurrentSession(): Session | null {
    return this.sessionSubject.value;
  }

  /**
   * Get current user synchronously from cache.
   * Note: Prefer using user$ observable for reactive updates.
   */
  getCurrentUser(): User | null {
    return this.userSubject.value;
  }

  /**
   * Get current role synchronously from cache.
   * Note: Prefer using role$ observable for reactive updates.
   */
  getCurrentRole(): UserRole {
    return this.roleSubject.value;
  }

  /**
   * Check if user is authenticated.
   */
  isAuthenticated(): boolean {
    return this.sessionSubject.value !== null;
  }

  /**
   * Check if user is an admin.
   */
  isAdmin(): boolean {
    return this.roleSubject.value === 'admin';
  }

  /**
   * Wait for initialization to complete.
   * Returns an observable that completes when auth is ready.
   */
  waitForInit(): Observable<boolean> {
    return this.initialized$.pipe(
      filter(initialized => initialized),
      take(1)
    );
  }

  /**
   * Refresh the current session.
   * Useful when you need to ensure the token is fresh.
   */
  async refreshSession(): Promise<Session | null> {
    const { data: { session }, error } = await this.supabaseClient.auth.refreshSession();
    
    if (error) {
      console.error('[SupabaseAuthService] Error refreshing session:', error);
      return null;
    }
    
    return session;
  }

  /**
   * Reset password for email.
   * Sends a password reset email to the specified address.
   */
  async resetPassword(email: string, redirectTo?: string): Promise<{ error: AuthError | null }> {
    try {
      const options = redirectTo ? { redirectTo } : undefined;
      
      console.log('[SupabaseAuthService] Requesting password reset:', {
        email,
        redirectTo,
        hasRedirectTo: !!redirectTo
      });
      
      const { data, error } = await this.supabaseClient.auth.resetPasswordForEmail(email, options);
      
      if (error) {
        console.error('[SupabaseAuthService] resetPasswordForEmail error:', {
          message: error.message,
          name: error.name,
          status: error.status,
          redirectTo
        });
      } else {
        console.log('[SupabaseAuthService] Password reset email sent successfully');
      }
      
      return { error };
    } catch (error: any) {
      console.error('[SupabaseAuthService] resetPassword exception:', error);
      return { 
        error: {
          name: 'UnexpectedError',
          message: error?.message || 'An unexpected error occurred',
          status: error?.status || 500
        } as AuthError
      };
    }
  }

  /**
   * Update user password.
   * Requires the user to be authenticated.
   */
  async updatePassword(newPassword: string): Promise<{ error: AuthError | null }> {
    const { error } = await this.supabaseClient.auth.updateUser({
      password: newPassword
    });
    return { error };
  }

  /**
   * Get a human-readable error message from an AuthError.
   * Normalizes common error messages for display to users.
   */
  getErrorMessage(error: AuthError | null): string {
    if (!error) {
      return 'An unknown error occurred';
    }

    // Normalize common error messages
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('invalid login credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.';
    }
    
    if (message.includes('email not confirmed')) {
      return 'Please verify your email address before signing in.';
    }
    
    if (message.includes('user not found')) {
      return 'No account found with this email address.';
    }
    
    if (message.includes('too many requests')) {
      return 'Too many login attempts. Please try again later.';
    }
    
    if (message.includes('network')) {
      return 'Network error. Please check your connection and try again.';
    }

    // Return original message for unhandled cases
    return error.message || 'An error occurred during authentication';
  }
}

