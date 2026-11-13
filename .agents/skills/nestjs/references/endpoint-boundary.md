# NestJS endpoint boundary

Load for a new or changed NestJS controller route.

## Trace before editing

1. Identify the owning module, controller, provider path, DTOs, global and route-scoped pipes, guards, interceptors, and exception filters.
2. Record the public method, route, status, request shape, response allowlist, and stable error body already used by adjacent endpoints.
3. Confirm provider scope and lifecycle. Avoid request-scoped providers unless the existing design or request context requires them.

## Implement

- Use framework decorators supported by the installed Nest version.
- Keep validation and transformation consistent with the configured `ValidationPipe`; do not assume implicit conversion is enabled.
- Pass validated values and authenticated context into the existing application boundary.
- Authorize the target resource or action, not merely the controller class or login state.
- Map expected domain failures through the existing filter or exception convention.

## Prove

Boot the application or its established Nest integration harness. Send one valid request and one relevant invalid or forbidden request. Assert consumer-visible status and body, plus the protected side effect or lack of it. If global application setup is part of production behavior, ensure the test applies the same setup rather than testing a bare controller in isolation.