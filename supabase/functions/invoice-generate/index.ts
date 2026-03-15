/**
 * invoice-generate Edge Function
 *
 * Generates a professional PDF invoice for an order, stores it in
 * the private `invoices` bucket, and updates the order record.
 * Always regenerates from fresh data (replaces existing PDF if any).
 *
 * POST { order_id: string }
 * Auth: admin only (JWT + admin table check)
 *
 * Returns: { order_id, invoice_pdf_path, signed_url, regenerated }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateInvoicePdf } from '../_shared/invoice-pdf.ts'
import { buildInvoiceData } from '../_shared/invoice-helpers.ts'

const ORDER_SELECT = `
  id, order_number, statut, total, currency, locale,
  shipping_cost, express_cost, express_delivery, shipping_zone_code,
  server_computed_total, payment_reference, payment_data,
  created_at,
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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

    const { order_id } = body as { order_id: string }

    // ── fetch full order data ───────────────────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from('commande')
      .select(ORDER_SELECT)
      .eq('id', order_id)
      .single()

    if (orderErr || !order) return json({ error: 'Order not found', order_id }, 404)

    // ── build invoice data (images + logo from Storage) ─────────────
    console.log(`[invoice-generate] Building invoice data for ${order_id}`)
    const invoiceData = await buildInvoiceData(supabase, SUPABASE_URL, order, order_id)

    const imgCount = invoiceData.items.filter(i => i.imageBytes).length
    console.log(`[invoice-generate] locale=${invoiceData.locale} currency=${invoiceData.currency} fxRate=${invoiceData.fxRate}`)
    console.log(`[invoice-generate] subtotal=${invoiceData.subtotal} shipping=${invoiceData.shippingCost} total=${invoiceData.total}`)
    console.log(`[invoice-generate] ${imgCount}/${invoiceData.items.length} product images loaded, logo: ${invoiceData.logoBytes ? 'yes' : 'text fallback'}`)

    // ── generate PDF ────────────────────────────────────────────────
    const pdfBytes = await generateInvoicePdf(invoiceData)
    console.log(`[invoice-generate] PDF generated: ${pdfBytes.length} bytes`)

    // ── upload to Storage (upsert replaces existing) ────────────────
    const storagePath = `${order_id}/invoice.pdf`

    const { error: uploadErr } = await supabase.storage
      .from('invoices')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadErr) {
      console.error('[invoice-generate] Upload failed:', uploadErr.message)
      return json({ error: 'Failed to store invoice PDF' }, 500)
    }

    // ── update order record ─────────────────────────────────────────
    await supabase.from('commande').update({
      invoice_pdf_path: storagePath,
    }).eq('id', order_id)

    // ── audit log ───────────────────────────────────────────────────
    await supabase.from('order_events').insert({
      order_id,
      event_type: 'invoice_generated',
      triggered_by: user.id,
      payload: { path: storagePath, images_loaded: imgCount },
    })

    // ── return signed URL ───────────────────────────────────────────
    const { data: signed } = await supabase.storage
      .from('invoices')
      .createSignedUrl(storagePath, 3600)

    console.log(`[invoice-generate] Done: ${storagePath}`)

    return json({
      order_id,
      invoice_pdf_path: storagePath,
      signed_url: signed?.signedUrl || null,
      regenerated: true,
    })
  } catch (e) {
    console.error('[invoice-generate] Error:', (e as Error).message, (e as Error).stack)
    return json({ error: (e as Error).message || 'Internal error' }, 500)
  }
})
