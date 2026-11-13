# Redis atomicity and connections

A single Redis command is atomic, but a client-side read/decide/write sequence is not. Use the smallest mechanism that protects the invariant: one command, conditional option, transaction with watched keys, or a server-side script/function. Document keys, return contract, failure behavior, and timeout ambiguity.

Lua/functions run atomically and can block the server. Keep them deterministic, bounded, and free of unbounded scans. Load/version them through the client's established mechanism and handle cache/script misses without silently changing semantics. In Cluster, all keys used by one script or multi-key command must share a slot.

Pipelining reduces network round trips but is not a transaction. Bound pipeline size and account for partial connection failure/unknown replies. Blocking commands need dedicated or correctly managed connections.

Reuse the service's client/pool. Set connect, command/socket, pool-acquisition, retry, and shutdown behavior. Retry only safe commands after classified failures; after a timeout, a mutating command may have executed. Reconcile state or use an idempotent operation rather than blindly repeating it.