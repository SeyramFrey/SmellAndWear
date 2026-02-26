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
 * Client Guard - Protects routes that are specifically for client users.
 * 
 * This guard ensures:
 * 1. User is authenticated
 * 2. User role is 'user' (client), NOT 'admin'
 * 
 * Admins are redirected to the admin dashboard.
 * Non-authenticated users are redirected to customer login.
 */
@Injectable({ 
  providedIn: 'root' 
})
export class ClientGuard implements CanActivate, CanActivateChild {
  
  constructor(
    private router: Router,
    private authService: SupabaseAuthService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot, 
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkClientAccess(state.url);
  }

  canActivateChild(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.checkClientAccess(state.url);
  }

  /**
   * Check if user is an authenticated client (not admin).
   */
  private checkClientAccess(returnUrl: string): Observable<boolean> {
    return this.authService.waitForInit().pipe(
      switchMap(() => this.authService.session$),
      take(1),
      map(session => {
        if (!session) {
          // Not authenticated - redirect to customer login
          console.log('[ClientGuard] User not authenticated, redirecting to customer login');
          this.router.navigate(['/customer/login'], {
            queryParams: { returnUrl },
            replaceUrl: true
          });
          return false;
        }
        
        // Check user role
        const userRole = this.authService.getCurrentRole();
        
        if (userRole === 'admin') {
          // Admin users should not access client account pages
          console.log('[ClientGuard] Admin user trying to access client area, redirecting to admin');
          this.router.navigate(['/admin'], { replaceUrl: true });
          return false;
        }
        
        // User is authenticated as a client
        return true;
      })
    );
  }
}

