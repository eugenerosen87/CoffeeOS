-- ═══════════════════════════════════════════════════════════════
-- CoffeeOS v4 — Correct model: Batch = one bean roast, Product = blend/SO
-- Run on clean Supabase project (drops all previous tables)
-- ═══════════════════════════════════════════════════════════════

-- Drop everything cleanly
drop table if exists product_prices cascade;
drop table if exists product_recipe cascade;
drop table if exists product_runs cascade;
drop table if exists products cascade;
drop table if exists roasts cascade;
drop table if exists formats cascade;
drop table if exists packaging_purchases cascade;
drop table if exists packaging cascade;
drop table if exists green_purchases cascade;
drop table if exists green_coffees cascade;
drop table if exists settings cascade;
drop view  if exists green_stock cascade;

-- ── 1. GREEN COFFEES (master profiles) ──────────────────────────
create table green_coffees (
  coffee_id   text primary key,
  supplier    text,
  origin      text,
  farm        text,
  process     text default 'Washed',
  variety     text,
  screen_size text,
  altitude    text,
  threshold   numeric default 5,
  default_price_per_kg numeric default 0,
  cupping_score  numeric default 0,
  cupping_notes  text,
  created_at  timestamptz default now()
);

-- ── 2. GREEN PURCHASES ───────────────────────────────────────────
create table green_purchases (
  id           uuid primary key default gen_random_uuid(),
  coffee_id    text references green_coffees(coffee_id) on delete cascade,
  purchase_date date default current_date,
  purchased_kg  numeric not null,
  cost_per_kg   numeric not null,
  supplier      text,
  notes         text,
  created_at    timestamptz default now()
);

-- ── 3. ROAST BATCHES (one bean, one roast) ──────────────────────
create table roasts (
  id            text primary key,
  coffee_id     text references green_coffees(coffee_id) on delete set null,
  date          timestamptz default now(),
  roast_level   text default 'cityplus',
  roaster_name  text,
  input_kg      numeric default 0,
  output_kg     numeric default 0,
  labour_hours  numeric default 1.5,
  gas_cost      numeric,        -- null = use global rate
  electric_cost numeric,        -- null = use global rate
  -- Cupping
  cupping_score  numeric default 0,
  cupping_notes  text,
  -- Certificate fields
  hero_img  text,
  story     text,
  notes     text,               -- flavour notes pipe-separated
  acidity   numeric default 0,
  body      numeric default 0,
  sweetness numeric default 0,
  -- Status
  archived      boolean default false,
  archived_at   timestamptz,
  archived_note text,
  created_at    timestamptz default now()
);

-- ── 4. FORMATS (customisable selling formats) ────────────────────
create table formats (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  weight_g     numeric,          -- null = wholesale per kg
  is_wholesale boolean default false,
  bag_cost     numeric default 0,
  sticker_cost numeric default 0,
  active       boolean default true,
  sort_order   integer default 0,
  created_at   timestamptz default now()
);

insert into formats (name, weight_g, is_wholesale, bag_cost, sticker_cost, sort_order) values
  ('Wholesale / kg', null, true,  0,  0,  0),
  ('125g Bag',       125,  false, 5,  2,  1),
  ('250g Bag',       250,  false, 8,  3,  2),
  ('500g Bag',       500,  false, 12, 3,  3),
  ('1kg Bag',        1000, false, 22, 4,  4),
  ('2kg Bag',        2000, false, 35, 4,  5);

-- ── 5. PRODUCTS (single origin or blend) ────────────────────────
create table products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  product_type text default 'single_origin', -- 'single_origin' | 'blend'
  active       boolean default true,
  archived     boolean default false,
  archived_at  timestamptz,
  created_at   timestamptz default now()
);

-- ── 6. PRODUCT RECIPE (links product to roasted batches + %) ────
create table product_recipe (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  batch_id   text references roasts(id) on delete restrict,
  percentage numeric not null check (percentage > 0 and percentage <= 100),
  created_at timestamptz default now(),
  unique(product_id, batch_id)
);

-- ── 7. PRODUCT PRICES (one price per product per format) ─────────
create table product_prices (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  format_id  uuid references formats(id) on delete cascade,
  price      numeric,
  unique(product_id, format_id)
);

-- ── 8. PRODUCT RUNS (packaging run — units packed per format) ────
create table product_runs (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references products(id) on delete cascade,
  run_date    date default current_date,
  notes       text,
  units_packed jsonb default '{}', -- {format_id: units}
  created_at  timestamptz default now()
);

-- ── 9. PACKAGING MATERIALS ──────────────────────────────────────
create table packaging (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  size                 text,
  stock_units          integer default 0,
  cost_per_unit        numeric default 0,
  low_stock_threshold  integer default 50,
  created_at           timestamptz default now()
);

insert into packaging (name, size, stock_units, cost_per_unit, low_stock_threshold) values
  ('250g Valve Bag', '250g', 0, 8.00, 50),
  ('1kg Valve Bag',  '1kg',  0, 22.00, 20);

create table packaging_purchases (
  id           uuid primary key default gen_random_uuid(),
  packaging_id uuid references packaging(id) on delete cascade,
  purchase_date date default current_date,
  units_bought  integer not null,
  cost_per_unit numeric not null,
  notes         text,
  created_at    timestamptz default now()
);

-- ── 10. SETTINGS ────────────────────────────────────────────────
create table settings (
  id               integer primary key default 1,
  gas_rate         numeric default 0.80,
  elec_rate        numeric default 0.60,
  labour_rate      numeric default 120,
  default_hours    numeric default 1.5,
  bag_250_cost     numeric default 8.00,
  bag_1kg_cost     numeric default 22.00,
  sticker_250_cost numeric default 3.00,
  sticker_1kg_cost numeric default 3.00,
  ws_markup        numeric default 40,
  vat_rate         numeric default 15,
  roastery_name    text default 'Specialty Roastery',
  updated_at       timestamptz default now()
);
insert into settings (id) values (1) on conflict do nothing;

-- ── 11. GREEN STOCK VIEW ─────────────────────────────────────────
create or replace view green_stock as
select
  gc.*,
  coalesce(p.total_purchased, 0)                              as total_purchased_kg,
  coalesce(p.latest_price, gc.default_price_per_kg)          as current_price_per_kg,
  coalesce(p.purchase_count, 0)                              as purchase_count,
  coalesce(u.total_used, 0)                                  as total_used_kg,
  coalesce(p.total_purchased, 0) - coalesce(u.total_used, 0) as stock_kg
from green_coffees gc
left join (
  select coffee_id,
    sum(purchased_kg) as total_purchased,
    count(*) as purchase_count,
    (array_agg(cost_per_kg order by purchase_date desc))[1] as latest_price
  from green_purchases group by coffee_id
) p on gc.coffee_id = p.coffee_id
left join (
  select coffee_id, sum(input_kg) as total_used
  from roasts where coffee_id is not null group by coffee_id
) u on gc.coffee_id = u.coffee_id;

-- ── 12. RLS ──────────────────────────────────────────────────────
alter table green_coffees      enable row level security;
alter table green_purchases    enable row level security;
alter table roasts             enable row level security;
alter table formats            enable row level security;
alter table products           enable row level security;
alter table product_recipe     enable row level security;
alter table product_prices     enable row level security;
alter table product_runs       enable row level security;
alter table packaging          enable row level security;
alter table packaging_purchases enable row level security;
alter table settings           enable row level security;

create policy "open" on green_coffees      for all using (true) with check (true);
create policy "open" on green_purchases    for all using (true) with check (true);
create policy "open" on roasts             for all using (true) with check (true);
create policy "open" on formats            for all using (true) with check (true);
create policy "open" on products           for all using (true) with check (true);
create policy "open" on product_recipe     for all using (true) with check (true);
create policy "open" on product_prices     for all using (true) with check (true);
create policy "open" on product_runs       for all using (true) with check (true);
create policy "open" on packaging          for all using (true) with check (true);
create policy "open" on packaging_purchases for all using (true) with check (true);
create policy "open" on settings           for all using (true) with check (true);

-- Storage bucket for hero images
insert into storage.buckets (id, name, public) values ('hero-images','hero-images',true) on conflict (id) do update set public = true;
drop policy if exists "Public hero images" on storage.objects;
create policy "Public hero images" on storage.objects for all using (bucket_id='hero-images') with check (bucket_id='hero-images');

-- ── 13. SUPPLIERS ─────────────────────────────────────────────────
create table if not exists suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  contact_name text,
  email        text,
  phone        text,
  country      text,
  notes        text,
  lead_time_days integer default 14,
  active       boolean default true,
  created_at   timestamptz default now()
);
alter table suppliers enable row level security;
drop policy if exists "open" on suppliers;
create policy "open" on suppliers for all to anon, authenticated using (true) with check (true);
grant all on suppliers to anon, authenticated;
