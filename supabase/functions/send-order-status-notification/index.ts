/**
 * send-order-status-notification Edge Function
 *
 * Sends an email to the customer when an admin changes an order's status.
 * Each status maps to a specific email template with appropriate messaging.
 *
 * POST { order_id: string, new_status: string, old_status?: string }
 * Auth: admin only (JWT + admin table check)
 *
 * Env vars:
 *   RESEND_API_KEY     – Resend API key
 *   INVOICE_FROM_EMAIL – sender address (default: onboarding@resend.dev)
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

const ORDER_SELECT = `
  id, order_number, statut, total, currency, locale, country_code,
  shipping_cost, express_cost, express_delivery,
  tracking_code, shipping_carrier, created_at,
  client:client_id (
    id, nom, prenom, email, telephone
  ),
  items:commande_item (
    id, quantite, prix_unitaire,
    variant:produit_variation_id (
      id,
      produit:produit_id ( nom )
    )
  )
`

// ─── Status → email content mapping ─────────────────────────────────────────

interface StatusEmailContent {
  subject: string
  heading: string
  message: string
  color: string
  icon: string
}

function getStatusEmailContent(
  status: string,
  orderNumber: string,
  customerName: string,
  order: any,
): StatusEmailContent {
  switch (status) {
    case 'En cours':
      return {
        subject: `Votre commande ${orderNumber} est en cours de preparation`,
        heading: 'Commande en cours de preparation',
        message: `Bonjour ${customerName},\n\nNous avons le plaisir de vous informer que votre commande <strong>${orderNumber}</strong> est en cours de preparation par nos equipes.\n\nNous vous tiendrons informe(e) de l'avancement de votre commande.`,
        color: '#0d6efd',
        icon: '📦',
      }

    case 'Expédiée':
      const trackingInfo = order.tracking_code
        ? `\n\n<strong>Code de suivi :</strong> ${order.tracking_code}${order.shipping_carrier ? `\n<strong>Transporteur :</strong> ${order.shipping_carrier}` : ''}`
        : ''
      return {
        subject: `Votre commande ${orderNumber} a ete expediee !`,
        heading: 'Commande expediee',
        message: `Bonjour ${customerName},\n\nBonne nouvelle ! Votre commande <strong>${orderNumber}</strong> a ete expediee et est en route vers vous.${trackingInfo}\n\nVous recevrez votre colis dans les prochains jours.`,
        color: '#0dcaf0',
        icon: '🚚',
      }

    case 'Livrée':
      return {
        subject: `Votre commande ${orderNumber} a ete livree`,
        heading: 'Commande livree',
        message: `Bonjour ${customerName},\n\nVotre commande <strong>${orderNumber}</strong> a ete livree avec succes.\n\nNous esperons que vous etes satisfait(e) de votre achat. N'hesitez pas a nous contacter si vous avez la moindre question.\n\nMerci pour votre confiance !`,
        color: '#198754',
        icon: '✅',
      }

    case 'Annulée':
      return {
        subject: `Votre commande ${orderNumber} a ete annulee`,
        heading: 'Commande annulee',
        message: `Bonjour ${customerName},\n\nNous vous informons que votre commande <strong>${orderNumber}</strong> a ete annulee.\n\nSi vous n'etes pas a l'origine de cette annulation ou si vous avez des questions, n'hesitez pas a nous contacter a l'adresse suivante : contact@smellandwear.com`,
        color: '#dc3545',
        icon: '❌',
      }

    case 'Nouvelle':
      return {
        subject: `Mise a jour de votre commande ${orderNumber}`,
        heading: 'Statut de commande mis a jour',
        message: `Bonjour ${customerName},\n\nLe statut de votre commande <strong>${orderNumber}</strong> a ete mis a jour : <strong>Nouvelle</strong>.\n\nNous vous tiendrons informe(e) de l'avancement.`,
        color: '#ffc107',
        icon: '🆕',
      }

    default:
      return {
        subject: `Mise a jour de votre commande ${orderNumber}`,
        heading: 'Statut de commande mis a jour',
        message: `Bonjour ${customerName},\n\nLe statut de votre commande <strong>${orderNumber}</strong> a ete mis a jour : <strong>${status}</strong>.\n\nN'hesitez pas a nous contacter pour toute question.`,
        color: '#6c757d',
        icon: 'ℹ️',
      }
  }
}

// ─── HTML email builder ─────────────────────────────────────────────────────

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

function buildEmailHtml(p: {
  heading: string
  message: string
  color: string
  icon: string
  orderNumber: string
  orderDate: string
  total: string
  itemsSummary: string
}): string {
  const messageHtml = p.message.replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#1a1a1a;padding:24px 30px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;letter-spacing:2px;">SMELL &amp; WEAR</h1>
    </div>

    <div style="padding:0 30px;">
      <div style="text-align:center;padding:24px 0 16px;">
        <span style="font-size:48px;">${p.icon}</span>
      </div>
      <h2 style="margin:0 0 8px;color:${p.color};font-size:18px;text-align:center;">${p.heading}</h2>
    </div>

    <div style="padding:0 30px 20px;">
      <p style="color:#555;line-height:1.6;font-size:14px;">${messageHtml}</p>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr>
          <td style="padding:10px 12px;background:#f9f9f9;border-radius:4px 0 0 0;color:#888;font-size:13px;">Commande</td>
          <td style="padding:10px 12px;background:#f9f9f9;border-radius:0 4px 0 0;font-weight:bold;color:#333;font-size:13px;">${p.orderNumber}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;color:#888;font-size:13px;">Date</td>
          <td style="padding:10px 12px;font-weight:bold;color:#333;font-size:13px;">${p.orderDate}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;background:#f9f9f9;color:#888;font-size:13px;">Total</td>
          <td style="padding:10px 12px;background:#f9f9f9;font-weight:bold;color:#B5190C;font-size:15px;">${p.total}</td>
        </tr>
      </table>

      ${p.itemsSummary ? `<div style="margin-bottom:20px;">
        <p style="color:#888;font-size:12px;margin:0 0 8px;font-weight:bold;">Articles :</p>
        ${p.itemsSummary}
      </div>` : ''}

      <div style="text-align:center;margin:24px 0;">
        <a href="https://smellandwear.com" style="display:inline-block;padding:12px 28px;background:#B5190C;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">
          Visiter notre boutique
        </a>
      </div>
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
      return json({ error: 'RESEND_API_KEY is not configured' }, 500)
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
    if (!body?.order_id || !body?.new_status) {
      return json({ error: 'order_id and new_status are required' }, 400)
    }

    const { order_id, new_status, old_status } = body as {
      order_id: string
      new_status: string
      old_status?: string
    }

    // ── fetch order ─────────────────────────────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from('commande')
      .select(ORDER_SELECT)
      .eq('id', order_id)
      .single()

    if (orderErr || !order) return json({ error: 'Order not found', order_id }, 404)

    const client = (order as any).client
    if (!client?.email) {
      return json({ error: 'Customer has no email address' }, 400)
    }

    const customerName = `${client.prenom || ''} ${client.nom || ''}`.trim() || 'Client'
    const orderNumber = (order as any).order_number || order_id.slice(0, 8)
    const currency = ((order as any).currency || 'XOF').toUpperCase()
    const total = Number((order as any).total) || 0

    // ── build email content ─────────────────────────────────────────
    const emailContent = getStatusEmailContent(new_status, orderNumber, customerName, order)

    const orderDate = (() => {
      try {
        return new Date((order as any).created_at).toLocaleDateString('fr-FR', {
          day: '2-digit', month: 'long', year: 'numeric',
        }).replace(/\u202F/g, ' ').replace(/\u00A0/g, ' ')
      } catch { return '\u2014' }
    })()

    const items = (order as any).items || []
    const itemsSummary = items.length > 0
      ? items.map((item: any) => {
          const name = item.variant?.produit?.nom || 'Article'
          return `<p style="color:#555;font-size:13px;margin:2px 0;">• ${name} x${item.quantite}</p>`
        }).join('')
      : ''

    const emailHtml = buildEmailHtml({
      heading: emailContent.heading,
      message: emailContent.message,
      color: emailContent.color,
      icon: emailContent.icon,
      orderNumber,
      orderDate,
      total: fmtCurrency(total, currency),
      itemsSummary,
    })

    // ── send email via Resend ───────────────────────────────────────
    console.log(`[order-status-notification] Sending "${new_status}" email to ${client.email} for order ${order_id}`)

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Smell & Wear <${FROM_EMAIL}>`,
        to: [client.email],
        subject: emailContent.subject,
        html: emailHtml,
      }),
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      console.error('[order-status-notification] Resend error:', resendData)
      return json({
        error: resendData?.message || 'Email sending failed',
        resend_status: resendRes.status,
      }, 502)
    }

    console.log(`[order-status-notification] Email sent: ${resendData.id}`)

    // ── audit log ───────────────────────────────────────────────────
    await supabase.from('order_events').insert({
      order_id,
      event_type: 'status_notification_sent',
      triggered_by: user.id,
      payload: {
        email: client.email,
        resend_id: resendData.id,
        old_status: old_status || null,
        new_status,
      },
    }).then(({ error }) => {
      if (error) console.warn('[order-status-notification] Audit log insert failed:', error.message)
    })

    return json({
      ok: true,
      order_id,
      email_sent_to: client.email,
      new_status,
      resend_id: resendData.id,
    })
  } catch (e) {
    console.error('[order-status-notification] Error:', (e as Error).message, (e as Error).stack)
    return json({ error: (e as Error).message || 'Internal error' }, 500)
  }
})
