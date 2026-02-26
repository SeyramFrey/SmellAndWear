import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { SupabaseAuthService } from '../services/supabase-auth.service';

/**
 * JWT Interceptor
 * 
 * Note: Supabase JS client automatically handles JWT tokens for its API calls.
 * This interceptor is mainly for non-Supabase HTTP requests that may need
 * authentication headers.
 * 
 * For Supabase operations, always use the Supabase client from SupabaseService
 * which automatically includes the auth token.
 */
@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  constructor(
    private authService: SupabaseAuthService,
    public router: Router
  ) { }

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    // Supabase handles its own auth headers via the JS client
    // This interceptor can be extended for non-Supabase API calls if needed
    
    return next.handle(request).pipe(
      catchError((error) => {
        if (error.status === 401) {
          console.warn('[JwtInterceptor] 401 Unauthorized');
          this.router.navigate(['/auth/login']);
        }
        return throwError(() => error);
      })
    );
  }
}
