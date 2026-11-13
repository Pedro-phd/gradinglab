# Browser and client security

Load for DOM writes, rendered external content, browser storage, navigation, redirects, cross-window messages, service workers, or client-side permission decisions.

- Treat client data as untrusted and non-authoritative for price, permission, ownership, entitlement, or final state.
- Prefer text and framework escaping over raw HTML. When raw HTML is required, use the project's reviewed sanitizer for that exact context.
- Validate `postMessage` origin, source, message shape, and intended recipient.
- Restrict redirects and navigations to allowed schemes and destinations.
- Do not store durable secrets in browser-readable storage. Follow the project's existing session design.
- Preserve CSP and other deployed controls, but do not recommend generic headers without knowing the delivery path.
- Client validation improves UX; server or trusted-boundary validation enforces security.

Verify the rendered or message boundary with an allowed case and a hostile input. Never claim the UI alone protects a server-side action.