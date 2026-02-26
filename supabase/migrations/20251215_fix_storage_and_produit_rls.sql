-- ============================================================================
-- MIGRATION: Fix Storage RLS and Produit Table Policies
-- Purpose: Fix storage bucket policies and update produit RLS to use is_admin_no_rls()
-- Date: 2025-12-15
-- 
-- This migration fixes:
-- 1. Storage bucket 'public-images' RLS policies for authenticated admins
-- 2. Produit table RLS policies to use is_admin_no_rls() function to avoid recursion
-- ============================================================================

-- ============================================================================
-- STEP 1: Ensure is_admin_no_rls() function exists (from previous migration)
-- ============================================================================

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

-- ============================================================================
-- STEP 2: Update Produit Table RLS Policies to use is_admin_no_rls()
-- This avoids recursion issues when checking admin status
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "admin_insert_produit" ON public.produit;
DROP POLICY IF EXISTS "admin_update_produit" ON public.produit;
DROP POLICY IF EXISTS "admin_delete_produit" ON public.produit;

-- Recreate policies using is_admin_no_rls() function
CREATE POLICY "admin_insert_produit"
ON public.produit FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_no_rls());

CREATE POLICY "admin_update_produit"
ON public.produit FOR UPDATE
TO authenticated
USING (public.is_admin_no_rls())
WITH CHECK (public.is_admin_no_rls());

CREATE POLICY "admin_delete_produit"
ON public.produit FOR DELETE
TO authenticated
USING (public.is_admin_no_rls());

-- ============================================================================
-- STEP 3: Storage Bucket Policies for 'public-images'
-- Allow authenticated admins to upload, update, and delete files
-- ============================================================================

-- Drop existing policies on storage.objects for public-images bucket
DROP POLICY IF EXISTS "public-images public read" ON storage.objects;
DROP POLICY IF EXISTS "public-images admin insert" ON storage.objects;
DROP POLICY IF EXISTS "public-images admin update" ON storage.objects;
DROP POLICY IF EXISTS "public-images admin delete" ON storage.objects;
DROP POLICY IF EXISTS "public-images authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "public-images authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "public-images authenticated delete" ON storage.objects;

-- Policy 1: Public read access (anyone can view images)
CREATE POLICY "public-images public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'public-images');

-- Policy 2: Authenticated admins can insert files
CREATE POLICY "public-images admin insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'public-images' 
  AND public.is_admin_no_rls()
);

-- Policy 3: Authenticated admins can update files
CREATE POLICY "public-images admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'public-images' 
  AND public.is_admin_no_rls()
)
WITH CHECK (
  bucket_id = 'public-images' 
  AND public.is_admin_no_rls()
);

-- Policy 4: Authenticated admins can delete files
CREATE POLICY "public-images admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'public-images' 
  AND public.is_admin_no_rls()
);

-- ============================================================================
-- STEP 4: Also fix storage policies for 'medias' bucket (if used)
-- ============================================================================

-- Drop existing policies on storage.objects for medias bucket
DROP POLICY IF EXISTS "medias public read" ON storage.objects;
DROP POLICY IF EXISTS "medias admin insert" ON storage.objects;
DROP POLICY IF EXISTS "medias admin update" ON storage.objects;
DROP POLICY IF EXISTS "medias admin delete" ON storage.objects;
DROP POLICY IF EXISTS "medias authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "medias authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "medias authenticated delete" ON storage.objects;

-- Policy 1: Public read access
CREATE POLICY "medias public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'medias');

-- Policy 2: Authenticated admins can insert files
CREATE POLICY "medias admin insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'medias' 
  AND public.is_admin_no_rls()
);

-- Policy 3: Authenticated admins can update files
CREATE POLICY "medias admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'medias' 
  AND public.is_admin_no_rls()
)
WITH CHECK (
  bucket_id = 'medias' 
  AND public.is_admin_no_rls()
);

-- Policy 4: Authenticated admins can delete files
CREATE POLICY "medias admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'medias' 
  AND public.is_admin_no_rls()
);

-- ============================================================================
-- VERIFICATION QUERIES (run these after migration to verify)
-- ============================================================================
/*
-- Verify produit policies
SELECT policyname, cmd, roles FROM pg_policies 
WHERE tablename = 'produit' AND schemaname = 'public';

-- Expected:
-- public_read_produit  | SELECT | {public}
-- admin_insert_produit | INSERT | {authenticated}
-- admin_update_produit | UPDATE | {authenticated}
-- admin_delete_produit | DELETE | {authenticated}

-- Verify storage policies for public-images
SELECT policyname, cmd, roles FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
AND policyname LIKE '%public-images%';

-- Verify storage policies for medias
SELECT policyname, cmd, roles FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
AND policyname LIKE '%medias%';
*/

-- ============================================================================
-- DONE
-- ============================================================================

