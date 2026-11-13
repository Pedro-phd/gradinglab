# Redis data structures and keys

Choose by access pattern, not the superficial shape of the data.

| Need | Candidate | Key property |
| --- | --- | --- |
| scalar, counter, lock token | String | atomic single-value commands |
| independently updated fields | Hash | field reads/writes without whole-object rewrite |
| end-oriented queue or recent items | List | push/pop at ends |
| membership and set algebra | Set | unique members |
| ranking or score range | Sorted Set | score-ordered access |
| nested document | JSON capability | path operations; requires the deployed JSON capability |
| durable event log/consumer groups | Stream | requires Redis 5.0+ and an explicit delivery/recovery contract |
| vector similarity | Vector Set | requires a compatible Redis 8 deployment |

Do not serialize a flat object into a String when callers frequently update one field; a Hash may avoid read/parse/rewrite races. Conversely, do not choose Hash/JSON if the object is always replaced atomically and no field operations are needed.

Use the service's established key scheme. Otherwise define lowercase colon-separated segments such as `{service}:{tenant}:{entity}:{id}:{purpose}`. Include tenant/owner where isolation requires it, keep keys short enough for memory efficiency, avoid raw secrets or personal data, and define whether Cluster hash tags intentionally colocate multi-key operations. Never use broad production `KEYS` scans for application discovery.