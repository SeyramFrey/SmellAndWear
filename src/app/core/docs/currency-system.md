# Currency System Documentation

This document describes the comprehensive currency switching system implemented for the Smell&Wear application.

## Overview

The currency system allows users to switch between EUR (Euro) and XOF (CFA Franc) currencies using the country flag selector in the topbar. Prices are stored in EUR in the database and converted dynamically based on user preference.

## Components

### 1. CurrencyService
**Location**: `src/app/core/services/currency.service.ts`

**Purpose**: Central service for managing currency state and conversions.

**Features**:
- Single source of truth for current currency
- Persistent storage in localStorage
- Fixed exchange rate: 1 EUR = 655.957 XOF
- Observable currency state for reactive updates
- Comprehensive conversion methods

**Usage**:
```typescript
// Inject service
constructor(private currencyService: CurrencyService) {}

// Set currency
this.currencyService.setCurrency('XOF');

// Get current currency
const current = this.currencyService.currentCurrency;

// Subscribe to changes
this.currencyService.currentCurrency$.subscribe(currency => {
  console.log('Currency changed to:', currency);
});

// Convert prices
const conversion = this.currencyService.convertFromEUR(100); // 100 EUR
console.log(conversion.convertedAmount); // Amount in current currency
```

### 2. ConvertPricePipe
**Location**: `src/app/shared/pipes/convert-price.pipe.ts`

**Purpose**: Pure pipe for converting EUR prices to current currency in templates.

**Features**:
- Pure pipe for optimal performance
- Automatic formatting with currency symbols
- Support for both cents and euros input
- Fallback handling for invalid values

**Usage**:
```html
<!-- Basic usage (assumes EUR input) -->
{{ price | convertPrice }}

<!-- Specify input unit -->
{{ priceInCents | convertPrice:'cents' }}

<!-- Target specific currency -->
{{ price | convertPrice:'euros':'XOF' }}

<!-- Get raw number without formatting -->
{{ price | convertPrice:'euros':undefined:false }}
```

### 3. Topbar Integration
**Location**: `src/app/shared/landing/index/topbar/topbar.component.ts`

**Features**:
- Automatic currency switching based on country selection
- France flag → EUR currency
- Côte d'Ivoire flag → XOF currency
- Updated cart display with currency conversion

## Currency Configuration

### Exchange Rate
- **Fixed Rate**: 1 EUR = 655.957 XOF
- **Source**: Official CFA Franc peg to Euro
- **Update**: Rate is fixed and should only be updated if the peg changes

### Supported Currencies

| Currency | Code | Symbol | Rate | Country |
|----------|------|--------|------|---------|
| Euro | EUR | € | 1.0 | France |
| CFA Franc | XOF | FCFA | 655.957 | Côte d'Ivoire |

### Formatting Rules

**EUR Formatting**:
- Decimals: 2 places (e.g., 12,34 €)
- Format: European (1 234,56 €)
- Symbol: € (after amount)

**XOF Formatting**:
- Decimals: 0 places (whole numbers only)
- Format: French (1 234 FCFA)
- Symbol: FCFA (after amount)

## Database Schema

**Storage**: All prices are stored in EUR (integer cents or decimal euros)
**Conversion**: Performed client-side using CurrencyService
**No Changes**: Database schema remains unchanged

## Implementation Examples

### Product Card Component
```typescript
// Import the pipe
import { ConvertPricePipe } from '../pipes/convert-price.pipe';

@Component({
  // ...
  imports: [ConvertPricePipe, ...],
})
```

```html
<!-- Product price display -->
<div class="price">
  {{ product.price | convertPrice }}
</div>
```

### Cart Component
```typescript
// Subscribe to currency changes for reactive updates
ngOnInit() {
  this.currencyService.currentCurrency$.subscribe(() => {
    // Cart totals will automatically update via pipe
    this.updateCartDisplay();
  });
}
```

```html
<!-- Cart item price -->
<div class="item-price">
  {{ item.quantity }} x {{ item.price | convertPrice }}
</div>

<!-- Cart total -->
<div class="total">
  Total: {{ cartTotal | convertPrice }}
</div>
```

### Manual Conversion
```typescript
// For calculations or non-template usage
const priceEUR = 29.99;
const conversion = this.currencyService.convertFromEUR(priceEUR);

if (this.currencyService.currentCurrency === 'XOF') {
  console.log(`Price: ${conversion.convertedAmount} FCFA`);
} else {
  console.log(`Price: ${conversion.convertedAmount} €`);
}
```

## Testing Scenarios

### Currency Switching
1. **Default State**: Page loads with EUR (French flag)
2. **Switch to XOF**: Click Côte d'Ivoire flag → prices convert to XOF
3. **Switch to EUR**: Click France flag → prices convert to EUR
4. **Persistence**: Refresh page → selected currency is remembered
5. **Cart Updates**: Currency change updates all cart prices immediately

### Price Conversion
1. **EUR to XOF**: 10 EUR → 6,560 FCFA (rounded)
2. **XOF to EUR**: 656 FCFA → 1,00 €
3. **Formatting**: EUR shows decimals, XOF shows whole numbers
4. **Symbols**: EUR uses €, XOF uses FCFA

### Edge Cases
1. **Invalid Prices**: null/undefined → displays 0 in current currency
2. **Decimal Handling**: XOF rounds to whole numbers, EUR shows 2 decimals
3. **Large Numbers**: Proper formatting with thousands separators

## Troubleshooting

### Common Issues

**Pipe Not Working**:
```typescript
// Ensure pipe is imported in component
imports: [ConvertPricePipe, ...]
```

**Currency Not Persisting**:
```typescript
// Check localStorage permissions
// CurrencyService handles storage automatically
```

**Incorrect Conversion**:
```typescript
// Verify input unit (cents vs euros)
{{ priceInCents | convertPrice:'cents' }}
{{ priceInEuros | convertPrice:'euros' }}
```

**Performance Issues**:
- ConvertPricePipe is pure for optimal performance
- Currency changes trigger minimal re-evaluations
- No unnecessary API calls or calculations

## Future Enhancements

### Potential Additions
1. **More Currencies**: Easy to add new currencies to CURRENCY_INFO
2. **Dynamic Rates**: Replace fixed rate with API-based rates
3. **Regional Formatting**: Locale-specific number formatting
4. **Currency History**: Track user's currency preferences over time

### Extension Points
```typescript
// Add new currency
private readonly CURRENCY_INFO: Record<CurrencyCode, CurrencyInfo> = {
  // ... existing currencies
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    flag: 'assets/images/flags/us.svg',
    rate: 1.1 // Example rate from EUR
  }
};
```

## Security Considerations

1. **Client-Side Only**: All conversions happen client-side
2. **No Server Impact**: Database remains in EUR only
3. **Input Validation**: Service validates currency codes
4. **Error Handling**: Graceful fallbacks for invalid data
5. **Storage Safety**: localStorage access is protected with try-catch

## Performance Metrics

- **Conversion Speed**: O(1) constant time conversions
- **Memory Usage**: Minimal state in BehaviorSubject
- **Bundle Size**: ~5KB additional code
- **Render Performance**: Pure pipe prevents unnecessary re-calculations
