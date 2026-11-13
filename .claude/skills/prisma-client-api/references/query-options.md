# Query shape and pagination

Use `select` to allowlist fields for a consumer. Use `include` only for relations the operation needs. `omit` availability and nesting are version-sensitive; verify against the installed generated client, and do not combine incompatible shape options.

Filter and order relation collections inside their nested query when supported. Avoid deep unconditional includes that multiply data volume. For public responses, never depend on a model's current full shape as an allowlist.

Offset pagination is suitable for bounded shallow pages. For growing or frequently updated datasets, prefer a stable cursor and deterministic unique tiebreaker. A next-page query normally uses the last cursor, skips that cursor record, and repeats the same ordering and authorization predicate.

`distinct`, null ordering, relation ordering, negative `take`, and provider behavior can differ by Prisma version/provider. Confirm generated types and verify representative results rather than assuming an example is portable.