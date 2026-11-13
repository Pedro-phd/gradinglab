# Input, output, and injection

Load when changed values can reach a query, template, HTML, command, path, URL, parser, serializer, header, redirect, or log.

1. Identify who controls the value at the current boundary. Internal transport does not make externally sourced data trusted.
2. Trace it to the concrete sink; do not flag unused or safely transformed values.
3. Prefer the project's typed validation, parameterized APIs, contextual encoding, and structured command/process interfaces.
4. Validate shape, size, allowed values, and relationships at the first trusted boundary that owns the contract.
5. Encode for the final output context. One sanitizer is not universal across HTML, attributes, URLs, JavaScript, SQL, and shell.
6. Keep errors stable and omit secrets, internal queries, stack traces, paths, and private fields.

Prove one accepted value and the most plausible malicious or malformed value at the real consumer boundary. Do not add a general validation framework for one field.