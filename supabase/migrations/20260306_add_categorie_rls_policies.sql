-- ============================================================================
-- MIGRATION: Add RLS policies for categorie table
-- Purpose: Fix PGRST116 error when admins update categories
-- Date: 2026-03-06
--
-- The categorie table had RLS enabled but no policies, causing UPDATE
-- operations to affect 0 rows and .single() to throw PGRST116.
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.categorie ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "public_read_categorie" ON public.categorie;
DROP POLICY IF EXISTS "admin_insert_categorie" ON public.categorie;
DROP POLICY IF EXISTS "admin_update_categorie" ON public.categorie;
DROP POLICY IF EXISTS "admin_delete_categorie" ON public.categorie;

-- Public read access (storefront needs to list categories)
CREATE POLICY "public_read_categorie"
ON public.categorie FOR SELECT
TO public
USING (true);

-- Admin insert
CREATE POLICY "admin_insert_categorie"
ON public.categorie FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_no_rls());

-- Admin update
CREATE POLICY "admin_update_categorie"
ON public.categorie FOR UPDATE
TO authenticated
USING (public.is_admin_no_rls())
WITH CHECK (public.is_admin_no_rls());

-- Admin delete
CREATE POLICY "admin_delete_categorie"
ON public.categorie FOR DELETE
TO authenticated
USING (public.is_admin_no_rls());
