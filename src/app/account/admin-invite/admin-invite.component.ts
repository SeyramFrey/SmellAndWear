import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AdminAuthService } from '../../core/services/admin-auth.service';

/**
 * Admin Invite Component
 * 
 * Handles ONLY admin invitation callbacks from Supabase.
 * This is a dedicated route for admin invites - separate from OAuth/signup callbacks.
 * 
 * Route: /auth/invite
 * 
 * Flow:
 * 1. Admin receives invite email with link to /auth/invite
 * 2. Parse tokens from URL hash (#access_token=...&type=invite)
 * 3. Establish Supabase session
 * 4. Show password setup form
 * 5. After password set, verify admin status and redirect to /admin
 * 
 * Expected URL format:
 * /auth/invite#access_token=...&refresh_token=...&type=invite
 */
@Component({
  selector: 'app-admin-invite',
  templateUrl: './admin-invite.component.html',
  styleUrls: ['./admin-invite.component.scss']
})
export class AdminInviteComponent implements OnInit, OnDestroy {
  // Component state
  loading = true;
  error = '';
  showPasswordForm = false;
  passwordSubmitted = false;
  passwordLoading = false;
  sessionEstablished = false;

  // Password form
  passwordForm!: FormGroup;

  // Current year for footer
  year: number = new Date().getFullYear();

  // For cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private adminAuthService: AdminAuthService,
    private formBuilder: FormBuilder,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initialize password form
    this.passwordForm = this.formBuilder.group({
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        this.passwordStrengthValidator
      ]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });

    // Process the invite callback
    this.processInviteCallback();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Process the admin invitation callback from URL
   * 
   * Supabase invitation links can come in different formats depending on email settings:
   * 
   * Format 1 (PKCE/Token Hash):
   *   URL: /auth/invite?token_hash=xxx&type=invite
   *   → Need to call verifyOtp to exchange token_hash for session
   * 
   * Format 2 (Implicit/Hash):
   *   URL: /auth/invite#access_token=xxx&refresh_token=xxx&type=invite
   *   → Need to call setSession with tokens
   * 
   * Format 3 (Session already established):
   *   URL: /auth/invite (no params)
   *   → Session already in cookies, just check for it
   * 
   * We handle all these cases to ensure the invite flow works regardless of Supabase config.
   */
  private async processInviteCallback(): Promise<void> {
    try {
      // Check query params (for token_hash flow)
      const urlParams = new URLSearchParams(window.location.search);
      const tokenHash = urlParams.get('token_hash');
      const typeFromQuery = urlParams.get('type');
      
      // Check hash params (for implicit flow)
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.replace('#', ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const typeFromHash = hashParams.get('type');
      const errorParam = hashParams.get('error') || urlParams.get('error');
      const errorDescription = hashParams.get('error_description') || urlParams.get('error_description');

      const type = typeFromHash || typeFromQuery;

      console.log('[AdminInvite] Processing callback:', { 
        hasTokenHash: !!tokenHash,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        type,
        url: window.location.href
      });

      // Check for errors in URL
      if (errorParam) {
        this.error = errorDescription || errorParam;
        this.loading = false;
        return;
      }

      let session = null;

      // Case 1: Token hash flow (PKCE) - exchange token_hash for session
      if (tokenHash && typeFromQuery) {
        console.log('[AdminInvite] Found token_hash, verifying OTP');
        
        const { data, error } = await this.adminAuthService.getClient().auth.verifyOtp({
          token_hash: tokenHash,
          type: typeFromQuery as any
        });

        if (error) {
          console.error('[AdminInvite] verifyOtp error:', error);
          this.error = error.message || 'Failed to verify invitation. The link may have expired.';
          this.loading = false;
          return;
        }

        session = data.session;
      }
      // Case 2: Implicit flow - tokens in hash
      else if (accessToken && refreshToken) {
        console.log('[AdminInvite] Found tokens in URL hash, establishing session');
        
        const { data, error } = await this.adminAuthService.getClient().auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('[AdminInvite] setSession error:', error);
          this.error = error.message || 'Failed to establish session. The link may have expired.';
          this.loading = false;
          return;
        }

        session = data.session;
      }
      // Case 3: No tokens in URL - check for existing session (page refresh or SSR)
      else {
        console.log('[AdminInvite] No tokens in URL, checking for existing session');
        
        const { data: sessionData } = await this.adminAuthService.getClient().auth.getSession();
        session = sessionData.session;
      }

      if (!session?.user) {
        console.log('[AdminInvite] No session found');
        this.error = 'Invalid or expired invitation link. Please request a new invitation from an administrator.';
        this.loading = false;
        return;
      }

      console.log('[AdminInvite] Session found for user:', session.user.email);

      // Verify user is in admin table
      const isAdmin = await this.checkAdminStatus(session.user.id);
      
      if (!isAdmin) {
        console.log('[AdminInvite] User is not in admin table');
        await this.adminAuthService.signOut();
        this.error = 'Access denied. You are not authorized as an administrator. Please contact an existing admin to receive an invitation.';
        this.loading = false;
        return;
      }

      // Check if user needs to set password
      // Invited users typically need to set their password on first login
      const needsPassword = type === 'invite' || type === 'recovery' || this.isNewUser(session.user);

      if (needsPassword) {
        // Success - show password form
        this.sessionEstablished = true;
        this.showPasswordForm = true;
        this.loading = false;
        console.log('[AdminInvite] Session established, showing password form');
      } else {
        // User already has password set, redirect to admin
        console.log('[AdminInvite] User already set up, redirecting to admin');
        this.router.navigate(['/admin'], { replaceUrl: true });
      }

    } catch (error: any) {
      console.error('[AdminInvite] Error:', error);
      this.error = error.message || 'An unexpected error occurred. Please try again.';
      this.loading = false;
    }
  }

  /**
   * Check if user is a new user who hasn't set up their account
   */
  private isNewUser(user: any): boolean {
    // New invited users typically have:
    // - No last_sign_in_at or it's very recent (same as created_at)
    // - email_confirmed_at set by the invite process
    if (!user.last_sign_in_at) {
      return true;
    }
    
    const createdAt = new Date(user.created_at).getTime();
    const lastSignIn = new Date(user.last_sign_in_at).getTime();
    
    // If last sign in is within 5 minutes of creation, probably first time
    return (lastSignIn - createdAt) < 5 * 60 * 1000;
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
        console.error('[AdminInvite] Admin check error:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('[AdminInvite] Admin check exception:', error);
      return false;
    }
  }

  /**
   * Handle password form submission
   */
  async onPasswordSubmit(): Promise<void> {
    this.passwordSubmitted = true;
    this.error = '';

    if (this.passwordForm.invalid) {
      return;
    }

    this.passwordLoading = true;

    try {
      const newPassword = this.passwordForm.get('password')?.value;

      // Update password
      const { error } = await this.adminAuthService.updatePassword(newPassword);

      if (error) {
        this.error = error.message || 'Failed to set password. Please try again.';
        console.error('[AdminInvite] Password update error:', error);
        this.passwordLoading = false;
        return;
      }

      // Password set successfully - refresh admin status and redirect
      await this.adminAuthService.refreshAdminStatus();

      console.log('[AdminInvite] Password set successfully, redirecting to admin');
      
      // Redirect to admin dashboard
      this.router.navigate(['/admin'], { replaceUrl: true });

    } catch (error: any) {
      console.error('[AdminInvite] Password submit error:', error);
      this.error = error.message || 'An unexpected error occurred. Please try again.';
      this.passwordLoading = false;
    }
  }

  /**
   * Navigate to login page
   */
  goToLogin(): void {
    this.router.navigate(['/auth/login'], { replaceUrl: true });
  }

  // Form control getters
  get f() { return this.passwordForm.controls; }

  /**
   * Custom validator for password strength
   */
  private passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;

    if (!value) {
      return null;
    }

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumeric = /[0-9]/.test(value);

    const valid = hasUpperCase && hasLowerCase && hasNumeric;

    if (!valid) {
      return { 
        passwordStrength: 'Password must contain uppercase, lowercase, and numbers' 
      };
    }

    return null;
  }

  /**
   * Validator to check if passwords match
   */
  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;

    if (password && confirmPassword && password !== confirmPassword) {
      return { passwordMismatch: true };
    }

    return null;
  }
}

