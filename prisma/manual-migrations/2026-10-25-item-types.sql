-- 2026-10-25: per-user item types (+ per-packet weight, in case it wasn't pushed yet).
--
-- Turns the free-text items.category into a per-user item_types list and links
-- every item to it, WITHOUT losing data. Idempotent: safe to run more than once,
-- and safe on a database in either the old or the new shape.
--
-- Run BEFORE `npm run db:push`:
--   npm run db:sql -- prisma/manual-migrations/2026-10-25-item-types.sql
-- Afterwards `npm run db:push` should report "already in sync".

BEGIN;

-- From the "weight per packet" change. No-op if already pushed.
ALTER TABLE transaction_lines ADD COLUMN IF NOT EXISTS weight_per_unit_kg DOUBLE PRECISION;

-- 1. The new per-user list of types.
CREATE TABLE IF NOT EXISTS item_types (
  id         TEXT         NOT NULL,
  user_id    TEXT         NOT NULL,
  name       TEXT         NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT item_types_pkey PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS item_types_user_id_name_key ON item_types (user_id, name);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'item_types_user_id_fkey') THEN
    ALTER TABLE item_types ADD CONSTRAINT item_types_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Link items to types, copying each user's existing category names.
ALTER TABLE items ADD COLUMN IF NOT EXISTS type_id TEXT;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'items' AND column_name = 'category') THEN
    INSERT INTO item_types (id, user_id, name)
      SELECT gen_random_uuid()::text, user_id, category FROM items GROUP BY user_id, category
      ON CONFLICT (user_id, name) DO NOTHING;

    UPDATE items i SET type_id = t.id
      FROM item_types t
      WHERE i.type_id IS NULL AND t.user_id = i.user_id AND t.name = i.category;

    ALTER TABLE items DROP COLUMN category;
  END IF;
END $$;

-- 3. Lock it in: every item must have a type.
ALTER TABLE items ALTER COLUMN type_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS items_type_id_idx ON items (type_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'items_type_id_fkey') THEN
    ALTER TABLE items ADD CONSTRAINT items_type_id_fkey
      FOREIGN KEY (type_id) REFERENCES item_types (id) ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
