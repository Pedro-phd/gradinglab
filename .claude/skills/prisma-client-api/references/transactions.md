# Transactions

Use an array transaction for independent Prisma operations that must commit together. Use an interactive transaction only when later database work depends on earlier results or conditional logic protects one invariant. Nested writes already provide atomicity for the supported related operation.

Inside an interactive transaction, use the transaction-scoped client. Prepare pure data before opening it; keep network calls, queues, filesystem work, and slow computation outside. Set acquisition and duration limits according to the repository and workload.

Isolation-level options and defaults depend on Prisma, the driver adapter, and the database engine. The engine adapter owns what locks are taken, which anomalies remain, and which serialization/deadlock failures are retryable. Do not select `Serializable` by reflex or claim a default is safe without the invariant and engine evidence.

Retry only the whole transaction for classified transient conflicts when its external effects are idempotent or absent, with a finite budget. Map expected errors to the stable application contract.