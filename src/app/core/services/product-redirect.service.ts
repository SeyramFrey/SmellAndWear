import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface ProductRedirectResponse {
  redirectUrl: string | null;
  reason: 'visible' | 'hidden' | 'not_found' | 'no_category' | 'missing_param' | 'error';
}

@Injectable({
  providedIn: 'root'
})
export class ProductRedirectService {
  private readonly baseUrl = `${environment.supabase.url}/functions/v1/product-category-redirect`;

  constructor(private http: HttpClient) {}

  /**
   * Get redirect URL for a product (when it may be hidden/scheduled/unpublished).
   * Returns redirect URL or null if product is visible.
   */
  getRedirectForProduct(productId: string): Observable<ProductRedirectResponse> {
    return this.http.get<ProductRedirectResponse>(`${this.baseUrl}?id=${encodeURIComponent(productId)}`, {
      headers: {
        'apikey': environment.supabase.key,
        'Authorization': `Bearer ${environment.supabase.key}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      catchError(() => of({ redirectUrl: '/wear', reason: 'error' as const }))
    );
  }
}
