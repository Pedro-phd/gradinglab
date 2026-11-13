# MySQL online DDL

Load for a production MySQL schema change. Exact support varies by server family, version, table definition, and operation; verify against the detected engine rather than copying a recipe.

MySQL-compatible engines may perform an alteration as metadata-only, an in-place rebuild, or a table copy. Ask for the strongest supported nonblocking algorithm and lock level explicitly where the engine provides that syntax so an unsupported request fails instead of silently choosing a more blocking method.

Before execution:

- inspect generated SQL and the version-specific algorithm/lock matrix;
- measure table and index size, write rate, free disk, replica lag, and long transactions;
- find sessions that can hold or queue metadata locks;
- test duration and resource use against representative data;
- define lock-wait, lag, latency, disk, and error abort thresholds;
- use `database-migrations` for mixed-version rollout and backfill coordination.

Even online or in-place operations may need short exclusive metadata locks at start or completion, generate heavy I/O, and delay replicas. External online-schema tools add triggers, binlog consumers, shadow tables, cutover locks, and their own recovery requirements; use only tools already approved for the environment and rehearse cleanup. Provider-specific workflows apply only when that provider is actually used.