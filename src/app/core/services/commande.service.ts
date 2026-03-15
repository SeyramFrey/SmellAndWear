import { Injectable } from '@angular/core';
import { Commande, CommandeItem, Client } from '../models/models';
import { SupabaseService } from './supabase.service';
import { Observable, from, throwError, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

/**
 * CommandeService - Manages order operations via Supabase
 * 
 * RLS Policy Alignment:
 * =====================
 * The `commande` and `commande_item` tables have the following RLS policies:
 * 
 * SELECT:
 * - Customers can view orders linked to their client record (via email)
 * - Admins can view all orders
 * 
 * INSERT:
 * - Customers can create orders for their own client record
 * - Anonymous users can create orders (guest checkout)
 * - Admins can create any order
 * 
 * UPDATE/DELETE:
 * - Only admins can update/delete orders
 * 
 * This means:
 * - Guest checkout works via anon access
 * - Authenticated customers can only see/create their own orders
 * - Admin dashboard can manage all orders
 * 
 * Error Handling:
 * - RLS violations return 0 rows or permission errors
 * - Service methods should handle these gracefully
 */

export interface CreateOrderRequest {
  client_id: string;
  adresse_livraison_id?: string;
  adresse_facturation_id?: string;
  total: number;
  country_code: string;  // 'FR' | 'CI'
  currency: string;      // 'EUR' | 'XOF'
  items: {
    produit_variation_id: string;
    quantite: number;
    prix_unitaire: number;
  }[];
  payment_reference?: string;
}

export interface OrderWithItems extends Commande {
  items?: CommandeItem[];
  client?: Client;
  tracking_code?: string;
  shipped_at?: string;
  shipping_carrier?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommandeService {
  private tableName = 'commande';
  private itemsTableName = 'commande_item';

  private commandesSubject = new BehaviorSubject<Commande[]>([]);
  public commandes$ = this.commandesSubject.asObservable();

  constructor(private supabaseService: SupabaseService) {}

  /**
   * Get all commandes with client information
   */
  getCommandes(): Observable<Commande[]> {
    return from(this.fetchCommandes()).pipe(
      tap(commandes => this.commandesSubject.next(commandes)),
      catchError(error => {
        console.error('Error fetching commandes:', error);
        return throwError(() => error);
      })
    );
  }

  private async fetchCommandes(): Promise<Commande[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select(`
        *,
        client:client_id (
          id,
          nom,
          prenom,
          email,
          telephone
        ),
        items:commande_item (
          id,
          quantite,
          prix_unitaire,
          variant:produit_variation_id (
            id,
            produit:produit_id (
              nom
            )
          )
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Commande[];
  }

  /**
   * Get commandes by status
   */
  getCommandesByStatus(status: string): Observable<Commande[]> {
    return from(this.fetchCommandesByStatus(status)).pipe(
      catchError(error => {
        console.error('Error fetching commandes by status:', error);
        return throwError(() => error);
      })
    );
  }

  private async fetchCommandesByStatus(status: string): Promise<Commande[]> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select(`
        *,
        client:client_id (
          id,
          nom,
          prenom,
          email,
          telephone
        ),
        items:commande_item (
          id,
          quantite,
          prix_unitaire,
          variant:produit_variation_id (
            id,
            produit:produit_id (
              nom
            )
          )
        )
      `)
      .eq('statut', status)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Commande[];
  }

  /**
   * Get commande by ID with items and client details
   */
  getCommandeById(id: string): Observable<OrderWithItems> {
    return from(this.fetchCommandeById(id)).pipe(
      catchError(error => {
        console.error('Error fetching commande by ID:', error);
        return throwError(() => error);
      })
    );
  }

  private async fetchCommandeById(id: string): Promise<OrderWithItems> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select(`
        *,
        client:client_id (
          id,
          nom,
          prenom,
          email,
          telephone
        ),
        items:commande_item (
          id,
          produit_variation_id,
          quantite,
          prix_unitaire,
          variant:produit_variation_id (
            id,
            produit:produit_id (
              nom,
              description
            ),
            taille:taille_id (
              libelle
            ),
            colors:couleur_id (
              nom,
              hex
            )
          )
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as OrderWithItems;
  }

  /**
   * Create a new order with items
   */
  createOrder(orderRequest: CreateOrderRequest): Observable<Commande> {
    return from(this.performCreateOrder(orderRequest)).pipe(
      tap(() => {
        // Refresh the orders list
        this.refreshCommandes();
      }),
      catchError(error => {
        console.error('Error creating order:', error);
        return throwError(() => error);
      })
    );
  }

  private async performCreateOrder(orderRequest: CreateOrderRequest): Promise<Commande> {
    const client = this.supabaseService.getClient();
    
    try {
      // Begin transaction — include payment_reference so Paystack Edge
      // Function can later look up and update this order by reference.
      const { data: commande, error: commandeError } = await client
        .from(this.tableName)
        .insert({
          client_id: orderRequest.client_id,
          adresse_livraison_id: orderRequest.adresse_livraison_id,
          adresse_facturation_id: orderRequest.adresse_facturation_id,
          total: orderRequest.total,
          country_code: orderRequest.country_code,
          currency: orderRequest.currency,
          locale: orderRequest.country_code,
          statut: 'Nouvelle',
          ...(orderRequest.payment_reference
            ? { payment_reference: orderRequest.payment_reference }
            : {}),
        })
        .select()
        .single();

      if (commandeError) throw commandeError;

      // Insert order items
      const items = orderRequest.items.map(item => ({
        commande_id: commande.id,
        produit_variation_id: item.produit_variation_id,
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire
      }));

      const { error: itemsError } = await client
        .from(this.itemsTableName)
        .insert(items);

      if (itemsError) {
        // Rollback: delete the created commande
        await client.from(this.tableName).delete().eq('id', commande.id);
        throw itemsError;
      }

      return commande as Commande;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Update order status and send notification email to customer
   */
  updateOrderStatus(orderId: string, newStatus: string): Observable<Commande> {
    return from(this.performUpdateOrderStatus(orderId, newStatus)).pipe(
      tap(() => {
        this.refreshCommandes();
      }),
      catchError(error => {
        console.error('Error updating order status:', error);
        return throwError(() => error);
      })
    );
  }

  private async performUpdateOrderStatus(orderId: string, newStatus: string): Promise<Commande> {
    const currentOrder = await this.fetchCommandeById(orderId);
    const oldStatus = currentOrder?.statut;

    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .update({ statut: newStatus })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;

    this.sendStatusNotificationEmail(orderId, newStatus, oldStatus);

    return data as Commande;
  }

  /**
   * Send status change notification email via Edge Function (non-blocking)
   */
  private async sendStatusNotificationEmail(
    orderId: string,
    newStatus: string,
    oldStatus?: string,
  ): Promise<void> {
    try {
      const { data, error } = await this.supabaseService.getClient()
        .functions.invoke('send-order-status-notification', {
          body: { order_id: orderId, new_status: newStatus, old_status: oldStatus },
        });

      if (error) {
        console.error('Status notification email failed:', error);
      } else {
        console.log('Status notification sent:', data);
      }
    } catch (err) {
      console.error('Failed to invoke status notification function:', err);
    }
  }

  /**
   * Delete an order and its related items from Supabase.
   * Deletes commande_item rows first (FK dependency), then the commande row.
   */
  deleteCommande(orderId: string): Observable<void> {
    return from(this.performDeleteCommande(orderId)).pipe(
      catchError(error => {
        console.error('Error deleting order:', error);
        return throwError(() => error);
      })
    );
  }

  private async performDeleteCommande(orderId: string): Promise<void> {
    const client = this.supabaseService.getClient();

    // 1) Delete child rows (commande_item) — FK constraint requires this first
    const { error: itemsError } = await client
      .from(this.itemsTableName)
      .delete()
      .eq('commande_id', orderId);

    if (itemsError) {
      console.warn('Error deleting order items (may be cascade):', itemsError.message);
    }

    // 2) Delete order_events if the table exists (best-effort)
    try {
      await client.from('order_events').delete().eq('order_id', orderId);
    } catch { /* table may not exist — ignore */ }

    // 3) Delete the commande itself
    const { error } = await client
      .from(this.tableName)
      .delete()
      .eq('id', orderId);

    if (error) throw error;
  }

  /**
   * Validate order (change status to "En cours" and trigger email/PDF)
   */
  validateOrder(orderId: string): Observable<boolean> {
    return from(this.performValidateOrder(orderId)).pipe(
      catchError(error => {
        console.error('Error validating order:', error);
        return throwError(() => error);
      })
    );
  }

  private async performValidateOrder(orderId: string): Promise<boolean> {
    try {
      // Get order details with client info
      const orderDetails = await this.fetchCommandeById(orderId);
      
      if (!orderDetails || !orderDetails.client) {
        throw new Error('Order or client not found');
      }

      // Update status to "En cours"
      await this.performUpdateOrderStatus(orderId, 'En cours');

      // Generate PDF invoice
      const pdfBlob = await this.generateInvoicePDF(orderDetails);

      // Send confirmation email with PDF attachment
      await this.sendOrderConfirmationEmail(orderDetails, pdfBlob);

      return true;
    } catch (error) {
      console.error('Order validation failed:', error);
      throw error;
    }
  }

  /**
   * Generate invoice PDF using jsPDF
   */
  private async generateInvoicePDF(order: OrderWithItems): Promise<Blob> {
    // Dynamic import to avoid loading jsPDF until needed
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();

    // Add header
    doc.setFontSize(20);
    doc.text('Smell&Wear - Facture', 20, 30);

    doc.setFontSize(12);
    doc.text(`Commande N°: ${order.id}`, 20, 50);
    doc.text(`Date: ${new Date(order.created_at!).toLocaleDateString('fr-FR').replace(/\u202F/g, ' ')}`, 20, 60);

    // Client information
    if (order.client) {
      doc.text('Informations client:', 20, 80);
      doc.text(`${order.client.prenom} ${order.client.nom}`, 20, 90);
      doc.text(`Email: ${order.client.email}`, 20, 100);
      if (order.client.telephone) {
        doc.text(`Téléphone: ${order.client.telephone}`, 20, 110);
      }
    }

    // Items table
    const tableData = order.items?.map((item: any) => [
      item.variant?.produit?.nom || 'Produit inconnu',
      item.variant?.taille?.libelle || '',
      item.variant?.colors?.nom || '',
      item.quantite.toString(),
      `${item.prix_unitaire}€`,
      `${(item.quantite * item.prix_unitaire).toFixed(2)}€`
    ]) || [];

    (doc as any).autoTable({
      head: [['Produit', 'Taille', 'Couleur', 'Quantité', 'Prix unitaire', 'Total']],
      body: tableData,
      startY: 130,
    });

    // Total
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text(`Total: ${order.total}€`, 20, finalY);

    // Footer
    doc.setFontSize(10);
    doc.text('Merci pour votre commande!', 20, finalY + 30);
    doc.text('Smell&Wear - Mode éthique et durable', 20, finalY + 40);

    return doc.output('blob');
  }

  /**
   * Send order confirmation email
   */
  private async sendOrderConfirmationEmail(order: OrderWithItems, pdfBlob: Blob): Promise<void> {
    // This would typically call a backend API or Edge Function to send the email
    // For now, we'll log the action and simulate the email sending
    
    console.log('Sending confirmation email to:', order.client?.email);
    console.log('Order details:', order);
    console.log('PDF generated, size:', pdfBlob.size, 'bytes');

    // In a real implementation, you would:
    // 1. Upload the PDF to storage
    // 2. Call an email service (SendGrid, Mailgun, etc.) via your backend
    // 3. Or use a Supabase Edge Function to handle email sending
    
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // TODO: Implement actual email sending through backend service
    console.log('Email sent successfully (simulated)');
  }

  /**
   * Check if payment reference already exists to prevent duplicates
   */
  checkPaymentReferenceExists(paymentReference: string): Observable<boolean> {
    return from(this.performCheckPaymentReference(paymentReference)).pipe(
      catchError(error => {
        console.error('Error checking payment reference:', error);
        return throwError(() => error);
      })
    );
  }

  private async performCheckPaymentReference(paymentReference: string): Promise<boolean> {
    const { data, error } = await this.supabaseService.getClient()
      .from(this.tableName)
      .select('id')
      .eq('payment_reference', paymentReference)
      .limit(1);

    if (error) throw error;
    return data && data.length > 0;
  }

  /**
   * Refresh the commandes list
   */
  refreshCommandes(): void {
    this.getCommandes().subscribe();
  }

  /**
   * Update order tracking code and set status to "Expédiée"
   * Optionally sends shipping notification email to customer
   */
  updateOrderTracking(
    orderId: string, 
    trackingCode: string, 
    carrier: string,
    notifyCustomer: boolean = true
  ): Observable<boolean> {
    return from(this.performUpdateTracking(orderId, trackingCode, carrier, notifyCustomer)).pipe(
      tap(() => this.refreshCommandes()),
      catchError(error => {
        console.error('Error updating tracking:', error);
        return throwError(() => error);
      })
    );
  }

  private async performUpdateTracking(
    orderId: string, 
    trackingCode: string, 
    carrier: string,
    notifyCustomer: boolean
  ): Promise<boolean> {
    const client = this.supabaseService.getClient();
    
    // Update order with tracking info and change status to Expédiée
    const { error: updateError } = await client
      .from(this.tableName)
      .update({
        tracking_code: trackingCode,
        shipping_carrier: carrier,
        shipped_at: new Date().toISOString(),
        statut: 'Expédiée'
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // Send notification email if requested
    if (notifyCustomer) {
      await this.sendShippingNotificationEmail(orderId);
    }

    return true;
  }

  /**
   * Send shipping notification email to customer
   */
  sendShippingNotification(orderId: string): Observable<boolean> {
    return from(this.sendShippingNotificationEmail(orderId)).pipe(
      map(() => true),
      catchError(error => {
        console.error('Error sending shipping notification:', error);
        return throwError(() => error);
      })
    );
  }

  private async sendShippingNotificationEmail(orderId: string): Promise<void> {
    // Fetch the order with client details
    const order = await this.fetchCommandeById(orderId);
    
    if (!order || !order.client?.email) {
      console.warn('Cannot send shipping notification: missing client email');
      return;
    }

    // Call Supabase Edge Function to send the email
    const client = this.supabaseService.getClient();
    
    try {
      const { data, error } = await client.functions.invoke('send-shipping-notification', {
        body: {
          orderId: order.id,
          customerEmail: order.client.email,
          customerName: `${order.client.prenom} ${order.client.nom}`,
          trackingCode: order.tracking_code,
          carrier: order.shipping_carrier,
          orderTotal: order.total
        }
      });

      if (error) {
        console.error('Error calling shipping notification function:', error);
        // Don't throw - email sending failure shouldn't block the tracking update
      } else {
        console.log('Shipping notification sent successfully:', data);
      }
    } catch (functionError) {
      console.error('Failed to invoke shipping notification function:', functionError);
      // Fallback: Log the email that should be sent
      console.log('=== SHIPPING NOTIFICATION EMAIL (FALLBACK) ===');
      console.log('To:', order.client.email);
      console.log('Subject: Votre commande est en route!');
      console.log('Body:');
      console.log(`Bonjour ${order.client.prenom},`);
      console.log(`Votre commande #${order.id.slice(0, 8)} est en route!`);
      console.log(`Code de suivi: ${order.tracking_code}`);
      console.log(`Transporteur: ${order.shipping_carrier}`);
      console.log('==============================================');
    }
  }
}