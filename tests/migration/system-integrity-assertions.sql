DO $$
BEGIN
  IF to_regclass('public.inventory_allocations') IS NULL THEN
    RAISE EXCEPTION 'inventory_allocations table is missing';
  END IF;
  IF to_regclass('public.addresses_one_default_per_user') IS NULL THEN
    RAISE EXCEPTION 'default-address partial unique index is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index
    WHERE indexrelid = 'public.addresses_one_default_per_user'::regclass
      AND indisvalid
      AND indisunique
  ) THEN
    RAISE EXCEPTION 'default-address index is not valid and unique';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.inventory_allocations'::regclass
      AND conname IN (
        'inventory_allocations_quantity_check',
        'inventory_allocations_lifecycle_check'
      )
      AND NOT convalidated
  ) THEN
    RAISE EXCEPTION 'inventory allocation constraints are not validated';
  END IF;
END $$;
