import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

import { AdminAuthService } from '../../core/services/admin-auth.service';

/**
 * Reset Password Component
 * 
 * Handles ONLY password reset callbacks from Supabase.
 * This is a dedicated route for password resets - separate from invites and OAuth.
 * 
 * Route: /auth/reset-password
 * 
 * Flow:
 * 1. User receives password reset email with link to /auth/reset-password
 * 2. Parse tokens from URL hash (#access_token=...&type=recovery)
 * 3. Establish Supabase session
 * 4. Show password reset form
 * 5. After password set, redirect to login
 * 
 * Expected URL format:
 * /auth/reset-password#access_token=...&refresh_token=...&type=recovery
 */
@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  // Component state
  loading = true;
  error = '';
  showPasswordForm = false;
  passwordSubmitted = false;
  passwordLoading = false;
  resetComplete = false;

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

    // Process the reset callback
    this.processResetCallback();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Process the password reset callback from URL
   * 
   * Handles multiple URL formats:
   * - Query params: ?token_hash=xxx&type=recovery
   * - Hash params: #access_token=xxx&refresh_token=xxx&type=recovery
   */
  private async processResetCallback(): Promise<void> {
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

      console.log('[ResetPassword] Processing callback:', { 
        hasTokenHash: !!tokenHash,
        hasAccessToken: !!accessToken,
        type 
      });

      // Check for errors in URL
      if (errorParam) {
        this.error = errorDescription || errorParam;
        this.loading = false;
        return;
      }

      let session = null;

      // Case 1: Token hash flow (PKCE) - exchange token_hash for session
      if (tokenHash && typeFromQuery === 'recovery') {
        console.log('[ResetPassword] Found token_hash, verifying OTP');
        
        const { data, error } = await this.adminAuthService.getClient().auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery'
        });

        if (error) {
          console.error('[ResetPassword] verifyOtp error:', error);
          this.error = error.message || 'Failed to verify reset link. The link may have expired.';
          this.loading = false;
          return;
        }

        session = data.session;
      }
      // Case 2: Implicit flow - tokens in hash
      else if (accessToken && refreshToken) {
        console.log('[ResetPassword] Found tokens in URL hash, establishing session');
        
        const { data, error } = await this.adminAuthService.getClient().auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('[ResetPassword] setSession error:', error);
          this.error = error.message || 'Failed to establish session. The link may have expired.';
          this.loading = false;
          return;
        }

        session = data.session;
      }
      // Case 3: No tokens - check for existing session
      else {
        console.log('[ResetPassword] No tokens in URL, checking for existing session');
        
        const { data: sessionData } = await this.adminAuthService.getClient().auth.getSession();
        session = sessionData.session;
      }

      if (!session?.user) {
        this.error = 'Invalid or expired password reset link. Please request a new one.';
        this.loading = false;
        return;
      }

      // Success - show password form
      this.showPasswordForm = true;
      this.loading = false;

      console.log('[ResetPassword] Session established, showing password form');

    } catch (error: any) {
      console.error('[ResetPassword] Error:', error);
      this.error = error.message || 'An unexpected error occurred. Please try again.';
      this.loading = false;
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
        this.error = error.message || 'Failed to reset password. Please try again.';
        console.error('[ResetPassword] Password update error:', error);
        this.passwordLoading = false;
        return;
      }

      // Password reset successful
      console.log('[ResetPassword] Password reset successfully');
      
      this.showPasswordForm = false;
      this.resetComplete = true;
      this.passwordLoading = false;

    } catch (error: any) {
      console.error('[ResetPassword] Password submit error:', error);
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

