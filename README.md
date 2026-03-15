# Smell & Wear

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 13.1.4.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

---

## Paystack Payment Integration

### Currency Rules

| Locale | Display currency | Paystack currency | Conversion |
|--------|-----------------|-------------------|------------|
| **FR** (France) | EUR | XOF | EUR × live FX rate → XOF (zero-decimal) |
| **CI** (Côte d'Ivoire) | XOF | XOF | Product EUR prices × FX rate → XOF, shipping already in XOF |

- **XOF is zero-decimal**: `amount = 19800` means **19 800 XOF** (no ×100).
- EUR/USD are NOT zero-decimal: if ever used directly, multiply by 100.
- FX rate source: `exchangerate-api.com` (live), fallback `655.957` (CFA peg).

### How Totals Are Computed (Server-Side)

The `paystack-initialize` Edge Function is the **source of truth** for the amount charged:

1. Fetch order items from `commande_item` → `variant` → `produit.prix` (canonical EUR price).
2. Compute `subtotal_eur = SUM(prix × quantite)`.
3. Fetch shipping from `livraison_tarifs` (by `country_code` + `zone_code`).
4. Fetch express fee if `express_delivery = true`.
5. **CI**: `total_xof = (subtotal_eur × FX) + shipping_xof + express_xof`.
6. **FR**: `total_xof = (subtotal_eur + shipping_eur + express_eur) × FX`.
7. `paystack_amount = Math.round(total_xof)` (zero-decimal).
8. The computed total is stored in `commande.server_computed_total`.

The client **never** sends an arbitrary amount to Paystack.

### Order Number Format

- **FR**: `S&M-FR-00000001`
- **CI**: `S&M-CI-00000001`

Generated atomically via Postgres sequence `order_number_seq` on successful payment verification.

### Payment Flow

```
Client                    Edge Functions              Paystack
  |                            |                         |
  |-- POST /checkout --------->|                         |
  |   (create order in DB)     |                         |
  |                            |                         |
  |-- paystack-initialize ---->|                         |
  |   (order_id, email,        |-- compute total ------->|
  |    locale, zone, express)  |-- POST /initialize ---->|
  |<-- authorization_url ------|<-- auth URL ------------|
  |                            |                         |
  |-- redirect to Paystack --->|                         |
  |                            |                         |
  |<-- redirect to /checkout/success?reference=XXX ------|
  |                            |                         |
  |-- paystack-verify -------->|                         |
  |   (reference)              |-- GET /verify/:ref ---->|
  |                            |-- validate amounts      |
  |                            |-- generate order_number |
  |                            |-- update order → PAID   |
  |<-- order details -----------|                        |
  |   (order_number, items,    |                         |
  |    totals, delivery info)  |                         |
```

### Manual Test Checklist

- [ ] **CI cart + shipping**: Add 2+ items, select Abidjan Nord zone → Paystack shows correct XOF total (items × FX + shipping).
- [ ] **FR cart + no shipping**: Add items, fill IDF address → Paystack shows correct XOF equivalent of EUR total.
- [ ] **Express delivery**: Toggle express ON → total increases by express fee.
- [ ] **Payment success**: After Paystack payment → redirected to `/checkout/success`, order number displayed (S&M-CI-XXXXXXXX or S&M-FR-XXXXXXXX).
- [ ] **Cart cleared**: After success page loads, cart is empty.
- [ ] **Idempotency**: Refresh the success page → same order shown, no duplicate created.
- [ ] **Payment failure**: Cancel on Paystack → error state on success page with retry link.
- [ ] **Webhook backup**: Even if client-side verify fails, webhook should update order to PAID.

### Environment Variables (Edge Functions)

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYSTACK_SECRET_KEY` | Yes | Paystack secret key |
| `SUPABASE_URL` | Yes (auto) | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (auto) | Service role key |
| `EXCHANGERATE_API_KEY` | No | exchangerate-api.com key (uses free tier if absent) |
| `EUR_XOF_FALLBACK_RATE` | No | Fallback FX rate (default: 655.957) |
| `RESEND_API_KEY` | Yes* | Resend API key (required for invoice emails) |
| `INVOICE_FROM_EMAIL` | No | Sender email (default: `onboarding@resend.dev`) |
| `INVOICE_LOGO_PATH` | No | Logo path in `public-images` bucket (default: `brand/invoice-logo.png`) |

---

## Invoice PDF & Email System

### Overview

Admins can generate professional PDF invoices and send them to customers via email, directly from the order details page. Everything runs server-side through Supabase Edge Functions.

### Architecture

```
Admin UI (order-details)
  │
  ├─ "Télécharger PDF" ──▶ invoice-generate (Edge Function)
  │                           ├── Fetch order + items + products from DB
  │                           ├── Fetch product thumbnails (image transforms)
  │                           ├── Generate PDF with pdf-lib
  │                           ├── Upload to Storage (invoices bucket)
  │                           └── Return signed download URL
  │
  └─ "Envoyer facture" ──▶ invoice-send (Edge Function)
                              ├── Generate PDF (if needed / regenerate)
                              ├── Build branded HTML email
                              ├── Send via Resend API (PDF attached)
                              ├── Update commande.invoice_last_sent_at
                              └── Log event in order_events table
```

### PDF Design

The generated invoice includes:
- **Header**: Logo (if uploaded to Storage) or "SMELL & WEAR" text + "FACTURE" title
- **Order info**: Order number, date, payment reference
- **Customer block**: Name, email, phone
- **Shipping block**: Locale, zone, express flag
- **Items table**: Product thumbnail (60×60 JPEG via image transforms), name, variant (size/color), quantity, unit price, line total
- **Totals**: Subtotal, shipping, express, total paid (bold)
- **Payment**: Paystack reference
- **Footer**: Website, support email, "Merci pour votre achat !"

### Storage

- Bucket: `invoices` (private, admin-only access)
- File path: `{order_id}/invoice.pdf` (upserted on regeneration)
- The signed URL returned is valid for 1 hour (download) or 7 days (email link)

### Database Changes

```sql
-- On commande table:
invoice_pdf_path TEXT           -- Storage path to the PDF
invoice_last_sent_at TIMESTAMPTZ -- Last time invoice email was sent

-- New audit table:
order_events (id, order_id, event_type, payload, triggered_by, created_at)
```

### How to Re-send an Invoice

1. Go to **Admin > Ecommerce > Orders**
2. Click on an order to view details
3. In the right sidebar, find the **Facture** card
4. Click **"Générer et envoyer"** to create a fresh PDF and email it
5. Click **"Renvoyer (sans régénérer)"** to re-send the existing PDF
6. Click **"Télécharger PDF"** to download it directly

### Setup Requirements

1. **Resend account**: Sign up at [resend.com](https://resend.com), get an API key
2. **Set the secret**:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx --project-ref ciiqdruaphzxratjpqzk
   ```
3. **Custom sender domain** (production): Add and verify your domain in Resend, then set:
   ```bash
   supabase secrets set INVOICE_FROM_EMAIL=invoices@smellandwear.com --project-ref ciiqdruaphzxratjpqzk
   ```
4. **Logo** (optional): Upload a PNG logo to `public-images/brand/invoice-logo.png` in Supabase Storage
5. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy invoice-generate --project-ref ciiqdruaphzxratjpqzk
   supabase functions deploy invoice-send --project-ref ciiqdruaphzxratjpqzk
   ```

### Testing Checklist

- [ ] Click "Télécharger PDF" → PDF opens in new tab with correct order details
- [ ] Click "Générer et envoyer" → Email received with PDF attachment
- [ ] Click "Renvoyer (sans régénérer)" → Same PDF re-sent, no regeneration
- [ ] "Dernier envoi" date updates after each send
- [ ] Non-admin user cannot trigger the functions (403 error)
- [ ] Order with missing customer email → clear error message
- [ ] Product thumbnails appear in PDF (or gracefully skipped if image missing)
