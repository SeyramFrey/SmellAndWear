import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { PaymentProvider, PaymentInitiationResponse } from './payment.service';
import { SupabaseService } from './supabase.service';

export interface ServerSidePaymentRequest {
  order_id: string;
  email: string;
  locale: string;           // 'FR' | 'CI'
  shipping_zone_code?: string;
  express_delivery: boolean;
  callback_url: string;
}

export interface PaystackVerifyResult {
  status: 'success' | 'failed' | string;
  order_id?: string;
  order_number?: string;
  already_processed?: boolean;
  order?: any;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaystackService implements PaymentProvider {

  constructor(
    private supabaseService: SupabaseService
  ) {}

  /**
   * Server-side payment initialization (v2).
   *
   * The client sends ONLY: order_id, email, locale, shipping info.
   * The Edge Function fetches product prices from DB, computes the total
   * server-side, converts currencies, and calls Paystack.
   *
   * No amount or currency is sent from the client.
   */
  initiateServerSidePayment(request: ServerSidePaymentRequest): Observable<PaymentInitiationResponse> {
    return from(
      this.supabaseService.getClient().functions.invoke('paystack-initialize', {
        body: {
          order_id: request.order_id,
          email: request.email,
          locale: request.locale,
          shipping_zone_code: request.shipping_zone_code,
          express_delivery: request.express_delivery,
          callback_url: request.callback_url,
        }
      })
    ).pipe(
      switchMap((response: any) => {
        if (response.error) {
          return from(this.extractEdgeFunctionError(response)).pipe(
            switchMap(errorDetail => {
              console.error('[PaystackService] Edge Function error:', errorDetail.message);
              return throwError(() => new PaystackInitError(
                errorDetail.message,
                errorDetail.field,
                errorDetail.details,
              ));
            })
          );
        }

        const data = response.data;
        if (!data || !data.authorization_url) {
          console.error('[PaystackService] Invalid response — no authorization_url:', data);
          return throwError(() => new PaystackInitError(
            'Invalid response from payment server: no authorization URL',
          ));
        }

        return from([{
          authorization_url: data.authorization_url,
          authorizationUrl: data.authorization_url,
          reference: data.reference,
          accessCode: data.access_code,
          displayed_amount: data.displayed_total,
          displayed_currency: data.displayed_currency,
          pay_amount: data.total_xof_major,
          pay_currency: 'XOF',
          fx_rate: data.fx_rate,
        } as PaymentInitiationResponse]);
      }),
      catchError(error => {
        if (error instanceof PaystackInitError) return throwError(() => error);
        console.error('[PaystackService] Unexpected error:', error);
        return throwError(() => new PaystackInitError(
          error.message || 'An unexpected error occurred during payment initialization',
        ));
      })
    );
  }

  private async extractEdgeFunctionError(
    response: any
  ): Promise<{ message: string; field?: string; details?: any }> {
    if (response.data && typeof response.data === 'object' && response.data.error) {
      return {
        message: response.data.error,
        field: response.data.field,
        details: response.data,
      };
    }
    const ctx = response.error?.context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body && body.error) {
          return { message: body.error, field: body.field, details: body };
        }
      } catch { /* fall through */ }
    }
    return {
      message: response.error?.message || 'Payment initialization failed (unknown error)',
    };
  }

  handleReturn(params: any): Observable<{ success: boolean; orderId?: string; reference?: string }> {
    const reference = params.reference || params.trxref;
    if (!reference) {
      return throwError(() => new Error('Payment reference not found in return parameters'));
    }
    return this.verifyPayment(reference).pipe(
      map((result: PaystackVerifyResult) => ({
        success: result.status === 'success',
        orderId: result.order_id,
        reference,
      })),
      catchError(error => {
        console.error('[PaystackService] Payment verification error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Verify payment and finalize order (v2).
   * The Edge Function verifies with Paystack, validates amounts,
   * generates order_number, and updates order status to PAID.
   */
  verifyPayment(reference: string): Observable<PaystackVerifyResult> {
    return from(
      this.supabaseService.getClient().functions.invoke('paystack-verify', {
        body: { reference }
      })
    ).pipe(
      switchMap((response: any) => {
        if (response.error) {
          return from(this.extractEdgeFunctionError(response)).pipe(
            switchMap(err => throwError(() => new Error(err.message)))
          );
        }
        return from([response.data as PaystackVerifyResult]);
      }),
      catchError(error => {
        console.error('[PaystackService] Verification error:', error);
        return throwError(() => error);
      })
    );
  }
}

export class PaystackInitError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly details?: any,
  ) {
    super(message);
    this.name = 'PaystackInitError';
  }
}
