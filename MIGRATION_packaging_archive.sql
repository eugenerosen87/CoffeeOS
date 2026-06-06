-- CoffeeOS — Migration: Packaging inventory + batch archiving
-- Run in Supabase SQL Editor

-- 1. Packaging materials table
create table if not exists packaging (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  size text not null, -- '250g' or '1kg'
  stock_units integer default 0,
  cost_per_unit numeric default 0,
  low_stock_threshold integer default 50,
  created_at timestamptz default now()
);

-- Insert default bag types
insert into packaging (name, size, stock_units, cost_per_unit, low_stock_threshold)
values
  ('250g Valve Bag', '250g', 0, 8.00, 50),
  ('1kg Valve Bag', '1kg', 0, 22.00, 20)
on conflict do nothing;

-- 2. Packaging purchase log
create table if not exists packaging_purchases (
  id uuid primary key default gen_random_uuid(),
  packaging_id uuid references packaging(id) on delete cascade,
  purchase_date date default current_date,
  units_bought integer not null,
  cost_per_unit numeric not null,
  notes text,
  created_at timestamptz default now()
);

-- 3. Add archived columns to roasts
alter table roasts add column if not exists archived boolean default false;
alter table roasts add column if not exists archived_at timestamptz;
alter table roasts add column if not exists archived_note text;

-- 4. RLS
alter table packaging enable row level security;
alter table packaging_purchases enable row level security;
create policy "Allow all on packaging" on packaging for all using (true) with check (true);
create policy "Allow all on packaging_purchases" on packaging_purchases for all using (true) with check (true);
