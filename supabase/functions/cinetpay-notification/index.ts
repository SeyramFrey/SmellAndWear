import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-token',
}

// Générer le token HMAC pour vérification
async function generateHmacToken(data: any, secretKey: string): Promise<string> {
  const concatenated =
      data.cpm_site_id +
      data.cpm_trans_id +
      data.cpm_trans_date +
      data.cpm_amount +
      data.cpm_currency +
      data.signature +
      data.payment_method +
      data.cel_phone_num +
      data.cpm_phone_prefixe +
      data.cpm_language +
      data.cpm_version +
      data.cpm_payment_config +
      data.cpm_page_action +
      data.cpm_custom +
      data.cpm_designation +
      data.cpm_error_message;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const dataToSign = encoder.encode(concatenated);

  const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, dataToSign);
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

// Vérifier le paiement auprès de CinetPay
async function verifyPaymentWithCinetPay(params: any) {
  const response = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      apikey: params.apikey,
      site_id: params.site_id,
      transaction_id: params.transaction_id
    })
  });

  return await response.json();
}

serve(async (req) => {
  // Gérer CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Gérer GET (CinetPay ping pour vérifier disponibilité)
  if (req.method === 'GET') {
    return new Response('OK', {
      status: 200,
      headers: corsHeaders
    })
  }

  try {
    // ⚠️ REMPLACER PAR VOS VRAIES VALEURS
    const CINETPAY_APIKEY = '73712460065f879ee485fb8.23373934'
    const CINETPAY_SITE_ID = '5875784'
    const CINETPAY_SECRET_KEY = 'VOTRE_SECRET_KEY_ICI' // À récupérer dans CinetPay

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Récupérer les données POST
    const contentType = req.headers.get('content-type') || ''
    let data: any = {}

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData()
      for (const [key, value] of formData.entries()) {
        data[key] = value
      }
    } else {
      data = await req.json()
    }

    console.log('📥 Notification CinetPay reçue:', data)

    // 1. Vérifier le token HMAC (SÉCURITÉ)
    const receivedToken = req.headers.get('x-token')
    const generatedToken = await generateHmacToken(data, CINETPAY_SECRET_KEY)

    if (receivedToken !== generatedToken) {
      console.error('❌ Token HMAC invalide!')
      console.log('Reçu:', receivedToken)
      console.log('Généré:', generatedToken)

      // Retourner quand même 200 pour ne pas bloquer CinetPay
      return new Response('OK', {
        status: 200,
        headers: corsHeaders
      })
    }

    console.log('✅ Token HMAC valide')

    const transactionId = data.cpm_trans_id

    // 2. Vérifier si la transaction existe déjà
    const { data: existingOrder, error: fetchError } = await supabase
        .from('commandes')
        .select('*')
        .eq('payment_reference', transactionId)
        .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Erreur fetch commande:', fetchError)
    }

    // Si la commande existe déjà et est payée, ne rien faire
    if (existingOrder && existingOrder.statut === 'PAID') {
      console.log('✅ Transaction déjà traitée')
      return new Response('OK', {
        status: 200,
        headers: corsHeaders
      })
    }

    // 3. Vérifier le statut auprès de CinetPay (OBLIGATOIRE)
    console.log('🔍 Vérification du paiement auprès de CinetPay...')
    const verificationResult = await verifyPaymentWithCinetPay({
      apikey: CINETPAY_APIKEY,
      site_id: CINETPAY_SITE_ID,
      transaction_id: transactionId
    })

    console.log('📊 Résultat vérification:', verificationResult)

    // 4. Mettre à jour le statut de la commande
    let newStatus = 'PENDING'
    let paymentData = null

    if (verificationResult.code === "00" && verificationResult.data.status === "ACCEPTED") {
      newStatus = 'PAID'
      paymentData = verificationResult.data
      console.log('✅ Paiement ACCEPTÉ')
    } else if (verificationResult.data.status === "REFUSED") {
      newStatus = 'FAILED'
      console.log('❌ Paiement REFUSÉ')
    } else if (verificationResult.data.status === "WAITING_FOR_CUSTOMER") {
      newStatus = 'PENDING'
      console.log('⏳ Paiement en ATTENTE')
    }

    // 5. Mettre à jour la commande dans Supabase
    if (existingOrder) {
      const { error: updateError } = await supabase
          .from('commandes')
          .update({
            statut: newStatus,
            payment_data: paymentData,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingOrder.id)

      if (updateError) {
        console.error('❌ Erreur mise à jour commande:', updateError)
      } else {
        console.log('✅ Commande mise à jour:', existingOrder.id)
      }
    } else {
      console.warn('⚠️ Aucune commande trouvée pour cette transaction')
    }

    // 6. Retourner 200 OK (OBLIGATOIRE pour CinetPay)
    return new Response('OK', {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('❌ Erreur dans la fonction:', error)

    // Toujours retourner 200 pour ne pas bloquer CinetPay
    return new Response('OK', {
      status: 200,
      headers: corsHeaders
    })
  }
})