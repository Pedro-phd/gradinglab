---
name: backend-core
description: Framework-agnostic base for changes to backend application behavior, contracts, persistence, integrations, jobs, workers, and events. Excludes infrastructure-only work.
---

# Backend Core

Use for construction, review, debugging, or refactoring that changes backend application behavior: public or internal endpoints, controllers, services, business rules, persistence, integrations, jobs, workers, schedules, or events. Do not activate for provisioning, deployment configuration, observability infrastructure, or other infrastructure-only work with no application behavior change.

This module preserves the architecture already in the repository. It does not prescribe a framework, repository layer, service layer, response envelope, cache, queue, or event bus.

## Map the behavior

1. Read project instructions and trace the affected entry point through its callers and consumers.
2. Name the input: request, event, job, schedule, internal call, or external response. Record the observable output and stable failure contract.
3. Locate business invariants, state transitions, ownership, authorization, and concurrency assumptions before deciding where code belongs.
4. Identify compatibility constraints for current callers, persisted data, and concurrently deployed versions.
5. Load only specialists and technology guidance supported by the touched behavior and real project evidence.

## Place guarantees at their boundary

- Validate untrusted input before it can affect domain state. Preserve the project's established parsing and validation mechanism.
- Enforce authorization against the resource or action being accessed, not merely against authentication status.
- Keep atomic local state changes inside the narrowest transaction that protects the invariant. Do not place remote calls inside a database transaction unless an existing coordination protocol requires it.
- Treat duplicate delivery, concurrent updates, and unknown results as design inputs when the actual flow can encounter them. Do not add idempotency machinery to a flow that cannot.
- Map failures to the project's stable error contract. Do not expose internal exceptions or introduce a parallel envelope.

Prefer the smallest coherent change in the existing module. Do not create speculative repositories, queues, caches, event buses, compatibility layers, retries, telemetry, or dependencies.

## Verify proportionately

Exercise changed behavior through its real boundary. A local internal adjustment needs the narrowest reliable gate and an observable smoke when available. A new or changed external boundary needs its success path, relevant rejection, and stable response or error contract exercised. Increase coverage for authorization, ownership, tenant, destructive, asynchronous, or migration risk; never claim checks that were not run.
