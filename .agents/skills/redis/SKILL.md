---
name: redis
description: Scoped Redis adapter for data structures, keys, TTL and eviction, invalidation, stampede control, atomicity and Lua, connections, cluster, security, and observability.
license: MIT
metadata:
  author: Redis, Inc.
  version: "0.1.0"
---

# Redis

Activate only when the touched service or package uses a Redis client, configuration, commands, cache/session/rate-limit/Stream behavior, or Redis-backed infrastructure called by that code. A Redis dependency elsewhere in a monorepo is insufficient. Load `backend-core` first and risk specialists when the Redis data crosses an external, tenant, auth, or session boundary.

Redis is not authoritative storage unless the explicit product and durability contract makes it so. For caches, name the source of truth and owner of invalidation before writing code.

## Route by topic

- Choose a structure from the actual access and update pattern, then define a short, stable, tenant-safe key convention: [data structures and keys](references/data-structures-and-keys.md).
- For caches, sessions, rate limits, TTL, eviction, stale data, invalidation, and stampedes: [cache and expiry](references/cache-and-expiry.md).
- For atomic updates, transactions, Lua/functions, pipelines, blocking operations, timeouts, and pooling: [atomicity and connections](references/atomicity-and-connections.md).
- For Cluster hash slots/tags, hot keys, ACL/TLS, memory, latency, persistence, and dangerous commands: [cluster, security, and operations](references/cluster-security-operations.md).

## Version and module gate

Confirm server version, deployment mode, client version, enabled modules, persistence/replication policy, eviction configuration, and managed-service restrictions. Streams require Redis 5.0 or later. Redis JSON commands require RedisJSON/Redis Stack or a deployment that explicitly includes the JSON capability. Vector Sets require a compatible Redis 8 deployment; do not substitute RediSearch vector indexes without checking the actual module/API. Verify exact command availability rather than inferring it from this snapshot.

## Verify at the service boundary

Exercise hits/misses or command outcomes through the touched service. Cover expiration/invalidation, duplicate/concurrent updates, stale-source behavior, and Redis unavailability only where those are part of the changed contract. For Cluster, prove multi-key slot compatibility and inspect hot-key distribution. Capture latency, error, memory, and eviction evidence before performance or capacity claims.