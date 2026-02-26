/**
 * Supabase Edge Function: invite-admin
 * 
 * Securely invites a new admin user via Supabase Auth Admin API.
 * 
 * IMPORTANT: This function dynamically determines the redirect URL from the
 * request Origin header. This allows the same Supabase project to work with
 * both development (localhost:4200) and production (smellandwear.com).
 * 
 * Security:
 * - Requires authenticated caller (JWT in Authorization header)
 * - Verifies caller is an admin by checking public.admin table
 * - Uses SUPABASE_SERVICE_ROLE_KEY (never exposed to frontend)
 * - Validates Origin against strict allowlist
 * 
 * Request:
 * - Method: POST
 * - Headers: 
 *   - Authorization: Bearer <user_jwt>
 *   - Content-Type: application/json
 *   - Origin: http://localhost:4200 or https://smellandwear.com
 * - Body: { "email": "newadmin@example.com" }
 * 
 * Response:
 * - Success: { "success": true, "message": "...", "userId": "..." }
 * - Error: { "success": false, "error": "..." }
 * 
 * Deployment:
 * ```bash
 * supabase functions deploy invite-admin
 * ```
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Allowed origins for redirect (strict allowlist)
const ALLOWED_ORIGINS = [
  'http://localhost:4200',
  'https://smellandwear.com',
  'https://www.smellandwear.com'
]

// CORS headers - dynamic based on request origin
function getCorsHeaders(origin: string | null): Record<string, string> {
  // Only allow listed origins
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate origin
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      console.error(`[invite-admin] Invalid origin: ${origin}`)
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid origin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email } = await req.json()
    
    if (!email || !isValidEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Dynamic redirect URL based on request origin
    // Admin invites go to /auth/invite (dedicated route)
    const redirectTo = `${origin}/auth/invite`
    
    console.log(`[invite-admin] Origin: ${origin}, RedirectTo: ${redirectTo}`)

    // User client to verify caller
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    // Get caller's user
    const { data: { user: caller }, error: userError } = await userClient.auth.getUser()
    
    if (userError || !caller) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify caller is an admin (check admin table)
    const { data: adminCheck, error: adminError } = await userClient
      .from('admin')
      .select('user_id')
      .eq('user_id', caller.id)
      .maybeSingle()

    if (adminError || !adminCheck) {
      console.error(`[invite-admin] Access denied for user ${caller.id}:`, adminError)
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied. You must be an admin to invite others.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client with service role for Admin API
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === email)

    let userId: string

    if (existingUser) {
      // User exists - check if already admin
      const { data: existingAdmin } = await adminClient
        .from('admin')
        .select('user_id')
        .eq('user_id', existingUser.id)
        .maybeSingle()

      if (existingAdmin) {
        return new Response(
          JSON.stringify({ success: false, error: 'This user is already an admin' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Add existing user to admin table
      userId = existingUser.id
      console.log(`[invite-admin] Existing user ${email}, adding to admin table`)
    } else {
      // Invite new user with dynamic redirect URL
      console.log(`[invite-admin] Inviting new user ${email} with redirect: ${redirectTo}`)
      
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: redirectTo
        }
      )

      if (inviteError) {
        console.error('[invite-admin] Invite error:', inviteError)
        return new Response(
          JSON.stringify({ success: false, error: inviteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      userId = inviteData.user.id
    }

    // Add to admin table (with email for reference)
    const { error: insertError } = await adminClient
      .from('admin')
      .upsert({ 
        user_id: userId,
        email: email 
      }, {
        onConflict: 'user_id'
      })

    if (insertError) {
      console.error('[invite-admin] Admin insert error:', insertError)
      // Don't fail completely - user was invited, just admin record failed
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User invited, but admin record creation failed. Please add manually.',
          userId,
          warning: insertError.message
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[invite-admin] Success: ${email} added as admin (userId: ${userId})`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: existingUser 
          ? `Admin access granted to ${email}` 
          : `Invitation sent to ${email}`,
        userId 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[invite-admin] Function error:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}
