import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';

import { SupabaseAuthService } from '../../core/services/supabase-auth.service';
import { environment } from '../../../environments/environment';

/**
 * Forgot Password Component
 * 
 * Allows users to request a password reset email.
 * 
 * Route: /auth/forgot-password
 * 
 * Flow:
 * 1. User enters their email address
 * 2. System sends password reset email via Supabase
 * 3. Email contains link to /auth/reset-password with tokens
 * 4. Show generic success message (don't reveal if email exists)
 * 
 * Security:
 * - Generic success message to prevent email enumeration
 * - Rate limiting handled by Supabase
 * - Redirect URL is environment-aware (dev/prod)
 */
@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent implements OnInit, OnDestroy {
  // Form state
  resetForm!: FormGroup;
  submitted = false;
  loading = false;
  error = '';
  
  // Success state
  emailSent = false;
  emailAddress = '';
  
  // Current year for footer
  year: number = new Date().getFullYear();
  
  // Component cleanup
  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private authService: SupabaseAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initialize form
    this.resetForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Convenience getter for form controls
  get f() { 
    return this.resetForm.controls; 
  }

  /**
   * Handle form submission
   * 
   * Sends password reset email with redirect URL
   */
  async onSubmit(): Promise<void> {
    this.submitted = true;
    this.error = '';

    // Stop if form is invalid
    if (this.resetForm.invalid) {
      return;
    }

    this.loading = true;

    try {
      const email = this.f['email'].value;
      
      // Construct redirect URL based on environment
      const redirectTo = `${environment.siteUrl}/auth/reset-password`;

      console.log('[ForgotPassword] Sending reset email to:', email);
      console.log('[ForgotPassword] Redirect URL:', redirectTo);

      // Send password reset email
      const { error } = await this.authService.resetPassword(email, redirectTo);

      if (error) {
        console.error('[ForgotPassword] Reset password error:', error);
        console.error('[ForgotPassword] Error details:', {
          message: error.message,
          name: error.name,
          status: error.status
        });
        
        // Handle specific error types
        const errorMessage = error.message?.toLowerCase() || '';
        
        if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
          this.error = 'Too many requests. Please wait a few minutes and try again.';
        } else if (errorMessage.includes('smtp') || errorMessage.includes('email') || errorMessage.includes('535')) {
          // SMTP/Email configuration error - show admin-friendly message
          console.error('[ForgotPassword] SMTP/Email configuration issue detected');
          this.error = 'Email service is temporarily unavailable. Please contact support or try again later.';
        } else if (errorMessage.includes('invalid') && errorMessage.includes('redirect')) {
          // Redirect URL not whitelisted
          console.error('[ForgotPassword] Redirect URL not whitelisted:', redirectTo);
          this.error = 'Configuration error: Redirect URL not whitelisted. Please contact support.';
        } else {
          // Generic error - still show success for security, but log the error
          console.error('[ForgotPassword] Unknown error:', error);
        }
        
        // For security, show generic success message unless it's a rate limit error
        // This prevents email enumeration attacks
        if (!this.error || this.error.includes('temporarily unavailable')) {
          this.emailAddress = email;
          this.emailSent = true;
          // Clear error if we're showing success message
          if (this.error.includes('temporarily unavailable')) {
            this.error = '';
          }
        }
      } else {
        // Success
        console.log('[ForgotPassword] Password reset email sent successfully');
        this.emailAddress = email;
        this.emailSent = true;
      }

    } catch (error: any) {
      console.error('[ForgotPassword] Unexpected error:', error);
      
      // Generic success message for security
      this.emailAddress = this.f['email'].value;
      this.emailSent = true;
      
    } finally {
      this.loading = false;
    }
  }

  /**
   * Navigate back to login page
   */
  backToLogin(): void {
    this.router.navigate(['/auth/login']);
  }

  /**
   * Resend reset email
   */
  resendEmail(): void {
    this.emailSent = false;
    this.submitted = false;
    this.error = '';
  }
}
