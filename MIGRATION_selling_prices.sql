-- CoffeeOS — Migration: Move selling prices to green coffee profiles
-- Run in Supabase SQL Editor

-- Add selling prices to green_coffees (the profile)
alter table green_coffees add column if not exists sell_price_unpacked numeric;
alter table green_coffees add column if not exists sell_price_250g numeric;
alter table green_coffees add column if not exists sell_price_1kg numeric;

-- Remove selling prices from roasts (they live on the profile now)
alter table roasts drop column if exists price_wholesale_kg;
alter table roasts drop column if exists price_retail_250g;
alter table roasts drop column if exists price_retail_1kg;
