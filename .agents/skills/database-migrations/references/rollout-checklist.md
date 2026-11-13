# Migration rollout checklist

Load this reference when planning or reviewing a production schema or data transition.

## Before expansion

- Identify every deployed application version, reader, writer, job, report, and integration using the old representation.
- Capture the database engine and version, table size and growth, write rate, replication topology, maintenance constraints, and available recovery point.
- Have the database adapter inspect generated DDL, expected metadata/table locks, transaction behavior, rewrite risk, disk headroom, and required privileges.

## Backfill contract

- Use a stable ordering key and explicit batch limit; avoid an unbounded update in deployment.
- Persist progress independently of process memory. A restarted worker must resume or safely reprocess the last batch.
- Make each batch idempotent or guarded by an explicit version/condition.
- Bound transaction duration, sleep or rate-limit based on measured load, and stop on replication lag, lock pressure, error rate, or application latency thresholds.
- Emit processed, remaining, failed, retried, throughput, and lag measures without sensitive row data.

## Parity and cutover

- Define comparison queries before the backfill starts: population counts, null/error counts, domain aggregates, and row-level mismatches where feasible.
- Run validation independently of the write path; a dual-write implementation cannot validate itself.
- Cut over behind the project's existing rollout control, observe a stated window, and retain a path back to the old read representation while it remains correct.

## Contract and recovery

- Confirm no supported binary, worker, rollback artifact, or external consumer uses the old representation.
- Rehearse the recovery action appropriate to the phase. Roll-forward or reconciliation may be safer than reversing already-observed data changes.
- Require explicit approval for information loss, then remove old writes before old reads and remove stored data last.