---
name: nestjs
description: Framework adapter for NestJS modules, providers, controllers, DTOs and pipes, guards and policies, filters and interceptors, lifecycle, and real-boundary verification.
---

# NestJS Adapter

Activate only when the touched service or package evidences NestJS through `@nestjs/core`, `nest-cli.json`, or scoped Nest imports. Load after `backend-core` and any risk specialist. Do not migrate another framework to NestJS or activate from an unrelated monorepo package.

First inspect the installed Nest major version, module graph, bootstrap code, global pipes, filters, interceptors, guards, error contract, and test conventions. Current official documentation for that installed version and repository patterns outrank generic examples.

## Preserve framework boundaries

- Keep controllers focused on transport concerns: route metadata, boundary parsing, authorization hooks, and response mapping. Put business rules where this repository already places them.
- Register providers in the owning module and preserve dependency direction. Use existing tokens, scopes, dynamic modules, and configuration mechanisms; do not hide initialization in constructors.
- Reuse established DTO and validation-pipe conventions. Validation must happen at the external boundary, and transformed values must match the declared contract.
- Apply guards or policies close to the protected action and resource. Authentication metadata alone does not prove resource authorization.
- Reuse the service's exception filters and interceptors. Do not create a second error envelope, silently catch domain errors, or let internal exceptions leak.
- Keep lifecycle hooks bounded and observable. Connections and background work need explicit startup/shutdown ownership consistent with the application.

NestJS owns framework composition and request lifecycle here. Prisma owns Client APIs; MySQL or Postgres owns SQL, locks, isolation, and DDL.

## Verify through Nest

For a new or changed endpoint, exercise the bootstrapped Nest HTTP boundary or the project's established integration harness. Prove a success path and the relevant validation or authorization rejection, including the stable response/error shape. Use `TestingModule` only when it faithfully assembles the real providers, guards, pipes, and filters needed by the changed boundary; do not replace meaningful integration behavior with mocked echoes.

Read [references/endpoint-boundary.md](references/endpoint-boundary.md) before implementing or reviewing an endpoint.