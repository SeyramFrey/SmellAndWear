# Admin Authentication System

## Overview

SmellAndWear uses a secure admin authentication system built with Supabase Auth and verified against the `public.admin` table. This ensures that only explicitly authorized users can access the admin panel.

## Security Model

### Key Principles

1. **Invite-Only Access**: Admin accounts are created via Supabase "Invite user" flow - NO public signup
2. **Database Verification**: Admin status is ALWAYS verified from `public.admin` table, not just JWT claims
3. **Immediate Revocation**: Non-admin users are signed out immediately upon detection
4. **Secure Invitations**: Admin invitations are processed via Edge Function (no service_role key in frontend)

### Authentication Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Admin Login    │────▶│  Supabase Auth   │────▶│  Verify in DB    │
│   /auth/login    │     │  signInWithPwd   │     │  public.admin    │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
                              ┌─────────────────────────────┤
                              │                             │
                              ▼                             ▼
                    ┌──────────────────┐         ┌──────────────────┐
                    │   Grant Access   │         │   Sign Out +     │
                    │   → /admin       │         │   Access Denied  │
                    └──────────────────┘         └──────────────────┘
```

## Database Setup

### Required Table: `public.admin`

```sql
CREATE TABLE public.admin (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view admin list"
ON public.admin FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin a 
    WHERE a.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Admins can insert new admins"
ON public.admin FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin a 
    WHERE a.user_id = (SELECT auth.uid())
  )
);

CREATE POLICY "Admins can remove other admins"
ON public.admin FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin a 
    WHERE a.user_id = (SELECT auth.uid())
  )
  AND user_id != (SELECT auth.uid()) -- Cannot remove self
);
```

### First Admin Setup

To create the first admin, run this SQL in the Supabase SQL Editor:

```sql
-- Replace with the user_id from auth.users table
INSERT INTO public.admin (user_id) 
VALUES ('YOUR-USER-ID-HERE');
```

Or use the helper function:

```sql
SELECT set_user_as_admin('admin@example.com');
```

## Supabase Configuration

### Redirect URLs

Add these URLs to your Supabase project's Authentication > URL Configuration > Redirect URLs:

```
https://yoursite.com/auth/callback
https://yoursite.com/admin/auth/callback
http://localhost:4200/auth/callback (for development)
http://localhost:4200/admin/auth/callback (for development)
```

### SMTP Setup

Ensure SMTP is configured in Supabase Auth settings for invite emails to work.

## Edge Function Deployment

### 1. Deploy the invite-admin function

```bash
# From project root
supabase functions deploy invite-admin
```

### 2. Set environment variables

In Supabase Dashboard > Edge Functions > invite-admin > Settings:

```
SITE_URL=https://yoursite.com
```

(SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are auto-set)

## Angular Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/auth/login` | LoginComponent | Admin login form |
| `/auth/callback` | AuthCallbackComponent | Handles invite/recovery links |
| `/admin/**` | Protected | All admin routes require AdminGuard |
| `/admin/ecommerce/admin-users` | AdminUsersComponent | Invite/manage admins |

## Services

### AdminAuthService

Central service for admin authentication.

```typescript
// Key observables
session$: Observable<Session | null>
user$: Observable<User | null>
isAdmin$: Observable<boolean>  // Verified from DB!
initialized$: Observable<boolean>

// Key methods
signIn(email, password): Promise<AdminAuthResult>
signOut(): Promise<void>
handleCallbackFromUrl(): Promise<CallbackResult>
refreshAdminStatus(): Promise<boolean>
```

### AdminInviteService

Handles admin invitations via Edge Function.

```typescript
inviteAdmin(email): Observable<InviteResult>
getAdmins(): Observable<AdminRecord[]>
removeAdmin(userId): Observable<{ success: boolean }>
```

## How to Invite an Admin

### Option 1: Via Admin Panel

1. Log in to admin panel
2. Navigate to `/admin/ecommerce/admin-users`
3. Enter email in "Invite New Admin" form
4. Click "Send Invitation"

### Option 2: Via Supabase Dashboard

1. Go to Supabase Dashboard > Authentication > Users
2. Click "Invite user"
3. Enter email
4. After user accepts, run SQL to add to admin table:

```sql
INSERT INTO public.admin (user_id)
SELECT id FROM auth.users WHERE email = 'newadmin@example.com';
```

## Invite Flow (User Perspective)

1. Existing admin sends invitation
2. New admin receives email with link
3. Clicking link opens `/auth/callback`
4. User sets their password
5. System verifies admin status in DB
6. User is redirected to `/admin`

## Troubleshooting

### "Access Denied" Error

- Check if user exists in `public.admin` table
- Verify RLS policies are correctly set
- Check browser console for specific errors

### Invite Email Not Received

- Check Supabase SMTP configuration
- Verify email is not in spam folder
- Check Supabase logs for email sending errors

### Edge Function Errors

- Ensure function is deployed: `supabase functions list`
- Check function logs: `supabase functions logs invite-admin`
- Verify SITE_URL environment variable is set

### Session Issues

- Clear browser localStorage
- Check if Supabase session is expired
- Verify auth redirect URLs in Supabase settings

## File Structure

```
src/app/
├── core/
│   ├── services/
│   │   ├── admin-auth.service.ts      # Admin auth + DB verification
│   │   ├── admin-invite.service.ts    # Admin invitation handling
│   │   └── supabase-auth.service.ts   # Base Supabase auth
│   └── guards/
│       └── admin.guard.ts             # Route protection
├── account/
│   ├── login/                         # Admin login page
│   └── auth-callback/                 # Invite/recovery callback
├── pages/
│   └── admin/
│       └── admin-users/               # Admin management UI
└── layouts/
    └── topbar/                        # Admin topbar with logout

supabase/
└── functions/
    └── invite-admin/
        └── index.ts                   # Edge Function for invites
```

## Security Checklist

- [ ] `public.admin` table created with RLS
- [ ] First admin added to table
- [ ] Redirect URLs configured in Supabase
- [ ] SMTP configured for invite emails
- [ ] Edge Function deployed
- [ ] SITE_URL environment variable set
- [ ] AdminGuard protecting all /admin routes
- [ ] No service_role key in frontend code

