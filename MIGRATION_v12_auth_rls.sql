-- -------------------------------------------
-- CoffeeOS — Migration v12: Real Auth RLS
-- Replaces open anon policies with policies
-- that require a signed-in Supabase Auth user.
--
-- IMPORTANT: Run this AFTER you have created
-- at least one user in Supabase Authentication
-- (Dashboard ? Authentication ? Users ? Add user).
--
-- The /cert/:id public certificate page still works
-- because roasts allows anonymous SELECT only.
-- All writes to every table require authentication.
--
-- Each block uses EXCEPTION WHEN undefined_table so the
-- script is safe regardless of which migration path
-- was previously applied to this database.
-- -------------------------------------------

-- -- roasts (public SELECT for cert pages) ----
do $$ begin
  drop policy if exists "Allow all on roasts" on roasts;
  drop policy if exists "open"                on roasts;
  create policy "public_read_roasts"  on roasts for select using (true);
  create policy "auth_write_roasts"   on roasts for insert with check (auth.uid() is not null);
  create policy "auth_update_roasts"  on roasts for update
    using (auth.uid() is not null) with check (auth.uid() is not null);
  create policy "auth_delete_roasts"  on roasts for delete using (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- settings ---------------------------------
do $$ begin
  drop policy if exists "Allow all on settings" on settings;
  drop policy if exists "open"                  on settings;
  create policy "auth_all_settings" on settings
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- formats ----------------------------------
do $$ begin
  drop policy if exists "Allow all on formats" on formats;
  drop policy if exists "open"                 on formats;
  create policy "auth_all_formats" on formats
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- products ---------------------------------
do $$ begin
  drop policy if exists "Allow all on products" on products;
  drop policy if exists "open"                  on products;
  create policy "auth_all_products" on products
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- product_recipe ----------------------------
do $$ begin
  drop policy if exists "Allow all on product_recipe" on product_recipe;
  drop policy if exists "open"                        on product_recipe;
  create policy "auth_all_product_recipe" on product_recipe
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- product_prices ----------------------------
do $$ begin
  drop policy if exists "Allow all on product_prices" on product_prices;
  drop policy if exists "open"                        on product_prices;
  create policy "auth_all_product_prices" on product_prices
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- product_runs -----------------------------
do $$ begin
  drop policy if exists "open" on product_runs;
  create policy "auth_all_product_runs" on product_runs
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- packaging --------------------------------
do $$ begin
  drop policy if exists "open" on packaging;
  create policy "auth_all_packaging" on packaging
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- packaging_purchases -----------------------
do $$ begin
  drop policy if exists "open" on packaging_purchases;
  create policy "auth_all_packaging_purchases" on packaging_purchases
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- suppliers --------------------------------
do $$ begin
  drop policy if exists "open" on suppliers;
  create policy "auth_all_suppliers" on suppliers
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- inventory_movements -----------------------
do $$ begin
  drop policy if exists "open" on inventory_movements;
  create policy "auth_all_inventory_movements" on inventory_movements
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- sales ------------------------------------
do $$ begin
  drop policy if exists "open" on sales;
  create policy "auth_all_sales" on sales
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- batch_allocations -------------------------
do $$ begin
  drop policy if exists "open" on batch_allocations;
  create policy "auth_all_batch_allocations" on batch_allocations
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- customers --------------------------------
do $$ begin
  drop policy if exists "open" on customers;
  create policy "auth_all_customers" on customers
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- green_coffees (renamed from greens in greens_v2 migration) --
do $$ begin
  drop policy if exists "open"                       on green_coffees;
  drop policy if exists "Allow all on green_coffees" on green_coffees;
  create policy "auth_all_green_coffees" on green_coffees
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- green_purchases ---------------------------
do $$ begin
  drop policy if exists "open"                         on green_purchases;
  drop policy if exists "Allow all on green_purchases" on green_purchases;
  create policy "auth_all_green_purchases" on green_purchases
    for all using (auth.uid() is not null) with check (auth.uid() is not null);
exception when undefined_table then null;
end $$;

-- -- Storage: hero images ----------------------
-- The bucket is already public=true so CDN reads work without a policy.
-- We only need to restrict API-level mutations to authenticated users.
drop policy if exists "Public hero images"     on storage.objects;
drop policy if exists "public_read_hero_images" on storage.objects;
drop policy if exists "auth_write_hero_images"  on storage.objects;
drop policy if exists "auth_update_hero_images" on storage.objects;
drop policy if exists "auth_delete_hero_images" on storage.objects;

create policy "public_read_hero_images" on storage.objects
  for select using (bucket_id = 'hero-images');

create policy "auth_write_hero_images" on storage.objects
  for insert with check (bucket_id = 'hero-images' and auth.uid() is not null);

create policy "auth_update_hero_images" on storage.objects
  for update using (bucket_id = 'hero-images' and auth.uid() is not null);

create policy "auth_delete_hero_images" on storage.objects
  for delete using (bucket_id = 'hero-images' and auth.uid() is not null);
