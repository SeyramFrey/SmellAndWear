import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
}

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

      // Update order status
      if (existingOrder) {
        const { error: updateError } = await supabase
          .from('commande')
          .update({
            statut: 'PAID',
            payment_data: transaction,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingOrder.id)

        if (updateError) {
          console.error('❌ Error updating order:', updateError)
        } else {
          console.log('✅ Order updated to PAID:', existingOrder.id)
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
