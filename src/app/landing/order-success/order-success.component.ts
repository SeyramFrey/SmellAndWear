import { Component, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SharedModule } from '../../shared/shared.module';
import { TopbarComponent } from '../../shared/landing/index/topbar/topbar.component';
import { PaystackService, PaystackVerifyResult } from '../../core/services/paystack.service';
import { CartService } from '../../core/services/cart.service';
import { CountryCurrencyService } from '../../core/services/country-currency.service';
import { CurrencyConverterPipe } from '../../shared/pipes/currency-converter.pipe';

type PageState = 'loading' | 'success' | 'failed' | 'error';

@Component({
  selector: 'app-order-success',
  templateUrl: './order-success.component.html',
  styleUrls: ['./order-success.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    SharedModule,
    TopbarComponent,
    CurrencyConverterPipe,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class OrderSuccessComponent implements OnInit, OnDestroy {
  state: PageState = 'loading';
  reference: string = '';
  errorMessage: string = '';

  orderNumber: string = '';
  orderId: string = '';
  orderDetails: any = null;
  alreadyProcessed: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private paystackService: PaystackService,
    private cartService: CartService,
    private countryCurrencyService: CountryCurrencyService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.reference = params['reference'] || params['trxref'] || '';
      if (!this.reference) {
        this.state = 'error';
        this.errorMessage = 'Aucune référence de paiement trouvée.';
        return;
      }
      this.verifyPayment();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private verifyPayment(): void {
    this.state = 'loading';

    this.paystackService.verifyPayment(this.reference)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result: PaystackVerifyResult) => {
          console.log('[OrderSuccess] Verification result:', result);

          if (result.status === 'success') {
            this.state = 'success';
            this.orderNumber = result.order_number || '';
            this.orderId = result.order_id || '';
            this.orderDetails = result.order || null;
            this.alreadyProcessed = !!result.already_processed;

            // Clear cart on successful payment
            this.cartService.clearCart();
          } else {
            this.state = 'failed';
            this.errorMessage = result.error || 'Le paiement n\'a pas abouti.';
          }
        },
        error: (err) => {
          console.error('[OrderSuccess] Verification error:', err);
          this.state = 'error';
          this.errorMessage = err?.message || 'Erreur lors de la vérification du paiement.';
        }
      });
  }

  getDisplayCurrency(): string {
    if (this.orderDetails?.locale === 'CI' || this.orderDetails?.currency === 'XOF') {
      return 'XOF';
    }
    return 'EUR';
  }

  goToCheckout(): void {
    this.router.navigate(['/checkout']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  goToAccount(): void {
    this.router.navigate(['/account']);
  }
}
