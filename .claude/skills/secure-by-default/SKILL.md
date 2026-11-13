---
name: secure-by-default
description: Automatic, task-scoped security guidance for changes to executable code, configuration, dependencies, permissions, data flows, browser behavior, files, network calls, processes, secrets, or cryptography. Excludes documentation-only edits and never starts a broad audit by itself.
---

# Secure by Default

Use for every task that changes executable code, runtime configuration, dependencies, permissions, or data flow. Do not activate for documentation-only edits. Inspect only the changed behavior, its direct consumers, and reachable security decisions; never turn routine work into a repository-wide audit.

## Daily loop

1. Identify changed values, who controls them, and which resource or capability they can affect.
2. Trace untrusted or missing values through direct propagation to a real decision point.
3. Preserve existing controls and apply the smallest source fix at the last trusted boundary.
4. Exercise the changed outcome. Add a relevant rejected case when the change crosses a trust boundary.
5. Report only observed checks. Never call a missing best practice a vulnerability without a reachable result.

Read only the references matching the touched surface:

- configuration, credentials, permissive switches, crypto or debug defaults: [references/insecure-defaults.md](references/insecure-defaults.md)
- finding confidence, impact or remediation language: [references/evidence-and-findings.md](references/evidence-and-findings.md)
- identity, sessions, ownership, tenants or privileges: [references/auth-sessions-permissions.md](references/auth-sessions-permissions.md)
- external input, output encoding, queries, parsers or injection sinks: [references/input-output-injection.md](references/input-output-injection.md)
- DOM, browser storage, navigation or cross-window messages: [references/browser-client.md](references/browser-client.md)
- secrets, tokens, keys, signatures or cryptographic operations: [references/secrets-crypto.md](references/secrets-crypto.md)
- paths, uploads, outbound requests or process execution: [references/files-network-processes.md](references/files-network-processes.md)
- packages, lockfiles, registries, build scripts or releases: [references/dependencies-supply-chain.md](references/dependencies-supply-chain.md)

## Escalate proportionally

Combine this module with `backend-security` for new or changed backend endpoints, exposed or modified data, authorization, tenant boundaries, integrations, webhooks, uploads, PII, credentials, payments, destructive actions, or user-influenced server fetches. Neither module replaces the other.

Treat authentication, sessions, tenant isolation, privilege changes, payments, secrets, cryptography, executable uploads, destructive actions, and user-influenced server fetches as critical. A request such as “make this especially secure” also selects the critical workflow:

1. inspect repository facts first;
2. use `grilling` when available to resolve only material decisions, one question at a time;
3. use `tlc-spec-driven` when available so decisions become requirement IDs, observable acceptance criteria, atomic tasks, and independent verification;
4. if either host skill is unavailable, apply the same minimum contract locally without installing anything;
5. before completion, use a disposable mutation to prove the focused tests detect removal of the highest-risk control.

## Fail closed

Missing or invalid security-critical configuration must stop startup, deny the operation, or keep the control enabled. A permissive fallback is a defect only when it reaches an enforcement decision. Prove the path; do not judge from the variable name alone.

## Optional focused audit

The Trail of Bits `insecure-defaults` plugin is optional and explicit. Use it only when the user asks to audit defaults in a path and the plugin is already installed. Never install or invoke it during ordinary tasks. If unavailable, state that directly; do not claim its audit ran.

Do not start a full security audit, launch audit agents, install scanners, probe production, or execute a potentially hostile target without reliable isolation. Broad audit work requires a separate explicit request.