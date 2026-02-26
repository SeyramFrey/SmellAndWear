import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface PaymentInitiationRequest {
  amount: number;
  currency: string;
  orderId: string;
  transactionId: string;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    address?: string;
    city?: string;
    country: string;
  };
  metadata?: any;
}

export interface PaymentInitiationResponse {
  authorizationUrl?: string;
  authorization_url?: string;
  reference?: string;
  accessCode?: string;
  access_code?: string;
  // Conversion metadata (returned by Edge Function)
  country?: string;
  displayed_currency?: string;
  displayed_amount?: number;
  pay_currency?: string;
  pay_amount?: number;
  fx_rate?: number;
  fx_as_of?: string;
  fx_provider?: string;
  conversion_applied?: boolean;
  amount_minor_units?: number;
  [key: string]: any;
}

export interface PaymentProvider {
  /**
   * Initialize payment and return redirect URL or session info
   */
  initiatePayment(request: PaymentInitiationRequest): Observable<PaymentInitiationResponse>;
  
  /**
   * Handle payment return/callback
   */
  handleReturn(params: any): Observable<{ success: boolean; orderId?: string; reference?: string }>;
  
  /**
   * Get payment status by reference
   */
  verifyPayment(reference: string): Observable<any>;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private provider: PaymentProvider | null = null;

  constructor() {}

  /**
   * Set the payment provider
   */
  setProvider(provider: PaymentProvider): void {
    this.provider = provider;
  }

  /**
   * Get current payment provider
   */
  getProvider(): PaymentProvider | null {
    return this.provider;
  }

  /**
   * Initialize payment using the configured provider
   */
  initiatePayment(request: PaymentInitiationRequest): Observable<PaymentInitiationResponse> {
    if (!this.provider) {
      throw new Error('Payment provider not configured');
    }
    return this.provider.initiatePayment(request);
  }

  /**
   * Handle payment return
   */
  handleReturn(params: any): Observable<{ success: boolean; orderId?: string; reference?: string }> {
    if (!this.provider) {
      throw new Error('Payment provider not configured');
    }
    return this.provider.handleReturn(params);
  }

  /**
   * Verify payment status
   */
  verifyPayment(reference: string): Observable<any> {
    if (!this.provider) {
      throw new Error('Payment provider not configured');
    }
    return this.provider.verifyPayment(reference);
  }
}
