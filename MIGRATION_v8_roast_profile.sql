-- ═══════════════════════════════════════════
-- CoffeeOS — Migration v8: Roast Profile Fields
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════

-- Roast profile data — allows roasters to document and repeat successful roasts
alter table roasts add column if not exists charge_temp     numeric;  -- °C at bean load
alter table roasts add column if not exists drop_temp       numeric;  -- °C at drop/end
alter table roasts add column if not exists first_crack_min numeric;  -- minutes into roast when first crack occurs
alter table roasts add column if not exists dev_time_pct    numeric;  -- development time ratio % (time FC→drop / total roast time)
