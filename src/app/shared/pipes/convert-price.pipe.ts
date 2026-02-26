import { Pipe, PipeTransform } from '@angular/core';
import { CurrencyService, CurrencyCode } from '../../core/services/currency.service';

@Pipe({
  name: 'convertPrice',
  pure: true, // Pure pipe for optimal performance
  standalone: true
})
export class ConvertPricePipe implements PipeTransform {

  constructor(private currencyService: CurrencyService) {}

  /**
   * Transform EUR price to current currency
   * @param value - Price in EUR (can be in cents or euros)
   * @param inputUnit - 'cents' or 'euros' (default: 'euros')
   * @param targetCurrency - Target currency (optional, uses current if not specified)
   * @param format - Whether to format the output (default: true)
   * @returns Converted and optionally formatted price
   */
  transform(
    value: number | null | undefined,
    inputUnit: 'cents' | 'euros' = 'euros',
    targetCurrency?: CurrencyCode,
    format: boolean = true
  ): string | number {
    
    // Handle null/undefined values
    if (value == null || isNaN(value)) {
      return format ? this.currencyService.formatCurrency(0, targetCurrency) : 0;
    }

    try {
      // Convert cents to euros if needed
      let amountInEUR = value;
      if (inputUnit === 'cents') {
        amountInEUR = value / 100;
      }

      // Use current currency if target not specified
      const currency = targetCurrency || this.currencyService.currentCurrency;

      // Convert from EUR to target currency
      const conversion = this.currencyService.convertCurrency(amountInEUR, 'EUR', currency);

      // Return formatted or raw number
      if (format) {
        return this.currencyService.formatCurrency(conversion.convertedAmount, currency);
      } else {
        return conversion.convertedAmount;
      }

    } catch (error) {
      console.error('Error in ConvertPricePipe:', error);
      // Fallback to original value formatted
      return format ? this.currencyService.formatCurrency(value, 'EUR') : value;
    }
  }
}
