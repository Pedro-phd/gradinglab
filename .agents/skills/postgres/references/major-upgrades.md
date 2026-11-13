# PostgreSQL major upgrades

Adapted and modified from Neon postgres-skills. Load only for a PostgreSQL major-version transition.

Choose among logical dump/restore, `pg_upgrade`, provider-supported mechanisms, or logical replication from database size, downtime budget, filesystem/topology, supported source/target versions, and rollback needs. Version-specific transfer modes and helper tools must be confirmed from the installed target documentation; never copy a newer-version flag into an older upgrade.

Before production:

- read every intervening release note and changed default;
- verify extensions, collations, custom types, authentication, removed settings, and client/driver compatibility;
- run the relevant compatibility check on a production-like clone;
- verify backup restore and rollback/roll-forward procedures;
- account for standbys, slots, WAL, disk headroom, and downtime;
- benchmark representative queries and application behavior on the target.

After upgrade, validate startup logs, extensions, invalid indexes, sequences, constraints, roles, data aggregates, replication, and application smoke paths. Refresh or preserve optimizer statistics according to the exact versions/tooling, then watch for plan regressions. Retain the old recovery path until the acceptance window passes; modes that mutate or link old storage can change what rollback is possible.