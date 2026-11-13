# Filters

Build `where` from generated scalar, logical, list, JSON, and relation-filter types. Compose `AND`, `OR`, and `NOT` deliberately; an empty or omitted condition can broaden a query.

Relation filters use `some`, `every`, and `none` for to-many relations and `is`/`isNot` for to-one relations. Remember that `every` can be true for a parent with zero related rows; combine it with `some` when at least one relation is required.

String case behavior, array fields, JSON paths, full-text search, null semantics, and operators such as `isSet` depend on provider, schema, preview/stable status, and Prisma version. Confirm the installed generated types and underlying database behavior.

Keep ownership or tenant predicates in the same protected query/action rather than filtering an already-fetched cross-tenant collection in memory. Test allowed, denied, absent, and cross-boundary cases where authorization is involved.