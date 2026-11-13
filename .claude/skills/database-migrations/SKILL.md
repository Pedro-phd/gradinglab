---
name: database-migrations
description: Coordinates safe schema and data changes through compatible rollout, bounded backfill, parity validation, cutover, contract, and explicit recovery.
---

# Database Migrations

Use for schema, index, constraint, type, rename, backfill, data transformation, or persistence-engine changes. Load after `backend-core`; also load the adapter for the database actually touched. This module owns rollout coordination, while MySQL or Postgres owns dialect-specific DDL, locks, isolation, and version behavior.

Never compress an online change into a destructive one-step migration. Never copy an entire production table, rewrite every row in the deploy path, or drop the old representation before compatibility and parity are proven.

## Plan the lifecycle

1. **Expand:** add a representation that old and new application versions can safely coexist with. Prefer additive schema changes and preserve the old read/write path.
2. **Compatible deploy:** deploy application code that tolerates both representations. Define how new writes keep them consistent and how mixed-version readers behave.
3. **Bounded backfill:** process deterministic, finite batches outside the deploy transaction. Record a durable cursor or equivalent progress, make reruns safe, cap load, and define pause/resume behavior.
4. **Validate parity:** compare counts plus domain-relevant aggregates or sampled/full row equivalence. Define an acceptable threshold and investigate mismatches instead of hiding them.
5. **Cut over:** switch reads or authority only after compatibility and parity gates pass. Observe errors, latency, lag, and business invariants during a stated window.
6. **Contract:** remove the old path or data only after every coexisting application version no longer needs it and the destructive step receives explicit human approval.

For a concrete review checklist, read [references/rollout-checklist.md](references/rollout-checklist.md).

## Recovery is phase-specific

Name a recovery action and stop condition for every phase. Schema expansion may be reversible while transformed or deleted business data is not. Do not claim every migration can roll back: preserve source data until cutover when possible, otherwise define a tested roll-forward, restore, or reconciliation procedure.

Before drops, truncation, narrowing conversions, irreversible rewrites, or retention changes, state the information-loss boundary and obtain human approval. Confirm backups are usable rather than merely configured when restore is part of recovery.

## Verify the transition

Inspect generated SQL and use the detected database adapter to classify locks, transactional DDL, online-build capabilities, and privilege/version requirements. Exercise coexistence, restart a partial backfill, validate parity, and test the phase-appropriate recovery in a safe representative environment. Report actual evidence and unresolved operational assumptions.