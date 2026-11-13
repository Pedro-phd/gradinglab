---
name: prisma-client-api
description: Prisma Client adapter for construction, CRUD, query shape, filters, relations, transactions, raw queries, and lifecycle, constrained by the installed Prisma version and database engine.
license: MIT
metadata:
  author: prisma
  version: "7.9.1"
---

# Prisma Client API

Activate when the touched service uses Prisma Client, `schema.prisma`, `prisma` or `@prisma/client`, a generated Prisma client, Prisma transactions, or Prisma raw queries. Inspect the package and lockfile, generator, schema provider, generated import path, client construction, and installed Prisma version before choosing an API. This snapshot describes 7.9.1, but never assume those APIs exist in an older project.

This adapter owns Prisma Client usage. `database-migrations` owns schema rollout; MySQL/Postgres owns engine locks, isolation outcomes, DDL, and operational recovery. NestJS owns modules and lifecycle wiring.

## Load only the needed reference

- Client creation, driver adapters, logging: [constructor](references/constructor.md)
- CRUD and aggregates: [model queries](references/model-queries.md)
- `select`, `include`, `omit`, ordering and pagination: [query options](references/query-options.md)
- Scalar, logical, list and relation predicates: [filters](references/filters.md)
- Relation reads and nested writes: [relations](references/relations.md)
- Sequential and interactive transactions: [transactions](references/transactions.md)
- Parameterized SQL: [raw queries](references/raw-queries.md)
- Connect, disconnect, events, extensions and types: [client methods](references/client-methods.md)

## Apply repository and engine guarantees

Reuse the generated client and lifecycle owner already present. Select only fields allowed by the public contract. Keep authorization predicates or ownership checks at the protected query/action boundary. Use transactions only for one named invariant, keep them short, and keep remote I/O outside.

Use raw SQL only when the typed query API cannot express the operation adequately. Parameterize every untrusted value and allowlist any dynamic identifier outside SQL construction. Never interpolate untrusted text or use an unsafe raw method to bypass parameterization.

## Verify

Exercise the consumer-visible repository/service boundary with a representative database when feasible. For concurrency, isolation, locks, query plans, or DDL claims, load the actual database adapter and capture engine evidence. Do not infer atomicity or performance solely because Prisma exposes a transaction or query method.