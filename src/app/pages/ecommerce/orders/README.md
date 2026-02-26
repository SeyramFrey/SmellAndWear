# Orders Management System

This document describes the complete Orders Management flow implemented for the Smell&Wear Angular e-commerce application.

## Overview

The Orders Management system handles the complete lifecycle of orders from payment validation through order fulfillment, with automatic email notifications and PDF invoice generation.

## Architecture

### Database Schema

The system uses the following Supabase tables:

#### `commande` table
- `id` (UUID, Primary Key)
- `client_id` (UUID, Foreign Key to `client`)
- `adresse_livraison_id` (UUID, Foreign Key to `adresse`)
- `adresse_facturation_id` (UUID, Foreign Key to `adresse`)
- `statut` (TEXT) - Order status: 'Nouvelle' | 'En cours' | 'Expédiée' | 'Livrée' | 'Annulée'
- `total` (NUMERIC) - Order total amount
- `created_at` (TIMESTAMP) - Order creation date
- `payment_reference` (TEXT) - CinetPay payment reference

#### `commande_item` table
- `id` (UUID, Primary Key)
- `commande_id` (UUID, Foreign Key to `commande`)
- `produit_variation_id` (UUID, Foreign Key to `variant`)
- `quantite` (INTEGER) - Item quantity
- `prix_unitaire` (NUMERIC) - Unit price

### Services

#### `CommandeService`
- **Location**: `src/app/core/services/commande.service.ts`
- **Purpose**: Handles all order operations with Supabase integration

**Key Methods:**
- `getCommandes()` - Fetch all orders with client information
- `getCommandesByStatus(status)` - Filter orders by status
- `createOrder(orderRequest)` - Create new order with items
- `updateOrderStatus(orderId, status)` - Update order status
- `validateOrder(orderId)` - Validate order, send email, generate PDF
- `generateInvoicePDF(order)` - Generate PDF invoice using jsPDF
- `sendOrderConfirmationEmail(order, pdf)` - Send confirmation email

## Implementation Details

### 1. Order Creation (Checkout Flow)

**Location**: `src/app/landing/checkout/checkout.component.ts`

When CinetPay payment is successful:

```typescript
private saveOrder(paymentData: any): Promise<void> {
  const orderRequest: CreateOrderRequest = {
    client_id: this.getCurrentClientId(),
    total: this.cartTotal,
    items: this.cartItems.map(item => ({
      produit_variation_id: item.variantId,
      quantite: item.quantity,
      prix_unitaire: item.price
    })),
    payment_reference: paymentData.reference || this.transactionId
  };

  return this.commandeService.createOrder(orderRequest).toPromise();
}
```

**Features:**
- Creates order with status "Nouvelle"
- Links payment reference to prevent duplicates
- Stores cart items as order items
- Handles transaction rollback if any operation fails

### 2. Orders Management (Admin Interface)

**Location**: `src/app/pages/ecommerce/orders/orders.component.ts`

**Features:**
- **Real-time Data**: Orders fetched from Supabase with reactive updates
- **Status Filtering**: Filter orders by status using tabs
- **Search Functionality**: Search by order ID, customer name, email, or status
- **Order Validation**: Click "Edit" button to validate orders with status "Nouvelle"

**Tab Navigation:**
- **All**: Shows all orders
- **Pending**: Shows orders with status "Nouvelle"
- **In Progress**: Shows orders with status "En cours"
- **Pickups**: Shows orders with status "Expédiée"
- **Delivered**: Shows orders with status "Livrée"
- **Cancelled**: Shows orders with status "Annulée"

### 3. Order Validation Process

When an admin clicks the "Edit" button for a "Nouvelle" order:

1. **Status Update**: Order status changes to "En cours"
2. **PDF Generation**: Invoice PDF created using jsPDF with:
   - Order details (ID, date, customer info)
   - Itemized product list with quantities and prices
   - Total amount
   - Company branding
3. **Email Notification**: Confirmation email sent to customer with PDF attachment

### 4. PDF Invoice Generation

**Dependencies**: `jspdf`, `jspdf-autotable`

The PDF includes:
- Company header with "Smell&Wear - Facture"
- Order number and date
- Customer information
- Detailed item table with product names, sizes, colors, quantities, and prices
- Total amount
- Company footer

### 5. Security (RLS Policies)

**Applied Policies:**
- Authenticated users can view all orders (admin interface)
- Authenticated users can create orders (checkout process)
- Authenticated users can update orders (admin operations)
- Authenticated users can delete orders (admin operations)
- Same permissions apply to order items

**Note**: In production, implement role-based access control to distinguish between customers and admins.

## Status Flow

```
Payment Success → Order Created (Nouvelle) → Admin Validation → Status Updated (En cours) → Email + PDF Sent
```

## Dependencies

### Required NPM Packages
- `jspdf` - PDF generation
- `jspdf-autotable` - Table formatting in PDFs

### Angular Dependencies
- `@supabase/supabase-js` - Database operations
- `rxjs` - Reactive programming
- `@ng-bootstrap/ng-bootstrap` - UI components

## Testing

A test order has been created in the database:
- **Client**: Test Client (test@example.com)
- **Order ID**: Available in Supabase
- **Status**: "Nouvelle"
- **Total**: €99.99

## Future Enhancements

1. **Authentication Integration**: Replace mock client ID with real authentication
2. **Email Service**: Implement actual email sending (currently simulated)
3. **Role-Based Access**: Implement proper admin/customer role distinction
4. **Order Tracking**: Add tracking number and shipping updates
5. **Inventory Management**: Update stock levels when orders are created
6. **Payment Verification**: Enhance payment verification with backend validation

## Usage

### For Customers (Checkout)
1. Complete checkout form
2. Proceed with CinetPay payment
3. Upon successful payment, order is automatically created
4. Order appears in admin interface with status "Nouvelle"

### For Admins (Orders Management)
1. Navigate to Orders page
2. View orders by status using tabs
3. Search and filter orders as needed
4. Click "Edit" (checkmark icon) on "Nouvelle" orders to validate
5. System automatically:
   - Updates status to "En cours"
   - Generates PDF invoice
   - Sends confirmation email to customer

## Error Handling

- Database transaction rollback on order creation failure
- Graceful error handling for PDF generation
- User-friendly error messages using SweetAlert2
- Comprehensive logging for debugging

## Performance Optimizations

- OnPush change detection strategy
- Debounced search functionality
- Efficient Supabase queries with joins
- Lazy loading of jsPDF library
- Reactive data management with BehaviorSubject
