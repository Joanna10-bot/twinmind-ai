-- ============================================================
-- Synthetic seed data for TwinMind AI
-- Run AFTER schema.sql. Gives you enough data to build and
-- test the dashboard, digital twin view, and forecasting model
-- without needing a real warehouse's data.
-- ============================================================

-- ------------------------------------------------------------
-- Users
-- Password below is a placeholder bcrypt hash for "password123"
-- Replace with real hashes once your auth flow is wired up.
-- ------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role) VALUES
('Admin User', 'admin@twinmind.ai', '$2b$10$abcdefghijklmnopqrstuv', 'admin'),
('Warehouse Manager', 'manager@twinmind.ai', '$2b$10$abcdefghijklmnopqrstuv', 'manager');

-- ------------------------------------------------------------
-- Warehouses + zones
-- ------------------------------------------------------------
INSERT INTO warehouses (name, location, total_capacity) VALUES
('Hyderabad Central Warehouse', 'Shaikpet, Hyderabad', 20000),
('Secunderabad Distribution Hub', 'Secunderabad, Hyderabad', 12000);

INSERT INTO warehouse_zones (warehouse_id, zone_name, zone_type, pos_x, pos_y, width, height, capacity) VALUES
(1, 'Receiving Dock A', 'receiving', 0,  0, 4, 2, 500),
(1, 'Storage Rack 1',   'storage',   0,  3, 6, 4, 6000),
(1, 'Storage Rack 2',   'storage',   7,  3, 6, 4, 6000),
(1, 'Picking Zone',     'picking',   0,  8, 8, 3, 1000),
(1, 'Shipping Dock B',  'shipping', 10,  8, 4, 2, 500),
(2, 'Receiving Dock',   'receiving', 0,  0, 3, 2, 300),
(2, 'Storage Rack 1',   'storage',   0,  3, 6, 4, 4000),
(2, 'Shipping Dock',    'shipping',  8,  3, 3, 2, 300);

-- ------------------------------------------------------------
-- Products
-- ------------------------------------------------------------
INSERT INTO products (sku, name, category, unit_price, reorder_level, reorder_quantity) VALUES
('ELX-1001', 'Wireless Mouse',        'Electronics', 499.00,  40, 200),
('ELX-1002', 'USB-C Charging Cable',  'Electronics', 299.00,  60, 300),
('ELX-1003', 'Bluetooth Speaker',     'Electronics', 1499.00, 25, 100),
('HOM-2001', 'Ceramic Coffee Mug',    'Home Goods',  199.00,  50, 250),
('HOM-2002', 'LED Desk Lamp',         'Home Goods',  899.00,  20, 80),
('APP-3001', 'Cotton T-Shirt (M)',    'Apparel',     349.00,  70, 300),
('APP-3002', 'Running Shoes',         'Apparel',     2199.00, 15, 60),
('GRO-4001', 'Basmati Rice 5kg',      'Grocery',     650.00,  30, 150),
('GRO-4002', 'Cooking Oil 1L',        'Grocery',     180.00,  80, 400),
('STA-5001', 'A4 Paper Ream',         'Stationery',  249.00,  40, 200);

-- ------------------------------------------------------------
-- Suppliers
-- ------------------------------------------------------------
INSERT INTO suppliers (name, contact_email, contact_phone, avg_lead_time_days, reliability_score, defect_rate) VALUES
('TechSource Distributors',   'sales@techsource.example',   '9876543210', 5,  0.950, 0.010),
('QuickSupply Logistics',     'orders@quicksupply.example', '9876500001', 3,  0.870, 0.025),
('National Wholesale Co.',    'contact@natwholesale.example','9876500002', 10, 0.900, 0.015),
('BudgetGoods Traders',       'info@budgetgoods.example',   '9876500003', 12, 0.780, 0.045),
('Premium Import Partners',   'trade@premiumimport.example','9876500004', 7,  0.930, 0.008);

-- Which suppliers offer which products, at what cost/lead time
INSERT INTO supplier_products (supplier_id, product_id, unit_cost, lead_time_days, min_order_qty) VALUES
(1, 1, 380.00, 5, 50), (2, 1, 360.00, 3, 30), (4, 1, 340.00, 12, 100),
(1, 2, 220.00, 5, 100),(2, 2, 210.00, 3, 50),
(1, 3, 1150.00,5, 20), (5, 3, 1100.00,7, 15),
(3, 4, 140.00, 10, 100),(4, 4, 125.00, 12, 150),
(1, 5, 680.00, 5, 25), (5, 5, 650.00, 7, 20),
(3, 6, 260.00, 10, 150),(4, 6, 240.00, 12, 200),
(3, 7, 1700.00,10, 30), (5, 7, 1650.00,7, 20),
(3, 8, 500.00, 10, 60), (4, 8, 470.00, 12, 80),
(3, 9, 140.00, 10, 200),(4, 9, 130.00, 12, 250),
(1,10, 190.00, 5, 100), (2,10, 180.00, 3, 80);

-- ------------------------------------------------------------
-- Current inventory snapshot
-- ------------------------------------------------------------
INSERT INTO inventory (product_id, warehouse_id, zone_id, quantity) VALUES
(1, 1, 2, 320), (2, 1, 2, 540), (3, 1, 3, 95), (4, 1, 3, 410),
(5, 1, 2, 60),  (6, 1, 3, 610), (7, 1, 2, 42), (8, 1, 3, 180),
(9, 1, 3, 720), (10,1, 2, 260),
(1, 2, 7, 120), (2, 2, 7, 200), (5, 2, 7, 35), (8, 2, 7, 90);

-- ------------------------------------------------------------
-- 180 days of synthetic sales history per product, with mild
-- weekly seasonality + noise -- gives the forecasting model
-- something realistic to train on.
-- ------------------------------------------------------------
DO $$
DECLARE
    d DATE;
    p RECORD;
    base_qty NUMERIC;
    day_factor NUMERIC;
    qty INT;
    new_so_id INT;
BEGIN
    FOR d IN SELECT generate_series(CURRENT_DATE - INTERVAL '180 days', CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day')::date LOOP
        FOR p IN SELECT product_id, unit_price FROM products LOOP
            -- weekday demand a bit higher than weekends
            day_factor := CASE WHEN EXTRACT(DOW FROM d) IN (0, 6) THEN 0.7 ELSE 1.1 END;
            base_qty := (5 + (p.product_id % 5) * 3) * day_factor;
            qty := GREATEST(0, ROUND(base_qty + (random() * 6 - 3))::int);

            IF qty > 0 THEN
                INSERT INTO sales_orders (warehouse_id, order_date, status)
                VALUES (1, d + (random() * INTERVAL '20 hours'), 'fulfilled')
                RETURNING so_id INTO new_so_id;

                INSERT INTO sales_order_items (so_id, product_id, quantity, unit_price)
                VALUES (new_so_id, p.product_id, qty, p.unit_price);

                INSERT INTO inventory_transactions (product_id, warehouse_id, transaction_type, quantity_change, reference_type, reference_id, created_at)
                VALUES (p.product_id, 1, 'outbound', -qty, 'sales_order', new_so_id, d);
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- A couple of sample purchase orders (inbound restocks)
-- ------------------------------------------------------------
INSERT INTO purchase_orders (supplier_id, warehouse_id, status, order_date, expected_delivery_date, actual_delivery_date) VALUES
(1, 1, 'delivered', now() - INTERVAL '20 days', CURRENT_DATE - 15, CURRENT_DATE - 14),
(2, 1, 'shipped',   now() - INTERVAL '3 days',  CURRENT_DATE + 2,  NULL);

INSERT INTO purchase_order_items (po_id, product_id, quantity, unit_cost) VALUES
(1, 1, 200, 380.00),
(1, 2, 300, 220.00),
(2, 5, 80,  680.00);
