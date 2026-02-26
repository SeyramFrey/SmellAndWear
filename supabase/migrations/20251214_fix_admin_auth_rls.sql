-- ============================================================================
-- MIGRATION: Admin Authentication & RLS Fixes
-- Purpose: Fix admin table policies, consolidate produit policies
-- Date: 2025-12-14
-- Author: SmellAndWear Admin Auth Audit
-- 
-- This migration was applied automatically. It is saved here for reference
-- and version control. If applying manually, run this in Supabase SQL Editor.
--
-- HOTFIX 2025-12-14: Fixed infinite recursion in admin RLS policies
-- The original policies referenced the admin table within themselves.
-- Solution: Use SECURITY DEFINER function is_admin_no_rls() to bypass RLS.
-- ============================================================================

-- ============================================================================
-- STEP 1: Admin Table RLS Policies
-- Current: Only SELECT policy exists
-- Goal: Add proper policies for admin management
-- ============================================================================

-- Drop existing policies on admin table first (safe cleanup)
DROP POLICY IF EXISTS "admin can read self" ON public.admin;
DROP POLICY IF EXISTS "Admins can view admin list" ON public.admin;
DROP POLICY IF EXISTS "Admins can insert new admins" ON public.admin;
DROP POLICY IF EXISTS "Admins can remove other admins" ON public.admin;
DROP POLICY IF EXISTS "admin_select_policy" ON public.admin;
DROP POLICY IF EXISTS "admin_insert_policy" ON public.admin;
DROP POLICY IF EXISTS "admin_update_policy" ON public.admin;
DROP POLICY IF EXISTS "admin_delete_policy" ON public.admin;

-- Ensure RLS is enabled
ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- IMPORTANT: Admin table policies use SECURITY DEFINER function to avoid
-- infinite recursion. The is_admin_no_rls() function bypasses RLS.
-- ============================================================================

-- Create SECURITY DEFINER function to check admin status (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin_no_rls(check_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin a
    WHERE a.user_id = COALESCE(check_user_id, auth.uid())
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin_no_rls(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_no_rls(uuid) TO anon;

-- Policy 1: Authenticated users can read their OWN admin record
CREATE POLICY "admin_select_own"
ON public.admin FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Policy 2: Admins can read ALL admin records (for admin management UI)
CREATE POLICY "admin_select_all_for_admins"
ON public.admin FOR SELECT
TO authenticated
USING (public.is_admin_no_rls());

-- Policy 3: INSERT is handled by Edge Function with service_role
-- No client INSERT policy needed (security by design)

-- Policy 4: DELETE - only existing admins can remove other admins
CREATE POLICY "admin_delete_others"
ON public.admin FOR DELETE
TO authenticated
USING (
  public.is_admin_no_rls()
  AND user_id != (SELECT auth.uid())
);

-- ============================================================================
-- STEP 2: Consolidate Produit Policies
-- Current: 7 policies with duplicates causing performance warnings
-- Goal: Reduce to minimal set without duplicates
-- ============================================================================

-- Drop duplicate/redundant policies on produit
DROP POLICY IF EXISTS "admins manage produit" ON public.produit;
DROP POLICY IF EXISTS "admin delete produit" ON public.produit;
DROP POLICY IF EXISTS "admin insert produit" ON public.produit;
DROP POLICY IF EXISTS "admin update produit" ON public.produit;
DROP POLICY IF EXISTS "anon read produit" ON public.produit;
DROP POLICY IF EXISTS "authenticated read produit" ON public.produit;

-- Create consolidated policies
-- Policy 1: Anyone can read products (public storefront)
CREATE POLICY "public_read_produit"
ON public.produit FOR SELECT
TO public
USING (true);

-- Policy 2: Only admins (verified from admin table) can INSERT
CREATE POLICY "admin_insert_produit"
ON public.produit FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin a 
    WHERE a.user_id = (SELECT auth.uid())
  )
);

-- Policy 3: Only admins can UPDATE
CREATE POLICY "admin_update_produit"
ON public.produit FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin a 
    WHERE a.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin a 
    WHERE a.user_id = (SELECT auth.uid())
  )
);

-- Policy 4: Only admins can DELETE
CREATE POLICY "admin_delete_produit"
ON public.produit FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin a 
    WHERE a.user_id = (SELECT auth.uid())
  )
);

-- ============================================================================
-- STEP 3: Sync admin email from auth.users (optional but useful for admin UI)
-- ============================================================================

-- Update existing admin records to include email from auth.users
UPDATE public.admin a
SET email = u.email
FROM auth.users u
WHERE a.user_id = u.id
  AND a.email IS NULL;

-- ============================================================================
-- STEP 4: Ensure is_admin function is optimized (already good, verify)
-- ============================================================================

-- Recreate is_admin function with guaranteed optimizations
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public', 'auth', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin a
    WHERE a.user_id = (SELECT auth.uid())
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (run these after migration to verify)
-- ============================================================================
/*
-- Verify admin policies
SELECT policyname, cmd, roles FROM pg_policies 
WHERE tablename = 'admin' AND schemaname = 'public';

-- Expected:
-- admin_select_self_or_admins | SELECT | {authenticated}
-- admin_delete_others         | DELETE | {authenticated}

-- Verify produit policies
SELECT policyname, cmd, roles FROM pg_policies 
WHERE tablename = 'produit' AND schemaname = 'public';

-- Expected:
-- public_read_produit  | SELECT | {public}
-- admin_insert_produit | INSERT | {authenticated}
-- admin_update_produit | UPDATE | {authenticated}
-- admin_delete_produit | DELETE | {authenticated}

-- Check is_admin function
SELECT proname, prosecdef, proconfig FROM pg_proc 
WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace;
*/

-- ============================================================================
-- DONE
-- ============================================================================

