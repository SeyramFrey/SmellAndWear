/**
 * Paystack Initialize Edge Function  (v2 – server-side totals)
 *
 * The client sends: order_id, email, locale (FR|CI),
 *   shipping_zone_code, express_delivery.
 * This function:
 *   1. Fetches order items + canonical product prices from DB
 *   2. Fetches shipping tariff from livraison_tarifs
 *   3. Computes the total deterministically
 *   4. Converts to XOF (Paystack's currency for this account)
 *   5. Calls Paystack /transaction/initialize
 *   6. Persists payment metadata back to the order
 *
 * Currency rules (Paystack):
 *   Paystack ALWAYS expects amounts as major × 100, for ALL currencies.
 *   This applies to XOF and XAF too — even though ISO 4217 defines them as
 *   zero-decimal (no real subunits), Paystack still divides by 100 to display.
 *
 *   Example: 19 023 XOF (major) → send 1 902 300 → Paystack shows 19 023 XOF
 *
 *   This is the opposite of Stripe's "zero-decimal" convention.
 *   See docs/payments.md § "Paystack Subunit Rule".
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Convert a human-readable (major-unit) amount to the integer Paystack expects.
 *
 * Paystack always uses major × 100 for ALL currencies, including XOF/XAF.
 * ISO 4217 defines XOF as zero-decimal, but Paystack ignores this convention:
 * their API divides by 100 before displaying to the customer.
 *
 *   19 023 XOF (major) → 1 902 300 (Paystack subunit) → displayed as 19 023 XOF
 *   43.80 EUR (major)  →     4 380 (Paystack subunit) → displayed as 43.80 EUR
 */
function toPaystackAmount(amountMajor: number, currency: string): number {
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
    throw new Error(`Invalid amount ${amountMajor} for ${currency}`)
  }
  const result = Math.round(amountMajor * 100)
  if (!Number.isInteger(result) || result <= 0) {
    throw new Error(
      `Computed Paystack amount ${result} is not a valid positive integer ` +
      `(input: ${amountMajor} ${currency.toUpperCase()})`
    )
  }
  return result
}

/**
 * Reverse of toPaystackAmount: convert Paystack subunit back to major unit.
 * Paystack always uses ×100 convention for all currencies.
 */
function fromPaystackAmount(subunitAmount: number): number {
  return subunitAmount / 100
}

// ─── helpers ────────────────────────────────────────────────────────────────

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

// ─── FX cache ───────────────────────────────────────────────────────────────

interface FxRate { rate: number; asOf: string; provider: string; cachedAt: number }
let fxCache: Record<string, FxRate> = {}
const FX_TTL = 30 * 60 * 1000

async function getEurXofRate(): Promise<FxRate> {
  const k = 'EUR_XOF'
  const now = Date.now()
  if (fxCache[k] && now - fxCache[k].cachedAt < FX_TTL) return fxCache[k]

  try {
    const apiKey = Deno.env.get('EXCHANGERATE_API_KEY')
    const url = apiKey
      ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/EUR`
      : 'https://api.exchangerate-api.com/v4/latest/EUR'
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`FX API ${res.status}`)
    const d = await res.json()
    const xof = d.rates?.XOF || d.conversion_rates?.XOF
    if (!xof || typeof xof !== 'number' || xof <= 0) throw new Error('bad rate')
    const r: FxRate = { rate: xof, asOf: d.time_last_update_utc || new Date().toISOString(), provider: 'exchangerate-api', cachedAt: now }
    fxCache[k] = r
    console.log(`[fx] 1 EUR = ${xof} XOF (live)`)
    return r
  } catch (e) {
    const fb = Number(Deno.env.get('EUR_XOF_FALLBACK_RATE')) || 655.957
    console.warn(`[fx] fallback ${fb}:`, (e as Error).message)
    const r: FxRate = { rate: fb, asOf: new Date().toISOString(), provider: 'fallback', cachedAt: now }
    fxCache[k] = r
    return r
  }
}

// ─── main ───────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!PAYSTACK_SECRET_KEY) return json({ error: 'Payment service not configured' }, 500)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const body = await req.json().catch(() => null)
    if (!body) return json({ error: 'Invalid JSON' }, 400)

    const {
      order_id,
      email,
      locale,            // 'FR' | 'CI'
      shipping_zone_code,
      express_delivery,
      callback_url,
    } = body as {
      order_id?: string
      email?: string
      locale?: string
      shipping_zone_code?: string
      express_delivery?: boolean
      callback_url?: string
    }

    // ── validate inputs ─────────────────────────────────────────────────
    if (!order_id) return json({ error: 'order_id is required' }, 400)
    if (!email || !isValidEmail(email)) return json({ error: 'Valid email is required' }, 400)
    if (!locale || !['FR', 'CI'].includes(locale.toUpperCase())) {
      return json({ error: 'locale must be FR or CI' }, 400)
    }
    const loc = locale.toUpperCase()
    const isCI = loc === 'CI'
    const isFR = loc === 'FR'

    // ── fetch order ─────────────────────────────────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from('commande')
      .select('id, statut, payment_reference, total')
      .eq('id', order_id)
      .single()

    if (orderErr || !order) return json({ error: 'Order not found', order_id }, 404)
    if (order.statut === 'PAID') return json({ error: 'Order already paid', order_id }, 409)

    // ── fetch order items + canonical product prices ────────────────────
    const { data: items, error: itemsErr } = await supabase
      .from('commande_item')
      .select(`
        quantite,
        produit_variation_id,
        variant:produit_variation_id (
          produit_id,
          produit:produit_id ( prix )
        )
      `)
      .eq('commande_id', order_id)

    if (itemsErr || !items || items.length === 0) {
      return json({ error: 'No order items found', order_id }, 400)
    }

    // ── compute subtotal in EUR (canonical prices) ──────────────────────
    let subtotalEur = 0
    const breakdown: { qty: number; unit_price_eur: number }[] = []
    for (const item of items) {
      const prix = (item as any).variant?.produit?.prix
      if (typeof prix !== 'number' || prix < 0) {
        return json({ error: 'Product price missing or invalid', order_id }, 500)
      }
      subtotalEur += prix * item.quantite
      breakdown.push({ qty: item.quantite, unit_price_eur: prix })
    }
    subtotalEur = Math.round(subtotalEur * 100) / 100

    // Overwrite client-supplied prix_unitaire with canonical product prices from DB.
    // The frontend writes item.price (client-controlled) into commande_item at order
    // creation time. Overwriting here ensures invoice generation and all downstream
    // reads always use server-verified prices, regardless of what the client sent.
    const priceOverwrites = items.map(item =>
      supabase.from('commande_item')
        .update({ prix_unitaire: (item as any).variant?.produit?.prix })
        .eq('commande_id', order_id)
        .eq('produit_variation_id', item.produit_variation_id)
    )
    const overwriteResults = await Promise.all(priceOverwrites)
    const overwriteFailures = overwriteResults.filter(r => r.error)
    if (overwriteFailures.length > 0) {
      console.error('[paystack-init] Failed to canonicalize item prices:', overwriteFailures.map(r => r.error?.message))
    }

    // ── fetch shipping cost ─────────────────────────────────────────────
    let shippingCost = 0
    let shippingCurrency = isCI ? 'XOF' : 'EUR'

    if (shipping_zone_code) {
      const { data: tariff } = await supabase
        .from('livraison_tarifs')
        .select('price, currency')
        .eq('country_code', loc)
        .eq('zone_code', shipping_zone_code)
        .eq('is_express', false)
        .eq('is_active', true)
        .single()

      if (tariff) {
        shippingCost = Number(tariff.price)
        shippingCurrency = tariff.currency || shippingCurrency
      }
    }

    // ── fetch express cost ──────────────────────────────────────────────
    let expressCost = 0
    if (express_delivery && shipping_zone_code) {
      const { data: expressTariff } = await supabase
        .from('livraison_tarifs')
        .select('price, currency')
        .eq('country_code', loc)
        .eq('zone_code', shipping_zone_code)
        .eq('is_express', true)
        .eq('is_active', true)
        .single()

      if (expressTariff && Number(expressTariff.price) > 0) {
        expressCost = Number(expressTariff.price)
      }
    }
    // FR without zone but with express: try generic express
    if (express_delivery && !shipping_zone_code && isFR) {
      const { data: frExpress } = await supabase
        .from('livraison_tarifs')
        .select('price')
        .eq('country_code', 'FR')
        .eq('is_express', true)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (frExpress && Number(frExpress.price) > 0) {
        expressCost = Number(frExpress.price)
      }
    }

    // ── compute final total ─────────────────────────────────────────────
    const fxRate = await getEurXofRate()
    let totalXof: number
    let displayedTotal: number
    let displayedCurrency: string

    if (isCI) {
      // CI: product prices (EUR) → XOF, shipping already in XOF
      const subtotalXof = Math.round(subtotalEur * fxRate.rate)
      const shippingXof = Math.round(shippingCost)
      const expressXof = Math.round(expressCost)
      totalXof = subtotalXof + shippingXof + expressXof
      displayedTotal = totalXof
      displayedCurrency = 'XOF'
    } else {
      // FR: everything in EUR, then convert final total to XOF for Paystack
      const totalEur = subtotalEur + shippingCost + expressCost
      displayedTotal = Math.round(totalEur * 100) / 100
      displayedCurrency = 'EUR'
      totalXof = Math.round(totalEur * fxRate.rate)
    }

    const paystackAmount = toPaystackAmount(totalXof, 'XOF')

    if (paystackAmount < 1) {
      return json({ error: `Total too low: ${totalXof} XOF (min 1 XOF)` }, 400)
    }

    // ── generate reference ──────────────────────────────────────────────
    const reference = `SW_${Date.now()}_${Math.floor(Math.random() * 10000)}`

    const conversionMeta = {
      locale: loc,
      subtotal_eur: subtotalEur,
      shipping_cost: shippingCost,
      shipping_currency: shippingCurrency,
      express_cost: expressCost,
      express_delivery: !!express_delivery,
      fx_rate: fxRate.rate,
      fx_provider: fxRate.provider,
      displayed_total: displayedTotal,
      displayed_currency: displayedCurrency,
      total_xof_major: totalXof,
      paystack_amount_subunit: paystackAmount,
      items_breakdown: breakdown,
    }

    console.log(JSON.stringify({
      event: 'paystack_init',
      order_id,
      ...conversionMeta,
      reference,
    }))

    // ── persist computed data on order ───────────────────────────────────
    const { error: updateErr } = await supabase.from('commande').update({
      locale: loc,
      country_code: loc,
      shipping_zone_code: shipping_zone_code || null,
      shipping_cost: shippingCost,
      express_delivery: !!express_delivery,
      express_cost: expressCost,
      server_computed_total: paystackAmount,
      currency: displayedCurrency,
      total: displayedTotal,
      exchange_rate_eur_to_xof: fxRate.rate,
      payment_reference: reference,
      statut: 'PENDING',
    }).eq('id', order_id)

    if (updateErr) {
      console.error('[paystack-init] Order update failed:', updateErr.message)
    }

    // ── call Paystack ───────────────────────────────────────────────────
    const channels = isCI ? ['mobile_money', 'card'] : ['card']

    const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: paystackAmount,
        currency: 'XOF',
        reference,
        channels,
        metadata: { order_id, ...conversionMeta },
        ...(callback_url ? { callback_url } : {}),
      }),
    })

    const psData = await psRes.json()

    if (!psRes.ok || !psData.status) {
      console.error('[paystack-init] Paystack error:', psData.message)
      return json({
        error: psData.message || 'Paystack initialization failed',
        paystack_status: psRes.status,
      }, psRes.status >= 400 && psRes.status < 500 ? 400 : 502)
    }

    // persist payment session data
    await supabase.from('commande').update({
      payment_data: {
        access_code: psData.data.access_code,
        authorization_url: psData.data.authorization_url,
        initialized_at: new Date().toISOString(),
        ...conversionMeta,
      },
    }).eq('id', order_id)

    console.log(`[paystack-init] OK ref=${psData.data.reference}`)

    return json({
      authorization_url: psData.data.authorization_url,
      reference: psData.data.reference,
      access_code: psData.data.access_code,
      displayed_total: displayedTotal,
      displayed_currency: displayedCurrency,
      total_xof_major: totalXof,
      paystack_amount_subunit: paystackAmount,
      fx_rate: fxRate.rate,
    })
  } catch (e) {
    console.error('[paystack-init] unhandled:', (e as Error).message)
    return json({ error: (e as Error).message || 'Internal error' }, 500)
  }
})
