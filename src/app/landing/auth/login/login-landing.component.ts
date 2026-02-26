import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SupabaseAuthService } from '../../../core/services/supabase-auth.service';
import { CustomerService } from '../../../core/services/customer.service';
import { FavoritesService } from '../../../core/services/favorites.service';

/**
 * Login Component for Storefront
 * 
 * Handles customer login for the e-commerce storefront.
 * On successful login:
 * 1. Session is established via SupabaseAuthService
 * 2. Customer record is loaded via CustomerService
 * 3. Local favorites are synced to database via FavoritesService
 */
@Component({
  selector: 'app-login-landing',
  templateUrl: './login-landing.component.html',
  styleUrls: ['./login-landing.component.scss']
})
export class LoginLandingComponent implements OnInit, OnDestroy {
  loginForm!: FormGroup;
  submitted = false;
  loading = false;
  error = '';
  success = '';
  fieldTextType = false;
  returnUrl = '';

  private destroy$ = new Subject<void>();
  year: number = new Date().getFullYear();

  constructor(
    private formBuilder: FormBuilder,
    private authService: SupabaseAuthService,
    private customerService: CustomerService,
    private favoritesService: FavoritesService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Check if already logged in
    this.authService.waitForInit().pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      if (this.authService.isAuthenticated()) {
        this.router.navigate(['/account']);
        return;
      }
    });

    // Initialize form
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });

    // Get return URL
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/account';

    // Check for signup success message
    if (this.route.snapshot.queryParams['signup'] === 'success') {
      this.success = 'Account created successfully! Please login.';
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get f() {
    return this.loginForm.controls;
  }

  async onSubmit(): Promise<void> {
    this.submitted = true;
    this.error = '';
    this.success = '';

    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;

    try {
      const email = this.f['email'].value;
      const password = this.f['password'].value;

      // Sign in with Supabase Auth
      const result = await this.authService.signIn(email, password);

      if (result.error) {
        this.error = this.authService.getErrorMessage(result.error);
        console.error('[LoginLanding] Auth error:', result.error);
        return;
      }

      if (result.user && result.session) {
        console.log('[LoginLanding] Login successful');
        
        // Wait for customer service to load client data
        await this.waitForCustomerData();
        
        // Favorites will be synced automatically by FavoritesService
        
        // Navigate to return URL or account page
        this.router.navigate([this.returnUrl]);
      }
    } catch (error) {
      console.error('[LoginLanding] Unexpected error:', error);
      this.error = 'An unexpected error occurred. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  /**
   * Wait for customer data to be loaded
   */
  private waitForCustomerData(): Promise<void> {
    return new Promise(resolve => {
      this.customerService.waitForInit().pipe(
        takeUntil(this.destroy$)
      ).subscribe(() => {
        // Give a small delay for data to propagate
        setTimeout(resolve, 200);
      });
      
      // Timeout fallback
      setTimeout(resolve, 2000);
    });
  }

  toggleFieldTextType(): void {
    this.fieldTextType = !this.fieldTextType;
  }

  navigateToSignup(): void {
    this.router.navigate(['/customer/signup'], {
      queryParams: { returnUrl: this.returnUrl }
    });
  }

  navigateToForgotPassword(): void {
    this.router.navigate(['/customer/forgot-password']);
  }
}

