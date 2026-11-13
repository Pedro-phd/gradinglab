# Authentication, sessions, and permissions

Load for identity, session, ownership, tenant, role, privilege, or protected-resource changes.

- Authentication establishes an actor; authorization decides whether that actor may perform this action on this resource.
- Enforce ownership or tenant scope at the trusted lookup or mutation boundary, not only in UI or routing hints.
- Deny when actor, resource scope, permission, or critical policy input is missing or invalid.
- Preserve the project's session, token, cookie, guard, policy, and error mechanisms; do not create a parallel auth stack.
- Prevent avoidable resource-existence leakage when denied and absent cases cross the same boundary.
- Keep public responses allowlisted. Do not serialize stored records by default.
- Define revocation and stale-grant behavior when changing sessions or privileges.

Verification should exercise the real boundary. Use the applicable rows: permitted actor, unauthenticated actor, authenticated but unauthorized actor, absent resource, other owner or tenant, revoked state. A helper-only test does not prove that routing and serialization enforce the decision.