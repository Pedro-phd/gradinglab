# Dependencies and supply chain

Load for package additions, lockfile changes, registries, install scripts, build plugins, CI actions, generated artifacts, signing, or releases.

- Prefer existing code, standard library, platform features, and already installed packages before adding a dependency.
- Verify the package name, source, resolved version, license, maintenance signal, and actual need.
- Update the canonical lockfile with the project's package manager; do not mix managers or bypass integrity checks.
- Treat install/build scripts as code execution. Never run an external installer silently or with ambient secrets.
- Pin CI actions and release inputs according to the project's existing policy.
- Keep generated release contents allowlisted and reproducible when the project already provides that contract.
- A known vulnerable version matters only when the affected component and reachable behavior apply to this project; record uncertainty instead of inventing exposure.

The optional Trail of Bits plugin is not a dependency of this module. Installation always requires an explicit user request.