# Model queries

Use the generated model delegate and installed-version types for `findUnique`, `findFirst`, `findMany`, create, update, upsert, delete, bulk operations, count, aggregate, and group operations.

- Use unique methods only with a unique or compound-unique selector.
- Prefer `*OrThrow` only where the repository's error mapping expects its not-found failure.
- Make bulk writes intentionally scoped; an empty filter can affect every row.
- Check whether `createManyAndReturn` or `updateManyAndReturn` exists for the installed version and provider before choosing it.
- Use atomic field operations for counters only when they preserve the domain invariant; they do not replace validation or a transaction involving multiple records.
- Map known Prisma errors through the project's stable error contract rather than exposing engine/client details.

Return types and supported options come from the generated client. Compile/typecheck the touched query and exercise the consumer-visible result.