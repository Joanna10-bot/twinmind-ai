-- ============================================================
-- TwinMind AI: AI-Driven Warehouse Digital Twin
-- PostgreSQL schema
-- ============================================================

-- Clean slate (safe to re-run during development)
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS simulation_scenarios CASCADE;
DROP TABLE IF EXISTS supplier_rankings CASCADE;
DROP TABLE IF EXISTS demand_forecasts CASCADE;
DROP TABLE IF EXISTS inventory_transactions CASCADE;
DROP TABLE IF EXISTS sales_order_items CASCADE;
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS supplier_products CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS warehouse_zones CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ------------------------------------------------------------
-- Users (dashboard / assistant access)
-- ------------------------------------------------------------
CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(160) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'manager'
                  CHECK (role IN ('admin', 'manager', 'viewer')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Warehouses + zones (the "digital twin" floor plan)
-- ------------------------------------------------------------
CREATE TABLE warehouses (
    warehouse_id    SERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    location        VARCHAR(200),
    total_capacity  INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE warehouse_zones (
    zone_id       SERIAL PRIMARY KEY,
    warehouse_id  INT NOT NULL REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
    zone_name     VARCHAR(120) NOT NULL,
    zone_type     VARCHAR(20) NOT NULL DEFAULT 'storage'
                  CHECK (zone_type IN ('storage', 'picking', 'receiving', 'shipping')),
    pos_x         NUMERIC(6,2) NOT NULL DEFAULT 0,   -- layout coordinates for the digital twin view
    pos_y         NUMERIC(6,2) NOT NULL DEFAULT 0,
    width         NUMERIC(6,2) NOT NULL DEFAULT 1,
    height        NUMERIC(6,2) NOT NULL DEFAULT 1,
    capacity      INT NOT NULL DEFAULT 0
);

-- ------------------------------------------------------------
-- Products
-- ------------------------------------------------------------
CREATE TABLE products (
    product_id       SERIAL PRIMARY KEY,
    sku              VARCHAR(64) UNIQUE NOT NULL,
    name             VARCHAR(160) NOT NULL,
    category         VARCHAR(80),
    unit_price       NUMERIC(10,2) NOT NULL DEFAULT 0,
    reorder_level    INT NOT NULL DEFAULT 10,   -- trigger point for reordering
    reorder_quantity INT NOT NULL DEFAULT 50,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Inventory (current stock, per product per warehouse/zone)
-- ------------------------------------------------------------
CREATE TABLE inventory (
    inventory_id  SERIAL PRIMARY KEY,
    product_id    INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    warehouse_id  INT NOT NULL REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
    zone_id       INT REFERENCES warehouse_zones(zone_id) ON DELETE SET NULL,
    quantity      INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    last_updated  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, warehouse_id, zone_id)
);

-- ------------------------------------------------------------
-- Suppliers + what each supplier offers
-- ------------------------------------------------------------
CREATE TABLE suppliers (
    supplier_id        SERIAL PRIMARY KEY,
    name                VARCHAR(160) NOT NULL,
    contact_email       VARCHAR(160),
    contact_phone       VARCHAR(40),
    avg_lead_time_days  INT NOT NULL DEFAULT 7,
    reliability_score   NUMERIC(4,3) NOT NULL DEFAULT 0.800 CHECK (reliability_score BETWEEN 0 AND 1),
    defect_rate         NUMERIC(4,3) NOT NULL DEFAULT 0.020 CHECK (defect_rate BETWEEN 0 AND 1),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE supplier_products (
    id             SERIAL PRIMARY KEY,
    supplier_id    INT NOT NULL REFERENCES suppliers(supplier_id) ON DELETE CASCADE,
    product_id     INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    unit_cost      NUMERIC(10,2) NOT NULL,
    lead_time_days INT NOT NULL DEFAULT 7,
    min_order_qty  INT NOT NULL DEFAULT 1,
    UNIQUE (supplier_id, product_id)
);

-- ------------------------------------------------------------
-- Purchase orders (inbound: warehouse buys from supplier)
-- ------------------------------------------------------------
CREATE TABLE purchase_orders (
    po_id                  SERIAL PRIMARY KEY,
    supplier_id            INT NOT NULL REFERENCES suppliers(supplier_id),
    warehouse_id           INT NOT NULL REFERENCES warehouses(warehouse_id),
    status                 VARCHAR(20) NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled')),
    order_date             TIMESTAMPTZ NOT NULL DEFAULT now(),
    expected_delivery_date DATE,
    actual_delivery_date   DATE
);

CREATE TABLE purchase_order_items (
    id          SERIAL PRIMARY KEY,
    po_id       INT NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    product_id  INT NOT NULL REFERENCES products(product_id),
    quantity    INT NOT NULL CHECK (quantity > 0),
    unit_cost   NUMERIC(10,2) NOT NULL
);

-- ------------------------------------------------------------
-- Sales orders (outbound: this is your demand history)
-- ------------------------------------------------------------
CREATE TABLE sales_orders (
    so_id         SERIAL PRIMARY KEY,
    warehouse_id  INT NOT NULL REFERENCES warehouses(warehouse_id),
    order_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
    status        VARCHAR(20) NOT NULL DEFAULT 'fulfilled'
                  CHECK (status IN ('pending', 'fulfilled', 'cancelled'))
);

CREATE TABLE sales_order_items (
    id          SERIAL PRIMARY KEY,
    so_id       INT NOT NULL REFERENCES sales_orders(so_id) ON DELETE CASCADE,
    product_id  INT NOT NULL REFERENCES products(product_id),
    quantity    INT NOT NULL CHECK (quantity > 0),
    unit_price  NUMERIC(10,2) NOT NULL
);

-- ------------------------------------------------------------
-- Inventory transactions (audit log; drives real-time digital twin updates)
-- ------------------------------------------------------------
CREATE TABLE inventory_transactions (
    transaction_id    SERIAL PRIMARY KEY,
    product_id        INT NOT NULL REFERENCES products(product_id),
    warehouse_id      INT NOT NULL REFERENCES warehouses(warehouse_id),
    zone_id           INT REFERENCES warehouse_zones(zone_id),
    transaction_type  VARCHAR(20) NOT NULL
                      CHECK (transaction_type IN ('inbound', 'outbound', 'adjustment', 'transfer')),
    quantity_change   INT NOT NULL,          -- positive for inbound, negative for outbound
    reference_type    VARCHAR(20)             -- 'purchase_order' | 'sales_order' | 'manual'
                      CHECK (reference_type IN ('purchase_order', 'sales_order', 'manual')),
    reference_id      INT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- AI outputs: demand forecasts, supplier rankings, what-if scenarios
-- ------------------------------------------------------------
CREATE TABLE demand_forecasts (
    forecast_id        SERIAL PRIMARY KEY,
    product_id          INT NOT NULL REFERENCES products(product_id),
    warehouse_id        INT NOT NULL REFERENCES warehouses(warehouse_id),
    forecast_date        DATE NOT NULL,
    predicted_demand     NUMERIC(10,2) NOT NULL,
    confidence_lower     NUMERIC(10,2),
    confidence_upper     NUMERIC(10,2),
    model_version         VARCHAR(40),
    generated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE supplier_rankings (
    ranking_id          SERIAL PRIMARY KEY,
    product_id           INT NOT NULL REFERENCES products(product_id),
    supplier_id          INT NOT NULL REFERENCES suppliers(supplier_id),
    score                 NUMERIC(6,4) NOT NULL,   -- MARCOS compromise score
    rank                  INT NOT NULL,
    criteria_breakdown    JSONB,                    -- per-criterion weighted scores, for explainability
    generated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE simulation_scenarios (
    scenario_id    SERIAL PRIMARY KEY,
    name           VARCHAR(160) NOT NULL,
    created_by     INT REFERENCES users(user_id),
    parameters     JSONB NOT NULL,   -- e.g. {"demand_multiplier": 1.3, "lead_time_delta": 5}
    results        JSONB,            -- computed outcome, filled in after the simulation runs
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Conversational assistant history
-- ------------------------------------------------------------
CREATE TABLE chat_messages (
    message_id  SERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(user_id),
    session_id  UUID NOT NULL,
    role        VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Indexes for the queries you'll run most (dashboard lookups,
-- forecasting time-series pulls, low-stock alerts)
-- ------------------------------------------------------------
CREATE INDEX idx_inventory_product      ON inventory(product_id);
CREATE INDEX idx_inventory_warehouse    ON inventory(warehouse_id);
CREATE INDEX idx_txn_product_date       ON inventory_transactions(product_id, created_at);
CREATE INDEX idx_so_items_product       ON sales_order_items(product_id);
CREATE INDEX idx_so_date                ON sales_orders(order_date);
CREATE INDEX idx_forecast_product_date  ON demand_forecasts(product_id, forecast_date);
CREATE INDEX idx_supplier_products_prod ON supplier_products(product_id);
CREATE INDEX idx_chat_session           ON chat_messages(session_id);
