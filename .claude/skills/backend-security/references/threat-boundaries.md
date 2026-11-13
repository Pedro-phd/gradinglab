# Threat boundaries and rejection proof

This focused reference adapts threat-boundary ideas from Addy Osmani's `security-and-hardening` skill at commit `be4e44a9fbc5e8df0beaefadbb28bd22ee61cc39`. It intentionally omits the upstream's broad audit workflow, framework recipes, fixed numeric prescriptions, and universal approval rules.

Load this file for critical work or when a sensitive boundary is unclear.

## Write the small threat model

Keep it beside the task evidence, not as generic ceremony:

- **Asset:** data, capability, money, credential, or tenant boundary that could be harmed.
- **Actors:** legitimate identities, services, operators, and plausible unauthenticated or compromised callers.
- **Trust crossings:** every place a value moves between independently controlled actors or processes. HTTP, callbacks, jobs, files, environment values, third-party output, and database rows can all be untrusted depending on who wrote them.
- **Abuse cases:** impersonation, tampering, denial, disclosure, replay, privilege gain, and destructive misuse that are credible for this exact flow.
- **Controls and residual risk:** the existing control or smallest new control at each crossing, plus anything the change cannot eliminate.

Channel is not trust. A value delivered by a worker, operating system, internal service, or persisted record still needs validation when another actor can influence its origin.

## Rejection matrix

Choose only rows that apply, but make each chosen result observable:

| Case | Prove |
| --- | --- |
| permitted actor | intended result and public response contract |
| malformed or disallowed input | boundary rejects before protected state changes |
| authenticated but unauthorized actor | no protected action or sensitive field exposure |
| resource absent | stable response without avoidable existence leakage |
| other owner or tenant | isolation holds across lookup, mutation, and side effects |
| replay or duplicate | effect is not repeated when the delivery contract allows duplicates |
| recovery | revoked or rolled-back state cannot retain the protected capability |

Test through the real endpoint, consumer, or integration boundary. Unit tests of a policy helper alone do not prove routing, serialization, or enforcement.

## Recovery questions

For credentials and sessions, define revocation and rotation. For privilege or tenant-policy changes, define safe rollout and how stale grants are removed. For value movement, define reconciliation and the response to an unknown result. For destructive work, define restore or roll-forward before executing it. Recovery must match the actual system; do not invent queues, snapshots, or compensating workflows by default.
