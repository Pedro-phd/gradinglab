---
name: mysql
description: Provider-neutral MySQL and InnoDB adapter for schema, indexes, query plans, transactions, locks, online DDL, connections, and replication in the touched service.
---

# MySQL

Activate when the touched service or package evidences MySQL/InnoDB through its driver, provider, connection configuration, migration, or SQL dialect. Do not activate from an unrelated monorepo dependency. Load `database-migrations` for schema rollout; this adapter owns MySQL-specific SQL, locks, isolation, and DDL behavior.

Start with the deployed MySQL-compatible engine and exact version, storage engine, workload, table size and growth, read/write mix, latency target, replication topology, and operational privileges. Do not recommend a hosting provider without project evidence.

## Route by topic

- **Schema:** choose primary-key shape, numeric and temporal types, character set, collation, nullability, normalization, JSON, and partitioning from the existing schema, version, access pattern, and measured workload. `AUTO_INCREMENT`, one collation, `DATETIME`, or 3NF are not universal requirements.
- **Indexes and queries:** design composite indexes around real equality, range, join, and ordering predicates. Inspect `EXPLAIN`; use `EXPLAIN ANALYZE` only on versions that support it and only where executing the statement is safe. Read [references/explain-analysis.md](references/explain-analysis.md).
- **Transactions:** protect a named invariant with the narrowest transaction. Inspect the configured isolation level, index access path, gap/next-key locks, deadlock history, and retry safety. Read [references/locking-transactions.md](references/locking-transactions.md).
- **DDL:** inspect the generated statement, algorithm, lock level, table rebuild risk, metadata-lock waiters, disk headroom, and replica impact. Read [references/online-ddl.md](references/online-ddl.md).
- **Operations:** size pools from measured concurrency and server limits, set acquisition/query/socket timeouts, and account for replica lag and read-after-write requirements. Do not increase `max_connections` as a substitute for bounded application concurrency.

## Verify with MySQL evidence

For a query change, capture the representative plan and measurement before and after. For a migration, combine the lifecycle from `database-migrations` with a version-accurate DDL and metadata-lock analysis; verify on a safe representative dataset and define abort/recovery thresholds. For deadlocks or contention, use engine evidence rather than changing isolation globally. State what ran and never infer performance from source inspection alone.