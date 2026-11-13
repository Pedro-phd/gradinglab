---
name: backend-jobs-webhooks
description: Specialist for jobs, workers, schedules, events, webhooks, callbacks, redelivery, retries, and asynchronous external effects.
---

# Backend Jobs and Webhooks

Use when the touched behavior already includes or explicitly requires a job, worker, schedule, event producer or consumer, webhook, callback, redelivery, or asynchronous retry. Load it after `backend-core`; external ingress and sensitive effects also activate the `sec` module (see `.harness/ROUTER.md`).

Do not introduce a queue merely because work could be asynchronous. Outbox, inbox, saga, compensation, and retry loops are coordination options for demonstrated failure modes, never baseline architecture.

## Establish the delivery contract

Before editing, trace producer to final effect and answer:

1. What identifies one logical delivery, and which actor assigns that identity?
2. Can delivery be duplicated, reordered, concurrent, delayed, or redelivered after acknowledgement?
3. At which durable boundary is receipt or intent recorded, and what does acknowledgement promise?
4. Which effects are locally transactional, which are remote, and what state is observable after a timeout?
5. What are the retryable, terminal, and poison-message outcomes?

For signed webhooks, read [references/webhooks.md](references/webhooks.md). For retries, leases, unknown outcomes, dead letters, or reprocessing, read [references/delivery-recovery.md](references/delivery-recovery.md).

## Protect one logical effect

Verify signatures over the provider-defined raw bytes before parsing, enforce the documented freshness or replay rule, and reject invalid delivery before business effects. Persist receipt before acknowledgement when the provider contract and loss tolerance require it.

Put deduplication or an idempotency claim in the same local transaction as the protected state change. A check performed before that transaction races with concurrent delivery. If order matters, name the ordering key and serialize or version only that key; do not globally serialize unrelated work.

Keep remote calls outside database transactions unless an established coordination protocol proves why they must be coupled. A timeout after a remote request is an unknown result, not proof of failure. Reconcile by provider status or retry with the same provider-supported idempotency key; without either boundary, automatic retry is unsafe.

## Bound recovery

Retry only transient classes whose repeated operation is safe. Set a finite attempt or time budget, backoff with jitter, and honor provider guidance where applicable. Use a dead-letter path only when the existing system needs retained terminal failures and has an owner, alert, and reprocessing procedure. Leases need expiry and heartbeat behavior that cannot make two workers silently own the same effect.

Correlate delivery ID, logical operation ID, attempt, and downstream request ID in telemetry without payload secrets. Reprocessing must use the same deduplication and authorization boundaries as first delivery.

## Verify delivery behavior

Exercise the real handler or consumer for normal delivery and a duplicate. Where remote effects exist, prove the known failure and unknown-timeout paths. Exercise terminal handling or lease recovery only when part of the changed contract. Report evidence from the actual boundary, not only a helper function.
