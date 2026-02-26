-- Sample Data for Promotion System
-- This file contains sample promotions and price rules for testing

-- Insert sample promotions
INSERT INTO promotions (
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
    theme
) VALUES 
(
    '🔥 SOLDES D''ÉTÉ', 
    'Jusqu''à -50% sur toute la collection streetwear !', 
    '/soldes', 
    'running', 
    'topbar', 
    NOW() - INTERVAL '1 day', 
    NOW() + INTERVAL '7 days', 
    10, 
    100, 
    true, 
    'slide',
    '{"bg": "#ff4444", "fg": "#ffffff", "accent": "#ffff00"}'
),
(
    '⚡ LIVRAISON GRATUITE', 
    'Livraison gratuite dès 50€ d''achat - Code: FREESHIP', 
    '/livraison', 
    'running', 
    'topbar', 
    NOW() - INTERVAL '2 hours', 
    NOW() + INTERVAL '30 days', 
    12, 
    90, 
    true, 
    'fade',
    '{"bg": "#00aa44", "fg": "#ffffff", "accent": "#00ffaa"}'
),
(
    '🎁 NOUVEAUTÉS', 
    'Découvrez notre nouvelle collection automne/hiver', 
    '/nouveautes', 
    'scheduled', 
    'topbar', 
    NOW() + INTERVAL '2 days', 
    NOW() + INTERVAL '14 days', 
    8, 
    80, 
    true, 
    'marquee',
    '{"bg": "#6600cc", "fg": "#ffffff", "accent": "#cc00ff"}'
),
(
    '💎 BLACK FRIDAY', 
    'Préparez-vous pour le Black Friday - Jusqu''à -70%', 
    '/black-friday', 
    'draft', 
    'topbar', 
    NOW() + INTERVAL '30 days', 
    NOW() + INTERVAL '35 days', 
    15, 
    200, 
    false, 
    'slide',
    '{"bg": "#000000", "fg": "#ffffff", "accent": "#ff0000"}'
),
(
    '🏆 MEMBRES VIP', 
    'Accès anticipé aux soldes pour nos membres VIP', 
    '/vip', 
    'paused', 
    'topbar', 
    NOW() - INTERVAL '5 days', 
    NOW() + INTERVAL '2 days', 
    10, 
    70, 
    true, 
    'fade',
    '{"bg": "#ffd700", "fg": "#000000", "accent": "#ff8800"}'
);

-- Get promotion IDs for price rules (this would typically be done programmatically)
-- For this example, we'll assume we know the IDs after insertion

-- Sample price rules (you'll need to replace the promotion_id and target_id with actual UUIDs)
-- 
-- INSERT INTO promotion_price_rules (
--     promotion_id, 
--     scope, 
--     target_id, 
--     discount_kind, 
--     discount_value, 
--     show_strikethrough, 
--     highlight_color
-- ) VALUES 
-- -- 30% off on a specific category for summer sales
-- (
--     '{summer-sales-promotion-id}', 
--     'category', 
--     '{t-shirts-category-id}', 
--     'percent', 
--     30.00, 
--     true, 
--     '#ff4444'
-- ),
-- -- Free shipping rule (amount discount)
-- (
--     '{free-shipping-promotion-id}', 
--     'product', 
--     '{specific-product-id}', 
--     'amount', 
--     5.00, 
--     true, 
--     '#00aa44'
-- ),
-- -- Black Friday mega discount
-- (
--     '{black-friday-promotion-id}', 
--     'category', 
--     '{all-streetwear-category-id}', 
--     'percent', 
--     70.00, 
--     true, 
--     '#ff0000'
-- );

-- Query to check inserted promotions
SELECT 
    id,
    title,
    message,
    status,
    placement,
    start_at,
    end_at,
    weight,
    theme->>'bg' as background_color,
    theme->>'fg' as text_color,
    CASE 
        WHEN NOW() BETWEEN start_at AND end_at AND status IN ('scheduled', 'running') 
        THEN 'ACTIVE'
        WHEN NOW() < start_at 
        THEN 'UPCOMING'
        WHEN NOW() > end_at 
        THEN 'EXPIRED'
        ELSE 'INACTIVE'
    END as current_status
FROM promotions
ORDER BY weight DESC, created_at DESC;

-- Query to test the active promotions view
SELECT * FROM v_promotions_active;

-- Query to test topbar promotions
SELECT * FROM v_topbar_promotions;
