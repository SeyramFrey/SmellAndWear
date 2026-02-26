import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AdminInviteService, InviteResult } from '../../../core/services/admin-invite.service';
import { AdminAuthService } from '../../../core/services/admin-auth.service';

/**
 * Admin Users Management Component
 * 
 * Allows existing admins to:
 * - View list of current admins
 * - Invite new admins by email
 * - Remove admin access (except their own)
 * 
 * Security:
 * - Only accessible to authenticated admins (protected by AdminGuard)
 * - Invitations are processed via secure Edge Function
 * - No service_role key is exposed to frontend
 * 
 * URL: /admin/admin-users
 */
@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  // UI State
  admins: any[] = [];
  loading = true;
  inviting = false;
  
  // Messages
  successMessage = '';
  errorMessage = '';
  
  // Invite form
  inviteForm!: FormGroup;
  inviteSubmitted = false;

  // Cleanup
  private destroy$ = new Subject<void>();

  // Current user ID (to prevent self-removal)
  currentUserId: string | null = null;

  // Site URL for configuration display
  siteUrl: string = typeof window !== 'undefined' ? window.location.origin : '';

  constructor(
    private adminInviteService: AdminInviteService,
    private adminAuthService: AdminAuthService,
    private formBuilder: FormBuilder
  ) {}

  ngOnInit(): void {
    // Initialize form
    this.inviteForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]]
    });

    // Get current user ID
    this.currentUserId = this.adminAuthService.getCurrentUser()?.id || null;

    // Load admins
    this.loadAdmins();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load list of admin users
   */
  loadAdmins(): void {
    this.loading = true;
    
    this.adminInviteService.getAdmins().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (admins) => {
        this.admins = admins;
        this.loading = false;
      },
      error: (error) => {
        console.error('[AdminUsers] Error loading admins:', error);
        this.errorMessage = 'Failed to load admin users';
        this.loading = false;
      }
    });
  }

  /**
   * Handle invite form submission
   */
  onInviteSubmit(): void {
    this.inviteSubmitted = true;
    this.clearMessages();

    if (this.inviteForm.invalid) {
      return;
    }

    this.inviting = true;
    const email = this.inviteForm.get('email')?.value;

    this.adminInviteService.inviteAdmin(email).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result: InviteResult) => {
        this.inviting = false;
        
        if (result.success) {
          this.successMessage = result.message || `Invitation sent to ${email}`;
          this.inviteForm.reset();
          this.inviteSubmitted = false;
          this.loadAdmins(); // Refresh list
        } else {
          this.errorMessage = result.error || result.message;
        }
      },
      error: (error) => {
        console.error('[AdminUsers] Invite error:', error);
        this.inviting = false;
        this.errorMessage = 'An unexpected error occurred';
      }
    });
  }

  /**
   * Remove admin access
   */
  removeAdmin(userId: string): void {
    if (userId === this.currentUserId) {
      this.errorMessage = 'You cannot remove your own admin access';
      return;
    }

    if (!confirm('Are you sure you want to remove admin access for this user?')) {
      return;
    }

    this.clearMessages();

    this.adminInviteService.removeAdmin(userId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        if (result.success) {
          this.successMessage = 'Admin access removed successfully';
          this.loadAdmins();
        } else {
          this.errorMessage = result.error || 'Failed to remove admin';
        }
      },
      error: (error) => {
        console.error('[AdminUsers] Remove error:', error);
        this.errorMessage = 'Failed to remove admin access';
      }
    });
  }

  /**
   * Clear success/error messages
   */
  clearMessages(): void {
    this.successMessage = '';
    this.errorMessage = '';
  }

  // Form control getter
  get f() { return this.inviteForm.controls; }
}

