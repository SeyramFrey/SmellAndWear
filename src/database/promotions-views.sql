-- Promotions Views for Smell & Wear
-- This file contains the database views for efficient promotion and pricing queries

-- 1. VIEW: Active Promotions with Countdown
CREATE OR REPLACE VIEW v_promotions_active AS
SELECT 
    id,
    title,
    message,
    url,
    status,
    placement,
    start_at,
    end_at,
    display_duration_seconds,
    weight,
    is_dismissible,
    animation,
    theme,
    created_at,
    updated_at,
    -- Computed remaining seconds for countdown
    GREATEST(0, EXTRACT(EPOCH FROM (end_at - NOW()))::INTEGER) AS remaining_seconds,
    -- Check if promotion is currently active
    (NOW() BETWEEN start_at AND end_at AND status IN ('scheduled', 'running')) AS is_currently_active
FROM promotions
WHERE 
    NOW() BETWEEN start_at AND end_at 
    AND status IN ('scheduled', 'running')
ORDER BY 
    placement,
    weight DESC,
    start_at ASC;

-- 2. VIEW: Active Promotion Rules
CREATE OR REPLACE VIEW v_active_promotion_rules AS
SELECT 
    pr.id,
    pr.promotion_id,
    pr.scope,
    pr.target_id,
    pr.discount_kind,
    pr.discount_value,
    pr.show_strikethrough,
    pr.highlight_color,
    pr.stackable,
    pr.created_at,
    p.weight AS promotion_weight,
    p.title AS promotion_title,
    p.start_at,
    p.end_at
FROM promotion_price_rules pr
INNER JOIN promotions p ON pr.promotion_id = p.id
WHERE 
    NOW() BETWEEN p.start_at AND p.end_at 
    AND p.status IN ('scheduled', 'running')
ORDER BY 
    p.weight DESC,
    p.start_at ASC;

-- 3. VIEW: Variant Effective Pricing (Main Price Logic)
CREATE OR REPLACE VIEW v_variant_effective_price AS
WITH variant_rules AS (
    -- Get the highest priority rule for each variant
    SELECT DISTINCT ON (pv.id)
        pv.id AS variant_id,
        p.prix AS original_price, -- Price comes from product, not variant
        COALESCE(
            -- Priority 1: Direct variant rule
            v_rule.discount_value,
            -- Priority 2: Product-level rule
            p_rule.discount_value,
            -- Priority 3: Category-level rule
            c_rule.discount_value
        ) AS discount_value,
        COALESCE(
            v_rule.discount_kind,
            p_rule.discount_kind,
            c_rule.discount_kind
        ) AS discount_kind,
        COALESCE(
            v_rule.show_strikethrough,
            p_rule.show_strikethrough,
            c_rule.show_strikethrough,
            false
        ) AS show_strikethrough,
        COALESCE(
            v_rule.highlight_color,
            p_rule.highlight_color,
            c_rule.highlight_color,
            '#ff0000'
        ) AS highlight_color,
        COALESCE(
            v_rule.promotion_weight,
            p_rule.promotion_weight,
            c_rule.promotion_weight,
            0
        ) AS promotion_weight,
        COALESCE(
            v_rule.promotion_title,
            p_rule.promotion_title,
            c_rule.promotion_title
        ) AS promotion_title
    FROM variant pv
    INNER JOIN produit p ON pv.produit_id = p.id
    INNER JOIN categorie c ON p.sous_categorie_id = c.id
    LEFT JOIN v_active_promotion_rules v_rule ON (
        v_rule.scope = 'variant' AND v_rule.target_id = pv.id
    )
    LEFT JOIN v_active_promotion_rules p_rule ON (
        v_rule.id IS NULL AND 
        p_rule.scope = 'product' AND p_rule.target_id = p.id
    )
    LEFT JOIN v_active_promotion_rules c_rule ON (
        v_rule.id IS NULL AND p_rule.id IS NULL AND
        c_rule.scope = 'category' AND c_rule.target_id = c.id
    )
    ORDER BY 
        pv.id,
        -- Priority order: variant > product > category
        CASE 
            WHEN v_rule.id IS NOT NULL THEN 1
            WHEN p_rule.id IS NOT NULL THEN 2
            WHEN c_rule.id IS NOT NULL THEN 3
            ELSE 4
        END,
        -- Tie-breaker by promotion weight
        COALESCE(v_rule.promotion_weight, p_rule.promotion_weight, c_rule.promotion_weight, 0) DESC
)
SELECT 
    variant_id,
    original_price,
    CASE 
        WHEN discount_value IS NULL THEN original_price
        WHEN discount_kind = 'percent' THEN ROUND(original_price * (1 - discount_value / 100.0), 2)
        WHEN discount_kind = 'amount' THEN GREATEST(0, original_price - discount_value)
        WHEN discount_kind = 'override' THEN discount_value
        ELSE original_price
    END AS effective_price,
    (discount_value IS NOT NULL) AS has_discount,
    show_strikethrough,
    highlight_color,
    promotion_weight,
    promotion_title,
    -- Calculate discount percentage for display
    CASE 
        WHEN discount_value IS NULL THEN 0
        WHEN discount_kind = 'percent' THEN discount_value
        WHEN discount_kind = 'amount' THEN ROUND((discount_value / original_price) * 100, 0)
        WHEN discount_kind = 'override' THEN ROUND(((original_price - discount_value) / original_price) * 100, 0)
        ELSE 0
    END AS discount_percentage
FROM variant_rules;

-- 4. VIEW: Topbar Promotions (Filtered for placement)
CREATE OR REPLACE VIEW v_topbar_promotions AS
SELECT *
FROM v_promotions_active
WHERE placement = 'topbar'
ORDER BY weight DESC, start_at ASC;

-- 5. FUNCTION: Get Product Effective Price (for products without variants)
CREATE OR REPLACE FUNCTION get_product_effective_price(product_id UUID)
RETURNS TABLE(
    original_price DECIMAL(10,2),
    effective_price DECIMAL(10,2),
    has_discount BOOLEAN,
    show_strikethrough BOOLEAN,
    highlight_color VARCHAR(7),
    promotion_title VARCHAR(255),
    discount_percentage INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH product_rules AS (
        SELECT 
            p.prix AS original_price,
            COALESCE(
                p_rule.discount_value,
                c_rule.discount_value
            ) AS discount_value,
            COALESCE(
                p_rule.discount_kind,
                c_rule.discount_kind
            ) AS discount_kind,
            COALESCE(
                p_rule.show_strikethrough,
                c_rule.show_strikethrough,
                false
            ) AS show_strikethrough,
            COALESCE(
                p_rule.highlight_color,
                c_rule.highlight_color,
                '#ff0000'
            ) AS highlight_color,
            COALESCE(
                p_rule.promotion_title,
                c_rule.promotion_title
            ) AS promotion_title
        FROM produit p
        INNER JOIN categorie c ON p.sous_categorie_id = c.id
        LEFT JOIN v_active_promotion_rules p_rule ON (
            p_rule.scope = 'product' AND p_rule.target_id = p.id
        )
        LEFT JOIN v_active_promotion_rules c_rule ON (
            p_rule.id IS NULL AND
            c_rule.scope = 'category' AND c_rule.target_id = c.id
        )
        WHERE p.id = product_id
        ORDER BY 
            CASE 
                WHEN p_rule.id IS NOT NULL THEN 1
                WHEN c_rule.id IS NOT NULL THEN 2
                ELSE 3
            END,
            COALESCE(p_rule.promotion_weight, c_rule.promotion_weight, 0) DESC
        LIMIT 1
    )
    SELECT 
        pr.original_price,
        CASE 
            WHEN pr.discount_value IS NULL THEN pr.original_price
            WHEN pr.discount_kind = 'percent' THEN ROUND(pr.original_price * (1 - pr.discount_value / 100.0), 2)
            WHEN pr.discount_kind = 'amount' THEN GREATEST(0, pr.original_price - pr.discount_value)
            WHEN pr.discount_kind = 'override' THEN pr.discount_value
            ELSE pr.original_price
        END AS effective_price,
        (pr.discount_value IS NOT NULL) AS has_discount,
        pr.show_strikethrough,
        pr.highlight_color,
        pr.promotion_title,
        CASE 
            WHEN pr.discount_value IS NULL THEN 0
            WHEN pr.discount_kind = 'percent' THEN pr.discount_value::INTEGER
            WHEN pr.discount_kind = 'amount' THEN ROUND((pr.discount_value / pr.original_price) * 100, 0)::INTEGER
            WHEN pr.discount_kind = 'override' THEN ROUND(((pr.original_price - pr.discount_value) / pr.original_price) * 100, 0)::INTEGER
            ELSE 0
        END AS discount_percentage
    FROM product_rules pr;
END;
$$ LANGUAGE plpgsql STABLE;
