# Online payment migration notes

This migration is forward-only. It adds VNPay lifecycle values, provider
metadata, payment sessions, and an append-only webhook event ledger.

- Existing COD and manual bank-transfer payments are not rewritten.
- Do not roll back by deleting payment, order, session, or webhook history.
- If deployment stops after PostgreSQL enum values are added, rerun
  `prisma migrate deploy`; the failed migration must be reconciled according to
  the database runbook before retrying.
- Before application rollout, verify the two new tables, foreign keys, unique
  provider reference, and unique webhook event key. Provider values are
  constrained by application policy because PostgreSQL cannot safely reference
  a newly-added enum value in a check within the same migration transaction.
- A forward fix must preserve all provider event records and payment versions.
