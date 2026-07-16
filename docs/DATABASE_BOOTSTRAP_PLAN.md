# Database Bootstrap Plan

Status: **DESIGN READY, DATABASE NOT CREATED**  
Database: Amazon RDS for PostgreSQL 16  
Date: 2026-07-15

## 1. Identity model

The RDS managed master user is bootstrap/break-glass only. It is never injected
into ECS application tasks or used for routine migrations.

| Role | Login | Purpose | Prohibited |
| --- | --- | --- | --- |
| `migration_user` | Yes | `prisma migrate deploy`, schema objects, reviewed extensions | Application runtime, role administration, RDS control-plane actions |
| `runtime_user` | Yes | Application DML and sequence use | DDL, migration table mutation outside Prisma, role creation, extension creation |

Staging and production use separate credentials and secrets.

## 2. Bootstrap order

1. Terraform creates private RDS with RDS-managed master password, TLS force,
   UTC parameter group, KMS, backups and deletion protection.
2. A database owner retrieves the master secret through a time-bounded audited
   session in the VPC.
3. Revoke default `CREATE` on schema/database from `PUBLIC` where compatible.
4. Create `migration_user` and `runtime_user` with generated independent
   passwords. Do not place passwords on command lines or in SQL files.
5. Grant `migration_user` `CONNECT`, database `CREATE`, and schema
   `USAGE, CREATE`. It owns objects created by migrations.
6. Configure default privileges for objects created by `migration_user`:
   runtime receives table `SELECT, INSERT, UPDATE, DELETE` and sequence
   `USAGE, SELECT, UPDATE` only.
7. Store separate migration/runtime URLs in Secrets Manager with
   `sslmode=require`.
8. Run migrations with `migration_user`.
9. Reapply/verify runtime grants for existing tables and sequences.
10. Verify runtime readiness and prove DDL/role creation is denied.
11. End the master session and record only role names/secret version IDs.

## 3. Required privileges

`migration_user` requires enough privilege for the committed migrations,
including tables, indexes, constraints, enums, functions/triggers and the
reviewed `btree_gist` extension. Extension installation must be tested on RDS 16;
if elevated privilege is required, the database owner performs that single
reviewed step before migration.

`runtime_user` receives no schema ownership and no `CREATE` privilege. It can
read/write application tables and use sequences. PostgreSQL row locks and
transactions require no DDL privilege.

## 4. Connection contract

- RDS is not public and accepts port 5432 only from ECS and migration security
  groups.
- Client URLs require TLS and certificate verification according to the approved
  RDS CA bundle strategy.
- PostgreSQL and Node run UTC; `SHOW timezone` must return `UTC`.
- Prisma connection-pool limits are budgeted across maximum ECS tasks.
- The migration URL is unavailable to the application task role.

## 5. Credential handling and rotation

Passwords are generated and submitted directly to Secrets Manager by the
private bootstrap runner. They never appear in repository SQL, shell history,
Terraform variables/state or CI logs.

Runtime rotation uses a replacement login or controlled password overlap, one
canary task, readiness/integration checks, full task rollout, then revocation.
Migration credentials should be short-lived per release window where practical.

## 6. Verification

- `SELECT current_user`, database and server address match the environment.
- `SHOW timezone` is `UTC`; TLS is active.
- Migration role can run `prisma migrate deploy` and no migration remains
  pending.
- Runtime role can execute representative application reads/writes and row locks.
- Runtime `CREATE TABLE`, `ALTER TABLE`, `CREATE ROLE` and cross-database access
  fail.
- Migration/runtime URLs are different and KMS-encrypted.
- `/api/ready` succeeds using only the runtime URL.
- Inventory, appointment and migration constraints pass the database runbook.

## 7. Failure handling

Do not mark a failed Prisma migration applied manually. Stop writes, preserve
logs without credentials, restore the pre-migration snapshot into isolation and
prepare a forward fix. Never reset, drop, truncate or seed production.

## 8. Exit criteria

Bootstrap is ready after the RDS instance exists, roles and grants are verified,
secrets are separate, TLS/UTC pass, runtime DDL denial is proven and the database
owner signs the evidence.
