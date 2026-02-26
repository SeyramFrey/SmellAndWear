import { Pipe, PipeTransform } from '@angular/core';
import { CountryCurrencyService } from '../../core/services/country-currency.service';

@Pipe({
  name: 'currencyConverter',
  standalone: true,
  pure: false // Make impure to react to country changes
})
export class CurrencyConverterPipe implements PipeTransform {

  constructor(private countryCurrencyService: CountryCurrencyService) {}

  /**
   * Transform price based on selected country
   * @param value - The price amount
   * @param fromCurrency - Source currency (default: EUR)
   * @param format - Whether to format with currency symbol (default: true)
   * @returns Converted and optionally formatted price
   */
  transform(
    value: number | string | null | undefined, 
    fromCurrency: string = 'EUR',
    format: boolean = true
  ): string {
    
    if (value === null || value === undefined || value === '') {
      return format ? this.countryCurrencyService.formatPrice(0) : '0';
    }

    const amount = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(amount)) {
      return format ? this.countryCurrencyService.formatPrice(0) : '0';
    }

    if (format) {
      return this.countryCurrencyService.getDisplayPrice(amount, fromCurrency);
    } else {
      const conversion = this.countryCurrencyService.convertPrice(amount, fromCurrency);
      return conversion.convertedAmount.toString();
    }
  }
}
