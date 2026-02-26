/**
 * Paystack Initialize Edge Function
 *
 * Handles payment initialization for SmellAndWear:
 * - France (FR): EUR → XOF conversion with live FX, card-only, sends XOF to Paystack
 * - Côte d'Ivoire (CI): XOF passed through (no conversion), card + mobile_money
 *
 * Paystack API rules (per docs):
 * - amount: MUST be in subunits. XOF is zero-decimal: 19800 = 19,800 XOF (no *100)
 * - currency: XOF supported for West Africa
 * - channels: France=card only; CI=card+mobile_money
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPPORTED_CURRENCIES = ['XOF', 'NGN', 'GHS', 'ZAR', 'KES', 'USD', 'XAF', 'EGP', 'RWF', 'TZS', 'UGX']

// Zero-decimal: amount IS the subunit. 19800 = 19,800 XOF (per Paystack docs)
const ZERO_DECIMAL_CURRENCIES = ['XOF', 'XAF', 'RWF', 'UGX', 'JPY', 'KRW']

interface FxRate {
  rate: number
  asOf: string
  provider: string
  cachedAt: number
}

let fxRateCache: { [key: string]: FxRate } = {}
const FX_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Fetch live EUR/XOF rate. XOF is pegged ~655.957; API may vary. Cached 30 min.
 */
async function getEurXofRate(): Promise<FxRate> {
  const cacheKey = 'EUR_XOF'
  const now = Date.now()

  if (fxRateCache[cacheKey] && (now - fxRateCache[cacheKey].cachedAt) < FX_CACHE_TTL_MS) {
    console.log('[fx] Using cached EUR/XOF rate:', fxRateCache[cacheKey].rate)
    return fxRateCache[cacheKey]
  }

  try {
    const apiKey = Deno.env.get('EXCHANGERATE_API_KEY')
    const apiUrl = apiKey
      ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/EUR`
      : 'https://api.exchangerate-api.com/v4/latest/EUR'

    console.log('[fx] Fetching live EUR/XOF rate...')
    const response = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })

    if (!response.ok) {
      throw new Error(`FX API returned ${response.status}`)
    }

    const data = await response.json()
    const xofRate = data.rates?.XOF || data.conversion_rates?.XOF

    if (!xofRate || typeof xofRate !== 'number' || xofRate <= 0) {
      throw new Error('Invalid XOF rate in API response')
    }

    const fxRate: FxRate = {
      rate: xofRate,
      asOf: data.time_last_update_utc || data.date || new Date().toISOString(),
      provider: 'exchangerate-api.com',
      cachedAt: now,
    }

    fxRateCache[cacheKey] = fxRate
    console.log(`[fx] Fetched live rate: 1 EUR = ${xofRate} XOF (as of ${fxRate.asOf})`)
    return fxRate
  } catch (error) {
    console.warn('[fx] Failed to fetch live rate:', (error as Error).message)
    const fallbackRate = Number(Deno.env.get('EUR_XOF_FALLBACK_RATE')) || 655.957
    console.log(`[fx] Using fallback rate: 1 EUR = ${fallbackRate} XOF`)
    return {
      rate: fallbackRate,
      asOf: new Date().toISOString(),
      provider: 'fallback',
      cachedAt: now,
    }
  }
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!PAYSTACK_SECRET_KEY) {
      console.error('[paystack-init] PAYSTACK_SECRET_KEY is not set')
      return jsonResponse({ error: 'Payment service is not configured. Contact support.' }, 500)
    }

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch (_e) {
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    const {
      amount,
      currency,
      email,
      reference,
      metadata,
      channels,
      callback_url,
      order_id,
      country,
    } = body as {
      amount?: number
      currency?: string
      email?: string
      reference?: string
      metadata?: Record<string, unknown>
      channels?: string[]
      callback_url?: string
      order_id?: string
      country?: string
    }

    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return jsonResponse({
        error: 'A valid email address is required',
        field: 'email',
        received: email ?? null,
      }, 400)
    }

    if (!reference || typeof reference !== 'string' || reference.length < 3) {
      return jsonResponse({
        error: 'A payment reference (min 3 chars) is required',
        field: 'reference',
        received: reference ?? null,
      }, 400)
    }

    if (amount === undefined || amount === null || typeof amount !== 'number' || !isFinite(amount) || amount <= 0) {
      return jsonResponse({
        error: 'Amount must be a positive finite number',
        field: 'amount',
        received: amount ?? null,
      }, 400)
    }

    // ----------------------------------------------------------------------
    // Country-based currency logic
    // Both France and Côte d'Ivoire charge in XOF
    // France: frontend sends EUR → we convert to XOF
    // CI: frontend sends XOF → pass through
    // ----------------------------------------------------------------------
    let finalCurrency: string
    let xofTotal: number
    let paystackAmount: number
    let conversionMeta: Record<string, unknown> = {}
    let paymentChannels: string[]

    const selectedCountry = (country || '').toUpperCase()

    if (selectedCountry === 'FR' || selectedCountry === 'FRANCE') {
      // FRANCE: EUR → XOF conversion. Card only (per Paystack channels).
      const eurTotal = round2(amount)
      const inputCurrency = ((currency as string) || 'EUR').toUpperCase()

      if (inputCurrency !== 'EUR') {
        return jsonResponse({
          error: `For France, amount must be sent in EUR. Received: ${inputCurrency}`,
          field: 'currency',
          received: inputCurrency,
        }, 400)
      }

      const fxRate = await getEurXofRate()
      xofTotal = Math.round(eurTotal * fxRate.rate)
      // XOF is zero-decimal: paystack_amount = xofTotal (no *100)
      paystackAmount = xofTotal
      finalCurrency = 'XOF'
      paymentChannels = ['card']

      conversionMeta = {
        country: 'FR',
        displayed_currency: 'EUR',
        displayed_amount: eurTotal,
        pay_currency: 'XOF',
        pay_amount: xofTotal,
        paystack_amount_subunits: paystackAmount,
        fx_rate: fxRate.rate,
        fx_as_of: fxRate.asOf,
        fx_provider: fxRate.provider,
        conversion_applied: true,
      }

      console.log(
        JSON.stringify({
          event: 'paystack_init_france',
          eur_total: eurTotal,
          fx_rate_used: fxRate.rate,
          xof_total: xofTotal,
          paystack_amount: paystackAmount,
          currency: finalCurrency,
          channels: paymentChannels,
          reference,
          order_id: order_id ?? null,
        })
      )
    } else if (selectedCountry === 'CI' || selectedCountry === 'COTE D\'IVOIRE') {
      // CÔTE D'IVOIRE: XOF pass-through. Amount already in XOF (integer).
      // Ensure we send integer: 19800 XOF = amount 19800 (NOT 198)
      xofTotal = Math.round(amount)
      paystackAmount = xofTotal
      finalCurrency = 'XOF'
      paymentChannels = channels && Array.isArray(channels) && channels.length > 0
        ? channels
        : ['mobile_money', 'card']

      conversionMeta = {
        country: 'CI',
        displayed_currency: 'XOF',
        displayed_amount: xofTotal,
        pay_currency: 'XOF',
        pay_amount: xofTotal,
        conversion_applied: false,
      }

      console.log(
        JSON.stringify({
          event: 'paystack_init_ci',
          eur_total: null,
          fx_rate_used: null,
          xof_total: xofTotal,
          paystack_amount: paystackAmount,
          currency: finalCurrency,
          channels: paymentChannels,
          reference,
          order_id: order_id ?? null,
        })
      )
    } else {
      console.warn(`[paystack-init] Unknown country: ${selectedCountry}. Defaulting to XOF.`)
      xofTotal = Math.round(amount)
      paystackAmount = xofTotal
      finalCurrency = 'XOF'
      paymentChannels = ['card', 'mobile_money']
      conversionMeta = {
        country: selectedCountry || 'unknown',
        displayed_currency: 'XOF',
        displayed_amount: xofTotal,
        pay_currency: 'XOF',
        pay_amount: xofTotal,
        conversion_applied: false,
      }
    }

    if (!SUPPORTED_CURRENCIES.includes(finalCurrency)) {
      return jsonResponse({
        error: `Currency '${finalCurrency}' is not supported by Paystack`,
        supported_currencies: SUPPORTED_CURRENCIES,
        field: 'currency',
      }, 400)
    }

    // XOF: amount is already in subunits (zero-decimal). No *100.
    if (ZERO_DECIMAL_CURRENCIES.includes(finalCurrency)) {
      paystackAmount = Math.round(paystackAmount)
    } else {
      paystackAmount = Math.round(paystackAmount * 100)
    }

    if (paystackAmount < 100) {
      return jsonResponse({
        error: `Amount too low: ${paystackAmount} ${finalCurrency} (smallest unit). Minimum is 100.`,
        field: 'amount',
        received_amount: amount,
        converted_amount: paystackAmount,
        currency: finalCurrency,
      }, 400)
    }

    // ----------------------------------------------------------------------
    // Idempotency check
    // ----------------------------------------------------------------------
    let supabase: ReturnType<typeof createClient> | null = null
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    }

    if (order_id && supabase) {
      const { data: existingOrder } = await supabase
        .from('commande')
        .select('id, payment_reference, statut, payment_data')
        .eq('id', order_id)
        .single()

      if (existingOrder) {
        if (existingOrder.statut === 'PAID') {
          return jsonResponse({
            error: 'This order has already been paid',
            order_id,
          }, 409)
        }

        const allowedReInitStatuses = ['Nouvelle', 'en_attente', 'PENDING', 'FAILED']
        if (
          existingOrder.payment_reference &&
          existingOrder.payment_reference !== reference &&
          !allowedReInitStatuses.includes(existingOrder.statut)
        ) {
          return jsonResponse({
            error: 'Order already has an active payment session.',
            order_id,
            current_status: existingOrder.statut,
          }, 409)
        }
      }
    }

    // ----------------------------------------------------------------------
    // Call Paystack
    // ----------------------------------------------------------------------
    console.log(
      `[paystack-init] Initializing: email=${email}, ref=${reference}, ` +
      `amount=${paystackAmount} XOF (subunits), channels=${paymentChannels.join(',')}, order=${order_id ?? 'n/a'}`
    )

    const paystackPayload = {
      email,
      amount: paystackAmount,
      currency: finalCurrency,
      reference,
      metadata: {
        ...(metadata || {}),
        ...conversionMeta,
      },
      channels: paymentChannels,
      ...(callback_url ? { callback_url } : {}),
    }

    const paystackResponse = await fetch(
      'https://api.paystack.co/transaction/initialize',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paystackPayload),
      },
    )

    const paystackData = await paystackResponse.json()

    if (!paystackResponse.ok || !paystackData.status) {
      const paystackMessage = paystackData.message || 'Unknown error'

      const isCurrencyNotSupported =
        typeof paystackMessage === 'string' &&
        (paystackMessage.toLowerCase().includes('currency not supported') ||
         paystackMessage.toLowerCase().includes('currency not supported by merchant'))

      const isChannelError =
        typeof paystackMessage === 'string' &&
        paystackMessage.toLowerCase().includes('channel')

      if (isCurrencyNotSupported) {
        return jsonResponse({
          error: 'La devise XOF n\'est pas activée pour ce compte Paystack. Veuillez contacter le support.',
          field: 'currency',
          paystack_message: paystackMessage,
          hint: 'Vérifiez les paramètres Paystack Dashboard → Settings → Business.',
        }, 400)
      }

      if (isChannelError) {
        return jsonResponse({
          error: paystackMessage || 'Le canal de paiement demandé n\'est pas disponible.',
          field: 'channels',
          paystack_message: paystackMessage,
        }, 400)
      }

      console.error(
        `[paystack-init] Paystack API error (HTTP ${paystackResponse.status}):`,
        paystackMessage,
      )

      return jsonResponse({
        error: paystackMessage || 'Échec de l\'initialisation du paiement Paystack.',
        paystack_status: paystackResponse.status,
        details: typeof paystackData.data === 'object' ? paystackData.data : null,
        hint: paystackResponse.status === 400
          ? 'Vérifiez le montant, la devise et l\'email. Paystack peut ne pas prendre en charge cette devise.'
          : undefined,
      }, paystackResponse.status >= 400 && paystackResponse.status < 500 ? 400 : 502)
    }

    // ----------------------------------------------------------------------
    // Persist payment data
    // ----------------------------------------------------------------------
    if (order_id && supabase) {
      const { error: updateError } = await supabase
        .from('commande')
        .update({
          payment_reference: paystackData.data.reference,
          payment_data: {
            access_code: paystackData.data.access_code,
            authorization_url: paystackData.data.authorization_url,
            currency: finalCurrency,
            amount_paystack: paystackAmount,
            ...conversionMeta,
            initialized_at: new Date().toISOString(),
          },
        })
        .eq('id', order_id)

      if (updateError) {
        console.error('[paystack-init] Failed to update order:', updateError.message)
      } else {
        console.log(`[paystack-init] Order ${order_id} updated with payment reference`)
      }
    }

    console.log(`[paystack-init] Success: ref=${paystackData.data.reference}`)

    return jsonResponse({
      authorization_url: paystackData.data.authorization_url,
      reference: paystackData.data.reference,
      access_code: paystackData.data.access_code,
      ...conversionMeta,
      amount_minor_units: paystackAmount,
    })

  } catch (error) {
    console.error('[paystack-init] Unhandled error:', (error as Error).message)
    return jsonResponse({
      error: (error as Error).message || 'Internal server error',
    }, 500)
  }
})
