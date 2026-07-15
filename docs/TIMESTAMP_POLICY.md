# Timestamp Policy

Decision date: 2026-07-15  
Business display timezone: `Asia/Ho_Chi_Minh`

## 1. Current state

The initial Prisma migrations created most columns as PostgreSQL
`TIMESTAMP(3) WITHOUT TIME ZONE`. Later Operations schedule/lifecycle columns
use `TIMESTAMPTZ`. Prisma maps both families to JavaScript `Date`, so the
database/session/application timezone contract matters.

Existing docs intend UTC persistence and Vietnam service-time presentation.
Changing types without proving the historical interpretation could shift real
appointments, token expiry and audit times.

## 2. Staging decision

**Accepted risk: no timestamp type migration before staging.**

Staging must:

- run PostgreSQL and the Node process with timezone `UTC`;
- verify `SHOW TIMEZONE` returns `UTC` after connection;
- pass ISO 8601 instants at API boundaries;
- convert service dates/rendering explicitly with `Asia/Ho_Chi_Minh` helpers;
- never apply a server/session timezone-dependent cast to historical columns.

This keeps the interpretation used by the current application and tests. The
mixed physical types remain technical debt, not a license to use local machine
time in new code.

## 3. Validation before promotion

On a staging copy, sample known appointment and audit rows and compare:

1. Raw PostgreSQL value and column type.
2. Prisma-returned ISO instant.
3. Expected Vietnam wall-clock display.

Check DST assumptions explicitly even though Vietnam currently has no DST;
external users and future service areas may not share that property.

## 4. Future migration plan

1. Inventory every timestamp column and classify it as instant, local date/time,
   or date-only business value.
2. Establish historical provenance for each `TIMESTAMP WITHOUT TIME ZONE`
   column from backups/logs and confirm it represents UTC.
3. Back up and restore a staging snapshot.
4. Use an additive/forward migration with explicit conversion such as
   `column AT TIME ZONE 'UTC'` only after provenance is approved.
5. Compare row counts and sampled instants before validating constraints and
   switching application code.
6. Keep a forward-fix path; do not roll back by casting ambiguous values again.

If historical interpretation cannot be proved, the migration is blocked and
must preserve original values plus an explicit interpretation/version marker.
