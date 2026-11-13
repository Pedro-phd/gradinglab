---
name: postgres
description: Unified PostgreSQL adapter for schema, indexes, plans, pooling, RLS, locks, diagnosis, backup and PITR, replication, live migration, and major upgrades.
---

# PostgreSQL

Activate when the touched service or package evidences PostgreSQL through its provider, driver, connection configuration, migration, or SQL dialect. Do not activate from an unrelated monorepo dependency. Load `database-migrations` for schema rollout; this single adapter owns PostgreSQL-specific plans, locks, isolation, DDL, and operations.

Confirm the deployed PostgreSQL version, extensions, privileges, topology, pooler and mode, workload, data size, recovery objectives, and relevant service boundary. Do not recommend a hosting provider without project evidence. Features and tools vary by major version and managed-service permissions.

## Route by topic

- **Schema, indexes, queries, pooling, RLS, locks, diagnosis:** read [references/performance-and-safety.md](references/performance-and-safety.md). Require `EXPLAIN (ANALYZE, BUFFERS)` only where executing the statement is safe; otherwise use a nonexecuting plan and representative metrics.
- **Backup, restore, PITR:** read [references/backup-and-pitr.md](references/backup-and-pitr.md) only when recovery or data protection is in scope.
- **Replication, standby, live migration:** read [references/replication-and-live-migration.md](references/replication-and-live-migration.md) only for those operations.
- **Major upgrade:** read [references/major-upgrades.md](references/major-upgrades.md) only for a version transition.

PostgreSQL owns engine semantics; Prisma or another ORM owns its client API, and framework adapters own application wiring.

## Evidence gate

Never claim a query or index is faster from source inspection alone. Capture the plan or a representative before/after measurement, including parameters/selectivity, dataset scale, cache state, concurrency, and observed rows/timing where safe. Treat planning estimates and measurements as evidence with limitations, not universal guarantees.

For DDL or operations, inspect locks, long transactions, WAL/replication impact, disk headroom, privileges, and version compatibility. For recovery claims, prove a restore to an isolated target and validate business data. For isolation/serialization failures, preserve the application invariant and bound any whole-transaction retry.