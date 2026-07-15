# Identity and Access rollback and forward-fix

Do not drop users, roles, password-reset tokens, or Auth.js account/session data
after this migration has accepted writes. Roll back application routes first and
retain all identity rows; use an additive forward migration for constraint or
column corrections.

For a partial deployment, inspect `_prisma_migrations`, table existence, and row
counts before resolving migration state. Back up identity data before any
approved destructive correction. Verify role uniqueness, user-role foreign keys,
and that password hashes and reset tokens remain non-plaintext.
