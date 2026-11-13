# Secrets and cryptography

Load for credentials, API keys, tokens, signatures, encryption, hashing, randomness, or key lifecycle.

- Never add a usable secret, development key, or credential fallback to source.
- Require security-critical secrets at startup or deny the protected operation when the architecture loads them lazily.
- Keep secret values out of logs, errors, fixtures, snapshots, command lines, URLs, and client bundles.
- Reuse the project's secret provider and rotation path.
- Use reviewed platform or installed-library primitives; do not design custom cryptography.
- Choose the primitive from the property needed: password hashing, integrity, authenticity, confidentiality, or random identifiers are different jobs.
- Compare authenticators using the established constant-time API when applicable.
- Verify signatures over the provider-defined bytes before parsing or normalization when the protocol requires it.
- Define revocation, rotation, or recovery when the change alters credential validity.

A version or algorithm name alone is not a finding. Trace how the primitive protects a real asset and which attacker controls its inputs.