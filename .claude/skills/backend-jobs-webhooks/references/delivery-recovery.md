# Delivery and recovery decisions

Load this reference when a job or event can retry, lose worker ownership, dead-letter, or leave a remote result unknown.

## Classify the outcome

- **Confirmed success:** commit the local completion marker once.
- **Confirmed transient failure:** retry only if the repeated operation is safe.
- **Confirmed terminal failure:** record enough structured context for the owning workflow; dead-letter only if someone will monitor and resolve it.
- **Unknown result:** query remote status, resume by a stable operation ID, or repeat with the same remote idempotency key. Never relabel unknown as failed just to enable a retry.

An attempt counter alone does not make retry safe. The idempotency boundary must cover the irreversible effect, whether that effect is a local state transition or a remote operation supported by the provider.

## Concurrency and leases

Claim work atomically. A lease records an owner and expiry; heartbeat only while the owner is making progress. Completion must verify ownership or use a fencing/version value so a worker that resumes after expiry cannot overwrite its successor. Define what happens when execution outlives the lease and how stalled work becomes eligible again.

Use per-entity ordering only when the domain requires it. Independent entities should remain concurrent. If events carry versions, reject or defer stale transitions explicitly rather than relying on arrival order.

## Retry budget and reprocessing

Choose a finite attempt count or elapsed-time budget from the business deadline and provider behavior. Backoff with jitter to avoid synchronized retries. Reprocessing from retained failure storage is a new delivery of the same logical operation, so it must preserve the original identity, current authorization, deduplication, and observability.

Outbox or inbox coordination is warranted only when a demonstrated atomicity gap spans local persistence and message delivery. Compensation is warranted only when an already-completed effect cannot be atomically rolled back and the domain defines a valid inverse. Document the gap before selecting either pattern.
