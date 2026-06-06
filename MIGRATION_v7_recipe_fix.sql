-- ═══════════════════════════════════════════════════════════════
-- CoffeeOS v7 — Three correctness fixes
-- 1. product_recipe links coffee profiles not batches
-- 2. Ledger writes only on Roasting state (not on create)
-- 3. Cost per usable kg (handled in app, no schema change needed)
-- Run AFTER v6 migration
-- ═══════════════════════════════════════════════════════════════

-- ── FIX: product_recipe — link to green_coffees not roasts ───────
-- Drop the old column and add the correct one
alter table product_recipe drop column if exists batch_id;
alter table product_recipe add column if not exists coffee_id text references green_coffees(coffee_id) on delete restrict;

-- Drop old unique constraint if it existed on batch_id
alter table product_recipe drop constraint if exists product_recipe_product_id_batch_id_key;

-- Add correct unique constraint
alter table product_recipe drop constraint if exists product_recipe_product_id_coffee_id_key;
alter table product_recipe add constraint product_recipe_product_id_coffee_id_key unique (product_id, coffee_id);

-- ── product_runs — add columns to track batch selections ─────────
alter table product_runs add column if not exists status text default 'completed'
  check (status in ('draft','in_progress','completed','cancelled'));
alter table product_runs add column if not exists total_kg numeric default 0;

-- ── batch_allocations — ensure it references product_runs ────────
-- (already correct in v6, just ensure it exists)
create table if not exists batch_allocations (
  id             uuid primary key default gen_random_uuid(),
  product_run_id uuid references product_runs(id) on delete cascade,
  batch_id       text references roasts(id) on delete restrict,
  coffee_id      text references green_coffees(coffee_id) on delete restrict,
  allocated_kg   numeric not null,
  percentage     numeric,
  created_at     timestamptz default now()
);

alter table batch_allocations enable row level security;
drop policy if exists "open" on batch_allocations;
create policy "open" on batch_allocations for all to anon, authenticated using (true) with check (true);
grant all on batch_allocations to anon, authenticated;

-- ── FIX: Ledger — add trigger to prevent writes on planned/scheduled
-- We handle this in app code, but also add a DB note column
alter table roasts add column if not exists ledger_written boolean default false;

-- Mark existing batches that already have ledger entries as written
update roasts r
set ledger_written = true
where exists (
  select 1 from inventory_movements m
  where m.reference_id = r.id and m.reference_type = 'roast'
);
