# PrismaClient constructor

Confirm the installed Prisma version, generator (`prisma-client` or legacy `prisma-client-js`), generated output/import, database provider, and driver-adapter requirement. Reuse the repository's existing singleton or dependency-injection lifecycle rather than creating a second client.

For versions and providers requiring a driver adapter, construct the matching adapter from the project's configured connection information and pass it to `PrismaClient`. Do not copy a Postgres adapter into a MySQL project. Configure logging through established telemetry, and avoid query parameters or sensitive data in logs.

Constructor options such as SQL commenter plugins, transaction defaults, and query-plan cache limits are version-sensitive. Verify they exist in the installed client before using them. Treat process-local cache settings separately from database prepared statements and pooling.

Own graceful shutdown in the framework lifecycle already used by the application. Development hot reload may justify a global singleton pattern; production process management may not.