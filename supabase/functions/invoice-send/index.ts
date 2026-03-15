/**
 * invoice-send Edge Function
 *
 * Generates (or re-uses) an invoice PDF and sends it to the customer
 * as an email attachment via Resend.
 *
 * POST { order_id: string, regenerate?: boolean }
 * Auth: admin only (JWT + admin table check)
 *
 * Env vars:
 *   RESEND_API_KEY          – Resend API key
 *   INVOICE_FROM_EMAIL      – sender address (default: onboarding@resend.dev)
 *   INVOICE_LOGO_PATH       – logo path in public-images bucket
 *
 * Returns: { ok, order_id, order_number, invoice_last_sent_at }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateInvoicePdf } from '../_shared/invoice-pdf.ts'
import { buildInvoiceData } from '../_shared/invoice-helpers.ts'

const ORDER_SELECT = `
  id, order_number, statut, total, currency, locale,
  shipping_cost, express_cost, express_delivery, shipping_zone_code,
  server_computed_total, payment_reference, payment_data,
  created_at, invoice_pdf_path,
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
  if (currency === 'XOF') {
    return `${safeFmtNumber(Math.round(amount), 0)} FCFA`
  }
  return `${safeFmtNumber(amount, 2)} \u20AC`
}

function resolveLocaleFromOrder(order: any): 'FR' | 'CI' {
  const match = (v: any): 'FR' | 'CI' | null => {
    const s = (v || '').toString().toUpperCase()
    if (s === 'FR') return 'FR'
    if (s === 'CI') return 'CI'
    return null
  }

  if (order.locale) {
    const r = match(order.locale)
    if (r) return r
  }

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

/**
 * Compute the display-currency total from order items + shipping/express.
 * Mirrors the logic in buildInvoiceData to guarantee PDF ↔ email consistency.
 */
function computeDisplayTotal(order: any, currency: string): number {
  const envRate = Deno.env.get('EUR_XOF_FALLBACK_RATE')
  const fxRate = envRate ? parseFloat(envRate) : DEFAULT_FX_RATE

  const items = order.items || []
  let subtotal = 0
  for (const item of items) {
    const unitPriceEur = Number(item.prix_unitaire) || 0
    const unitPrice = currency === 'XOF'
      ? Math.round(unitPriceEur * fxRate)
      : unitPriceEur
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

// ─── HTML email template ────────────────────────────────────────────────────

function buildEmailHtml(p: {
  customerName: string
  orderNumber: string
  total: string
  orderDate: string
  downloadUrl: string
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
      <h2 style="margin:0 0 8px;color:#333;font-size:18px;">Votre facture</h2>
      <p style="color:#666;margin:0 0 20px;">Bonjour ${p.customerName},</p>
      <p style="color:#666;margin:0 0 20px;">Veuillez trouver ci-joint la facture pour votre commande.</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:10px 12px;background:#f9f9f9;border-radius:4px 0 0 4px;color:#888;font-size:13px;">Commande</td>
          <td style="padding:10px 12px;background:#f9f9f9;font-weight:bold;color:#333;font-size:13px;">${p.orderNumber}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;color:#888;font-size:13px;">Date</td>
          <td style="padding:10px 12px;font-weight:bold;color:#333;font-size:13px;">${p.orderDate}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#f9f9f9;border-radius:0 0 0 4px;color:#888;font-size:13px;">Total</td>
          <td style="padding:10px 12px;background:#f9f9f9;border-radius:0 0 4px 0;font-weight:bold;color:#B5190C;font-size:15px;">${p.total}</td>
        </tr>
      </table>

      <div style="text-align:center;margin-bottom:24px;">
        <a href="${p.downloadUrl}" style="display:inline-block;padding:12px 28px;background:#B5190C;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">
          Telecharger la facture
        </a>
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

// ─── main ───────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const FROM_EMAIL = Deno.env.get('INVOICE_FROM_EMAIL') || 'onboarding@resend.dev'

    if (!RESEND_API_KEY) {
      return json({ error: 'RESEND_API_KEY is not configured. Set it in Edge Function secrets.' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // ── auth: verify admin ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing authorization' }, 401)

    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY') || SUPABASE_SERVICE_KEY,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Invalid token' }, 401)

    const { data: adminCheck } = await supabase
      .from('admin').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!adminCheck) return json({ error: 'Admin access required' }, 403)

    // ── parse body ──────────────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body?.order_id) return json({ error: 'order_id is required' }, 400)

    const { order_id, regenerate } = body as { order_id: string; regenerate?: boolean }

    // ── fetch full order ────────────────────────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from('commande')
      .select(ORDER_SELECT)
      .eq('id', order_id)
      .single()

    if (orderErr || !order) return json({ error: 'Order not found', order_id }, 404)

    const client = (order as any).client
    if (!client?.email) return json({ error: 'Customer has no email address' }, 400)

    const locale = resolveLocaleFromOrder(order)
    const currency = locale === 'FR' ? 'EUR' : 'XOF'
    const orderNumber = (order as any).order_number || order_id.slice(0, 8)

    // ── generate or retrieve PDF ────────────────────────────────────
    let pdfBytes: Uint8Array
    let storagePath = (order as any).invoice_pdf_path as string | null

    const needsGeneration = regenerate || !storagePath

    if (needsGeneration) {
      console.log(`[invoice-send] Generating PDF for ${order_id}`)

      const invoiceData = await buildInvoiceData(supabase, SUPABASE_URL, order, order_id)
      const imgCount = invoiceData.items.filter(i => i.imageBytes).length
      console.log(`[invoice-send] ${imgCount}/${invoiceData.items.length} images, logo: ${invoiceData.logoBytes ? 'yes' : 'fallback'}`)

      pdfBytes = await generateInvoicePdf(invoiceData)

      storagePath = `${order_id}/invoice.pdf`
      await supabase.storage.from('invoices').upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

      await supabase.from('commande').update({ invoice_pdf_path: storagePath }).eq('id', order_id)
    } else {
      console.log(`[invoice-send] Using existing PDF: ${storagePath}`)
      const { data: dlData, error: dlErr } = await supabase.storage
        .from('invoices')
        .download(storagePath!)
      if (dlErr || !dlData) return json({ error: 'Failed to retrieve existing invoice PDF' }, 500)
      pdfBytes = new Uint8Array(await dlData.arrayBuffer())
    }

    // ── create signed download URL ──────────────────────────────────
    const { data: signedData } = await supabase.storage
      .from('invoices')
      .createSignedUrl(storagePath!, 7 * 24 * 3600)

    const downloadUrl = signedData?.signedUrl || 'https://smellandwear.com'

    // ── format date for email ───────────────────────────────────────
    const orderDate = (() => {
      try {
        const raw = new Date((order as any).created_at).toLocaleDateString('fr-FR', {
          day: '2-digit', month: 'long', year: 'numeric',
        })
        return raw.replace(/\u202F/g, ' ').replace(/\u00A0/g, ' ')
      } catch { return '\u2014' }
    })()

    // ── compute display total (same logic as buildInvoiceData) ─────
    const displayTotal = computeDisplayTotal(order, currency)
    console.log(`[invoice-send] displayTotal=${displayTotal} db_total=${(order as any).total} currency=${currency}`)

    // ── send email via Resend ───────────────────────────────────────
    const emailHtml = buildEmailHtml({
      customerName: `${client.prenom} ${client.nom}`,
      orderNumber,
      total: fmtCurrency(displayTotal, currency),
      orderDate,
      downloadUrl,
    })

    const pdfBase64 = toBase64(pdfBytes)

    console.log(`[invoice-send] Sending email to ${client.email}`)

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Smell & Wear <${FROM_EMAIL}>`,
        to: [client.email],
        subject: `Votre facture Smell & Wear \u2014 ${orderNumber}`,
        html: emailHtml,
        attachments: [
          {
            filename: `facture-${orderNumber.replace(/[^a-zA-Z0-9-]/g, '')}.pdf`,
            content: pdfBase64,
          },
        ],
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      console.error('[invoice-send] Resend error:', resendData)
      return json({
        error: resendData?.message || 'Email sending failed',
        resend_status: resendRes.status,
      }, 502)
    }

    console.log(`[invoice-send] Email sent: ${resendData.id}`)

    // ── update order + audit log ────────────────────────────────────
    const now = new Date().toISOString()
    await supabase.from('commande').update({
      invoice_last_sent_at: now,
    }).eq('id', order_id)

    await supabase.from('order_events').insert({
      order_id,
      event_type: 'invoice_sent',
      triggered_by: user.id,
      payload: {
        email: client.email,
        resend_id: resendData.id,
        regenerated: needsGeneration,
      },
    })

    return json({
      ok: true,
      order_id,
      order_number: orderNumber,
      email_sent_to: client.email,
      invoice_last_sent_at: now,
      resend_id: resendData.id,
    })
  } catch (e) {
    console.error('[invoice-send] Error:', (e as Error).message, (e as Error).stack)
    return json({ error: (e as Error).message || 'Internal error' }, 500)
  }
})
