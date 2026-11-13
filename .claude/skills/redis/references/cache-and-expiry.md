# Redis cache and expiry

Name the source of truth, cache owner, invalidation event, freshness tolerance, missing-value policy, and behavior when Redis is unavailable.

Set TTL deliberately at creation/update rather than relying on a later call that can be skipped. Understand whether the chosen command preserves, replaces, or clears an existing TTL. Sessions and rate-limit state have security and availability contracts different from ordinary caches.

Choose eviction policy from the complete workload and memory limit. A TTL is not a guarantee that data remains until expiry: eviction, failover, flushes, and persistence settings can remove it earlier. Cache clients must tolerate misses.

For stampedes, use one bounded strategy supported by the application: request coalescing/singleflight, short lease with ownership token, stale-while-revalidate, or jittered expirations. Locks need unique ownership, atomic conditional acquisition with expiry, and compare-and-delete release. Never extend or delete another worker's lease.

Invalidate only after the source-of-truth change reaches its committed boundary. If invalidation can be lost, define acceptable staleness and reconciliation. Avoid treating cache contents as authoritative merely because they are fast.