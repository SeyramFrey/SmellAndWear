import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SupabaseAuthService } from '../../../core/services/supabase-auth.service';
import { CustomerService } from '../../../core/services/customer.service';

/**
 * Signup Component for Storefront
 * 
 * Handles customer registration for the e-commerce storefront.
 * On successful signup:
 * 1. User is created in Supabase Auth
 * 2. Customer record is created/linked in the client table
 * 3. If there's a pending guest order email, accounts are linked
 */
@Component({
  selector: 'app-signup-landing',
  templateUrl: './signup-landing.component.html',
  styleUrls: ['./signup-landing.component.scss']
})
export class SignupLandingComponent implements OnInit, OnDestroy {
  signupForm!: FormGroup;
  submitted = false;
  loading = false;
  error = '';
  fieldTextType = false;
  fieldTextTypeConfirm = false;
  returnUrl = '';
  pendingGuestEmail: string | null = null;

  private destroy$ = new Subject<void>();
  year: number = new Date().getFullYear();

  // Phone input with country code
  phoneCountries = [
    { code: '+33', country: 'FR', flag: '🇫🇷', name: 'France', placeholder: '6 12 34 56 78' },
    { code: '+225', country: 'CI', flag: '🇨🇮', name: "Côte d'Ivoire", placeholder: '07 00 00 00 00' }
  ];
  selectedPhoneCountry = this.phoneCountries[0]; // Default to France

  constructor(
    private formBuilder: FormBuilder,
    private authService: SupabaseAuthService,
    private customerService: CustomerService,
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

    // Check for pending guest email
    this.pendingGuestEmail = this.customerService.getPendingGuestEmail();

    // Initialize form
    this.signupForm = this.formBuilder.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: [this.pendingGuestEmail || '', [Validators.required, Validators.email]],
      phone: [''],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    }, {
      validators: this.passwordMatchValidator
    });

    // Get return URL
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/account';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get f() {
    return this.signupForm.controls;
  }

  /**
   * Custom validator to check password match
   */
  passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    return null;
  }

  async onSubmit(): Promise<void> {
    this.submitted = true;
    this.error = '';

    if (this.signupForm.invalid) {
      return;
    }

    this.loading = true;

    try {
      const email = this.f['email'].value;
      const password = this.f['password'].value;
      const firstName = this.f['firstName'].value;
      const lastName = this.f['lastName'].value;
      const phone = this.getFullPhoneNumber(); // Get phone with country code

      // Create user in Supabase Auth
      const client = this.authService.getClient();
      const { data, error: signUpError } = await client.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName
          }
        }
      });

      if (signUpError) {
        this.error = this.getSignUpErrorMessage(signUpError);
        console.error('[SignupLanding] Auth error:', signUpError);
        return;
      }

      if (data.user) {
        console.log('[SignupLanding] User created in Auth');

        // Create or link customer record
        const customerResult = await this.customerService.createClient({
          email,
          nom: lastName,
          prenom: firstName,
          telephone: phone || undefined
        });

        if (customerResult) {
          console.log('[SignupLanding] Customer record created/linked');
          
          // Clear pending guest email
          this.customerService.clearPendingGuestEmail();
        }

        // Check if email confirmation is required
        if (data.session) {
          // Auto-confirmed - redirect to account
          this.router.navigate([this.returnUrl]);
        } else {
          // Email confirmation required - redirect to login with message
          this.router.navigate(['/customer/login'], {
            queryParams: { 
              signup: 'success',
              email: email
            }
          });
        }
      }
    } catch (error) {
      console.error('[SignupLanding] Unexpected error:', error);
      this.error = 'An unexpected error occurred. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  /**
   * Get user-friendly error message for signup errors
   */
  private getSignUpErrorMessage(error: any): string {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('already registered') || message.includes('already exists')) {
      return 'An account with this email already exists. Please login instead.';
    }

    if (message.includes('invalid email')) {
      return 'Please enter a valid email address.';
    }

    if (message.includes('password')) {
      return 'Password must be at least 6 characters long.';
    }

    return error.message || 'Failed to create account. Please try again.';
  }

  toggleFieldTextType(): void {
    this.fieldTextType = !this.fieldTextType;
  }

  toggleFieldTextTypeConfirm(): void {
    this.fieldTextTypeConfirm = !this.fieldTextTypeConfirm;
  }

  navigateToLogin(): void {
    this.router.navigate(['/customer/login'], {
      queryParams: { returnUrl: this.returnUrl }
    });
  }

  /**
   * Handle phone country selection
   */
  onPhoneCountryChange(countryCode: string): void {
    const country = this.phoneCountries.find(c => c.code === countryCode);
    if (country) {
      this.selectedPhoneCountry = country;
      // Clear phone field when country changes
      this.signupForm.get('phone')?.setValue('');
    }
  }

  /**
   * Format phone number as user types
   */
  formatPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); // Remove non-digits
    
    // Format based on country
    if (this.selectedPhoneCountry.country === 'FR') {
      // French format: 6 12 34 56 78 (groups of 2)
      value = value.slice(0, 10); // Max 10 digits
      const formatted = value.replace(/(\d{1,2})(?=\d)/g, '$1 ').trim();
      input.value = formatted;
    } else if (this.selectedPhoneCountry.country === 'CI') {
      // Ivorian format: 07 00 00 00 00 (groups of 2)
      value = value.slice(0, 10); // Max 10 digits
      const formatted = value.replace(/(\d{1,2})(?=\d)/g, '$1 ').trim();
      input.value = formatted;
    }
    
    // Update form control
    this.signupForm.get('phone')?.setValue(input.value);
  }

  /**
   * Get full phone number with country code
   */
  getFullPhoneNumber(): string {
    const phoneValue = this.signupForm.get('phone')?.value;
    if (!phoneValue) return '';
    
    const digitsOnly = phoneValue.replace(/\D/g, '');
    return `${this.selectedPhoneCountry.code}${digitsOnly}`;
  }
}

