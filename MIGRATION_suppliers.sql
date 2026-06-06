-- CoffeeOS — Add suppliers table
-- Run this in Supabase SQL Editor if you've already run v4

create table if not exists suppliers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  contact_name   text,
  email          text,
  phone          text,
  country        text,
  lead_time_days integer default 14,
  notes          text,
  active         boolean default true,
  created_at     timestamptz default now()
);

alter table suppliers enable row level security;
drop policy if exists "open" on suppliers;
create policy "open" on suppliers for all to anon, authenticated using (true) with check (true);
grant all on suppliers to anon, authenticated;
