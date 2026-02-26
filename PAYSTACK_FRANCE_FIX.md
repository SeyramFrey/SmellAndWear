# Paystack France Payment Fix

## Summary

Fixed Paystack payment initialization for France with:
- **All conversion logic server-side** (Edge Function)
- **Live EUR→USD FX rate** with 30-min cache
- **Correct Paystack amount format** (subunits per docs)
- **Explicit error handling** for "Currency not supported by merchant"

## Paystack API Rules (per docs)

| Rule | Implementation |
|------|----------------|
| **Amount in subunits** | USD: `Math.round(usd * 100)` (cents). XOF: already smallest unit |
| **Currency support** | Account-dependent; USD requires international payments enabled |
| **"Currency not supported"** | Return clear error, no silent fallback |

## Changes

### 1. Edge Function (`supabase/functions/paystack-initialize/index.ts`)

- **France**: Expects `amount` in EUR, `currency: 'EUR'`
  - Fetches live EUR/USD rate (exchangerate-api.com)
  - Caches rate 30 minutes
  - `usd = round(eur_total * rate, 2)`
  - `paystack_amount = Math.round(usd * 100)` (integer cents)
  - Sends `currency: "USD"`, `amount: paystack_amount`
  - Structured logs: `eur_total`, `rate_used`, `usd_total`, `paystack_amount`, `reference`, `order_id`

- **Côte d'Ivoire**: Unchanged. XOF in subunits (zero-decimal).

- **Error handling**: Detects "Currency not supported by merchant" and returns:
  ```
  Payments in USD are not enabled for this merchant. Please contact support to enable 
  international payments (USD) in your Paystack dashboard...
  ```

### 2. Angular Checkout (`src/app/landing/checkout/checkout.component.ts`)

- **France**: Sends `amount: cartTotal` (EUR), `currency: 'EUR'`
- **No client-side FX conversion**
- UI prices stay in EUR

### 3. PaystackService

- Passes through `displayed_currency`, `displayed_amount`, `pay_currency`, `pay_amount`, `fx_rate` from Edge Function response

## Deploy

```bash
supabase functions deploy paystack-initialize
```

## Environment (Edge Function)

- `EXCHANGERATE_API_KEY` (optional): For exchangerate-api.com v6
- `EUR_USD_FALLBACK_RATE` (optional): Fallback if FX API fails (default: 1.10)
- `PAYSTACK_SECRET_KEY`: Required

## If "Currency not supported by merchant" persists

1. Enable **international payments** in Paystack Dashboard
2. Enable **USD** for your merchant account
3. Contact Paystack support if needed: support@paystack.com
