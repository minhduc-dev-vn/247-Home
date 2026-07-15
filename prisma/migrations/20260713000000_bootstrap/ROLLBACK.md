# Bootstrap rollback and forward-fix

This migration is additive. Do not reset the database or drop the Prisma
migration table. If the application must roll back, deploy the prior application
while retaining `bootstrap_markers`; the table is harmless to older code.

If deployment stopped partway, inspect `_prisma_migrations` and the table before
using `prisma migrate resolve`. Prefer a new forward migration for any schema
correction. Verify the marker table is readable and `pnpm db:migrate` reports no
failed migration.
