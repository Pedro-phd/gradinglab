# PostgreSQL backup, restore, and PITR

Adapted and modified from Neon postgres-skills. Load only when backup, restore, recovery objectives, or PITR is in scope.

Choose logical dumps, physical base backups, and continuous WAL archiving from database size, topology, portability needs, supported version path, RPO, and RTO. Include cluster globals such as roles/tablespaces when recovery requires them. Confirm tool binaries are compatible with source and target versions and that the execution role has only the required privileges.

A backup is not proven by successful creation. Restore it to an isolated target, validate schema, constraints, row counts and domain aggregates, exercise representative reads/writes, and measure restore time against RTO. For PITR, verify WAL archiving continuously, retention covers the recovery window, and a recovery reaches a chosen time/LSN/restore point without promoting the wrong target.

Encrypt and access-control backup storage, protect connection material, monitor missed base backups and WAL archive failures, and rehearse rotation without deleting the last usable recovery chain. Before a destructive migration, identify the exact recovery point and the data changes that a restore would discard.