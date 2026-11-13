# Raw queries

Prefer Prisma's tagged `$queryRaw` for rows and `$executeRaw` for affected-row counts. Values interpolated into a tagged template are parameters:

```typescript
const users = await prisma.$queryRaw<User[]>`
  SELECT id, email FROM "User" WHERE email = ${email}
`
```

SQL parameters cannot safely stand for identifiers. If a table, column, direction, or SQL fragment is dynamic, map a trusted application enum to a fixed allowlisted fragment; never derive it directly from request text. Do not use `$queryRawUnsafe`, `$executeRawUnsafe`, string concatenation, or `Prisma.raw` with untrusted input.

Write SQL for the actual schema provider; Postgres quoting/operators are not portable to MySQL. Use the database adapter for query plans, locks, isolation, result types, and provider-specific errors. Validate dates and numeric conversions at the application boundary, and handle `bigint` without lossy conversion when values may exceed JavaScript's safe integer range.

Raw statements inside a Prisma transaction share the transaction boundary but still obey engine semantics.