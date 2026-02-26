import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, filter, take } from 'rxjs/operators';

import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ToastService } from './toast-service';

/**
 * Admin Login Component
 * 
 * Handles admin authentication using Supabase Auth with DB verification.
 * 
 * Authentication flow:
 * 1. User enters email and password
 * 2. Credentials are sent to Supabase Auth
 * 3. On success, admin status is verified from public.admin table
 * 4. If not admin: immediate sign out and access denied
 * 5. If admin: redirect to admin dashboard
 * 
 * Security:
 * - Admin status is ALWAYS verified from database, not just JWT
 * - Non-admin users are immediately signed out
 * - No public admin signup is allowed
 */
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  // Login Form
  loginForm!: FormGroup;
  submitted = false;
  fieldTextType = false;
  error = '';
  returnUrl = '';
  loading = false;

  // Logo animation state
  isDarkLogo = false;
  private logoInterval: any;

  // Component cleanup
  private destroy$ = new Subject<void>();

  // Current year for footer
  year: number = new Date().getFullYear();

  constructor(
    private formBuilder: FormBuilder,
    private adminAuthService: AdminAuthService,
    private router: Router,
    private route: ActivatedRoute,
    public toastService: ToastService
  ) {}

  ngOnInit(): void {
    // Wait for admin auth to initialize, then check if already logged in
    this.adminAuthService.waitForInit().pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      // Check if user is already authenticated and is admin
      if (this.adminAuthService.getCurrentSession() && this.adminAuthService.isAdminSync()) {
        this.router.navigate(['/admin']);
        return;
      }
    });

    // Check for error message from callback
    const errorFromCallback = this.route.snapshot.queryParams['error'];
    if (errorFromCallback) {
      this.error = decodeURIComponent(errorFromCallback);
    }

    // Check for signup success message
    const signupStatus = this.route.snapshot.queryParams['signup'];
    if (signupStatus === 'success') {
      this.toastService.show(
        'Account created! Please check your email to verify your account.',
        { classname: 'bg-info text-white', delay: 5000 }
      );
    }

    // Initialize form
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    // Get return URL from route parameters or default to '/admin'
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin';

    // Start logo animation
    this.startLogoAnimation();
  }

  ngOnDestroy(): void {
    // Clear logo animation interval
    if (this.logoInterval) {
      clearInterval(this.logoInterval);
    }
    
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Start logo animation - switches between white and dark logos
   */
  private startLogoAnimation(): void {
    // Initial state: show white logo (for dark background)
    this.isDarkLogo = false;
    
    // Switch logos every 3 seconds
    this.logoInterval = setInterval(() => {
      this.isDarkLogo = !this.isDarkLogo;
    }, 3000);
  }

  // Convenience getter for form controls
  get f() { 
    return this.loginForm.controls; 
  }

  /**
   * Handle form submission
   * 
   * Uses AdminAuthService which:
   * 1. Authenticates with Supabase
   * 2. Verifies admin status from public.admin table
   * 3. Signs out non-admin users immediately
   */
  async onSubmit(): Promise<void> {
    this.submitted = true;
    this.error = '';

    // Stop if form is invalid
    if (this.loginForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    this.loading = true;

    try {
      const email = this.f['email'].value;
      const password = this.f['password'].value;

      // Sign in with AdminAuthService (verifies admin status from DB)
      const result = await this.adminAuthService.signIn(email, password);

      if (result.error) {
        // Get user-friendly error message
        this.error = this.adminAuthService.getErrorMessage(result.error);
        
        // Log technical error for debugging
        console.error('[LoginComponent] Authentication error:', result.error);
        
        this.toastService.show(
          this.error,
          { classname: 'bg-danger text-white', delay: 5000 }
        );
        return;
      }

      if (result.isAdmin && result.user && result.session) {
        // Success - admin verified from database
        this.toastService.show(
          'Welcome back, Administrator!',
          { classname: 'bg-success text-white', delay: 3000 }
        );

        // Navigate to return URL or admin dashboard
        setTimeout(() => {
          this.router.navigate([this.returnUrl]);
        }, 500);
      } else {
        // This shouldn't happen as AdminAuthService handles non-admin case
        // But handle it just in case
        this.error = 'Access denied. You are not authorized as an administrator.';
        
        this.toastService.show(
          this.error,
          { classname: 'bg-warning text-dark', delay: 5000 }
        );
      }
    } catch (error) {
      console.error('[LoginComponent] Unexpected error:', error);
      this.error = 'An unexpected error occurred. Please try again.';
      
      this.toastService.show(
        this.error,
        { classname: 'bg-danger text-white', delay: 5000 }
      );
    } finally {
      this.loading = false;
    }
  }

  /**
   * Mark all form fields as touched to trigger validation display
   */
  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach(key => {
      this.loginForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Toggle password visibility
   */
  toggleFieldTextType(): void {
    this.fieldTextType = !this.fieldTextType;
  }
}
