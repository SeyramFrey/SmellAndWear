import { Injectable } from '@angular/core';
import { 
  CanActivate, 
  CanActivateChild,
  ActivatedRouteSnapshot, 
  RouterStateSnapshot, 
  Router 
} from '@angular/router';
import { Observable } from 'rxjs';
import { map, switchMap, take } from 'rxjs/operators';
import { SupabaseAuthService } from '../services/supabase-auth.service';

/**
 * Auth Guard - Protects routes that require authentication.
 * 
 * This guard checks if the user has an active Supabase session.
 * If not authenticated, redirects to the login page with a return URL.
 * 
 * Usage:
 * ```typescript
 * {
 *   path: 'protected',
 *   component: ProtectedComponent,
 *   canActivate: [AuthGuard]
 * }
 * ```
 * 
 * Note: This guard waits for the auth service to initialize before
 * making any decisions to avoid false negatives during app startup.
 */
@Injectable({ 
  providedIn: 'root' 
})
export class AuthGuard implements CanActivate, CanActivateChild {
  
  constructor(
    private router: Router,
    private authService: SupabaseAuthService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot, 
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkAuthentication(state.url);
  }

  canActivateChild(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkAuthentication(state.url);
  }

  /**
   * Check if user is authenticated.
   * Waits for auth initialization to complete before checking.
   */
  private checkAuthentication(returnUrl: string): Observable<boolean> {
    // Wait for auth service to initialize, then check session
    return this.authService.waitForInit().pipe(
      switchMap(() => this.authService.session$),
      take(1),
      map(session => {
        if (session) {
          // User is authenticated
          return true;
        }
        
        // Not authenticated - redirect to login
        console.log('[AuthGuard] User not authenticated, redirecting to login');
        this.router.navigate(['/auth/login'], {
          queryParams: { returnUrl },
          replaceUrl: true
        });
        return false;
      })
    );
  }
}
