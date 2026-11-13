# Webhook intake

Load this reference only for inbound webhooks or signed callbacks.

## Intake order

1. Apply a small transport-level body-size limit without transforming the body.
2. Capture the exact bytes covered by the provider signature. Do not parse JSON, normalize whitespace, or re-encode first.
3. Use the provider's maintained verifier and algorithm when available; do not invent cryptography.
4. Validate the signed timestamp or documented freshness field against a bounded replay window. Store or deduplicate the provider event ID when replay remains possible inside that window.
5. Parse and schema-check the authenticated payload, then authorize its account, tenant, or resource mapping.
6. Record receipt or the local effect durably before acknowledging when a successful response tells the provider it may stop delivery.

Return the project's stable public errors without revealing signing material or internal parsing details. Rotate signing material through the provider's overlap procedure when supported; never log headers or payload fields that contain credentials or sensitive data.

## Acknowledgement choice

Synchronous handling can be correct when the local effect is fast, atomic, and safely repeatable. Durable handoff can be correct when provider deadlines are short or processing is long. A queue is not mandatory: select it only when the existing architecture and delivery contract justify the added boundary.

Test a valid delivery, an invalid signature, an expired or replayed delivery, and a duplicate when those cases are part of the provider contract.
