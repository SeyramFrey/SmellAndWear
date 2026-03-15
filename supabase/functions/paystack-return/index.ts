/**
 * Paystack Return Edge Function
 *
 * Handles the redirect from Paystack after payment.
 * Redirects to the Angular /checkout/success page with the reference.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FRONTEND_ORIGINS = [
  'https://smellandwear.com',
  'https://www.smellandwear.com',
  'http://localhost:4200',
]

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const reference = url.searchParams.get('reference') || url.searchParams.get('trxref')
    const origin = req.headers.get('origin') || req.headers.get('referer')

    // Determine frontend base URL
    let baseUrl = FRONTEND_ORIGINS[0]
    if (origin) {
      const found = FRONTEND_ORIGINS.find(o => origin.startsWith(o))
      if (found) baseUrl = found
    }

    if (!reference) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: `${baseUrl}/checkout?payment=error&message=no_reference` },
      })
    }

    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${baseUrl}/checkout/success?reference=${reference}` },
    })
  } catch (error) {
    console.error('[paystack-return] Error:', error)
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: `${FRONTEND_ORIGINS[0]}/checkout?payment=error` },
    })
  }
})
