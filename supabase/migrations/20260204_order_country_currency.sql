-- =============================================================================
-- Migration: Order country/currency consistency
--
-- Ensures every order stores its country, currency, and exchange rate
-- at creation time for deterministic invoicing and admin display.
-- =============================================================================

-- 1) Add country_code (nullable initially — backfill sets values, then we tighten)
ALTER TABLE commande ADD COLUMN IF NOT EXISTS country_code TEXT;

-- 2) Ensure currency exists (may already exist from earlier work)
DO $$ BEGIN
  ALTER TABLE commande ADD COLUMN currency TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3) Add exchange_rate_eur_to_xof for auditability
ALTER TABLE commande ADD COLUMN IF NOT EXISTS exchange_rate_eur_to_xof NUMERIC;

-- 4) Add CHECK constraints (allow NULL for legacy rows, enforced in app layer)
DO $$ BEGIN
  ALTER TABLE commande ADD CONSTRAINT chk_commande_country_code
    CHECK (country_code IS NULL OR country_code IN ('FR', 'CI'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE commande ADD CONSTRAINT chk_commande_currency
    CHECK (currency IS NULL OR currency IN ('EUR', 'USD', 'XOF'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5) Indexes for filtering / reporting
CREATE INDEX IF NOT EXISTS idx_commande_country_code ON commande(country_code);
CREATE INDEX IF NOT EXISTS idx_commande_currency ON commande(currency);
CREATE INDEX IF NOT EXISTS idx_commande_created_at ON commande(created_at);

-- =============================================================================
-- BACKFILL: Infer country_code + currency for existing orders
-- =============================================================================

-- A) From locale column (set by paystack-initialize)
UPDATE commande
SET country_code = UPPER(locale),
    currency     = CASE UPPER(locale) WHEN 'FR' THEN 'EUR' ELSE 'XOF' END
WHERE country_code IS NULL
  AND locale IS NOT NULL
  AND UPPER(locale) IN ('FR', 'CI');

-- B) From payment_data.metadata.locale (set by paystack-init, stored after verify)
UPDATE commande
SET country_code = UPPER(payment_data->'metadata'->>'locale'),
    currency     = CASE UPPER(payment_data->'metadata'->>'locale')
                     WHEN 'FR' THEN 'EUR' ELSE 'XOF' END
WHERE country_code IS NULL
  AND payment_data IS NOT NULL
  AND payment_data->'metadata'->>'locale' IS NOT NULL
  AND UPPER(payment_data->'metadata'->>'locale') IN ('FR', 'CI');

-- C) From payment_data top-level locale/country (before verify overwrites)
UPDATE commande
SET country_code = UPPER(COALESCE(payment_data->>'locale', payment_data->>'country')),
    currency     = CASE UPPER(COALESCE(payment_data->>'locale', payment_data->>'country'))
                     WHEN 'FR' THEN 'EUR' ELSE 'XOF' END
WHERE country_code IS NULL
  AND payment_data IS NOT NULL
  AND UPPER(COALESCE(payment_data->>'locale', payment_data->>'country')) IN ('FR', 'CI');

-- D) From payment_data.currency (Paystack transaction stores currency)
UPDATE commande
SET currency = UPPER(payment_data->>'currency')
WHERE currency IS NULL
  AND payment_data IS NOT NULL
  AND UPPER(payment_data->>'currency') IN ('EUR', 'USD', 'XOF');

-- E) Backfill exchange_rate from payment_data.metadata.fx_rate
UPDATE commande
SET exchange_rate_eur_to_xof = (payment_data->'metadata'->>'fx_rate')::NUMERIC
WHERE exchange_rate_eur_to_xof IS NULL
  AND payment_data IS NOT NULL
  AND payment_data->'metadata'->>'fx_rate' IS NOT NULL;

-- F) Default remaining NULL country_code to 'CI' (Côte d'Ivoire — primary market)
--    Only for orders that have a total suggesting XOF (>= 100, typical XOF range)
UPDATE commande
SET country_code = 'CI',
    currency     = COALESCE(currency, 'XOF')
WHERE country_code IS NULL
  AND total >= 100;

-- G) Default remaining NULL country_code to 'FR' for small totals (likely EUR)
UPDATE commande
SET country_code = 'FR',
    currency     = COALESCE(currency, 'EUR')
WHERE country_code IS NULL
  AND total < 100;

-- H) Catch-all: any remaining NULLs default to CI/XOF
UPDATE commande
SET country_code = COALESCE(country_code, 'CI'),
    currency     = COALESCE(currency, 'XOF');

-- I) Sync locale from country_code where locale was NULL
UPDATE commande
SET locale = country_code
WHERE locale IS NULL
  AND country_code IS NOT NULL;
