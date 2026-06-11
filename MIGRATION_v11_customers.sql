-- ═══════════════════════════════════════════
-- CoffeeOS — Migration v11: Customers table + link to sales
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- ── 1. Create customers table ────────────────────────────────────
create table if not exists customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  email         text,
  phone         text,
  type          text default 'individual',
  notes         text,
  created_at    timestamptz default now()
);

alter table customers enable row level security;
create policy "open" on customers for all to anon, authenticated using (true) with check (true);

-- ── 2. Add customer_id FK to sales ──────────────────────────────
alter table sales
  add column if not exists customer_id uuid references customers(id) on delete set null;

create index if not exists sales_customer_id_idx on sales(customer_id);
