# Staging Rollback Plan

## Preconditions

Every deployment record must contain target Git SHA, target digest, active
previous digest, migration head, pre-migration backup checksum, schema
compatibility decision, release owner and rollback owner. Both image digests
must remain pullable.

## Application rollback

1. Stop new writes and preserve logs/request IDs.
2. Confirm the previous digest supports the current forward schema.
3. Call the approved deployment platform with the previous exact digest.
4. Wait for health/readiness before routing traffic.
5. Verify login, checkout/order read, Operations assignment and Technician
   evidence read with synthetic accounts.
6. Record deployed digest and validation result.

Never rebuild an old tag, deploy `latest`, or move a release tag.

## Database recovery

Do not run destructive reverse migrations. On migration failure, keep the
failed database intact, stop writes, and restore the verified pre-migration
backup into a separate isolated database. Verify migrations, constraints,
indexes, allocations, slot capacity, row counts and readiness before an
approved connection switch. Repair history with a reviewed forward fix.

## Abort criteria

Abort rollout on failed migration, failed invariant, missing audit event,
readiness failure, secret/storage binding failure, Critical/High image finding,
unexpected data loss, or unavailable previous artifact/backup.

The current repository has no registry digest for either current or previous
artifact and no staging backup. Rollback is documented but cannot be exercised
until external infrastructure is provisioned.

