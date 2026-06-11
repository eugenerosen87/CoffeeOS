-- ═══════════════════════════════════════════
-- CoffeeOS — Migration v10: Link sales to product runs
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- ── 1. Add product_run_id to sales ──────────────────────────────
alter table sales add column if not exists product_run_id uuid references product_runs(id) on delete set null;
create index if not exists sales_product_run_id_idx on sales(product_run_id);

-- ── 2. Add order_id to group multi-item sales ────────────────────
alter table sales add column if not exists order_id uuid;
create index if not exists sales_order_id_idx on sales(order_id);
