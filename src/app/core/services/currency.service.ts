import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type CurrencyCode = 'EUR' | 'XOF';

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  name: string;
  flag: string;
  rate: number; // Conversion rate from EUR (EUR = 1, XOF = 655.957)
}

export interface CurrencyConversion {
  originalAmount: number;
  convertedAmount: number;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: number;
}

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private readonly STORAGE_KEY = 'selectedCurrency';
  private readonly DEFAULT_CURRENCY: CurrencyCode = 'EUR';
  
  // Fixed exchange rate: 1 EUR = 655.957 XOF (CFA Franc)
  private readonly EXCHANGE_RATES: Record<CurrencyCode, number> = {
    EUR: 1,
    XOF: 655.957
  };

  private readonly CURRENCY_INFO: Record<CurrencyCode, CurrencyInfo> = {
    EUR: {
      code: 'EUR',
      symbol: '€',
      name: 'Euro',
      flag: 'assets/images/flags/french.svg',
      rate: 1
    },
    XOF: {
      code: 'XOF',
      symbol: 'FCFA',
      name: 'CFA Franc',
      flag: 'assets/images/flags/ci.svg',
      rate: 655.957
    }
  };

  private currentCurrencySubject: BehaviorSubject<CurrencyCode>;
  
  constructor() {
    // Initialize currency from localStorage or default
    const savedCurrency = this.loadCurrencyFromStorage();
    this.currentCurrencySubject = new BehaviorSubject<CurrencyCode>(savedCurrency);
  }

  /**
   * Get current currency as observable
   */
  get currentCurrency$(): Observable<CurrencyCode> {
    return this.currentCurrencySubject.asObservable();
  }

  /**
   * Get current currency value synchronously
   */
  get currentCurrency(): CurrencyCode {
    return this.currentCurrencySubject.value;
  }

  /**
   * Get current currency info
   */
  get currentCurrencyInfo(): CurrencyInfo {
    return this.CURRENCY_INFO[this.currentCurrency];
  }

  /**
   * Set the current currency
   */
  setCurrency(currency: CurrencyCode): void {
    if (this.isValidCurrency(currency)) {
      this.currentCurrencySubject.next(currency);
      this.saveCurrencyToStorage(currency);
      console.log(`Currency switched to: ${currency}`);
    } else {
      console.error(`Invalid currency code: ${currency}`);
    }
  }

  /**
   * Convert price from EUR to current currency
   */
  convertFromEUR(amountInEUR: number): CurrencyConversion {
    const targetCurrency = this.currentCurrency;
    const rate = this.EXCHANGE_RATES[targetCurrency];
    const convertedAmount = amountInEUR * rate;

    return {
      originalAmount: amountInEUR,
      convertedAmount: this.roundCurrency(convertedAmount, targetCurrency),
      fromCurrency: 'EUR',
      toCurrency: targetCurrency,
      rate
    };
  }

  /**
   * Convert any amount between currencies
   */
  convertCurrency(amount: number, fromCurrency: CurrencyCode, toCurrency: CurrencyCode): CurrencyConversion {
    if (!this.isValidCurrency(fromCurrency) || !this.isValidCurrency(toCurrency)) {
      throw new Error('Invalid currency code provided');
    }

    // Convert to EUR first if needed, then to target currency
    const amountInEUR = amount / this.EXCHANGE_RATES[fromCurrency];
    const convertedAmount = amountInEUR * this.EXCHANGE_RATES[toCurrency];

    return {
      originalAmount: amount,
      convertedAmount: this.roundCurrency(convertedAmount, toCurrency),
      fromCurrency,
      toCurrency,
      rate: this.EXCHANGE_RATES[toCurrency] / this.EXCHANGE_RATES[fromCurrency]
    };
  }

  /**
   * Get currency info for a specific currency
   */
  getCurrencyInfo(currency: CurrencyCode): CurrencyInfo {
    return this.CURRENCY_INFO[currency];
  }

  /**
   * Get all available currencies
   */
  getAvailableCurrencies(): CurrencyInfo[] {
    return Object.values(this.CURRENCY_INFO);
  }

  /**
   * Check if currency matches country/language selection
   */
  getCurrencyForCountry(lang: string): CurrencyCode {
    switch (lang) {
      case 'ci':
        return 'XOF';
      case 'fr':
      default:
        return 'EUR';
    }
  }

  /**
   * Format currency amount with proper symbols and decimals
   */
  formatCurrency(amount: number, currency?: CurrencyCode): string {
    const targetCurrency = currency || this.currentCurrency;
    const currencyInfo = this.CURRENCY_INFO[targetCurrency];
    
    // Round to appropriate decimal places
    const roundedAmount = this.roundCurrency(amount, targetCurrency);
    
    if (targetCurrency === 'EUR') {
      // European format: 1 234,56 €
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(roundedAmount);
    } else {
      // XOF format: 1 234 FCFA (no decimals)
      return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(roundedAmount) + ' ' + currencyInfo.symbol;
    }
  }

  /**
   * Validate currency code
   */
  private isValidCurrency(currency: string): currency is CurrencyCode {
    return currency === 'EUR' || currency === 'XOF';
  }

  /**
   * Round currency to appropriate decimal places
   */
  private roundCurrency(amount: number, currency: CurrencyCode): number {
    if (currency === 'EUR') {
      // Round to 2 decimal places for EUR
      return Math.round(amount * 100) / 100;
    } else {
      // Round to whole number for XOF (no fractional units)
      return Math.round(amount);
    }
  }

  /**
   * Load currency preference from localStorage
   */
  private loadCurrencyFromStorage(): CurrencyCode {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved && this.isValidCurrency(saved)) {
        return saved as CurrencyCode;
      }
    } catch (error) {
      console.warn('Failed to load currency from storage:', error);
    }
    return this.DEFAULT_CURRENCY;
  }

  /**
   * Save currency preference to localStorage
   */
  private saveCurrencyToStorage(currency: CurrencyCode): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, currency);
    } catch (error) {
      console.error('Failed to save currency to storage:', error);
    }
  }

  /**
   * Reset to default currency
   */
  resetToDefault(): void {
    this.setCurrency(this.DEFAULT_CURRENCY);
  }

  /**
   * Get exchange rate between currencies
   */
  getExchangeRate(from: CurrencyCode, to: CurrencyCode): number {
    return this.EXCHANGE_RATES[to] / this.EXCHANGE_RATES[from];
  }
}
