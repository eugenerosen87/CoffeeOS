-- ═══════════════════════════════════════════
-- CoffeeOS — Migration v9: VAT toggle + Product Runs housekeeping
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- ── 1. VAT enabled toggle on settings ───────────────────────────
alter table settings add column if not exists vat_enabled boolean default true;

-- ── 2. Ensure product_runs has status + total_kg (may already exist from v7) ──
alter table product_runs add column if not exists status    text    default 'completed';
alter table product_runs add column if not exists total_kg  numeric default 0;

-- ── 3. Ensure batch_allocations has coffee_id (may already exist from v7) ──
alter table batch_allocations add column if not exists coffee_id text references green_coffees(coffee_id) on delete restrict;

-- ── 4. RLS on product_runs (in case not set) ──────────────────────
alter table product_runs enable row level security;
drop policy if exists "open" on product_runs;
create policy "open" on product_runs for all to anon, authenticated using (true) with check (true);
grant all on product_runs to anon, authenticated;
