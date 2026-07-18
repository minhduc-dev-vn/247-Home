-- Expand the existing enum in its own migration so PostgreSQL commits the new
-- value before later constraints reference it.
ALTER TYPE "WarrantyStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
