/**
 * Supabase Edge Function: product-category-redirect
 *
 * Returns a redirect URL when a user accesses a hidden/scheduled/unpublished product.
 * Does NOT leak product data - only returns the category path for redirect.
 *
 * Request: GET with ?id=<product_id> or ?slug=<product_slug>
 * - Uses id (UUID) - slug not supported as produit has no slug column
 *
 * Response:
 * - { redirectUrl: "/subcategory-products/:id", reason: "hidden" } when product exists but not visible
 * - { redirectUrl: "/wear", reason: "not_found" } when product doesn't exist
 *
 * Security: Public (anon), no JWT required. Uses service role only to look up category.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'http://localhost:4200',
  'https://smellandwear.com',
  'https://www.smellandwear.com',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get('id') || url.searchParams.get('slug');

    if (!productId) {
      return new Response(
        JSON.stringify({ redirectUrl: '/wear', reason: 'missing_param' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Look up product by id (produit table has no slug - use id only)
    const { data: product, error: productError } = await supabase
      .from('produit')
      .select('id, sous_categorie_id, is_hidden, publish_at, unpublish_at')
      .eq('id', productId)
      .maybeSingle();

    if (productError) {
      console.error('[product-category-redirect] DB error:', productError);
      return new Response(
        JSON.stringify({ redirectUrl: '/wear', reason: 'error' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Product doesn't exist
    if (!product) {
      return new Response(
        JSON.stringify({ redirectUrl: '/wear', reason: 'not_found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if product is publicly visible
    const now = new Date();
    const isVisible =
      !product.is_hidden &&
      (product.publish_at == null || new Date(product.publish_at) <= now) &&
      (product.unpublish_at == null || new Date(product.unpublish_at) > now);

    if (isVisible) {
      // Product is visible - no redirect needed (client should not call this)
      return new Response(
        JSON.stringify({ redirectUrl: null, reason: 'visible' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Product exists but is not visible - return category redirect
    if (product.sous_categorie_id) {
      return new Response(
        JSON.stringify({
          redirectUrl: `/subcategory-products/${product.sous_categorie_id}`,
          reason: 'hidden',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No category - fallback to wear
    return new Response(
      JSON.stringify({ redirectUrl: '/wear', reason: 'no_category' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[product-category-redirect] Error:', err);
    return new Response(
      JSON.stringify({ redirectUrl: '/wear', reason: 'error' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
