# Insecure defaults

This is an original, task-scoped treatment inspired by Trail of Bits `plugins/insecure-defaults` at commit `027bc47a69a276c340717bafdc3708263094b9a4`. The upstream corpus is CC BY-SA 4.0 and is not copied or redistributed here.

Load this reference when changed code reads configuration or introduces credentials, access switches, cryptography, permissions, CORS, or debug behavior.

## What to inspect

- fallback secrets or signing keys;
- usable default credentials;
- absent configuration that disables authentication, authorization, validation, or verification;
- weak cryptography used for a security property;
- public access, broad origins, writable modes, or privileges selected by default;
- debug output, stack traces, internal paths, or sensitive context exposed by default.

## Trace before judging

For every candidate, record:

```text
configuration or literal → normalization → branch/policy → security decision → result
```

A suspicious value with no reachable security decision is rejected, not reported.

Classify the source:

- **Configurable:** a lookup has a fallback. Evaluate the path when configuration is absent or invalid. A startup error or explicit denial is fail-closed; continued operation with the control disabled is fail-open.
- **Unconditional:** an insecure value is hardcoded and no supported configuration replaces it. Deployment configuration cannot refute what the application never reads.

Then check deployment evidence in the repository. A manifest that always supplies a safe value can reduce reachability for a configurable candidate. Missing deployment evidence does not prove either state; mark the exact fact as needing validation.

## Preferred behavior

- Critical configuration is required and parsed strictly.
- Invalid values are rejected rather than coerced to a permissive state.
- Development conveniences require an explicit development mode and cannot silently reach production.
- Secrets have no usable source fallback and never enter logs or errors.
- Public access and broad origins require an explicit contract.
- Security-sensitive cryptography uses an existing, reviewed primitive for the actual property required.

The optional Trail of Bits plugin may run a broader audit only when the user requests it explicitly. Never install or invoke it as part of this daily check.