import {Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, ViewChild, OnDestroy} from '@angular/core';
import {NgbModal, NgbNav, NgbNavContent, NgbNavItem, NgbNavLink, NgbNavOutlet} from '@ng-bootstrap/ng-bootstrap';
import { defineElement } from "@lordicon/element";
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { CommonModule } from '@angular/common';

// Sweet Alert
import Swal from 'sweetalert2';
import {SharedModule} from "../../shared/shared.module";
import {TopbarComponent} from "../../shared/landing/index/topbar/topbar.component";
import { CartService, CartItem } from '../../core/services/cart.service';
import { OrderService, CreateOrderRequest } from '../../core/services/order.service';
import { CountryCurrencyService, Country } from '../../core/services/country-currency.service';
import { CurrencyConverterPipe } from '../../shared/pipes/currency-converter.pipe';
import { DeliveryPricesService } from '../../core/services/delivery-prices.service';
import { DeliveryPrice } from '../../core/models/delivery-price.model';
import { CustomerService } from '../../core/services/customer.service';
import { SupabaseAuthService } from '../../core/services/supabase-auth.service';
import { PaymentService } from '../../core/services/payment.service';
import { PaystackService, PaystackInitError } from '../../core/services/paystack.service';
import { ImageService, IMAGE_SIZES } from '../../core/services/image.service';
import { ActivatedRoute } from '@angular/router';
import { Commande } from '../../core/models/models';

@Component({
    selector: 'app-checkout',
    templateUrl: './checkout.component.html',
    styleUrls: ['./checkout.component.scss'],
    providers: [NgbNav],
    imports: [
        SharedModule,
        NgbNavItem,
        NgbNav,
        NgbNavOutlet,
        NgbNavLink,
        NgbNavContent,
        TopbarComponent,
        ReactiveFormsModule,
        FormsModule,
        RouterLink,
        CommonModule,
        CurrencyConverterPipe
    ],
    standalone: true,
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})

/**
 * Checkout Component
 */
export class CheckoutComponent implements OnInit, OnDestroy {

  // bread crumb items
  breadCrumbItems!: Array<{}>;
  submitted = false;
  
  // Cart data
  cartItems: CartItem[] = [];
  cartTotal: number = 0;
  cartSubtotal: number = 0;
  shippingCost: number = 0;
  shippingCurrency: string = 'FCFA'; // Currency for shipping costs
  expressDeliveryFee: number = 0;
  expressDeliveryCurrency: string = 'FCFA';
  
  // Delivery prices loaded from database
  availableDeliveryZones: DeliveryPrice[] = [];
  isLoadingDeliveryPrices: boolean = false;
  
  // Express delivery prices from database (by country)
  // Start at 0: the express section is hidden until a price > 0 is confirmed from DB
  franceExpressPrice: number = 0;
  ciExpressPrice: number = 0;
  
  // Form data
  checkoutForm!: FormGroup;
  paymentMethod: string = 'paystack'; // Default value updated to paystack
  
  // Transaction data
  transactionId: string = '';
  orderId: string = '';
  
  // Country/Currency management
  selectedCountry: Country | null = null;
  isLoading: boolean = false;
  
  // Phone input management
  selectedCountryCode: string = '+225'; // Default to Côte d'Ivoire
  phoneCountries = [
    { code: '+225', flag: '🇨🇮', name: 'Côte d\'Ivoire' },
    { code: '+33', flag: '🇫🇷', name: 'France' },
    { code: '+1', flag: '🇺🇸', name: 'États-Unis' },
    { code: '+44', flag: '🇬🇧', name: 'Royaume-Uni' },
    { code: '+49', flag: '🇩🇪', name: 'Allemagne' },
    { code: '+34', flag: '🇪🇸', name: 'Espagne' },
    { code: '+39', flag: '🇮🇹', name: 'Italie' }
  ];
  
  // Address autocomplete (France - Île-de-France only)
  addressSuggestions: any[] = [];
  showSuggestions: boolean = false;
  isLoadingAddress: boolean = false;
  addressError: string = '';
  private addressSearch$ = new Subject<string>();
  private readonly IDF_POSTCODES = ['75', '77', '78', '91', '92', '93', '94', '95'];
  
  private subscriptions: Subscription[] = [];
  private expressControlSubscription?: Subscription;

  @ViewChild(NgbNav) nav!: NgbNav;

  constructor(
    private modalService: NgbModal,
    private cartService: CartService,
    private formBuilder: FormBuilder,
    private router: Router,
    private http: HttpClient,
    private commandeService: OrderService,
    private countryCurrencyService: CountryCurrencyService,
    private deliveryPricesService: DeliveryPricesService,
    private customerService: CustomerService,
    private authService: SupabaseAuthService,
    private paymentService: PaymentService,
    private paystackService: PaystackService,
    private route: ActivatedRoute,
    private imageService: ImageService
  ) {
    // Initialize Paystack as the payment provider
    this.paymentService.setProvider(this.paystackService);
  }

  ngOnInit(): void {
    /**
    * BreadCrumb
    */
    this.breadCrumbItems = [
      { label: 'Ecommerce' },
      { label: 'Checkout', active: true }
    ];
    
    // Subscribe to country changes
    const countrySubscription = this.countryCurrencyService.selectedCountry$.subscribe(country => {
      this.selectedCountry = country;
      this.initForm(); // Reinitialize form when country changes
    });
    this.subscriptions.push(countrySubscription);
    
    // Subscribe to loading state
    const loadingSubscription = this.countryCurrencyService.isLoading$.subscribe(loading => {
      this.isLoading = loading;
    });
    this.subscriptions.push(loadingSubscription);
    
    // Setup address autocomplete
    this.setupAddressAutocomplete();
    
    // Initialize form
    this.initForm();
    
    // Load cart items
    this.loadCartItems();
    
    // Generate transaction ID
    this.transactionId = 'SW' + Math.floor(Math.random() * 100000000).toString();
    this.orderId = this.transactionId;
    
    // Handle payment return from Paystack redirect
    this.handlePaymentReturn();
  }
  
  /**
   * Handle legacy payment return query params (from old paystack-return Edge Function).
   * New flow redirects directly to /checkout/success with ?reference=.
   */
  private handlePaymentReturn(): void {
    this.route.queryParams.subscribe(params => {
      const paymentStatus = params['payment'];
      const reference = params['reference'];
      
      if (paymentStatus && reference) {
        // Redirect to the dedicated success page for proper verification
        this.router.navigate(['/checkout/success'], {
          queryParams: { reference },
          replaceUrl: true,
        });
      }
    });
  }
  
  ngOnDestroy(): void {
    // Unsubscribe to prevent memory leaks
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.expressControlSubscription?.unsubscribe();
  }
  
  /**
   * Initialize checkout form
   */
  private initForm(): void {
    this.expressControlSubscription?.unsubscribe();
    this.expressDeliveryFee = 0;

    // Base form fields common to all countries
    const baseFormFields = {
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      address: ['', [Validators.required]],
      expressDelivery: [false]
    };

    // Add country-specific fields
    if (this.selectedCountry?.code === 'FR') {
      // France: Bank card form with address validation
      this.checkoutForm = this.formBuilder.group({
        ...baseFormFields,
        phone: ['', [Validators.required, Validators.pattern(/^\+33[1-9](?:[0-9]{8})$/)]],
        street: [''],
        city: [''],
        postcode: ['', [this.idfPostcodeValidator.bind(this)]],
        latitude: [''],
        longitude: [''],
        paymentMethod: ['stripe', [Validators.required]],
        // Credit card fields
        cardNumber: ['', [Validators.required, Validators.pattern(/^\d{13,19}$/)]],
        cardExpiry: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
        cardCvv: ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]],
        cardHolder: ['', [Validators.required]]
      });
    } else {
      // Côte d'Ivoire and default: Mobile money form
      // No default values for CI - user must select delivery zone
      this.checkoutForm = this.formBuilder.group({
        ...baseFormFields,
        phone: ['', [Validators.required]], // Will use ngx-intl-tel-input validation
        shippingZone: ['', [Validators.required]], // No default - user must select
        paymentMethod: ['paystack', [Validators.required]]
      });
    }

    this.setupExpressDeliveryWatcher();

    if (this.isCoteIvoireSelected()) {
      this.shippingCurrency = 'FCFA';
      this.expressDeliveryCurrency = 'FCFA';
      this.loadDeliveryPrices('CI');
    } else if (this.isFranceSelected()) {
      this.shippingCost = 0;
      this.shippingCurrency = 'EUR';
      this.expressDeliveryCurrency = 'EUR';
      this.loadDeliveryPrices('FR');
    } else {
      this.shippingCost = 0;
      this.updateTotal();
    }
  }

  /**
   * Check if current country is France
   */
  isFranceSelected(): boolean {
    return this.selectedCountry?.code === 'FR';
  }

  /**
   * Check if current country is Côte d'Ivoire
   */
  isCoteIvoireSelected(): boolean {
    return this.selectedCountry?.code === 'CI';
  }

  /**
   * Setup address autocomplete with debouncing
   */
  private setupAddressAutocomplete(): void {
    const searchSub = this.addressSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        // Require minimum 4 characters to avoid API errors
        if (!query || query.trim().length < 4) {
          this.isLoadingAddress = false;
          this.addressSuggestions = [];
          this.showSuggestions = false;
          return of(null);
        }

        this.isLoadingAddress = true;
        // Simplified API call without type parameter to avoid 400 errors
        const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query.trim())}&autocomplete=1&limit=8`;
        
        return this.http.get<any>(url).pipe(
          catchError(err => {
            console.error('Address API error:', err);
            this.isLoadingAddress = false;
            return of(null);
          })
        );
      })
    ).subscribe(response => {
      this.isLoadingAddress = false;
      
      if (!response || !response.features) {
        this.addressSuggestions = [];
        this.showSuggestions = false;
        return;
      }

      // Filter for Île-de-France postcodes (75, 77, 78, 91, 92, 93, 94, 95)
      const filtered = response.features.filter((f: any) => {
        const pc = f.properties?.postcode;
        if (!pc) return false;
        
        const dept = pc.substring(0, 2);
        return this.IDF_POSTCODES.includes(dept);
      });

      this.addressSuggestions = filtered;
      this.showSuggestions = filtered.length > 0 || response.features.length > 0;
    });

    this.subscriptions.push(searchSub);
  }

  /**
   * Île-de-France postcode validator
   */
  private idfPostcodeValidator(control: any) {
    if (!control.value) return null;
    const pc = control.value.toString();
    return this.IDF_POSTCODES.includes(pc.substring(0, 2)) ? null : { notIDF: true };
  }

  /**
   * Handle address input changes
   */
  onAddressInput(event: any): void {
    const query = event.target.value;
    this.addressError = '';
    this.addressSearch$.next(query);
  }

  /**
   * Select address from suggestions
   */
  onSelectAddress(suggestion: any): void {
    const p = suggestion.properties;
    const c = suggestion.geometry.coordinates;

    this.checkoutForm.patchValue({
      address: p.label,
      street: p.name || p.street || '',
      city: p.city,
      postcode: p.postcode,
      latitude: c[1],
      longitude: c[0]
    });

    this.showSuggestions = false;
    this.addressSuggestions = [];
  }

  /**
   * Validate IDF address before payment
   */
  private checkIdfAddress(): boolean {
    if (!this.isFranceSelected()) return true;

    const pc = this.checkoutForm.get('postcode')?.value;
    if (!pc) {
      this.addressError = 'Code postal requis.';
      return false;
    }

    if (!this.IDF_POSTCODES.includes(pc.substring(0, 2))) {
      this.addressError = 'Adresse hors Île-de-France non autorisée.';
      return false;
    }

    return true;
  }

  /**
   * Format credit card number input
   */
  formatCardNumber(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    let formattedValue = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    
    if (formattedValue.length > 19) {
      formattedValue = formattedValue.substring(0, 19);
    }
    
    event.target.value = formattedValue;
    this.checkoutForm.patchValue({ cardNumber: value });
  }

  /**
   * Format expiry date input (MM/YY)
   */
  formatExpiryDate(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    
    event.target.value = value;
    this.checkoutForm.patchValue({ cardExpiry: value });
  }

  /**
   * Format CVV input (numbers only)
   */
  formatCvv(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    
    if (value.length > 4) {
      value = value.substring(0, 4);
    }
    
    event.target.value = value;
    this.checkoutForm.patchValue({ cardCvv: value });
  }

  /**
   * Format phone number input
   */
  formatPhoneNumber(event: any): void {
    let value = event.target.value.replace(/\D/g, '');
    let formattedValue = '';
    
    // Format based on country code
    switch (this.selectedCountryCode) {
      case '+225': // Côte d'Ivoire: XX XX XX XX XX
        formattedValue = value.replace(/(\d{2})(?=\d)/g, '$1 ');
        if (formattedValue.length > 14) {
          formattedValue = formattedValue.substring(0, 14);
        }
        break;
      case '+33': // France: X XX XX XX XX
        if (value.length > 0) {
          formattedValue = value.charAt(0);
          if (value.length > 1) {
            formattedValue += ' ' + value.substring(1).replace(/(\d{2})(?=\d)/g, '$1 ');
          }
        }
        if (formattedValue.length > 13) {
          formattedValue = formattedValue.substring(0, 13);
        }
        break;
      default: // Other countries: XXX XXX XXXX
        formattedValue = value.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
        if (formattedValue.length > 12) {
          formattedValue = formattedValue.substring(0, 12);
        }
        break;
    }
    
    event.target.value = formattedValue;
    
    // Update form control with full international number
    const fullPhoneNumber = this.selectedCountryCode + value;
    this.checkoutForm.patchValue({ phone: fullPhoneNumber });
  }

  /**
   * Update phone format when country code changes
   */
  onCountryCodeChange(): void {
    const phoneControl = this.checkoutForm.get('phone');
    if (phoneControl?.value) {
      // Clear the current value to re-format with new country code
      phoneControl.setValue('');
    }
  }

  /**
   * Get phone placeholder based on selected country code
   */
  getPhonePlaceholder(): string {
    switch (this.selectedCountryCode) {
      case '+225': // Côte d'Ivoire
        return 'XX XX XX XX XX';
      case '+33': // France  
        return 'X XX XX XX XX';
      case '+1': // US/Canada
        return 'XXX XXX XXXX';
      case '+44': // UK
        return 'XXXX XXX XXXX';
      default:
        return 'XXX XXX XXXX';
    }
  }

  /**
   * Get final total based on selected country
   */
  getFinalTotal(): number {
    return this.cartTotal;
  }

  /**
   * Get display subtotal (converted if needed for CI)
   */
  getDisplaySubtotal(): number {
    if (this.isCoteIvoireSelected()) {
      const conversionResult = this.countryCurrencyService.convertPrice(this.cartSubtotal, 'EUR');
      return conversionResult.convertedAmount;
    }
    return this.cartSubtotal;
  }

  /**
   * Get subtotal currency
   */
  getSubtotalCurrency(): string {
    return this.isCoteIvoireSelected() ? 'FCFA' : 'EUR';
  }
  
  /**
   * Load cart items and calculate totals
   */
  private loadCartItems(): void {
    // Validate cart (remove hidden/scheduled/unpublished products)
    this.cartService.validateCartVisibility();

    // Get current cart items
    this.cartItems = this.cartService.getCartItems();
    
    // Calculate subtotal
    this.cartSubtotal = this.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Calculate total with shipping
    this.updateTotal();
    
    // Subscribe to cart changes
    const cartSub = this.cartService.cartItems$.subscribe(items => {
      this.cartItems = items;
      this.cartSubtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      this.updateTotal();
    });
    
    this.subscriptions.push(cartSub);
  }
  
  /**
   * Load delivery prices from database for a specific country
   */
  private loadDeliveryPrices(countryCode: string): void {
    this.isLoadingDeliveryPrices = true;
    
    // Load standard delivery prices
    const subscription = this.deliveryPricesService
      .getStandardDeliveryPrices(countryCode)
      .subscribe({
        next: (prices) => {
          this.availableDeliveryZones = prices;
          this.isLoadingDeliveryPrices = false;
          
          // Set initial shipping cost based on current zone selection
          // For CI: Do NOT set default - user must select
          const currentZone = this.checkoutForm.get('shippingZone')?.value;
          if (currentZone) {
            this.updateShippingCostFromZone(currentZone);
          }
          // Removed auto-selection of first zone for CI - user must choose
        },
        error: (error) => {
          console.error('Error loading delivery prices:', error);
          this.isLoadingDeliveryPrices = false;
          
          // Fallback to default values
          if (countryCode === 'CI') {
            this.shippingCost = 2000;
          }
          this.updateTotal();
        }
      });
    
    this.subscriptions.push(subscription);
    
    // Also load express delivery prices for display
    this.loadExpressPricesForDisplay(countryCode);
  }
  
  /**
   * Load express delivery prices for display purposes
   */
  private loadExpressPricesForDisplay(countryCode: string): void {
    const expressSub = this.deliveryPricesService
      .getExpressDeliveryPrices(countryCode)
      .subscribe({
        next: (expressPrices) => {
          // Only store the price when it exists AND is strictly greater than 0.
          // A price of 0 (or no entry at all) means express is not available:
          // the section will remain hidden from the customer.
          const activeExpress = expressPrices.find(p => p.price > 0);
          if (countryCode === 'FR') {
            this.franceExpressPrice = activeExpress?.price ?? 0;
            this.expressDeliveryCurrency = 'EUR';
          } else if (countryCode === 'CI') {
            this.ciExpressPrice = activeExpress?.price ?? 0;
            this.expressDeliveryCurrency = 'XOF';
          }
        },
        error: (error) => {
          console.error('Error loading express prices for display:', error);
        }
      });
    
    this.subscriptions.push(expressSub);
  }

  /**
   * Update shipping cost based on selected zone (using database prices)
   */
  updateShippingCost(zone: string): void {
    this.updateShippingCostFromZone(zone);
  }
  
  /**
   * Update shipping cost from zone using loaded delivery prices
   */
  private updateShippingCostFromZone(zoneCode: string): void {
    const selectedZone = this.availableDeliveryZones.find(z => z.zone_code === zoneCode);
    
    if (selectedZone) {
      this.shippingCost = selectedZone.price;
      this.shippingCurrency = selectedZone.currency;
    } else {
      // Fallback to default if zone not found
      this.shippingCost = 0;
    }
    
    this.updateTotal();
  }
  
  /**
   * Update total amount with shipping
   */
  private updateTotal(): void {
    if (this.isCoteIvoireSelected()) {
      // For Côte d'Ivoire: Convert EUR cart subtotal to FCFA, then add FCFA shipping costs
      const conversionResult = this.countryCurrencyService.convertPrice(this.cartSubtotal, 'EUR');
      const subtotalInFCFA = conversionResult.convertedAmount;
      this.cartTotal = subtotalInFCFA + this.shippingCost + this.expressDeliveryFee;
    } else if (this.isFranceSelected()) {
      // For France: No shipping cost, cart is in EUR
      this.cartTotal = this.cartSubtotal + this.expressDeliveryFee;
    } else {
      // Other countries: Add shipping to cart subtotal (both should be in same currency)
      this.cartTotal = this.cartSubtotal + this.shippingCost + this.expressDeliveryFee;
    }
  }

  private setupExpressDeliveryWatcher(): void {
    const expressControl = this.checkoutForm?.get('expressDelivery');
    if (!expressControl) {
      return;
    }

    this.expressControlSubscription?.unsubscribe();
    this.expressControlSubscription = expressControl.valueChanges.subscribe(() => {
      this.onExpressDeliveryToggle();
    });

    this.onExpressDeliveryToggle();
  }

  private onExpressDeliveryToggle(): void {
    const enabled = !!this.checkoutForm?.get('expressDelivery')?.value;
    
    if (enabled) {
      // Load express delivery price from database
      const countryCode = this.selectedCountry?.code;
      const currentZone = this.checkoutForm.get('shippingZone')?.value;
      
      if (countryCode && currentZone) {
        this.loadExpressDeliveryPrice(countryCode, currentZone);
      } else {
        // Fallback to hardcoded values
        this.expressDeliveryFee = this.getExpressFeeBaseAmount();
        this.updateTotal();
      }
    } else {
      this.expressDeliveryFee = 0;
      this.updateTotal();
    }
  }
  
  /**
   * Load express delivery price from database
   */
  private loadExpressDeliveryPrice(countryCode: string, zoneCode: string): void {
    const subscription = this.deliveryPricesService
      .getDeliveryPrice(countryCode, zoneCode, true)
      .subscribe({
        next: (price) => {
          if (price) {
            this.expressDeliveryFee = price.price;
            this.expressDeliveryCurrency = price.currency;
          } else {
            // Fallback if no express price found
            this.expressDeliveryFee = this.getExpressFeeBaseAmount();
          }
          this.updateTotal();
        },
        error: (error) => {
          console.error('Error loading express delivery price:', error);
          // Fallback to hardcoded values
          this.expressDeliveryFee = this.getExpressFeeBaseAmount();
          this.updateTotal();
        }
      });
    
    this.subscriptions.push(subscription);
  }

  getExpressFeeBaseAmount(): number {
    if (this.isFranceSelected()) {
      return this.franceExpressPrice;
    }
    if (this.isCoteIvoireSelected()) {
      return this.ciExpressPrice;
    }
    return 0;
  }

  /**
   * TrackBy function for delivery zones
   */
  trackByZoneId(index: number, zone: DeliveryPrice): string {
    return zone.id;
  }

  getExpressFeeCurrency(): string {
    return this.isCoteIvoireSelected() ? 'XOF' : 'EUR';
  }

  isExpressDeliverySelected(): boolean {
    return !!this.checkoutForm?.get('expressDelivery')?.value;
  }

  /**
   * Proceed to payment with Paystack
   */
  proceedToPayment(): void {
    this.submitted = true;
    
    // Validate Île-de-France address for France
    if (!this.checkIdfAddress()) {
      Swal.fire({
        title: 'Adresse non valide',
        text: this.addressError,
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    if (this.checkoutForm.invalid) {
      // Mark form controls as touched to display validation errors
      Object.keys(this.checkoutForm.controls).forEach(key => {
        const control = this.checkoutForm.get(key);
        control?.markAsTouched();
      });
      
      // Afficher un message d'erreur global
      let invalidFields = [];
      
      if (this.checkoutForm.get('firstName')?.invalid) invalidFields.push('Prénom');
      if (this.checkoutForm.get('lastName')?.invalid) invalidFields.push('Nom');
      if (this.checkoutForm.get('email')?.invalid) invalidFields.push('Email');
      if (this.checkoutForm.get('phone')?.invalid) invalidFields.push('Téléphone');
      if (this.checkoutForm.get('address')?.invalid) invalidFields.push('Adresse');
      
      Swal.fire({
        title: 'Formulaire incomplet',
        text: `Veuillez vérifier les champs suivants : ${invalidFields.join(', ')}`,
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      
      return;
    }

    // Vérifier que le panier n'est pas vide
    if (this.cartItems.length === 0) {
      Swal.fire({
        title: 'Panier vide',
        text: 'Votre panier est vide. Veuillez ajouter des articles avant de procéder au paiement.',
        icon: 'warning',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    // Vérifier que le montant est valide (montant négatif interdit)
    if (this.cartTotal < 0) {
      Swal.fire({
        title: 'Montant invalide',
        text: 'Le montant de votre commande est invalide.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
      return;
    }
    
    const formValues = this.checkoutForm.value;
    
    // Si le montant est 0 (commande gratuite), traiter sans paiement
    if (this.cartTotal === 0) {
      this.handleFreeOrder(formValues);
      return;
    }
    
    // Afficher un indicateur de chargement
    Swal.fire({
      title: 'Initialisation du paiement',
      text: 'Veuillez patienter pendant que nous initialisons votre paiement...',
      icon: 'info',
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    // Process payment with Paystack
    this.initiatePaystackPayment(formValues);
  }

  /**
   * Get valid customer state based on country
   */
  private getCustomerState(country: string, formData: any): string {
    if (country === 'FR') {
      // Pour la France, utiliser le département (2 premiers chiffres du code postal)
      const postcode = formData.postcode || '75001';
      return postcode.substring(0, 2); // Ex: "75" pour Paris
    } else if (country === 'CI') {
      // Pour la Côte d'Ivoire, utiliser la région
      const zone = formData.shippingZone;
      if (zone === 'abidjan_nord' || zone === 'abidjan_sud') {
        return 'AB'; // Abidjan
      }
      return 'CI'; // Par défaut
    }
    return country; // Par défaut pour autres pays
  }

  /**
   * Get valid zip code based on country
   */
  private getValidZipCode(country: string, formData: any): string {
    if (country === 'FR') {
      return formData.postcode || '75001';
    } else if (country === 'CI') {
      // Côte d'Ivoire n'a pas de système de code postal standardisé
      // Utiliser un code factice mais valide
      return '00225'; // Code téléphone pays comme référence
    }
    return '00000';
  }
  
  /**
   * Handle free order (0€ / 0 XOF) - skip payment gateway
   */
  private handleFreeOrder(formData: any): void {
    // Afficher un indicateur de chargement
    Swal.fire({
      title: 'Traitement de la commande',
      text: 'Veuillez patienter pendant que nous enregistrons votre commande gratuite...',
      icon: 'info',
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    // Generate order ID for free order
    this.transactionId = 'FREE_' + Math.floor(Math.random() * 100000000).toString();
    this.orderId = this.transactionId;
    
    // Create payment data for free order
    const freePaymentData = {
      status: 'FREE_ORDER',
      reference: this.transactionId,
      amount: 0
    };
    
    // Save the order
    this.saveOrder(freePaymentData)
      .then((_createdOrder) => {
        // Clear cart after successful order
        this.cartService.clearCart();
        
        // Close loading indicator
        Swal.close();
        
        // Navigate to success tab
        this.changeActiveTab(4);
        
        // Afficher une confirmation visuelle
        Swal.fire({
          title: 'Commande confirmée!',
          text: 'Votre commande gratuite a été enregistrée avec succès.',
          icon: 'success',
          confirmButtonText: 'OK'
        });
      })
      .catch(error => {
        console.error('Error saving free order:', error);
        Swal.fire({
          title: 'Erreur',
          text: 'Une erreur est survenue lors de l\'enregistrement de votre commande. Veuillez réessayer.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      });
  }
  
  /**
   * Initialize Paystack payment (v2 – server-side totals).
   *
   * Flow:
   * 1. Create the order in DB (items + client)
   * 2. Call paystack-initialize Edge Function with ONLY:
   *    order_id, email, locale, shipping_zone_code, express_delivery
   *    → The Edge Function fetches prices from DB and computes totals
   * 3. Redirect user to Paystack authorization URL
   * 4. On return, Paystack redirects to /checkout/success?reference=XXX
   */
  private initiatePaystackPayment(formData: any): void {
    try {
      const locale = this.isFranceSelected() ? 'FR' : 'CI';
      const shippingZone = formData.shippingZone || undefined;
      const expressDelivery = !!formData.expressDelivery;

      // Step 1: Create order in DB
      this.saveOrder({ reference: `pending_${Date.now()}`, status: 'Nouvelle' })
        .then((createdOrder) => {
          const dbOrderId = createdOrder?.id;
          if (!dbOrderId) throw new Error('Order creation returned no ID');
          this.orderId = dbOrderId;

          // Step 2: Call paystack-initialize (server computes the total)
          this.paystackService.initiateServerSidePayment({
            order_id: dbOrderId,
            email: formData.email,
            locale,
            shipping_zone_code: shippingZone,
            express_delivery: expressDelivery,
            callback_url: `${window.location.origin}/checkout/success`,
          }).subscribe({
            next: (response) => {
              Swal.close();

              const url = response.authorizationUrl || response.authorization_url;
              if (url) {
                window.location.href = url;
              } else {
                throw new Error('No authorization URL received from Paystack');
              }
            },
            error: (error) => {
              console.error('[Checkout] Paystack init error:', error);
              Swal.close();

              let text = 'Impossible d\'initialiser le paiement. Veuillez réessayer.';
              if (error instanceof PaystackInitError) {
                text = error.message;
                if (error.details?.hint) text += '\n\n' + error.details.hint;
              } else if (error?.message) {
                text = error.message;
              }

              Swal.fire({
                title: 'Erreur de paiement',
                text,
                icon: 'error',
                confirmButtonText: 'Réessayer',
                showCancelButton: true,
                cancelButtonText: 'Annuler'
              }).then((result) => {
                if (result.isConfirmed) this.proceedToPayment();
              });
            }
          });
        })
        .catch(error => {
          console.error('[Checkout] Order creation failed:', error);
          Swal.close();
          Swal.fire({
            title: 'Erreur',
            text: 'Impossible de créer votre commande. Veuillez réessayer.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        });

    } catch (error) {
      console.error('[Checkout] Unexpected error:', error);
      Swal.close();
      Swal.fire({
        title: 'Erreur',
        text: 'Impossible d\'initialiser le paiement. Veuillez réessayer plus tard.',
        icon: 'error',
        confirmButtonText: 'OK'
      });
    }
  }
  
  // Payment success and failure are now handled by OrderSuccessComponent
  // at the /checkout/success route.
  
  /**
   * Save order data to Supabase.
   * Returns the created Commande so callers can use order.id.
   *
   * RLS Alignment:
   * - For authenticated users: Order is linked to their client_id
   * - For guests: A guest client record is created first, then order is created
   */
  private async saveOrder(paymentData: any): Promise<Commande> {
    try {
      // Ensure client exists (creates guest client if needed)
      const clientId = await this.ensureClientExists();

      // Persist country + currency from the topbar selection at creation time
      const country = this.countryCurrencyService.getCurrentCountry();

      const orderRequest: CreateOrderRequest = {
        client_id: clientId,
        total: this.cartTotal,
        country_code: country.code,
        currency: country.currency,
        items: this.cartItems.map(item => ({
          produit_variation_id: item.variantId,
          quantite: item.quantity,
          prix_unitaire: item.price
        })),
        payment_reference: paymentData.reference || this.transactionId
      };

      // Create order using CommandeService
      return new Promise<Commande>((resolve, reject) => {
        this.commandeService.createOrder(orderRequest).subscribe({
          next: (createdOrder) => {
            resolve(createdOrder);
          },
          error: (error) => {
            console.error('[Checkout] Failed to create order:', error);
            if (error.code === '42501' || error.message?.includes('policy')) {
              console.error('[Checkout] RLS policy violation — check client_id and auth state');
            }
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('[Checkout] Error preparing order data:', error);
      throw error;
    }
  }

  /**
   * Get current client ID
   * 
   * RLS Alignment:
   * - Authenticated users: Uses CustomerService to get/create client record
   * - Guest users: Creates a guest client record for checkout
   * 
   * The RLS policies allow:
   * - Authenticated users to create orders for their own client_id
   * - Anonymous users (anon role) to create orders (guest checkout)
   */
  private getCurrentClientId(): string | null {
    // Check if user is authenticated and has a client record
    const currentClient = this.customerService.getCurrentClient();
    if (currentClient) {
      return currentClient.id;
    }
    
    // For guest checkout, return null - the order creation will handle it
    // The guest client is created before order in saveOrder method
    return null;
  }
  
  /**
   * Create or get guest client for checkout
   * Called before order creation for unauthenticated users
   */
  private async ensureClientExists(): Promise<string> {
    // If authenticated user with client record, use that
    const currentClient = this.customerService.getCurrentClient();
    if (currentClient) {
      return currentClient.id;
    }
    
    // Create guest client from checkout form data
    const formValues = this.checkoutForm.value;
    const guestClient = await this.customerService.createGuestClient(
      formValues.email,
      formValues.lastName,
      formValues.firstName,
      formValues.phone || undefined
    );
    
    if (!guestClient) {
      throw new Error('Failed to create guest client record');
    }
    
    return guestClient.id;
  }

  /**
   * Confirmation mail model
   */
  confirm(content:any) {
    this.modalService.open(content, { centered: true });
  }


  openModal(content: any) {
    this.submitted = false;
    this.modalService.open(content, { size: 'md', centered: true });
  }

  changeActiveTab(tabId: any) {
    this.nav.select(tabId);
  }

  topFunction() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }

  getCartImageUrl(imageUrl?: string): string {
    return this.imageService.resolveImageUrl(
      imageUrl,
      IMAGE_SIZES.CART_THUMBNAIL,
      75,
      'public-images',
      'assets/images/products/placeholder.jpg'
    );
  }

  protected readonly string_decoder = this.transactionId;
}
