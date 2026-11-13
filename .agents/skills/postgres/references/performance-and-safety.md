# PostgreSQL performance and safety

Load for schema, query, index, connection, RLS, locking, or diagnosis work.

## Queries and indexes

Start from the real query shape and representative parameters. Index frequent selective filter, join, ordering, and constraint paths; account for column order, partial predicates, included columns, write amplification, storage, and maintenance. A sequential scan can be correct for a small table or large result fraction.

Use plain `EXPLAIN` when execution is unsafe. Where safe, `EXPLAIN (ANALYZE, BUFFERS)` supplies actual rows, loops, timing, and buffer activity. Compare estimates with actuals and capture before/after under comparable cache and concurrency conditions. Do not optimize from cost alone.

## Connections and transactions

Reuse the project's pooler and choose transaction/session mode based on features such as prepared statements, session state, temp tables, and advisory locks. Size pools from server capacity, memory per operation, concurrent work, external pools, and measured queueing—not a fixed connections-per-core formula. Bound acquisition, statement, lock, idle-transaction, and network waits at the correct layer.

Keep transactions short and lock rows in a consistent order. Inspect `pg_stat_activity`, blocking chains, deadlocks, and actual isolation. Retry serialization or deadlock failures only as a complete safe transaction with a finite budget.

## RLS and schema

Index columns used by RLS predicates and test policies as every applicable role. Keep security-definer helpers outside exposed schemas, fix `search_path`, minimize privileges, and ensure the caller identity/tenant is checked. RLS is defense at the database boundary, not a substitute for application authorization.

Use explicit constraints for durable invariants. Add or validate expensive constraints through a rollout appropriate to table size and version. Load `database-migrations` for every production schema transition.