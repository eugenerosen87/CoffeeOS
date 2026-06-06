-- ═══════════════════════════════════════════════════════════════
-- CoffeeOS v5 — Trust layer
-- Run AFTER v4 is already set up (additive only, no drops)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. INVENTORY MOVEMENTS (append-only ledger) ──────────────────
create table if not exists inventory_movements (
  id           uuid primary key default gen_random_uuid(),
  coffee_id    text references green_coffees(coffee_id) on delete set null,
  movement_type text not null, -- 'purchase_in' | 'roast_out' | 'adjustment_in' | 'adjustment_out' | 'waste_out'
  quantity_kg  numeric not null,  -- always positive
  reference_id text,              -- purchase id, roast batch id, etc.
  reference_type text,            -- 'purchase' | 'roast' | 'manual'
  note         text,
  created_at   timestamptz default now()
);

alter table inventory_movements enable row level security;
drop policy if exists "open" on inventory_movements;
create policy "open" on inventory_movements for all to anon, authenticated using (true) with check (true);
grant all on inventory_movements to anon, authenticated;

-- ── 2. Backfill movements from existing purchases ────────────────
insert into inventory_movements (coffee_id, movement_type, quantity_kg, reference_id, reference_type, note, created_at)
select
  coffee_id,
  'purchase_in',
  purchased_kg,
  id::text,
  'purchase',
  'Backfilled from purchase history',
  created_at
from green_purchases
on conflict do nothing;

-- Backfill roast deductions
insert into inventory_movements (coffee_id, movement_type, quantity_kg, reference_id, reference_type, note, created_at)
select
  coffee_id,
  'roast_out',
  input_kg,
  id,
  'roast',
  'Backfilled from roast history',
  created_at
from roasts
where coffee_id is not null and input_kg > 0
on conflict do nothing;

-- ── 3. BATCH STATUS (state machine) ──────────────────────────────
alter table roasts add column if not exists status text default 'roasted'
  check (status in ('planned','scheduled','roasting','resting','approved','archived'));

-- Migrate existing archived flag to status
update roasts set status = 'archived' where archived = true;
update roasts set status = 'resting'  where archived = false and status = 'roasted'
  and date > now() - interval '5 days';
update roasts set status = 'approved' where archived = false and status = 'roasted'
  and date <= now() - interval '5 days';

-- ── 4. SALES RECORDING ───────────────────────────────────────────
create table if not exists sales (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid references products(id) on delete set null,
  format_id    uuid references formats(id) on delete set null,
  sale_date    date not null default current_date,
  units_sold   integer not null,
  price_per_unit numeric not null,   -- actual sale price excl VAT
  channel      text default 'direct', -- 'direct' | 'wholesale' | 'market' | 'online'
  customer     text,
  note         text,
  created_at   timestamptz default now()
);

alter table sales enable row level security;
drop policy if exists "open" on sales;
create policy "open" on sales for all to anon, authenticated using (true) with check (true);
grant all on sales to anon, authenticated;

-- ── 5. Rebuild green_stock view to use movements ledger ──────────
create or replace view green_stock as
select
  gc.*,
  coalesce(m.total_in,  0)                        as total_purchased_kg,
  coalesce(m.total_out, 0)                        as total_used_kg,
  coalesce(m.total_in, 0) - coalesce(m.total_out, 0) as stock_kg,
  coalesce(p.latest_price, gc.default_price_per_kg)  as current_price_per_kg,
  coalesce(p.purchase_count, 0)                   as purchase_count
from green_coffees gc
left join (
  select
    coffee_id,
    sum(case when movement_type in ('purchase_in','adjustment_in') then quantity_kg else 0 end) as total_in,
    sum(case when movement_type in ('roast_out','adjustment_out','waste_out') then quantity_kg else 0 end) as total_out
  from inventory_movements
  group by coffee_id
) m on gc.coffee_id = m.coffee_id
left join (
  select coffee_id,
    count(*) as purchase_count,
    (array_agg(cost_per_kg order by purchase_date desc))[1] as latest_price
  from green_purchases group by coffee_id
) p on gc.coffee_id = p.coffee_id;
