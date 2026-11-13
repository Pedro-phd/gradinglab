# Evidence and findings

This reference adapts source-first evidence principles from Cloudflare's `security-audit-skill` at commit `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` under MIT. It is reduced to the daily task boundary; it does not include the upstream full-audit pipeline.

## Require a boundary and result

A confirmed problem needs all of these:

- lower-trust actor, input, or missing configuration;
- intended security control;
- propagation to a concrete decision point or sink;
- affected principal, resource, data, money, or capability;
- observed or source-proven result;
- repository-relative `file:line` evidence.

Do not promote checklist deviations, guessed deployment behavior, self-impact, or missing defense in depth when another control blocks the path.

## Three outcomes

- **Confirmed:** boundary, sink, conditions, and impact are established. Severity may be assigned.
- **Needs validation:** source supports a precise hypothesis but one named external or runtime fact is unavailable. Do not assign severity.
- **Rejected:** a control, unreachable path, fail-closed behavior, or absent sink disproves the candidate. Keep the short reason when it helps explain the decision.

## Severity follows demonstrated impact

Critical means unauthenticated takeover, arbitrary account compromise, code execution, or broad datastore access. High means complete defeat of an explicit control with real consequences, such as auth bypass or cross-tenant read/write. Medium is a real but bounded violation. Low is minimal-impact disclosure or constrained effect. If concrete damage cannot be stated, lower the classification or leave it unconfirmed.

## Fix the last trusted decision

Recommend the smallest existing-source change that restores the invariant at the last trusted boundary. Prefer a focused regression check over a new framework, scanner, policy layer, or generic hardening list.

Daily task output stays short: outcome, path to sink, impact, fix, and exact verification. Full findings artifacts require an explicit audit request.