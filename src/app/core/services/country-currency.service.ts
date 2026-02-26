import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface Country {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  flag: string;
  locale: string;
}

export interface CurrencyConversion {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  convertedAmount: number;
  exchangeRate: number;
}

@Injectable({
  providedIn: 'root'
})
export class CountryCurrencyService {
  
  // Supported countries
  private readonly countries: Country[] = [
    {
      code: 'FR',
      name: 'France',
      currency: 'EUR',
      currencySymbol: '€',
      flag: '🇫🇷',
      locale: 'fr-FR'
    },
    {
      code: 'CI',
      name: 'Côte d\'Ivoire',
      currency: 'XOF',
      currencySymbol: 'FCFA',
      flag: '🇨🇮',
      locale: 'fr-CI'
    }
  ];

  // Current exchange rate (EUR to XOF)
  // Note: In production, this should be fetched from a real-time API
  private readonly EUR_TO_XOF_RATE = 655.957; // 1 EUR = ~656 XOF (fixed rate)

  // EUR to USD rate for Paystack (France). Align with Edge Function fallback.
  // Edge Function uses exchangerate-api.com; fallback is EUR_USD_FALLBACK_RATE or 1.10
  private readonly EUR_TO_USD_RATE = 1.10;

  // BehaviorSubjects for reactive state
  private selectedCountrySubject = new BehaviorSubject<Country>(this.countries[0]); // Default to France
  private isLoadingSubject = new BehaviorSubject<boolean>(false);

  // Public observables
  public selectedCountry$ = this.selectedCountrySubject.asObservable();
  public isLoading$ = this.isLoadingSubject.asObservable();

  constructor() {
    this.initializeCountry();
  }

  /**
   * Initialize country based on user's location
   */
  private async initializeCountry(): Promise<void> {
    try {
      // Try to get saved preference first
      const savedCountryCode = localStorage.getItem('selected-country');
      if (savedCountryCode) {
        const savedCountry = this.countries.find(c => c.code === savedCountryCode);
        if (savedCountry) {
          this.selectedCountrySubject.next(savedCountry);
          return;
        }
      }

      // Auto-detect based on user's location
      const detectedCountry = await this.detectUserCountry();
      this.selectedCountrySubject.next(detectedCountry);
      
    } catch (error) {
      console.warn('Could not detect user country, defaulting to France:', error);
      this.selectedCountrySubject.next(this.countries[0]); // Default to France
    }
  }

  /**
   * Detect user's country using continent-based geolocation
   * Europe -> FR, Africa -> CI, Unknown -> FR
   */
  private async detectUserCountry(): Promise<Country> {
    try {
      this.isLoadingSubject.next(true);
      
      // Use server-side geo-default function for continent detection
      // Use environment configuration for Supabase URL
      try {
        const supabaseUrl = environment.supabase.url;
        const response = await fetch(`${supabaseUrl}/functions/v1/geo-default`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.defaultCountry) {
            const detectedCountry = this.countries.find(c => c.code === data.defaultCountry) || this.countries[0];
            console.log('Detected country from continent:', detectedCountry.name, '(continent:', data.continent, ')');
            return detectedCountry;
          }
        }
      } catch (error) {
        console.warn('Geo-default function failed, falling back to client-side detection:', error);
      }
      
      // Fallback: Try client-side country detection
      const country = await this.tryGeolocationServices();
      const detectedCountry = this.countries.find(c => c.code === country);
      
      // Map country to continent-based default
      if (detectedCountry) {
        return detectedCountry;
      }
      
      // If country detected but not in our list, determine by continent
      const continent = await this.detectContinent();
      if (continent === 'Europe' || continent === 'EU') {
        return this.countries.find(c => c.code === 'FR') || this.countries[0];
      } else if (continent === 'Africa' || continent === 'AF') {
        return this.countries.find(c => c.code === 'CI') || this.countries[0];
      }
      
      // Default to France
      return this.countries[0];
    } catch (error) {
      console.warn('Geolocation detection failed:', error);
      return this.countries[0]; // Default to France
    } finally {
      this.isLoadingSubject.next(false);
    }
  }

  /**
   * Detect continent from country code
   */
  private async detectContinent(): Promise<string | null> {
    try {
      const response = await fetch('https://ip-api.com/json/?fields=continent,continentCode');
      const data = await response.json();
      return data.continentCode || data.continent || null;
    } catch (error) {
      console.warn('Continent detection failed:', error);
      return null;
    }
  }

  /**
   * Try multiple geolocation services for better reliability
   */
  private async tryGeolocationServices(): Promise<string> {
    const services = [
      // Service 1: ip-api.com (free, no key needed) 
      async () => {
        const response = await fetch('https://ip-api.com/json/?fields=countryCode');
        const data = await response.json();
        return data.countryCode;
      },
      
      // Service 2: ipapi.co (free, no key needed)
      async () => {
        const response = await fetch('https://ipapi.co/country/');
        return await response.text();
      },

      // Service 3: ipinfo.io (free tier available)
      async () => {
        const response = await fetch('https://ipinfo.io/json');
        const data = await response.json();
        return data.country;
      }
    ];

    // Try services sequentially until one succeeds
    for (const service of services) {
      try {
        const countryCode = await Promise.race([
          service(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
        ]) as string;
        
        if (countryCode && countryCode.length === 2) {
          return countryCode.toUpperCase();
        }
      } catch (error) {
        console.warn('Geolocation service failed:', error);
        continue;
      }
    }

    throw new Error('All geolocation services failed');
  }

  /**
   * Get all supported countries
   */
  getCountries(): Country[] {
    return [...this.countries];
  }

  /**
   * Get currently selected country
   */
  getCurrentCountry(): Country {
    return this.selectedCountrySubject.value;
  }

  /**
   * Set selected country manually
   */
  setCountry(countryCode: string): void {
    const country = this.countries.find(c => c.code === countryCode);
    if (country) {
      this.selectedCountrySubject.next(country);
      localStorage.setItem('selected-country', countryCode);
      console.log('Country changed to:', country.name);
    } else {
      console.warn('Unsupported country code:', countryCode);
    }
  }

  /**
   * Convert price from EUR to target currency
   */
  convertPrice(amount: number, fromCurrency: string = 'EUR', toCurrency?: string): CurrencyConversion {
    const targetCurrency = toCurrency || this.getCurrentCountry().currency;
    
    if (fromCurrency === targetCurrency) {
      return {
        amount,
        fromCurrency,
        toCurrency: targetCurrency,
        convertedAmount: amount,
        exchangeRate: 1
      };
    }

    let convertedAmount: number;
    let exchangeRate: number;

    if (fromCurrency === 'EUR' && targetCurrency === 'XOF') {
      exchangeRate = this.EUR_TO_XOF_RATE;
      convertedAmount = amount * exchangeRate;
    } else if (fromCurrency === 'XOF' && targetCurrency === 'EUR') {
      exchangeRate = 1 / this.EUR_TO_XOF_RATE;
      convertedAmount = amount * exchangeRate;
    } else if (fromCurrency === 'EUR' && targetCurrency === 'USD') {
      exchangeRate = this.EUR_TO_USD_RATE;
      convertedAmount = amount * exchangeRate;
    } else {
      console.warn(`Unsupported currency conversion: ${fromCurrency} to ${targetCurrency}`);
      return {
        amount,
        fromCurrency,
        toCurrency: targetCurrency,
        convertedAmount: amount,
        exchangeRate: 1
      };
    }

    return {
      amount,
      fromCurrency,
      toCurrency: targetCurrency,
      convertedAmount: targetCurrency === 'USD' ? Math.round(convertedAmount * 100) / 100 : Math.round(convertedAmount),
      exchangeRate
    };
  }

  /**
   * Format price with currency symbol
   */
  formatPrice(amount: number, currency?: string): string {
    const targetCurrency = currency || this.getCurrentCountry().currency;
    const country = this.countries.find(c => c.currency === targetCurrency) || this.getCurrentCountry();
    
    if (targetCurrency === 'EUR') {
      return new Intl.NumberFormat(country.locale, {
        style: 'currency',
        currency: 'EUR'
      }).format(amount);
    } else if (targetCurrency === 'XOF') {
      // XOF formatting (Franc CFA)
      return new Intl.NumberFormat(country.locale, {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount) + ' FCFA';
    }

    return `${amount} ${country.currencySymbol}`;
  }

  /**
   * Get converted and formatted price
   */
  getDisplayPrice(amount: number, fromCurrency: string = 'EUR'): string {
    const conversion = this.convertPrice(amount, fromCurrency);
    return this.formatPrice(conversion.convertedAmount, conversion.toCurrency);
  }

  /**
   * Get exchange rate information
   */
  getExchangeRate(): { rate: number; from: string; to: string } {
    const currentCountry = this.getCurrentCountry();
    if (currentCountry.currency === 'EUR') {
      return { rate: 1, from: 'EUR', to: 'EUR' };
    } else {
      return { rate: this.EUR_TO_XOF_RATE, from: 'EUR', to: 'XOF' };
    }
  }
}
