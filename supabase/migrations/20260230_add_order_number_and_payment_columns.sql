-- Sequence for order number digits
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

-- New columns on commande
ALTER TABLE commande ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS locale TEXT;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS shipping_zone_code TEXT;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC DEFAULT 0;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS express_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS express_cost NUMERIC DEFAULT 0;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS server_computed_total NUMERIC;
ALTER TABLE commande ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'XOF';

CREATE UNIQUE INDEX IF NOT EXISTS idx_commande_order_number ON commande (order_number) WHERE order_number IS NOT NULL;

-- Function: generate_order_number(locale)
-- Returns S&M-FR-00000001 or S&M-CI-00000001
CREATE OR REPLACE FUNCTION generate_order_number(p_locale TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  prefix TEXT;
  seq_val BIGINT;
BEGIN
  IF upper(p_locale) = 'FR' THEN
    prefix := 'S&M-FR-';
  ELSE
    prefix := 'S&M-CI-';
  END IF;
  seq_val := nextval('order_number_seq');
  RETURN prefix || lpad(seq_val::text, 8, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION generate_order_number(TEXT) TO service_role;
