-- ═══════════════════════════════════════════════════════════════
-- CoffeeOS v3 — Full schema rebuild
-- WARNING: Drops and recreates roasts table. Run on clean DB.
-- ═══════════════════════════════════════════════════════════════

-- 1. Drop old roasts table (clean rebuild)
drop table if exists roasts cascade;

-- 2. FORMATS — customisable selling formats
create table if not exists formats (
  id uuid primary key default gen_random_uuid(),
  name text not null,           -- e.g. "250g Bag", "Wholesale/kg"
  weight_g numeric,             -- weight in grams (null = per kg wholesale)
  is_wholesale boolean default false,
  bag_cost numeric default 0,   -- packaging cost per unit
  sticker_cost numeric default 0,
  active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

-- Seed default formats
insert into formats (name, weight_g, is_wholesale, bag_cost, sticker_cost, sort_order) values
  ('Wholesale / kg', null, true,  0,  0,  0),
  ('125g Bag',       125,  false, 5,  2,  1),
  ('250g Bag',       250,  false, 8,  3,  2),
  ('500g Bag',       500,  false, 12, 3,  3),
  ('1kg Bag',        1000, false, 22, 4,  4),
  ('2kg Bag',        2000, false, 35, 4,  5)
on conflict do nothing;

-- 3. PRODUCTS — what you sell
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  product_type text default 'single_origin', -- 'single_origin' | 'blend'
  roast_level text default 'cityplus',
  active boolean default true,
  archived boolean default false,
  archived_at timestamptz,
  created_at timestamptz default now()
);

-- 4. PRODUCT RECIPE — beans + percentages
create table if not exists product_recipe (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  coffee_id text references green_coffees(coffee_id) on delete restrict,
  percentage numeric not null check (percentage > 0 and percentage <= 100),
  created_at timestamptz default now()
);

-- 5. PRODUCT PRICES — one price per product per format
create table if not exists product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  format_id uuid references formats(id) on delete cascade,
  price numeric,  -- your selling price excl VAT
  unique(product_id, format_id)
);

-- 6. ROASTS — rebuilt, linked to product
create table if not exists roasts (
  id text primary key,
  product_id uuid references products(id) on delete set null,
  date timestamptz default now(),
  roaster_name text,
  -- Bean inputs (JSON array: [{coffee_id, input_kg}])
  bean_inputs jsonb default '[]',
  output_kg numeric default 0,
  labour_hours numeric default 1.5,
  gas_cost numeric,       -- null = use global rate
  electric_cost numeric,  -- null = use global rate
  -- Units packed per format (JSON: {format_id: units})
  units_packed jsonb default '{}',
  -- Certificate fields
  hero_img text,
  story text,
  notes text,
  acidity numeric default 0,
  body numeric default 0,
  sweetness numeric default 0,
  -- Status
  archived boolean default false,
  archived_at timestamptz,
  archived_note text,
  created_at timestamptz default now()
);

-- 7. RLS
alter table formats enable row level security;
alter table products enable row level security;
alter table product_recipe enable row level security;
alter table product_prices enable row level security;
alter table roasts enable row level security;

create policy "Allow all on formats" on formats for all using (true) with check (true);
create policy "Allow all on products" on products for all using (true) with check (true);
create policy "Allow all on product_recipe" on product_recipe for all using (true) with check (true);
create policy "Allow all on product_prices" on product_prices for all using (true) with check (true);
create policy "Allow all on roasts" on roasts for all using (true) with check (true);

-- 8. Rebuild green_stock view (roasts now uses bean_inputs jsonb)
create or replace view green_stock as
select
  gc.*,
  coalesce(p.total_purchased, 0) as total_purchased_kg,
  coalesce(p.latest_price, gc.default_price_per_kg) as current_price_per_kg,
  coalesce(p.purchase_count, 0) as purchase_count,
  coalesce(u.total_used, 0) as total_used_kg,
  coalesce(p.total_purchased, 0) - coalesce(u.total_used, 0) as stock_kg
from green_coffees gc
left join (
  select
    coffee_id,
    sum(purchased_kg) as total_purchased,
    count(*) as purchase_count,
    (array_agg(cost_per_kg order by purchase_date desc))[1] as latest_price
  from green_purchases
  group by coffee_id
) p on gc.coffee_id = p.coffee_id
left join (
  select
    item->>'coffee_id' as coffee_id,
    sum((item->>'input_kg')::numeric) as total_used
  from roasts, jsonb_array_elements(bean_inputs) as item
  group by item->>'coffee_id'
) u on gc.coffee_id = u.coffee_id;
