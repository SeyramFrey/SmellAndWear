# Admin Authentication Guide

> Complete guide for the SmellAndWear admin authentication system.
> 
> **Architecture**: One Supabase project serving both DEV and PROD environments.

## Table of Contents

1. [Overview](#overview)
2. [Authentication Routes](#authentication-routes)
3. [Supabase Dashboard Configuration](#supabase-dashboard-configuration)
4. [Email Templates](#email-templates)
5. [Edge Function](#edge-function)
6. [How It Works](#how-it-works)
7. [Troubleshooting](#troubleshooting)
8. [Technical Reference](#technical-reference)

---

## Overview

SmellAndWear uses a secure, invite-only admin authentication system that works seamlessly across both development and production environments using a **single Supabase project**.

### Key Principles

- **Invite-Only Access**: Admin accounts are created via Edge Function - NO public signup
- **Database-Verified**: Admin status is checked against `public.admin` table, not just JWT
- **Environment-Aware**: Edge Function dynamically determines redirect URL from Origin header
- **Dedicated Routes**: Each auth flow has its own route for clear separation

### Environments

| Environment | URL | Same Supabase Project |
|-------------|-----|----------------------|
| Development | `http://localhost:4200` | ✅ Yes |
| Production | `https://smellandwear.com` | ✅ Yes |

---

## Authentication Routes

Each authentication flow has a **dedicated route** for clean separation:

| Route | Purpose | Triggered By |
|-------|---------|--------------|
| `/auth/login` | Admin login page | User navigation |
| `/auth/callback` | OAuth, signup confirmation, magic links | Supabase redirect |
| `/auth/invite` | Admin invitation acceptance | Invite email link |
| `/auth/reset-password` | Password reset | Reset email link |

### Route Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AUTHENTICATION ROUTES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  OAuth/Magic Link          Admin Invite              Password Reset          │
│  ────────────────          ────────────              ──────────────          │
│        │                        │                         │                  │
│        ▼                        ▼                         ▼                  │
│  /auth/callback            /auth/invite           /auth/reset-password       │
│        │                        │                         │                  │
│        │                        ▼                         ▼                  │
│        │                  Set Password              Set New Password         │
│        │                        │                         │                  │
│        ▼                        ▼                         ▼                  │
│   Check Admin?           Verify Admin Table         Redirect to Login        │
│        │                        │                                            │
│   ┌────┴────┐                   │                                            │
│   ▼         ▼                   ▼                                            │
│ /admin     /                 /admin                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Supabase Dashboard Configuration

### ⚠️ CRITICAL SETTINGS

Navigate to **Authentication** → **URL Configuration**:

#### Site URL (ALWAYS PRODUCTION)

```
https://smellandwear.com
```

> **NEVER** change the Site URL based on environment. It MUST always be production.

#### Redirect URLs (BOTH ENVIRONMENTS)

Add ALL of these URLs to the allowlist:

```
http://localhost:4200/auth/callback
http://localhost:4200/auth/invite
http://localhost:4200/auth/reset-password
https://smellandwear.com/auth/callback
https://smellandwear.com/auth/invite
https://smellandwear.com/auth/reset-password
```

### Configuration Checklist

- [ ] **Site URL**: `https://smellandwear.com`
- [ ] **Redirect URLs**: All 6 URLs added (3 DEV + 3 PROD)
- [ ] **SMTP**: Custom SMTP configured
- [ ] **Email Templates**: Correctly configured (see below)

---

## Email Templates

Navigate to **Authentication** → **Email Templates**:

### Confirm Signup Email

**Subject:** `Confirm your email`

**Template:**
```html
<h2>Confirm your email</h2>
<p>Follow this link to confirm your email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your email</a></p>
```

> ✅ Use `{{ .ConfirmationURL }}` - This auto-generates the correct verification link

### Invite User Email (Admin Invitations)

**Subject:** `You have been invited to Smell & Wear Admin`

**Template (Option A - Using ConfirmationURL with custom redirect):**
```html
<h2>You have been invited</h2>
<p>You have been invited to join Smell & Wear as an administrator.</p>
<p><a href="{{ .ConfirmationURL }}">Accept Invitation</a></p>
```

> ⚠️ When using `{{ .ConfirmationURL }}`, the Edge Function's `redirectTo` will be used AFTER token verification.

**Template (Option B - Custom link with token_hash for SSR):**
```html
<h2>You have been invited</h2>
<p>You have been invited to join Smell & Wear as an administrator.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite">Accept Invitation</a></p>
```

> ✅ This format gives full control - the token_hash is verified by Angular using `verifyOtp`

### Reset Password Email

**Subject:** `Reset your password`

**Template:**
```html
<h2>Reset your password</h2>
<p>Follow this link to reset your password:</p>
<p><a href="{{ .SiteURL }}/auth/reset-password?token_hash={{ .TokenHash }}&type=recovery">Reset Password</a></p>
```

> ✅ This uses token_hash flow which works reliably with SSR apps

### Template Variable Reference

| Variable | Use Case | Notes |
|----------|----------|-------|
| `{{ .ConfirmationURL }}` | All confirmations | Auto-generated by Supabase, includes token |
| `{{ .TokenHash }}` | Custom links | Use with `verifyOtp()` in Angular |
| `{{ .RedirectTo }}` | Custom links | The redirect URL passed to inviteUserByEmail |
| `{{ .SiteURL }}` | Display/links | Your Site URL from Dashboard settings |
| `{{ .Token }}` | OTP input | 6-digit code for manual entry |

---

## Edge Function

### How It Works

The `invite-admin` Edge Function dynamically determines the redirect URL:

1. **Receives request** from Angular frontend
2. **Reads Origin header** (`http://localhost:4200` or `https://smellandwear.com`)
3. **Validates Origin** against strict allowlist
4. **Builds redirectTo** as `{origin}/auth/invite`
5. **Calls inviteUserByEmail** with the dynamic redirectTo
6. **Inserts into admin table**

### Allowed Origins (Hardcoded)

```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:4200',
  'https://smellandwear.com',
  'https://www.smellandwear.com'
]
```

### Security Features

- ✅ Validates Origin header against allowlist
- ✅ Requires authenticated admin caller (JWT verification)
- ✅ Verifies caller is in `public.admin` table
- ✅ Uses `service_role` key (never exposed to frontend)
- ✅ Rejects requests from unknown origins

### Deployment

```bash
supabase functions deploy invite-admin
```

No secrets to set - the function uses the Origin header dynamically.

---

## How It Works

### Admin Invitation Flow

```
1. Admin Panel                    2. Edge Function                 3. Supabase Auth
   ───────────                       ─────────────                    ────────────
   POST /invite-admin ──────────────► Validate Origin
   Origin: localhost:4200             │
                                      ▼
                                 Build redirectTo:
                                 localhost:4200/auth/invite
                                      │
                                      ▼
                                 inviteUserByEmail(email, {
                                   redirectTo: "localhost:4200/auth/invite"
                                 }) ──────────────────────────────► Send Email
                                      │
                                      ▼
                                 INSERT into admin table


4. Email Received                 5. /auth/invite                  6. Admin Dashboard
   ──────────────                    ─────────────                    ───────────────
   Click link ────────────────────► Parse tokens from URL
   localhost:4200/auth/invite        │
   #access_token=...                 ▼
                                 setSession(tokens)
                                      │
                                      ▼
                                 Show password form
                                      │
                                      ▼
                                 updatePassword()
                                      │
                                      ▼
                                 Verify admin in DB ───────────────► /admin
```

### Password Reset Flow

```
1. Login Page                     2. Supabase Auth                 3. /auth/reset-password
   ──────────                        ────────────                     ──────────────────
   resetPasswordForEmail() ─────────► Send email with
                                      ConfirmationURL
                                           │
                                           ▼
                                      User clicks link
                                      /auth/reset-password#...
                                           │
                                           ▼
                                      Parse tokens
                                           │
                                           ▼
                                      Set new password
                                           │
                                           ▼
                                      Redirect to /auth/login
```

---

## Troubleshooting

### "Invalid origin" Error from Edge Function

**Cause:** Request origin is not in the allowlist.

**Solution:**
1. Check browser dev tools → Network → Request headers
2. Verify Origin header matches one of:
   - `http://localhost:4200`
   - `https://smellandwear.com`

### Invite Email Links Go to Wrong Environment

**Cause:** The Edge Function wasn't receiving the correct Origin header.

**Solution:**
1. Ensure Angular is making requests with credentials
2. Check that CORS is working correctly
3. Verify the Edge Function is deployed (v11+)

### "redirect_uri_mismatch" Error

**Cause:** Redirect URL not in Supabase allowlist.

**Solution:** Add ALL redirect URLs to Supabase Dashboard:
```
http://localhost:4200/auth/callback
http://localhost:4200/auth/invite
http://localhost:4200/auth/reset-password
https://smellandwear.com/auth/callback
https://smellandwear.com/auth/invite
https://smellandwear.com/auth/reset-password
```

### Infinite Recursion Error (42P17)

**Cause:** Old RLS policy on admin table referenced itself.

**Solution:** This has been fixed. The `is_admin_no_rls()` function is now SECURITY DEFINER to bypass RLS.

### Password Reset Email Goes to Wrong Route

**Cause:** Email template using wrong variable.

**Solution:** Ensure reset password template uses `{{ .ConfirmationURL }}`, NOT `{{ .RedirectTo }}`.

---

## Technical Reference

### Database Schema

#### Table: `public.admin`

```sql
CREATE TABLE public.admin (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### RLS Policies

| Policy | Command | Description |
|--------|---------|-------------|
| `admin_select_own` | SELECT | Users can see their own admin record |
| `admin_select_all_for_admins` | SELECT | Admins can see all admin records |
| `admin_delete_others` | DELETE | Admins can delete other admins (not self) |

**Note:** INSERT is handled by Edge Function with `service_role` (bypasses RLS).

### Functions

#### `public.is_admin()`

```sql
-- Wrapper function (SECURITY INVOKER)
CREATE FUNCTION public.is_admin() RETURNS boolean
AS $$ SELECT public.is_admin_no_rls(auth.uid()); $$;
```

#### `public.is_admin_no_rls()`

```sql
-- Core function (SECURITY DEFINER - bypasses RLS)
CREATE FUNCTION public.is_admin_no_rls(check_user_id uuid DEFAULT NULL) 
RETURNS boolean
SECURITY DEFINER
AS $$ SELECT EXISTS (SELECT 1 FROM public.admin WHERE user_id = COALESCE(check_user_id, auth.uid())); $$;
```

### Angular Files

```
src/app/
├── account/
│   ├── account-routing.module.ts     # Route definitions
│   ├── account.module.ts             # Module declarations
│   ├── login/                        # /auth/login
│   ├── auth-callback/                # /auth/callback (OAuth, signup, magic)
│   ├── admin-invite/                 # /auth/invite (admin invitations)
│   └── reset-password/               # /auth/reset-password
├── core/
│   ├── guards/
│   │   └── admin.guard.ts            # Route protection
│   └── services/
│       ├── supabase-auth.service.ts  # Base auth
│       ├── admin-auth.service.ts     # Admin auth logic
│       └── admin-invite.service.ts   # Invitation handling
└── pages/
    └── ecommerce/
        └── admin-users/              # Admin management UI

supabase/
└── functions/
    └── invite-admin/
        └── index.ts                  # Edge Function
```

---

## Summary

### Architecture

| Component | Configuration |
|-----------|---------------|
| Supabase Site URL | `https://smellandwear.com` (always production) |
| Redirect URLs | 6 URLs (3 routes × 2 environments) |
| Edge Function | Uses Origin header for dynamic redirect |
| Angular Routes | 4 dedicated routes for different auth flows |

### Security

- ✅ Admin invites via Edge Function only
- ✅ Origin header validation
- ✅ Admin status verified from database
- ✅ No service_role key in frontend
- ✅ RLS policies with SECURITY DEFINER helper

### Forbidden Practices

- ❌ Changing Site URL per environment
- ❌ Hardcoding URLs in Edge Function
- ❌ Merging all auth flows into one route
- ❌ Using `{{ .SiteURL }}` for functional links
- ❌ Inviting users directly from frontend

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-14 | Initial implementation |
| 2025-12-14 | Fixed RLS infinite recursion with SECURITY DEFINER function |
| 2025-12-14 | **MAJOR**: Refactored to dedicated routes for each auth flow |
| 2025-12-14 | Edge Function now uses Origin header for dynamic redirect |
| 2025-12-14 | Added `/auth/invite` and `/auth/reset-password` routes |
