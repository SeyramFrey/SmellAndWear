-- Invoice tracking columns on commande
ALTER TABLE commande ADD COLUMN IF NOT EXISTS invoice_pdf_path TEXT;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS invoice_last_sent_at TIMESTAMPTZ;

-- Audit log for order events (emails, invoice actions, etc.)
CREATE TABLE IF NOT EXISTS order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES commande(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  triggered_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order_id ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_type ON order_events(event_type);

ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_order_events" ON order_events;
CREATE POLICY "admin_all_order_events" ON order_events FOR ALL
  TO authenticated USING (public.is_admin_no_rls())
  WITH CHECK (public.is_admin_no_rls());

-- Private storage bucket for generated invoices
INSERT INTO storage.buckets (id, name, public)
  VALUES ('invoices', 'invoices', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: admin-only access
DROP POLICY IF EXISTS "invoices admin read" ON storage.objects;
DROP POLICY IF EXISTS "invoices service insert" ON storage.objects;
DROP POLICY IF EXISTS "invoices service update" ON storage.objects;
DROP POLICY IF EXISTS "invoices service delete" ON storage.objects;
CREATE POLICY "invoices admin read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'invoices' AND public.is_admin_no_rls());
CREATE POLICY "invoices service insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'invoices' AND public.is_admin_no_rls());
CREATE POLICY "invoices service update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'invoices' AND public.is_admin_no_rls()) WITH CHECK (bucket_id = 'invoices' AND public.is_admin_no_rls());
CREATE POLICY "invoices service delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'invoices' AND public.is_admin_no_rls());
