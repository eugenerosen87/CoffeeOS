-- ═══════════════════════════════════════════════════════
-- CoffeeOS — Migration: Green coffees + purchases model
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Rename existing greens table to green_coffees (master profiles)
alter table greens rename to green_coffees;

-- 2. Rename lot_id to coffee_id
alter table green_coffees rename column lot_id to coffee_id;

-- 3. Drop purchase-specific columns from master profile
alter table green_coffees drop column if exists purchase_date;
alter table green_coffees drop column if exists purchased_kg;
alter table green_coffees drop column if exists cost_per_kg;
alter table green_coffees drop column if exists stock_kg;

-- 4. Add default_price to master profile (used as default for new purchases)
alter table green_coffees add column if not exists default_price_per_kg numeric default 0;
alter table green_coffees add column if not exists supplier text;

-- 5. Create purchases table
create table if not exists green_purchases (
  id uuid primary key default gen_random_uuid(),
  coffee_id text references green_coffees(coffee_id) on delete cascade,
  purchase_date date not null default current_date,
  purchased_kg numeric not null default 0,
  cost_per_kg numeric not null default 0,
  supplier text,
  notes text,
  created_at timestamptz default now()
);

-- 6. Stock is computed as: sum(purchases) - sum(used in roasts)
--    We add a computed stock view for convenience
create or replace view green_stock as
select
  gc.*,
  coalesce(p.total_purchased, 0) as total_purchased_kg,
  coalesce(r.total_used, 0) as total_used_kg,
  coalesce(p.total_purchased, 0) - coalesce(r.total_used, 0) as stock_kg,
  coalesce(p.latest_price, gc.default_price_per_kg) as current_price_per_kg,
  coalesce(p.purchase_count, 0) as purchase_count
from green_coffees gc
left join (
  select
    coffee_id,
    sum(purchased_kg) as total_purchased,
    max(cost_per_kg) filter (where purchase_date = (
      select max(purchase_date) from green_purchases p2 where p2.coffee_id = green_purchases.coffee_id
    )) as latest_price,
    count(*) as purchase_count
  from green_purchases
  group by coffee_id
) p on gc.coffee_id = p.coffee_id
left join (
  select green_lot_id, sum(input_kg) as total_used
  from roasts
  where green_lot_id is not null
  group by green_lot_id
) r on gc.coffee_id = r.green_lot_id;

-- 7. RLS for new table
alter table green_purchases enable row level security;
create policy "Allow all on green_purchases" on green_purchases for all using (true) with check (true);

-- 8. Update roasts foreign key reference (green_lot_id now references green_coffees.coffee_id)
-- (No change needed — the column name in roasts stays green_lot_id, just references new table name)

