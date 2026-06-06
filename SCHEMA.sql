-- ═══════════════════════════════════════════
-- CoffeeOS 2.0 — Supabase Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- GREENS TABLE
create table if not exists greens (
  lot_id text primary key,
  purchase_date date,
  supplier text,
  origin text,
  farm text,
  process text,
  variety text,
  screen_size text,
  altitude text,
  purchased_kg numeric default 0,
  cost_per_kg numeric default 0,
  stock_kg numeric default 0,
  threshold numeric default 5,
  cupping_score numeric default 0,
  cupping_notes text,
  created_at timestamptz default now()
);

-- ROASTS TABLE
create table if not exists roasts (
  id text primary key,
  date timestamptz,
  green_lot_id text references greens(lot_id) on delete set null,
  roast_level text default 'cityplus',
  roaster_name text,
  origin text,
  farm text,
  process text,
  variety text,
  altitude text,
  screen_size text,
  input_kg numeric default 0,
  output_kg numeric default 0,
  labour_hours numeric default 1.5,
  green_cost_per_kg numeric default 0,
  gas_cost numeric,
  electric_cost numeric,
  bags_250 integer default 0,
  bags_1kg integer default 0,
  hero_img text,
  story text,
  notes text,
  acidity numeric default 0,
  body numeric default 0,
  sweetness numeric default 0,
  created_at timestamptz default now()
);

-- SETTINGS TABLE (single row)
create table if not exists settings (
  id integer primary key default 1,
  gas_rate numeric default 0.80,
  elec_rate numeric default 0.60,
  labour_rate numeric default 120,
  default_hours numeric default 1.5,
  bag_250_cost numeric default 8.00,
  bag_1kg_cost numeric default 22.00,
  ws_markup numeric default 40,
  rt_markup numeric default 40,
  vat_rate numeric default 15,
  roastery_name text default 'Specialty Roastery',
  updated_at timestamptz default now()
);

-- Insert default settings row
insert into settings (id) values (1) on conflict (id) do nothing;

-- STORAGE BUCKET for hero images
insert into storage.buckets (id, name, public)
values ('hero-images', 'hero-images', true)
on conflict (id) do nothing;

-- ROW LEVEL SECURITY
alter table greens enable row level security;
alter table roasts enable row level security;
alter table settings enable row level security;

-- Allow all operations for anon (single-user app, no auth yet)
create policy "Allow all on greens" on greens for all using (true) with check (true);
create policy "Allow all on roasts" on roasts for all using (true) with check (true);
create policy "Allow all on settings" on settings for all using (true) with check (true);

-- Storage policy
create policy "Public hero images" on storage.objects
  for all using (bucket_id = 'hero-images') with check (bucket_id = 'hero-images');
