# PostgreSQL replication and live migration

Adapted and modified from Neon postgres-skills. Load only for physical/logical replication, standby behavior, CDC, or a live database migration.

Confirm PostgreSQL versions, publication scope, replica identity, schema compatibility, WAL level, slots/senders/workers, privileges, extension behavior, large objects, sequences, and DDL strategy. Version-gated features such as schema publications or row/column filters must be checked against the installed versions.

A live migration is a lifecycle: create compatible target schema, perform initial copy, stream changes, monitor table-sync and apply lag, validate parity independently, quiesce or fence writes, synchronize sequences and unreplicated objects, cut over clients, then observe. PostgreSQL logical replication does not generally carry arbitrary DDL or sequence state; plan them explicitly.

Replication slots can retain WAL until disk exhaustion. Monitor retained WAL, inactive slots, worker errors, conflicts, and lag; define pause, abort, and cleanup ownership. Standby reads can conflict with recovery, and asynchronous replicas can be stale; align routing with the application's consistency contract.

Rollback after cutover is not merely switching a connection if the new primary accepted writes. Define write fencing, reverse replication, reconciliation, or roll-forward before cutover.