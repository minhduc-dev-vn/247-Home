# ADR-014: VNPay online payment

## Status

Accepted for the online-payment extension. This supersedes only the
"no payment gateway" scope restriction in ADR-013; COD and manual transfer
rules remain valid.

## Decision

Use VNPay API v2.1 through an internal adapter. A verified server IPN is the
only authority that may mark a VNPay payment paid. Browser return values,
client totals, and client transaction identifiers are never authoritative.

Persist payment sessions and an append-only webhook event ledger. Apply
payment, order, session, event, and audit mutations atomically with optimistic
version checks and row locks.

## Consequences

- Merchant onboarding and secret provisioning become release prerequisites.
- Online payment can be hidden when credentials are absent.
- Refund is an explicit future use case and cannot reuse manual status update.
- A second provider must implement the same application boundary rather than
  adding provider rules to checkout or UI.
