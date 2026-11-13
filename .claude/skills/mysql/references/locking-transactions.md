# InnoDB transactions and locking

Load for concurrency, deadlocks, locking reads, or migration lock analysis.

InnoDB lock scope follows the index access path. Under common repeatable-read configurations, locking range scans can take next-key locks over records and gaps. A unique lookup on a unique index may lock only the record, while an unindexed update can scan and lock a very broad set of rows. A lookup for a missing row can still protect a gap.

1. Confirm the actual isolation level and autocommit/transaction boundaries; never assume a global default.
2. Inspect the query plan and indexes for every locking statement.
3. Keep transactions short and remote I/O outside them.
4. Access shared rows in a consistent order to reduce deadlocks.
5. On deadlock, inspect engine diagnostics and retry only the complete transaction when the operation is safe and the retry is bounded.
6. Change isolation only for a demonstrated anomaly/contention trade-off and verify the application invariant under the new semantics.

`READ COMMITTED` can reduce many search gap locks but changes snapshot behavior and does not remove all gap locking. `SERIALIZABLE` increases contention and is not a substitute for modeling the invariant. InnoDB does not generally escalate row locks to a table lock; a broad scan can nonetheless lock enough individual records to look table-wide.