# Payment Workflow Migration Notes

This migration is forward-only. PostgreSQL enum values must not be removed from
an already deployed type, and no payment rows should be deleted to roll back a
release.

- If application rollout fails, deploy a forward fix that stops using
  `REFUNDED` and leaves the nullable `confirmation_reference` column unused.
- If deployment is partial, finish this additive migration before deploying a
  compatible application build. It does not rewrite or remove payment data.
- Verify with `pnpm db:migrate`, then query payment status counts and confirm
  that existing `PENDING`, `PAID`, `FAILED`, and `CANCELLED` rows are unchanged.
