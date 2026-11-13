# Redis cluster, security, and operations

## Cluster and scale

Redis Cluster hashes keys to slots. Multi-key commands, transactions, and scripts require colocated keys; use hash tags only when intentional, because over-colocation can create hot slots. Measure per-key/slot request rate, value size, slow commands, network, CPU, and memory before sharding or capacity claims. Split hot keys only when the access contract permits it.

## Security

Use environment-appropriate TLS and ACLs where supported. Grant only commands and key patterns the touched service needs. Keep credentials out of keys, values logged for diagnostics, command traces, and source. Treat session/rate-limit keys as sensitive state and include tenant boundaries in both authorization and key design.

## Operations

Monitor used memory, fragmentation, eviction, hit/miss ratio, latency percentiles, blocked clients, rejected connections, replication state, persistence health, and command errors. Persistence and replicas change durability and failover behavior; document the actual RPO/RTO instead of treating Redis as automatically durable.

Avoid broad or blocking production commands such as `KEYS`, synchronous full-dataset deletion, or expensive unbounded scripts. Prefer cursor scans for bounded operational discovery and unlink/async deletion where supported, with rate limits and observation. Destructive flushes or mass deletions require explicit human approval and a recovery plan.