# TwinMind AI — database setup

## What's here
- `schema.sql` — full table definitions (products, inventory, suppliers,
  purchase/sales orders, transactions, forecasts, supplier rankings,
  simulation scenarios, chat history)
- `seed.sql` — realistic sample data: 2 warehouses, 8 zones, 10 products,
  5 suppliers, current stock levels, and **180 days of synthetic daily
  sales history** with weekday/weekend seasonality — enough to train
  and test a demand forecasting model right away
- `../docker-compose.yml` — spins up Postgres 16 and auto-loads both
  scripts on first start

Both scripts have been run and verified — they execute cleanly with no
errors on a fresh Postgres 16 instance.

## Option A — Docker (recommended, easiest for a 3-person team)

You each get an identical database with one command, no local Postgres
install needed.

1. Install Docker Desktop if you don't have it.
2. From the `twinmind-ai/` folder:
   ```
   docker compose up -d
   ```
3. That's it — Postgres is now running on `localhost:5432` with the
   schema and seed data already loaded.
   - Database: `twinmind`
   - User: `twinmind`
   - Password: `twinmind_dev_pw`
4. To reset and reload fresh data later:
   ```
   docker compose down -v
   docker compose up -d
   ```
   (`-v` wipes the volume so the init scripts run again — schema.sql
   already has `DROP TABLE IF EXISTS` at the top so re-running is safe.)

## Option B — Local PostgreSQL install

If you'd rather install Postgres directly (e.g. via `apt`, `brew`, or
the Windows installer):

1. Create the database and user:
   ```sql
   CREATE USER twinmind WITH PASSWORD 'twinmind_dev_pw' SUPERUSER;
   CREATE DATABASE twinmind OWNER twinmind;
   ```
2. Load the schema, then the seed data:
   ```
   psql -U twinmind -d twinmind -f schema.sql
   psql -U twinmind -d twinmind -f seed.sql
   ```

## Connecting from your code

**Node.js** (`pg` package):
```js
import { Pool } from 'pg';
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'twinmind',
  user: 'twinmind',
  password: 'twinmind_dev_pw',
});
```

**Python** (`psycopg2` or SQLAlchemy — for your forecasting/ML services):
```python
DATABASE_URL = "postgresql://twinmind:twinmind_dev_pw@localhost:5432/twinmind"
```

Put this connection string in a `.env` file in each service (don't hardcode
it), and add `.env` to `.gitignore` before your first commit.

## A quick tour of the data once it's loaded

```sql
-- current stock levels across the warehouse
SELECT p.name, w.name AS warehouse, i.quantity
FROM inventory i
JOIN products p ON p.product_id = i.product_id
JOIN warehouses w ON w.warehouse_id = i.warehouse_id;

-- which products are below their reorder point right now
SELECT p.name, i.quantity, p.reorder_level
FROM inventory i JOIN products p ON p.product_id = i.product_id
WHERE i.quantity < p.reorder_level;

-- daily demand history for product_id 1 (feed this into your
-- forecasting model)
SELECT so.order_date::date AS d, SUM(soi.quantity) AS units_sold
FROM sales_orders so
JOIN sales_order_items soi ON soi.so_id = so.so_id
WHERE soi.product_id = 1
GROUP BY 1 ORDER BY 1;
```

## Next step
Once this is running, the natural next build target is a thin Node.js
Express API with a few read endpoints (`GET /inventory`, `GET /products`,
`GET /warehouses/:id/zones`) so the frontend has something real to call
instead of mock data.
