---
name: backend-security
description: Risk-triggered security workflow for backend boundaries, protected data, authorization, tenants, credentials, payments, destructive actions, uploads, and externally influenced requests.
---

# Backend Security

Use automatically when touched backend behavior crosses a trust boundary, exposes or modifies data, or changes a sensitive control. The user does not need to say “security.” Keep routine internal work in `backend-core`; a full security audit remains an explicit request.

## Classify first

### Routine

An internal rename, extraction, or refactor is routine only when it preserves inputs, outputs, authorization, data access, side effects, and external boundaries. Apply the core's existing controls and focused verification; do not expand it into this workflow.

### Sensitive

Treat every new or changed endpoint, data-reading or data-writing rule, third-party response, integration, webhook, upload, PII path, ownership decision, or tenant-aware resource as sensitive. Map the boundary and plausible abuse, validate external input and output, enforce authorization on the resource, allowlist exposed fields, preserve stable errors, and prove one allowed path plus one meaningful rejection.

### Critical

Escalate authentication, sessions, credentials, privilege changes, payments or value movement, secrets or cryptography, destructive operations, multi-tenant isolation, executable uploads, and user-influenced server fetches. Before editing:

1. write a short threat model naming the asset, actors, trust crossings, abuse cases, and controls;
2. define allowed, denied, nonexistent-resource, and cross-owner or cross-tenant behavior where applicable;
3. define rollout, revocation, rollback, or recovery for changed security state and destructive effects;
4. ask for a decision only when materially different public contracts, data categories, privileges, or destructive outcomes cannot be derived from repository evidence.

Read [references/threat-boundaries.md](references/threat-boundaries.md) for the critical threat-model and rejection checklist. Load framework-specific security guidance only when the touched stack and version are established.

## Implement at the real boundary

Reuse the project's authentication, policy, validation, serialization, and error mechanisms. Authentication identifies an actor; it never substitutes for resource authorization. Validate values according to who can influence them, including job payloads and data written by another process. Limit responses to explicitly public fields, avoid leaking existence across authorization boundaries, and keep sensitive values out of logs and errors.

Do not add a security framework, dependency, rate limiter, approval ceremony, or audit scope without evidence that this change needs it. Never weaken a control to simplify the implementation.

## Prove rejection, not just success

Sensitive work must exercise the real public or message boundary for a permitted case and a relevant invalid or unauthorized case. Critical work also proves cross-boundary isolation and recovery appropriate to the change. Report only observed checks. An explicit full-audit request may broaden coverage; automatic activation alone does not.
