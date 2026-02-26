import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GeoResponse {
  continent?: string;
  country?: string;
  defaultCountry: 'FR' | 'CI';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get client IP from request headers (Supabase/Cloudflare will provide this)
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('x-real-ip') ||
                     ''

    if (!clientIP) {
      // Default to France if IP cannot be determined
      return new Response(
        JSON.stringify({ continent: 'Unknown', defaultCountry: 'FR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Try multiple geolocation services for reliability
    let continent: string | null = null
    let country: string | null = null

    // Service 1: ip-api.com (free, no key needed)
    try {
      const response = await fetch(`http://ip-api.com/json/${clientIP}?fields=status,country,countryCode,continent`)
      const data = await response.json()
      if (data.status === 'success') {
        continent = data.continent || null
        country = data.countryCode || null
      }
    } catch (error) {
      console.warn('ip-api.com failed:', error)
    }

    // Service 2: ipapi.co (fallback)
    if (!continent) {
      try {
        const response = await fetch(`https://ipapi.co/${clientIP}/json/`)
        const data = await response.json()
        if (data.continent_code) {
          continent = data.continent_code === 'EU' ? 'Europe' : 
                     data.continent_code === 'AF' ? 'Africa' : null
          country = data.country_code || null
        }
      } catch (error) {
        console.warn('ipapi.co failed:', error)
      }
    }

    // Determine default country based on continent
    let defaultCountry: 'FR' | 'CI' = 'FR' // Default to France

    if (continent) {
      const continentUpper = continent.toUpperCase()
      if (continentUpper === 'EUROPE' || continentUpper === 'EU') {
        defaultCountry = 'FR'
      } else if (continentUpper === 'AFRICA' || continentUpper === 'AF') {
        defaultCountry = 'CI'
      }
    } else if (country) {
      // Fallback: use country code
      const countryUpper = country.toUpperCase()
      // European countries
      if (['FR', 'DE', 'IT', 'ES', 'GB', 'NL', 'BE', 'CH', 'AT', 'PT', 'SE', 'NO', 'DK', 'FI'].includes(countryUpper)) {
        defaultCountry = 'FR'
      }
      // African countries
      else if (['CI', 'SN', 'ML', 'BF', 'NE', 'TG', 'BJ', 'GH', 'NG', 'CM', 'CD'].includes(countryUpper)) {
        defaultCountry = 'CI'
      }
    }

    const response: GeoResponse = {
      continent: continent || 'Unknown',
      country: country || 'Unknown',
      defaultCountry
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in geo-default:', error)
    // Default to France on error
    return new Response(
      JSON.stringify({ continent: 'Unknown', defaultCountry: 'FR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
