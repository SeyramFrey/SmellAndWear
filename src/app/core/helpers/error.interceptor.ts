import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { SupabaseAuthService } from '../services/supabase-auth.service';

/**
 * HTTP Error Interceptor
 * 
 * Handles HTTP errors globally and performs appropriate actions:
 * - 401 Unauthorized: Signs out user and redirects to login
 * - Other errors: Rethrows for component-level handling
 * 
 * Note: Supabase JS client handles its own auth headers and 401s,
 * so this interceptor mainly catches non-Supabase HTTP requests.
 */
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {

  constructor(
    private authService: SupabaseAuthService,
    private router: Router
  ) { }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError(err => {
        if (err.status === 401) {
          // Auto logout on 401 response
          console.warn('[ErrorInterceptor] 401 Unauthorized - signing out user');
          
          this.authService.signOut().then(() => {
            this.router.navigate(['/auth/login']);
          }).catch(error => {
            console.error('[ErrorInterceptor] Error during sign out:', error);
            this.router.navigate(['/auth/login']);
          });
        }
        
        // Extract error message
        const error = err.error?.message || err.statusText || 'An error occurred';
        return throwError(() => new Error(error));
      })
    );
  }
}
