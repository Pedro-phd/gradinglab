# Relations and nested writes

Read relations with a narrowly scoped `select` or `include`; filter, order, and limit nested collections where supported. Avoid exposing a complete related model by default.

Nested writes can create, connect, connect-or-create, update, upsert, disconnect, delete, or replace relations atomically when the generated relation API supports the operation. Verify the ownership and uniqueness assumptions before connecting an existing record. A nested write does not automatically authorize every related record named by input.

Use `set` only when replacement of the complete relation set is the intended contract. Deletes and disconnects have different data-retention behavior. Consider referential actions configured in the schema and enforced by the database.

For multi-record invariants not expressible as one nested write, use an appropriate transaction and load the database adapter for isolation/concurrency semantics.