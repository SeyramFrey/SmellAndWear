/**
 * Paystack Verify Edge Function  (v2 – full verification + order finalization)
 *
 * Called by the Angular frontend after Paystack redirects the user back.
 *
 * Steps:
 *   1. Call Paystack /transaction/verify/:reference
 *   2. Validate status === 'success'
 *   3. Find the order by payment_reference
 *   4. Idempotency: if already PAID, return existing order data
 *   5. Validate amount paid matches server_computed_total
 *   6. Generate order_number via generate_order_number(locale)
 *   7. Update order → PAID
 *   8. Return full order details for the success page
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateInvoicePdf } from '../_shared/invoice-pdf.ts'
import { buildInvoiceData } from '../_shared/invoice-helpers.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!PAYSTACK_SECRET_KEY) return json({ error: 'PAYSTACK_SECRET_KEY not configured' }, 500)

    const body = await req.json().catch(() => null)
    if (!body) return json({ error: 'Invalid JSON' }, 400)

    const { reference } = body as { reference?: string }
    if (!reference) return json({ error: 'reference is required' }, 400)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── 1. Find the order ───────────────────────────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from('commande')
      .select('id, statut, order_number, locale, country_code, server_computed_total, total, currency, payment_reference, shipping_cost, express_cost, express_delivery')
      .eq('payment_reference', reference)
      .single()

    if (orderErr || !order) {
      console.warn(`[paystack-verify] No order for ref=${reference}`)
      return json({ error: 'Order not found for this reference', reference }, 404)
    }

    // ── 2. Idempotency: already processed ───────────────────────────────
    if (order.statut === 'PAID' && order.order_number) {
      console.log(`[paystack-verify] Already PAID: ${order.id} / ${order.order_number}`)
      const details = await fetchOrderDetails(supabase, order.id)
      return json({
        status: 'success',
        order_id: order.id,
        order_number: order.order_number,
        already_processed: true,
        order: details,
      })
    }

    // ── 3. Verify with Paystack ─────────────────────────────────────────
    const psRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    const psData = await psRes.json()

    if (!psRes.ok || !psData.status) {
      console.error('[paystack-verify] Paystack error:', psData.message)
      return json({
        status: 'failed',
        error: psData.message || 'Paystack verification failed',
      }, 400)
    }

    const txn = psData.data

    // ── 4. Check payment status ─────────────────────────────────────────
    if (txn.status !== 'success') {
      console.log(`[paystack-verify] Payment not successful: ${txn.status}`)

      await supabase.from('commande').update({
        statut: txn.status === 'failed' ? 'FAILED' : 'PENDING',
        payment_data: txn,
      }).eq('id', order.id)

      return json({
        status: txn.status,
        error: `Payment status: ${txn.status}`,
        order_id: order.id,
      })
    }

    // ── 5. Validate currency + amount ───────────────────────────────────
    // Paystack returns amount in subunits (major × 100), even for XOF.
    // server_computed_total is stored in the same subunit format.
    //
    // Currency note: paystack-initialize always calls Paystack with currency:'XOF'
    // regardless of the customer's locale (FR or CI). All totals are converted
    // to XOF server-side before the Paystack call. Paystack therefore always
    // reports txn.currency = 'XOF' in this verify response, for all locales.
    const paidAmount = txn.amount
    const paidCurrency = (txn.currency || '').toUpperCase()
    const expectedAmount = order.server_computed_total

    const currencyOk = paidCurrency === 'XOF'
    if (!currencyOk) {
      console.error(JSON.stringify({
        event: 'paystack_verify_currency_mismatch',
        order_id: order.id,
        expected_currency: 'XOF',
        paid_currency: paidCurrency,
      }))
    }

    // Amount validation (tolerance of 1 unit for rounding)
    const amountOk = !expectedAmount || Math.abs(paidAmount - expectedAmount) <= 1
    if (!amountOk) {
      console.error(JSON.stringify({
        event: 'paystack_verify_amount_mismatch',
        order_id: order.id,
        expected: expectedAmount,
        paid: paidAmount,
        currency: paidCurrency,
      }))
    }

    // Guard: reject if either check failed — do NOT proceed to mark order PAID
    if (!currencyOk || !amountOk) {
      return json({
        status: 'failed',
        error: !currencyOk
          ? `Currency mismatch: expected XOF, received ${paidCurrency}`
          : `Amount mismatch: expected ${expectedAmount}, received ${paidAmount}`,
        order_id: order.id,
      }, 400)
    }

    // ── 6. Generate order number ────────────────────────────────────────
    const locale = order.country_code || order.locale || 'CI'
    const { data: numResult } = await supabase.rpc('generate_order_number', { p_locale: locale })
    const orderNumber = numResult || `S&M-${locale}-${Date.now()}`

    console.log(JSON.stringify({
      event: 'paystack_verify_success',
      order_id: order.id,
      order_number: orderNumber,
      paid_amount: paidAmount,
      expected_amount: expectedAmount,
      currency: paidCurrency,
    }))

    // ── 7. Update order → PAID ──────────────────────────────────────────
    await supabase.from('commande').update({
      statut: 'PAID',
      order_number: orderNumber,
      payment_data: txn,
    }).eq('id', order.id)

    // ── 7b. Auto-send invoice email (idempotent, non-blocking) ───────
    triggerInvoiceEmail(supabase, order.id).catch(e => {
      console.error('[paystack-verify] Auto invoice email failed (non-blocking):', (e as Error).message)
    })

    // ── 8. Return full order details ────────────────────────────────────
    const details = await fetchOrderDetails(supabase, order.id)

    return json({
      status: 'success',
      order_id: order.id,
      order_number: orderNumber,
      order: details,
    })

  } catch (e) {
    console.error('[paystack-verify] unhandled:', (e as Error).message)
    return json({ error: (e as Error).message || 'Internal error' }, 500)
  }
})

// ─── helpers ────────────────────────────────────────────────────────────────

const FULL_ORDER_SELECT = `
  id, order_number, statut, total, currency, locale, country_code,
  shipping_cost, express_cost, express_delivery, shipping_zone_code,
  server_computed_total, exchange_rate_eur_to_xof, payment_reference,
  payment_data, created_at, invoice_pdf_path, invoice_last_sent_at,
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

async function fetchOrderDetails(supabase: any, orderId: string) {
  const { data } = await supabase
    .from('commande')
    .select(FULL_ORDER_SELECT)
    .eq('id', orderId)
    .single()

  return data
}

// ─── auto invoice email (idempotent) ─────────────────────────────────────────

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
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
  const shipping = currency === 'XOF' ? Math.round(Number(order.shipping_cost) || 0) : Number(order.shipping_cost) || 0
  const express = currency === 'XOF' ? Math.round(Number(order.express_cost) || 0) : Number(order.express_cost) || 0
  return subtotal + shipping + express
}

function buildConfirmationEmailHtml(p: {
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
 * Idempotent invoice email trigger.
 * Skips if invoice_last_sent_at is already set (webhook or previous call won).
 */
async function triggerInvoiceEmail(supabase: any, orderId: string): Promise<void> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const FROM_EMAIL = Deno.env.get('INVOICE_FROM_EMAIL') || 'onboarding@resend.dev'
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

  if (!RESEND_API_KEY) {
    console.warn('[verify-email] RESEND_API_KEY not configured, skipping')
    return
  }

  const { data: order, error: orderErr } = await supabase
    .from('commande')
    .select(FULL_ORDER_SELECT)
    .eq('id', orderId)
    .single()

  if (orderErr || !order) { console.error('[verify-email] Order not found'); return }
  if (order.invoice_last_sent_at) {
    console.log(`[verify-email] Already sent at ${order.invoice_last_sent_at}, skipping`)
    return
  }

  const client = order.client
  if (!client?.email) { console.warn('[verify-email] No email'); return }

  const locale = resolveLocaleFromOrder(order)
  const currency = locale === 'FR' ? 'EUR' : 'XOF'
  const orderNumber = order.order_number || orderId.slice(0, 8)

  console.log(`[verify-email] Generating invoice for ${orderId}`)
  const invoiceData = await buildInvoiceData(supabase, SUPABASE_URL, order, orderId)
  const pdfBytes = await generateInvoicePdf(invoiceData)

  const storagePath = `${orderId}/invoice.pdf`
  await supabase.storage.from('invoices').upload(storagePath, pdfBytes, {
    contentType: 'application/pdf', upsert: true,
  })
  await supabase.from('commande').update({ invoice_pdf_path: storagePath }).eq('id', orderId)

  const { data: signedData } = await supabase.storage
    .from('invoices').createSignedUrl(storagePath, 7 * 24 * 3600)
  const downloadUrl = signedData?.signedUrl || 'https://smellandwear.com'

  const orderDate = (() => {
    try {
      return new Date(order.created_at).toLocaleDateString('fr-FR', {
        day: '2-digit', month: 'long', year: 'numeric',
      }).replace(/\u202F/g, ' ').replace(/\u00A0/g, ' ')
    } catch { return '\u2014' }
  })()

  const displayTotal = computeDisplayTotal(order, currency)

  const emailHtml = buildConfirmationEmailHtml({
    customerName: `${client.prenom} ${client.nom}`,
    orderNumber,
    total: fmtCurrency(displayTotal, currency),
    orderDate,
    downloadUrl,
  })

  console.log(`[verify-email] Sending to ${client.email}`)
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
  if (!resendRes.ok) { console.error('[verify-email] Resend error:', resendData); return }

  console.log(`[verify-email] Email sent: ${resendData.id}`)
  const now = new Date().toISOString()
  await supabase.from('commande').update({ invoice_last_sent_at: now }).eq('id', orderId)
  await supabase.from('order_events').insert({
    order_id: orderId,
    event_type: 'invoice_sent',
    triggered_by: null,
    payload: { email: client.email, resend_id: resendData.id, trigger: 'verify_auto' },
  })
}
