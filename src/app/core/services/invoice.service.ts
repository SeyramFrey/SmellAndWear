import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';

export interface InvoiceGenerateResult {
  order_id: string;
  invoice_pdf_path: string;
  signed_url: string | null;
  regenerated: boolean;
}

export interface InvoiceSendResult {
  ok: boolean;
  order_id: string;
  order_number: string;
  email_sent_to: string;
  invoice_last_sent_at: string;
  resend_id?: string;
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  constructor(private supabaseService: SupabaseService) {}

  /**
   * Generate (or retrieve) an invoice PDF for an order.
   * Calls the invoice-generate Edge Function (admin-only).
   */
  generateInvoice(orderId: string, forceRegenerate = false): Observable<InvoiceGenerateResult> {
    return from(
      this.supabaseService.getClient().functions.invoke('invoice-generate', {
        body: { order_id: orderId, force_regenerate: forceRegenerate },
      })
    ).pipe(
      switchMap((response: any) => {
        if (response.error) {
          return from(this.extractError(response)).pipe(
            switchMap(msg => throwError(() => new Error(msg)))
          );
        }
        return from([response.data as InvoiceGenerateResult]);
      }),
      catchError(err => {
        if (err instanceof Error) return throwError(() => err);
        return throwError(() => new Error('Invoice generation failed'));
      })
    );
  }

  /**
   * Generate (if needed) and send invoice email to the customer.
   * Calls the invoice-send Edge Function (admin-only).
   */
  sendInvoice(orderId: string, regenerate = false): Observable<InvoiceSendResult> {
    return from(
      this.supabaseService.getClient().functions.invoke('invoice-send', {
        body: { order_id: orderId, regenerate },
      })
    ).pipe(
      switchMap((response: any) => {
        if (response.error) {
          return from(this.extractError(response)).pipe(
            switchMap(msg => throwError(() => new Error(msg)))
          );
        }
        return from([response.data as InvoiceSendResult]);
      }),
      catchError(err => {
        if (err instanceof Error) return throwError(() => err);
        return throwError(() => new Error('Invoice sending failed'));
      })
    );
  }

  private async extractError(response: any): Promise<string> {
    if (response.data?.error) return response.data.error;
    const ctx = response.error?.context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body?.error) return body.error;
      } catch { /* fall through */ }
    }
    return response.error?.message || 'Unknown error';
  }
}
