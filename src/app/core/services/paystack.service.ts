import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { PaymentProvider, PaymentInitiationRequest, PaymentInitiationResponse } from './payment.service';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class PaystackService implements PaymentProvider {

  constructor(
    private supabaseService: SupabaseService
  ) {}

  /**
   * Initialize Paystack payment via the paystack-initialize Edge Function.
   *
   * The Edge Function handles:
   * - France (FR): EUR → USD conversion using live FX rates
   * - Côte d'Ivoire (CI): XOF (no conversion)
   * - Amount conversion to smallest currency unit
   * - Persisting payment_reference / payment_data back to the order
   * - Idempotency (prevents double-init for paid orders)
   */
  initiatePayment(request: PaymentInitiationRequest): Observable<PaymentInitiationResponse> {
    const payload = {
      amount: request.amount,
      currency: request.currency,
      email: request.customer.email,
      reference: request.transactionId,
      order_id: request.orderId,
      country: request.customer.country, // FR or CI — Edge Function uses this for currency logic
      metadata: {
        orderId: request.orderId,
        transactionId: request.transactionId,
        customerName: `${request.customer.firstName} ${request.customer.lastName}`,
        customerPhone: request.customer.phone,
        customerCountry: request.customer.country,
        ...request.metadata
      },
      channels: this.getPaymentChannels(request.customer.country),
      callback_url: `${window.location.origin}/payment-return`,
    };

    // Log the payload for debugging (no secrets)
    console.log('[PaystackService] Initiating payment:', {
      amount: payload.amount,
      currency: payload.currency,
      email: payload.email,
      reference: payload.reference,
      order_id: payload.order_id,
      channels: payload.channels,
    });

    return from(
      this.supabaseService.getClient().functions.invoke('paystack-initialize', {
        body: payload
      })
    ).pipe(
      switchMap((response: any) => {
        // When the Edge Function returns non-2xx, the Supabase client sets
        // response.error (FunctionsHttpError) with a generic .message.
        // The actual JSON body from the Edge Function may be in response.data
        // or needs to be extracted from response.error.context.
        if (response.error) {
          return from(this.extractEdgeFunctionError(response)).pipe(
            switchMap(errorDetail => {
              console.error('[PaystackService] Edge Function error:', errorDetail);
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

        console.log('[PaystackService] Payment initialized:', {
          reference: data.reference,
          currency: data.currency,
          amount: data.amount,
          eur_converted: data.eur_converted,
        });

        return from([{
          authorizationUrl: data.authorization_url,
          reference: data.reference || request.transactionId,
          accessCode: data.access_code,
          // Pass through conversion info from Edge Function
          currency: data.pay_currency || data.currency,
          amount: data.pay_amount ?? data.amount,
          displayed_currency: data.displayed_currency,
          displayed_amount: data.displayed_amount,
          pay_currency: data.pay_currency,
          pay_amount: data.pay_amount,
          fx_rate: data.fx_rate,
          originalAmount: data.original_amount,
          originalCurrency: data.original_currency,
          eurConverted: data.conversion_applied,
        } as PaymentInitiationResponse]);
      }),
      catchError(error => {
        // If it's already a PaystackInitError, pass it through
        if (error instanceof PaystackInitError) {
          return throwError(() => error);
        }
        console.error('[PaystackService] Unexpected error:', error);
        return throwError(() => new PaystackInitError(
          error.message || 'An unexpected error occurred during payment initialization',
        ));
      })
    );
  }

  /**
   * Extract the actual error message from a Supabase Functions error response.
   *
   * The Supabase JS client wraps non-2xx responses in a FunctionsHttpError
   * whose .message is generic ("Edge Function returned a non-2xx status code").
   * The real error body may be:
   * 1. In response.data (some supabase-js versions parse it)
   * 2. In response.error.context (a Response object that can be .json()-ed)
   */
  private async extractEdgeFunctionError(
    response: any
  ): Promise<{ message: string; field?: string; details?: any }> {
    // Try response.data first (some versions populate this even on error)
    if (response.data && typeof response.data === 'object' && response.data.error) {
      return {
        message: response.data.error,
        field: response.data.field,
        details: response.data,
      };
    }

    // Try response.error.context (FunctionsHttpError stores the raw Response)
    const ctx = response.error?.context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = await ctx.json();
        if (body && body.error) {
          return {
            message: body.error,
            field: body.field,
            details: body,
          };
        }
      } catch {
        // context.json() failed — fall through
      }
    }

    // Fallback to generic message
    return {
      message: response.error?.message || 'Payment initialization failed (unknown error)',
    };
  }

  /**
   * Get payment channels based on customer country.
   * CI: mobile_money + card (XOF)
   * FR: card only (USD — bank transfer not available for USD on Paystack)
   */
  private getPaymentChannels(country: string): string[] {
    const normalized = (country || '').toUpperCase();
    if (normalized === 'CI' || country === 'Côte d\'Ivoire') {
      return ['mobile_money', 'card'];
    }
    // France (USD): card only
    return ['card'];
  }

  /**
   * Handle payment return from Paystack redirect
   */
  handleReturn(params: any): Observable<{ success: boolean; orderId?: string; reference?: string }> {
    const reference = params.reference || params.trxref;

    if (!reference) {
      return throwError(() => new Error('Payment reference not found in return parameters'));
    }

    return this.verifyPayment(reference).pipe(
      map((verificationResult: any) => {
        const isSuccess =
          verificationResult.status === 'success' ||
          verificationResult.data?.status === 'success';

        return {
          success: isSuccess,
          orderId: verificationResult.data?.metadata?.orderId,
          reference,
        };
      }),
      catchError(error => {
        console.error('[PaystackService] Payment verification error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Verify payment status by reference
   */
  verifyPayment(reference: string): Observable<any> {
    return from(
      this.supabaseService.getClient().functions.invoke('paystack-verify', {
        body: { reference }
      })
    ).pipe(
      map((response: any) => {
        if (response.error) {
          throw new Error(response.error.message || 'Payment verification failed');
        }
        return response.data;
      }),
      catchError(error => {
        console.error('[PaystackService] Verification error:', error);
        return throwError(() => error);
      })
    );
  }
}

/**
 * Typed error class for Paystack initialization failures.
 * Carries the field name and full details from the Edge Function.
 */
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
