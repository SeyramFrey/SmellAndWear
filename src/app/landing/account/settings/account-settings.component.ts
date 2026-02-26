import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { CustomerService } from '../../../core/services/customer.service';
import { SupabaseAuthService } from '../../../core/services/supabase-auth.service';
import { Client } from '../../../core/models/models';

@Component({
  selector: 'app-account-settings',
  templateUrl: './account-settings.component.html',
  styleUrls: ['./account-settings.component.scss']
})
export class AccountSettingsComponent implements OnInit, OnDestroy {
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  client: Client | null = null;
  loading: boolean = true;
  saving: boolean = false;
  savingPassword: boolean = false;
  successMessage: string = '';
  errorMessage: string = '';

  private destroy$ = new Subject<void>();

  constructor(
    private customerService: CustomerService,
    private authService: SupabaseAuthService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForms(): void {
    this.profileForm = this.formBuilder.group({
      prenom: ['', Validators.required],
      nom: ['', Validators.required],
      telephone: ['']
    });

    this.passwordForm = this.formBuilder.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    });
  }

  private loadData(): void {
    this.customerService.client$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(client => {
      this.client = client;
      this.loading = false;
      
      if (client) {
        this.profileForm.patchValue({
          prenom: client.prenom,
          nom: client.nom,
          telephone: client.telephone
        });
      }
    });
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) return;
    
    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    try {
      const result = await this.customerService.updateProfile({
        prenom: this.profileForm.value.prenom,
        nom: this.profileForm.value.nom,
        telephone: this.profileForm.value.telephone
      });

      if (result) {
        this.successMessage = 'Profile updated successfully!';
      } else {
        this.errorMessage = 'Failed to update profile.';
      }
    } catch (error) {
      this.errorMessage = 'An error occurred while updating your profile.';
    } finally {
      this.saving = false;
    }
  }

  async changePassword(): Promise<void> {
    if (this.passwordForm.invalid) return;
    
    const { newPassword, confirmPassword } = this.passwordForm.value;
    
    if (newPassword !== confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.savingPassword = true;
    this.successMessage = '';
    this.errorMessage = '';

    try {
      const { error } = await this.authService.updatePassword(newPassword);
      
      if (error) {
        this.errorMessage = 'Failed to change password: ' + error.message;
      } else {
        this.successMessage = 'Password changed successfully!';
        this.passwordForm.reset();
      }
    } catch (error) {
      this.errorMessage = 'An error occurred while changing your password.';
    } finally {
      this.savingPassword = false;
    }
  }
}

