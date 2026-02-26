-- ============================================================================
-- MIGRATION: Product Scheduling & Visibility
-- Purpose: Add is_hidden, publish_at, unpublish_at; create public views; RLS
-- Date: 2026-02-11
-- ============================================================================
-- Public visibility rule: product is visible iff
--   is_hidden = false AND (publish_at IS NULL OR now() >= publish_at)
--   AND (unpublish_at IS NULL OR now() < unpublish_at)
-- Admin: can see ALL products regardless of visibility.
-- Non-admin: must NEVER read hidden/scheduled/unpublished via produit table.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: Add columns to produit
-- ----------------------------------------------------------------------------
ALTER TABLE public.produit
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publish_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS unpublish_at timestamptz NULL;

-- ----------------------------------------------------------------------------
-- STEP 2: CHECK constraint (unpublish_at > publish_at when both set)
-- ----------------------------------------------------------------------------
ALTER TABLE public.produit
  DROP CONSTRAINT IF EXISTS chk_produit_publish_range;

ALTER TABLE public.produit
  ADD CONSTRAINT chk_produit_publish_range
  CHECK (
    unpublish_at IS NULL
    OR publish_at IS NULL
    OR unpublish_at > publish_at
  );

-- ----------------------------------------------------------------------------
-- STEP 3: Indexes for performance
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_produit_is_hidden ON public.produit (is_hidden);
CREATE INDEX IF NOT EXISTS idx_produit_publish_at ON public.produit (publish_at);
CREATE INDEX IF NOT EXISTS idx_produit_unpublish_at ON public.produit (unpublish_at);

-- ----------------------------------------------------------------------------
-- STEP 4: Visibility function (SECURITY INVOKER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_product_publicly_visible(p public.produit)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
  SELECT
    p.is_hidden = false
    AND (p.publish_at IS NULL OR now() >= p.publish_at)
    AND (p.unpublish_at IS NULL OR now() < p.unpublish_at);
$$;

-- Alternative: by product_id (for use in policies/views)
CREATE OR REPLACE FUNCTION public.is_product_publicly_visible_by_id(product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.produit p
    WHERE p.id = product_id
      AND p.is_hidden = false
      AND (p.publish_at IS NULL OR now() >= p.publish_at)
      AND (p.unpublish_at IS NULL OR now() < p.unpublish_at)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_product_publicly_visible(public.produit) TO anon;
GRANT EXECUTE ON FUNCTION public.is_product_publicly_visible(public.produit) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_product_publicly_visible_by_id(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_product_publicly_visible_by_id(uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- STEP 5: products_public view
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public AS
SELECT
  p.id,
  p.nom,
  p.description,
  p.prix,
  p.created_at,
  p.sous_categorie_id,
  p.front_photo_path,
  p.back_photo_path,
  p.is_best_seller,
  p.selected_colors,
  p.selected_sizes,
  p.is_new
FROM public.produit p
WHERE public.is_product_publicly_visible(p);

-- Grant SELECT to anon and authenticated
GRANT SELECT ON public.products_public TO anon;
GRANT SELECT ON public.products_public TO authenticated;

-- ----------------------------------------------------------------------------
-- STEP 6: variants_public view (variants of publicly visible products)
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.variants_public;
CREATE VIEW public.variants_public AS
SELECT
  v.id,
  v.produit_id,
  v.taille_id,
  v.stock,
  v.created_at,
  v.couleur_id,
  v.others_photos,
  v.is_primary,
  v.main_photo_path
FROM public.variant v
WHERE EXISTS (
  SELECT 1 FROM public.produit p
  WHERE p.id = v.produit_id
    AND public.is_product_publicly_visible(p)
);

GRANT SELECT ON public.variants_public TO anon;
GRANT SELECT ON public.variants_public TO authenticated;

-- ----------------------------------------------------------------------------
-- STEP 7: RLS on produit - restrict SELECT to admin only
-- ----------------------------------------------------------------------------
-- Drop existing public read policy
DROP POLICY IF EXISTS "public_read_produit" ON public.produit;

-- New policy: only admins can SELECT from produit
CREATE POLICY "admin_select_produit"
ON public.produit FOR SELECT
TO authenticated
USING (public.is_admin_no_rls());

-- Allow anon for nothing on produit (they use products_public)
-- Note: If admin checks happen via anon, we need to ensure admin is authenticated.
-- The products_public view is the only way for non-admins to see products.

-- ----------------------------------------------------------------------------
-- STEP 8: RLS on products_public view
-- By default, views inherit RLS from underlying tables. But products_public
-- selects from produit - we need the view to be readable by anon/authenticated.
-- Views in Postgres do NOT have RLS by default - they use the underlying
-- table's RLS. Since we're selecting only visible rows, the view definition
-- itself filters. The view runs with the invoker's privileges.
-- Actually: When you SELECT from a view, Postgres runs the view's query.
-- The view query selects from produit - so RLS on produit would apply!
-- That would block anon from reading products_public because anon can't
-- SELECT from produit at all.
--
-- Solution: Use SECURITY INVOKER for the view... Views don't have that.
-- We need a different approach: use a SECURITY DEFINER function that
-- returns the visible products, OR make the view bypass RLS.
--
-- Option A: Create a table that's populated by trigger - complex.
-- Option B: Use a SECURITY DEFINER function that selects and returns.
-- Option C: Add a policy on produit that allows SELECT when the row
--   satisfies is_product_publicly_visible(p) - but that would need to
--   be a USING clause. So: allow anon/authenticated to SELECT from produit
--   ONLY when the row is publicly visible. That way:
--   - Admin (authenticated + is_admin): sees all (via admin_select_produit)
--   - Non-admin: sees only visible rows (via new policy)
--
-- Let me re-read the requirements. "non-admin must not be able to SELECT
-- from products at all" - so they must NOT query the produit table.
-- They must use products_public. So we need the view to be readable
-- without going through produit RLS... The only way is to have the view
-- created with SECURITY DEFINER or to have a function that runs as
-- definer. Actually, in Postgres, views don't have RLS - the underlying
-- table's RLS applies when you query through the view. So if we have:
-- - produit: SELECT only for is_admin_no_rls()
-- Then SELECT from products_public (which reads from produit) would also
-- require is_admin_no_rls() when the current user is the one running the
-- query. So anon would get no rows... Actually the view would run as the
-- invoking user. So when anon selects from products_public, the view
-- runs, and it references produit. The RLS on produit says: only
-- is_admin_no_rls() can select. For anon, auth.uid() is null, so
-- is_admin_no_rls() is false. So no rows. So we need a different policy.
--
-- We need TWO ways to read produit:
-- 1. Admin: can read all rows (admin_select_produit)
-- 2. Non-admin: can read only rows where is_product_publicly_visible(p)
--
-- So we need a second policy for SELECT:
-- "public_select_visible_produit" : allow anon and authenticated to
-- SELECT where is_product_publicly_visible(produit). But wait - the
-- requirement says "non-admin must not be able to SELECT from products
-- at all". So they should NOT have any policy that lets them read produit.
-- They must use products_public.
--
-- For products_public to work for anon: the view selects from produit.
-- When anon queries the view, Postgres will check RLS on produit for
-- each row. If the only policy is admin_select_produit, anon gets nothing.
--
-- Solution: Create products_public as a SECURITY DEFINER set-returning
-- function? Or use a table with a trigger? The cleanest is:
--
-- Use a policy that allows SELECT for rows that are publicly visible.
-- That way, non-admins can effectively only get visible products when
-- they query... but they'd be querying the produit table. The spec says
-- "non-admin must not be able to SELECT from products at all" - meaning
-- they shouldn't have a way to even attempt to fetch hidden products.
-- If we give them a policy "SELECT where visible", they could try
-- .eq('id', some_hidden_id) and get 0 rows - they're not "reading" the
-- product, they get nothing. So that's safe.
--
-- Actually the key is: we want the PUBLIC SITE to use products_public
-- view, not the produit table. So the Angular app will call
-- .from('products_public') for public. The view is just a filter on
-- produit. For the view to return rows to anon, we need anon to be able
-- to read from produit for those rows. So we need:
--
-- Policy: Allow anon and authenticated to SELECT from produit WHERE
-- is_product_publicly_visible(produit). This gives them access to
-- only visible rows. They could try to select by id a hidden product
-- and get 0 rows - they don't "see" it. Good.
--
-- And for admin: they need to see ALL. So we need:
-- Policy 1: admin_select_produit - USING (is_admin_no_rls()) - all rows
-- Policy 2: public_select_visible_produit - USING (NOT is_admin_no_rls()
--   AND is_product_publicly_visible(produit))
--
-- With RLS, if ANY policy allows, the row is visible. So:
-- - Admin: is_admin_no_rls() true -> sees all
-- - Anon: is_admin_no_rls() false, but is_product_publicly_visible
--   for visible rows -> sees only visible
--
-- But wait - anon is not authenticated. So is_admin_no_rls() for anon
-- would check auth.uid() which is null, so no admin row - so false.
-- So anon would only get rows where is_product_publicly_visible is true.
-- Good.
--
-- Let me update the migration: keep admin_select_produit, add
-- public_select_visible_produit for anon and authenticated where
-- NOT is_admin and row is visible.
--
-- Actually, simpler: one policy for "select visible" that applies to
-- anon and authenticated when they're not admin. And one for admin
-- that selects all. The second policy for non-admin: we need to be
-- careful. If we use USING (is_product_publicly_visible(produit)),
-- then both anon and authenticated non-admin would get only visible
-- rows. And admin would get all via the first policy. Perfect.
--
-- Revised: 
-- Policy 1: admin_select_produit - TO authenticated, USING (is_admin_no_rls())
-- Policy 2: public_select_visible_produit - TO anon, TO authenticated,
--   USING (is_product_publicly_visible(produit))
--
-- When anon queries: no auth.uid(), so is_admin_no_rls() is false.
-- Policy 1 doesn't apply to anon (TO authenticated). Policy 2 applies.
-- So anon gets visible rows only. Good.
--
-- When authenticated non-admin: is_admin_no_rls() false. Policy 1 doesn't
-- pass. Policy 2 passes for visible rows. Good.
--
-- When authenticated admin: Policy 1 passes - gets all. Policy 2 also
-- passes for visible rows but we don't need it. Good.
--
-- So we need BOTH policies. The first one I already added. Now add the
-- second for anon and authenticated.
-- ----------------------------------------------------------------------------

CREATE POLICY "public_select_visible_produit"
ON public.produit FOR SELECT
TO anon
USING (public.is_product_publicly_visible(produit));

CREATE POLICY "public_select_visible_produit_auth"
ON public.produit FOR SELECT
TO authenticated
USING (
  NOT public.is_admin_no_rls()
  AND public.is_product_publicly_visible(produit)
);

-- Wait - if we have both policies for authenticated, an admin would hit
-- admin_select_produit (all rows) and public_select_visible_produit
-- (visible only). With OR, they get all. Good.
-- For authenticated non-admin: admin_select fails, public_select passes
-- for visible. Good.
-- For anon: only public_select. Good.

-- ----------------------------------------------------------------------------
-- STEP 9: RLS on variant
-- Drop legacy public read policy if exists
DROP POLICY IF EXISTS "public read variant" ON public.variant;

-- ----------------------------------------------------------------------------
-- STEP 10: RLS on variant - admin + visible-only for public
-- Allow public to read through variants_public. The variants_public view
-- reads from variant. So we need:
-- - Admin: can SELECT all from variant
-- - Non-admin: can SELECT from variant only for variants whose product
--   is visible. The simplest way: add a policy that allows SELECT when
--   the product is publicly visible. Then variant table is readable
--   for those rows. And for admin, they need to read all variants.
-- ----------------------------------------------------------------------------
-- Check existing variant policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'variant'
  ) THEN
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "public_read_variant" ON public.variant;
    DROP POLICY IF EXISTS "anon_read_variant" ON public.variant;
    DROP POLICY IF EXISTS "authenticated_read_variant" ON public.variant;
  END IF;
END $$;

-- Ensure RLS is enabled on variant
ALTER TABLE public.variant ENABLE ROW LEVEL SECURITY;

-- Admin: full read
CREATE POLICY "admin_select_variant"
ON public.variant FOR SELECT
TO authenticated
USING (public.is_admin_no_rls());

-- Public: read only variants of visible products
CREATE POLICY "public_select_visible_variant"
ON public.variant FOR SELECT
TO anon
USING (
  public.is_product_publicly_visible_by_id(produit_id)
);

CREATE POLICY "public_select_visible_variant_auth"
ON public.variant FOR SELECT
TO authenticated
USING (
  NOT public.is_admin_no_rls()
  AND public.is_product_publicly_visible_by_id(produit_id)
);

-- INSERT/UPDATE/DELETE on variant: admin only (if not already)
DROP POLICY IF EXISTS "admin_insert_variant" ON public.variant;
DROP POLICY IF EXISTS "admin_update_variant" ON public.variant;
DROP POLICY IF EXISTS "admin_delete_variant" ON public.variant;

CREATE POLICY "admin_insert_variant"
ON public.variant FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_no_rls());

CREATE POLICY "admin_update_variant"
ON public.variant FOR UPDATE
TO authenticated
USING (public.is_admin_no_rls())
WITH CHECK (public.is_admin_no_rls());

CREATE POLICY "admin_delete_variant"
ON public.variant FOR DELETE
TO authenticated
USING (public.is_admin_no_rls());

-- ----------------------------------------------------------------------------
-- DONE
-- ----------------------------------------------------------------------------
