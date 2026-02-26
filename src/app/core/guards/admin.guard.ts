import { Injectable } from '@angular/core';
import { 
  CanActivate, 
  CanActivateChild, 
  ActivatedRouteSnapshot, 
  RouterStateSnapshot, 
  Router 
} from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { AdminAuthService } from '../services/admin-auth.service';

/**
 * Admin Guard - Protects routes that require admin privileges.
 * 
 * This guard checks if the user:
 * 1. Is authenticated (has a valid Supabase session)
 * 2. Is present in the public.admin table (verified from DB, not just JWT)
 * 
 * Security Model:
 * - Admin status is ALWAYS verified from the database
 * - This prevents unauthorized access even if JWT is compromised
 * - Non-admin users are redirected to login
 * 
 * Usage:
 * ```typescript
 * {
 *   path: 'admin',
 *   component: AdminComponent,
 *   canActivate: [AdminGuard]
 * }
 * ```
 * 
 * Redirect behavior:
 * - Not authenticated → /auth/login
 * - Authenticated but not in public.admin → /auth/login with error
 */
@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate, CanActivateChild {

  constructor(
    private adminAuthService: AdminAuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkAdminAuthorization(state.url);
  }

  canActivateChild(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkAdminAuthorization(state.url);
  }

  /**
   * Check admin authorization.
   * Waits for AdminAuthService initialization, then checks both session and admin status.
   * Admin status is verified from public.admin table, not just JWT claims.
   */
  private checkAdminAuthorization(returnUrl: string): Observable<boolean> {
    return this.adminAuthService.waitForInit().pipe(
      switchMap(() => this.adminAuthService.session$),
      take(1),
      switchMap(session => {
        // First check: Is user authenticated?
        if (!session) {
          console.log('[AdminGuard] No session, redirecting to login');
          this.redirectToLogin(returnUrl);
          return of(false);
        }

        // Second check: Is user in admin table? (DB verification)
        return this.adminAuthService.isAdmin$.pipe(
          take(1),
          map(isAdmin => {
            if (isAdmin) {
              console.log('[AdminGuard] Admin access granted (verified from DB)');
              return true;
            }

            // User is authenticated but not in admin table
            console.log('[AdminGuard] Access denied - user not in admin table');
            this.redirectToLoginWithError(returnUrl);
            return false;
          })
        );
      })
    );
  }

  /**
   * Redirect to login page with return URL
   */
  private redirectToLogin(returnUrl: string): void {
    this.router.navigate(['/auth/login'], {
      queryParams: { returnUrl },
      replaceUrl: true
    });
  }

  /**
   * Redirect to login page with access denied error
   */
  private redirectToLoginWithError(returnUrl: string): void {
    // Sign out the non-admin user
    this.adminAuthService.signOut().then(() => {
      this.router.navigate(['/auth/login'], {
        queryParams: { 
          returnUrl,
          error: 'Access denied. You are not authorized as an administrator.'
        },
        replaceUrl: true
      });
    });
  }
}
