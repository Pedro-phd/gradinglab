# MySQL plan evidence

Load for query tuning or index changes. Confirm engine/version before choosing plan syntax.

- `EXPLAIN` provides the estimated access path. JSON or tree formats expose more optimizer detail when the installed version supports them.
- `EXPLAIN ANALYZE` executes the statement and reports actual iterator timing, rows, and loops on supported MySQL versions. Use it only where executing the query and its cost is safe; do not run it on a mutating production statement.
- Inspect selected key and key parts, access type, estimated rows and filtering, join order, sort/temp-table work, and predicates applied after index access.
- Treat full scans, full index scans, filesort, or temporary tables as observations, not automatic bugs. Evaluate table size, selectivity, result fraction, cache state, and workload.
- Compare estimated with actual rows to find stale statistics or correlation errors. Measurement overhead and warm caches affect results.

A performance claim needs a representative plan or timing plus workload context. Record the query shape and parameters without exposing sensitive values.