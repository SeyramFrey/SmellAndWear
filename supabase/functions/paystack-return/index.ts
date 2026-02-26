import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const reference = url.searchParams.get('reference') || url.searchParams.get('trxref')
    
    if (!reference) {
      // Redirect to checkout with error
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `${url.origin}/checkout?payment=error&message=No reference provided`
        }
      })
    }

    // Redirect to checkout with reference for client-side verification
    const success = url.searchParams.get('status') === 'success'
    const redirectUrl = success
      ? `${url.origin}/checkout?payment=success&reference=${reference}`
      : `${url.origin}/checkout?payment=failed&reference=${reference}`

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': redirectUrl
      }
    })

  } catch (error) {
    console.error('Error in paystack-return:', error)
    // Redirect to checkout with error
    const url = new URL(req.url)
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${url.origin}/checkout?payment=error`
      }
    })
  }
})
