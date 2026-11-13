# Files, network, and processes

Load for user-influenced paths, uploads, archives, outbound requests, redirects, subprocesses, templates, or executable content.

- Resolve paths against an allowed root, reject traversal after normalization, and avoid following attacker-controlled links.
- Bound upload size and accepted type using content evidence appropriate to the application; store outside executable/public roots unless explicitly required.
- Treat archive members as paths: reject absolute paths, parent traversal, links, devices, and expansion beyond limits.
- For outbound requests, constrain schemes and destinations, re-check redirects, and account for internal/private targets when the user controls any part of the URL.
- Prefer argv-based process APIs. Do not interpolate untrusted data into a shell command.
- Bound time, output, memory, and process count for parsers or tools processing untrusted content.

Do not execute a potentially hostile repository, build, fixture, document, or binary unless the environment proves appropriate isolation. Without it, use static evidence and return the exact validation blocker.