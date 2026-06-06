-- CoffeeOS — Migration: Add sticker/branding costs to settings
-- Run this in Supabase SQL Editor

alter table settings add column if not exists sticker_250_cost numeric default 3.00;
alter table settings add column if not exists sticker_1kg_cost numeric default 3.00;
