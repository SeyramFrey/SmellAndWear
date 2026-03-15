-- Add description column to livraison_tarifs table
-- Applies to all rows (France FR and Côte d'Ivoire CI)
ALTER TABLE livraison_tarifs
  ADD COLUMN IF NOT EXISTS description TEXT NULL;
