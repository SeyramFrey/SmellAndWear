import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateInvoicePdf } from '../_shared/invoice-pdf.ts'
import { buildInvoiceData } from '../_shared/invoice-helpers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
}

const ORDER_SELECT = `
  id, order_number, statut, total, currency, locale,
  shipping_cost, express_cost, express_delivery, shipping_zone_code,
  server_computed_total, payment_reference, payment_data,
  created_at, invoice_pdf_path, invoice_last_sent_at,
  client:client_id (
    id, nom, prenom, email, telephone
  ),
  items:commande_item (
    id, quantite, prix_unitaire,
    variant:produit_variation_id (
      id,
      produit:produit_id ( nom, prix, front_photo_path ),
      taille:taille_id ( libelle ),
      colors:couleur_id ( nom, hex )
    )
  )
`

// Verify Paystack webhook signature using HMAC SHA512
async function verifyPaystackSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const dataToSign = encoder.encode(payload)

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, dataToSign)
  const hashArray = Array.from(new Uint8Array(signatureBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return hashHex === signature
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY not configured')
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get raw body for signature verification
    const rawBody = await req.text()
    const signature = req.headers.get('x-paystack-signature') || ''

    // Verify webhook signature
    const isValid = await verifyPaystackSignature(rawBody, signature, PAYSTACK_SECRET_KEY)
    if (!isValid) {
      console.error('❌ Invalid Paystack webhook signature')
      // Return 200 to prevent Paystack from retrying
      return new Response('OK', { status: 200, headers: corsHeaders })
    }

    console.log('✅ Paystack webhook signature verified')

    const event = JSON.parse(rawBody)
    console.log('📥 Paystack webhook event:', event.event, event.data?.reference)

    // Handle different event types
    if (event.event === 'charge.success') {
      const transaction = event.data
      const reference = transaction.reference

      if (!reference) {
        console.warn('⚠️ No reference in webhook event')
        return new Response('OK', { status: 200, headers: corsHeaders })
      }

      // Check if this event was already processed (idempotency)
      const { data: existingOrder, error: fetchError } = await supabase
        .from('commande')
        .select('*')
        .eq('payment_reference', reference)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching order:', fetchError)
      }

      // If order exists and is already paid, skip (idempotency)
      if (existingOrder && existingOrder.statut === 'PAID') {
        console.log('✅ Transaction already processed:', reference)
        return new Response('OK', { status: 200, headers: corsHeaders })
      }

      // Update order status + generate order_number if missing
      if (existingOrder) {
        let orderNumber = existingOrder.order_number
        if (!orderNumber) {
          const locale = existingOrder.locale || 'CI'
          const { data: numResult } = await supabase.rpc('generate_order_number', { p_locale: locale })
          orderNumber = numResult || `S&M-${locale}-${Date.now()}`
        }

        const { error: updateError } = await supabase
          .from('commande')
          .update({
            statut: 'PAID',
            order_number: orderNumber,
            payment_data: transaction,
          })
          .eq('id', existingOrder.id)

        if (updateError) {
          console.error('❌ Error updating order:', updateError)
        } else {
          console.log(`✅ Order PAID: ${existingOrder.id} / ${orderNumber}`)

          // Automatically send invoice email (idempotent — skips if already sent)
          await sendInvoiceEmail(supabase, existingOrder.id).catch(e => {
            console.error('❌ Auto invoice email failed (non-blocking):', (e as Error).message)
          })
        }
      } else {
        console.warn('⚠️ Order not found for reference:', reference)
      }

    } else if (event.event === 'charge.failed') {
      const transaction = event.data
      const reference = transaction.reference

      if (reference) {
        const { data: existingOrder } = await supabase
          .from('commande')
          .select('*')
          .eq('payment_reference', reference)
          .single()

        if (existingOrder && existingOrder.statut !== 'FAILED') {
          const { error: updateError } = await supabase
            .from('commande')
            .update({
              statut: 'FAILED',
              payment_data: transaction,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingOrder.id)

          if (updateError) {
            console.error('❌ Error updating failed order:', updateError)
          } else {
            console.log('✅ Order updated to FAILED:', existingOrder.id)
          }
        }
      }
    }

    // Always return 200 OK to Paystack
    return new Response('OK', { status: 200, headers: corsHeaders })

  } catch (error) {
    console.error('❌ Error in paystack-webhook:', error)
    // Always return 200 to prevent Paystack from retrying
    return new Response('OK', { status: 200, headers: corsHeaders })
  }
})

// ─── auto-send invoice email (idempotent) ────────────────────────────────────

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function safeFmtNumber(amount: number, decimals: number): string {
  const fixed = amount.toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return decPart ? `${grouped},${decPart}` : grouped
}

function fmtCurrency(amount: number, currency: string): string {
  if (currency === 'XOF') return `${safeFmtNumber(Math.round(amount), 0)} FCFA`
  return `${safeFmtNumber(amount, 2)} \u20AC`
}

function resolveLocaleFromOrder(order: any): 'FR' | 'CI' {
  const match = (v: any): 'FR' | 'CI' | null => {
    const s = (v || '').toString().toUpperCase()
    if (s === 'FR') return 'FR'
    if (s === 'CI') return 'CI'
    return null
  }
  if (order.locale) { const r = match(order.locale); if (r) return r }
  const pd = order.payment_data
  if (pd && typeof pd === 'object') {
    const r1 = match(pd.locale) || match(pd.country) || match(pd.market)
    if (r1) return r1
    const meta = pd.metadata
    if (meta && typeof meta === 'object') {
      const r2 = match(meta.locale) || match(meta.country) || match(meta.market)
      if (r2) return r2
    }
  }
  return 'CI'
}

const DEFAULT_FX_RATE = 655.957

function computeDisplayTotal(order: any, currency: string): number {
  const envRate = Deno.env.get('EUR_XOF_FALLBACK_RATE')
  const fxRate = envRate ? parseFloat(envRate) : DEFAULT_FX_RATE
  const items = order.items || []
  let subtotal = 0
  for (const item of items) {
    const unitPriceEur = Number(item.prix_unitaire) || 0
    const unitPrice = currency === 'XOF' ? Math.round(unitPriceEur * fxRate) : unitPriceEur
    subtotal += unitPrice * (item.quantite || 1)
  }
  const shipping = currency === 'XOF'
    ? Math.round(Number(order.shipping_cost) || 0)
    : Number(order.shipping_cost) || 0
  const express = currency === 'XOF'
    ? Math.round(Number(order.express_cost) || 0)
    : Number(order.express_cost) || 0
  return subtotal + shipping + express
}

function buildEmailHtml(p: {
  customerName: string; orderNumber: string; total: string;
  orderDate: string; downloadUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#1a1a1a;padding:24px 30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:2px;">SMELL &amp; WEAR</h1>
    </div>
    <div style="padding:30px;">
      <h2 style="margin:0 0 8px;color:#333;font-size:18px;">Confirmation de commande</h2>
      <p style="color:#666;margin:0 0 20px;">Bonjour ${p.customerName},</p>
      <p style="color:#666;margin:0 0 20px;">Merci pour votre achat ! Votre paiement a bien ete recu. Veuillez trouver ci-joint la facture.</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr><td style="padding:10px 12px;background:#f9f9f9;color:#888;font-size:13px;">Commande</td><td style="padding:10px 12px;background:#f9f9f9;font-weight:bold;color:#333;font-size:13px;">${p.orderNumber}</td></tr>
        <tr><td style="padding:10px 12px;color:#888;font-size:13px;">Date</td><td style="padding:10px 12px;font-weight:bold;color:#333;font-size:13px;">${p.orderDate}</td></tr>
        <tr><td style="padding:10px 12px;background:#f9f9f9;color:#888;font-size:13px;">Total</td><td style="padding:10px 12px;background:#f9f9f9;font-weight:bold;color:#B5190C;font-size:15px;">${p.total}</td></tr>
      </table>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${p.downloadUrl}" style="display:inline-block;padding:12px 28px;background:#B5190C;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">Telecharger la facture</a>
      </div>
      <p style="color:#999;font-size:12px;margin:0;">La facture est egalement jointe a cet email en piece jointe PDF.</p>
    </div>
    <div style="background:#f9f9f9;padding:20px 30px;text-align:center;border-top:1px solid #eee;">
      <p style="color:#999;font-size:12px;margin:0 0 4px;">Smell &amp; Wear — <a href="https://smellandwear.com" style="color:#B5190C;">smellandwear.com</a></p>
      <p style="color:#bbb;font-size:11px;margin:0;">Merci pour votre confiance !</p>
    </div>
  </div>
</body>
</html>`
}

/**
 * Automatically generate invoice PDF and send confirmation email.
 * Idempotent: skips if invoice_last_sent_at is already set.
 * Uses service role — no admin JWT needed.
 */
async function sendInvoiceEmail(supabase: any, orderId: string): Promise<void> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const FROM_EMAIL = Deno.env.get('INVOICE_FROM_EMAIL') || 'onboarding@resend.dev'
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

  if (!RESEND_API_KEY) {
    console.warn('[webhook-email] RESEND_API_KEY not configured, skipping email')
    return
  }

  // Re-fetch the full order (now with PAID status and order_number)
  const { data: order, error: orderErr } = await supabase
    .from('commande')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .single()

  if (orderErr || !order) {
    console.error('[webhook-email] Order not found:', orderId)
    return
  }

  // Idempotency: skip if email already sent
  if (order.invoice_last_sent_at) {
    console.log(`[webhook-email] Email already sent at ${order.invoice_last_sent_at}, skipping`)
    return
  }

  const client = order.client
  if (!client?.email) {
    console.warn('[webhook-email] No customer email, skipping')
    return
  }

  const locale = resolveLocaleFromOrder(order)
  const currency = locale === 'FR' ? 'EUR' : 'XOF'
  const orderNumber = order.order_number || orderId.slice(0, 8)

  // Generate PDF
  console.log(`[webhook-email] Generating invoice PDF for ${orderId}`)
  const invoiceData = await buildInvoiceData(supabase, SUPABASE_URL, order, orderId)
  const pdfBytes = await generateInvoicePdf(invoiceData)

  // Upload PDF to storage
  const storagePath = `${orderId}/invoice.pdf`
  await supabase.storage.from('invoices').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  })
  await supabase.from('commande').update({ invoice_pdf_path: storagePath }).eq('id', orderId)

  // Create signed download URL
  const { data: signedData } = await supabase.storage
    .from('invoices')
    .createSignedUrl(storagePath, 7 * 24 * 3600)
  const downloadUrl = signedData?.signedUrl || 'https://smellandwear.com'

  // Format date
  const orderDate = (() => {
    try {
      return new Date(order.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      }).replace(/\u202F/g, ' ').replace(/\u00A0/g, ' ')
    } catch { return '\u2014' }
  })()

  const displayTotal = computeDisplayTotal(order, currency)

  // Send email
  const emailHtml = buildEmailHtml({
    customerName: `${client.prenom} ${client.nom}`,
    orderNumber,
    total: fmtCurrency(displayTotal, currency),
    orderDate,
    downloadUrl,
  })

  console.log(`[webhook-email] Sending invoice to ${client.email}`)
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Smell & Wear <${FROM_EMAIL}>`,
      to: [client.email],
      subject: `Confirmation de commande Smell & Wear \u2014 ${orderNumber}`,
      html: emailHtml,
      attachments: [{
        filename: `facture-${orderNumber.replace(/[^a-zA-Z0-9-]/g, '')}.pdf`,
        content: toBase64(pdfBytes),
      }],
    }),
  })

  const resendData = await resendRes.json()
  if (!resendRes.ok) {
    console.error('[webhook-email] Resend error:', resendData)
    return
  }

  console.log(`[webhook-email] Email sent: ${resendData.id}`)

  // Mark as sent + audit log
  const now = new Date().toISOString()
  await supabase.from('commande').update({ invoice_last_sent_at: now }).eq('id', orderId)
  await supabase.from('order_events').insert({
    order_id: orderId,
    event_type: 'invoice_sent',
    triggered_by: null,
    payload: {
      email: client.email,
      resend_id: resendData.id,
      trigger: 'webhook_auto',
    },
  })
}
