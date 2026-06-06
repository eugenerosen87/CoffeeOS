-- ═══════════════════════════════════════════════════════════════
-- CoffeeOS v6 — Fixes 1, 3, 4
-- Run AFTER v5 migration
-- ═══════════════════════════════════════════════════════════════

-- ── FIX 1: Snapshot cost fields onto roast batches ───────────────
-- These get written at save time, never recalculated from Settings
alter table roasts add column if not exists snapped_gas_rate    numeric;
alter table roasts add column if not exists snapped_elec_rate   numeric;
alter table roasts add column if not exists snapped_labour_rate numeric;
alter table roasts add column if not exists snapped_green_cost  numeric;

-- Backfill existing batches with current settings values
-- (best we can do for historical rows)
update roasts r
set
  snapped_green_cost  = r.input_kg * 0,  -- unknown for old rows, will show 0
  snapped_gas_rate    = (select gas_rate    from settings where id = 1),
  snapped_elec_rate   = (select elec_rate   from settings where id = 1),
  snapped_labour_rate = (select labour_rate from settings where id = 1)
where snapped_gas_rate is null;

-- ── FIX 3: Roasted stock tracking ────────────────────────────────
-- available_kg = output_kg - waste_kg - allocated to product runs
alter table roasts add column if not exists available_kg numeric;

-- Initialise available_kg = output_kg for all existing batches
update roasts set available_kg = output_kg where available_kg is null;

-- batch_allocations: tracks exactly which roast batch kg went into which product run
create table if not exists batch_allocations (
  id          uuid primary key default gen_random_uuid(),
  product_run_id uuid references product_runs(id) on delete cascade,
  batch_id    text references roasts(id) on delete restrict,
  allocated_kg numeric not null,
  percentage  numeric,  -- the recipe % used
  created_at  timestamptz default now()
);

alter table batch_allocations enable row level security;
drop policy if exists "open" on batch_allocations;
create policy "open" on batch_allocations for all to anon, authenticated using (true) with check (true);
grant all on batch_allocations to anon, authenticated;

-- ── FIX 4: Waste field on roast batches ──────────────────────────
alter table roasts add column if not exists waste_kg numeric default 0;

-- Recompute available_kg to account for waste
update roasts set available_kg = output_kg - coalesce(waste_kg, 0)
where available_kg is not null;
