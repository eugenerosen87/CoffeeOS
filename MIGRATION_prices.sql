-- ═══════════════════════════════════════════
-- CoffeeOS — Migration: Add manual price fields
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════

alter table roasts add column if not exists price_wholesale_kg numeric;
alter table roasts add column if not exists price_retail_250g numeric;
alter table roasts add column if not exists price_retail_1kg numeric;
