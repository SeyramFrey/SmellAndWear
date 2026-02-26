-- Promotions Schema for Smell & Wear
-- This file contains the complete database schema for the promotions system

-- 1. PROMOTIONS TABLE
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'ended')),
    placement VARCHAR(50) NOT NULL DEFAULT 'topbar' CHECK (placement IN ('topbar', 'banner', 'popup')),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    display_duration_seconds INTEGER NOT NULL DEFAULT 10,
    weight INTEGER NOT NULL DEFAULT 0,
    is_dismissible BOOLEAN NOT NULL DEFAULT true,
    animation VARCHAR(20) NOT NULL DEFAULT 'slide' CHECK (animation IN ('slide', 'fade', 'marquee', 'none')),
    theme JSONB DEFAULT '{"bg": "#000000", "fg": "#ffffff", "accent": "#ff0000"}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_time_range CHECK (end_at > start_at),
    CONSTRAINT valid_duration CHECK (display_duration_seconds > 0)
);

-- 2. PROMOTION PRICE RULES TABLE
CREATE TABLE IF NOT EXISTS promotion_price_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promotion_id UUID NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    scope VARCHAR(20) NOT NULL CHECK (scope IN ('variant', 'product', 'category')),
    target_id UUID NOT NULL,
    discount_kind VARCHAR(20) NOT NULL CHECK (discount_kind IN ('percent', 'amount', 'override')),
    discount_value DECIMAL(10,2) NOT NULL,
    show_strikethrough BOOLEAN NOT NULL DEFAULT true,
    highlight_color VARCHAR(7) DEFAULT '#ff0000',
    stackable BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_discount_value CHECK (
        (discount_kind = 'percent' AND discount_value BETWEEN 0 AND 100) OR
        (discount_kind IN ('amount', 'override') AND discount_value >= 0)
    ),
    CONSTRAINT valid_color CHECK (highlight_color ~ '^#[0-9A-Fa-f]{6}$')
);

-- 3. INDEXES FOR PERFORMANCE
-- Promotions indexes
CREATE INDEX IF NOT EXISTS idx_promotions_status_time ON promotions(status, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_promotions_placement_weight ON promotions(placement, weight DESC);
CREATE INDEX IF NOT EXISTS idx_promotions_active_lookup ON promotions(status, start_at, end_at) 
    WHERE status IN ('scheduled', 'running');

-- Promotion rules indexes
CREATE INDEX IF NOT EXISTS idx_promotion_rules_promotion_id ON promotion_price_rules(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_rules_scope_target ON promotion_price_rules(scope, target_id);
CREATE INDEX IF NOT EXISTS idx_promotion_rules_lookup ON promotion_price_rules(promotion_id, scope, target_id);

-- 4. TRIGGERS FOR AUTOMATIC UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_promotions_updated_at 
    BEFORE UPDATE ON promotions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. ROW LEVEL SECURITY (optional, enable if needed)
-- ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE promotion_price_rules ENABLE ROW LEVEL SECURITY;

-- Example policies (uncomment if RLS is enabled)
-- CREATE POLICY "Promotions are viewable by everyone" ON promotions FOR SELECT USING (true);
-- CREATE POLICY "Promotion rules are viewable by everyone" ON promotion_price_rules FOR SELECT USING (true);
