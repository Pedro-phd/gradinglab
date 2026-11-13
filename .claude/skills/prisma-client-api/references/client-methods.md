# Client methods and types

`$connect` can make startup failure explicit; otherwise Prisma commonly connects on first use. `$disconnect` belongs in the application's established shutdown lifecycle, not after every request.

Configure `$on` only for event levels enabled by the constructor. Route events through existing telemetry and avoid logging parameter values or sensitive SQL context. Confirm event typing and adapter support in the installed version.

Use `$extends` for a coherent reusable client/model/query/result behavior only when the repository already centralizes that concern. Extensions must not hide authorization, tenant filtering, or surprising writes. Compose extensions in a deliberate order and test their consumer-visible behavior.

Import generated `Prisma` types from the configured output. With the `prisma-client` generator, use TypeScript `satisfies` for reusable typed select/include fragments; older `Prisma.validator` examples may belong to `prisma-client-js`. Let installed generated types decide.