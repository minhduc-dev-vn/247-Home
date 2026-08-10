# Payment Gateway Decision

## Decision

247 Home will use **VNPay API v2.1 as the first online payment gateway**.
COD and manual bank transfer remain available under their existing policies.

## Evaluation

Scores are 1 (weak) to 5 (strong) for the current Vietnam-first product. Fees
and commercial eligibility must be reconfirmed during merchant onboarding;
they are not hardcoded into application logic.

| Gateway | Vietnam fit | Integration/API | Security docs | MVP operations | International scale | Total / 25 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| VNPay | 5 | 4 | 5 | 4 | 2 | **20** |
| MoMo | 5 | 4 | 4 | 4 | 1 | 18 |
| ZaloPay | 5 | 4 | 4 | 3 | 1 | 17 |
| VietQR/payment link | 5 | 3 | 3 | 4 | 1 | 16 |
| Stripe | 2 | 5 | 5 | 4 | 5 | 21 |
| PayPal | 2 | 4 | 5 | 3 | 5 | 19 |

Stripe scores highly as a platform, but VNPay is selected because local card,
bank, and QR expectations plus Vietnam merchant operations are the decisive
requirements for 247 Home's first market. Stripe or PayPal can later implement
the same payment-port contract without changing order ownership.

## Why VNPay

- Official API v2.1 documents a hosted payment URL, HMAC-SHA512 signature,
  return flow, and server IPN contract.
- Hosted payment avoids card data entering 247 Home systems.
- `vnp_TxnRef`, signed amount, provider transaction id, and response/status
  codes map cleanly to the current order/payment aggregate.
- No runtime SDK is needed; Node's audited `crypto` primitive is sufficient.

Official protocol references:

- [VNPay payment API](https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html)
- [VNPay HMAC-SHA512 migration](https://sandbox.vnpayment.vn/apis/docs/chuyen-doi-thuat-toan/changeTypeHash.html)
- [VNPay query and refund](https://sandbox.vnpayment.vn/apis/docs/truy-van-hoan-tien/querydr%26refund.html)
- [Stripe webhook verification](https://docs.stripe.com/webhooks)
- [PayPal webhook verification](https://developer.paypal.com/api/rest/webhooks/)

## Operational contract

- Sandbox and production use separate merchant code, hash secret, URLs, and
  provider configuration.
- IPN is authoritative. Browser return is presentation only.
- Merchant secrets live in the deployment secret manager.
- Provider reconciliation must alert on pending transactions older than the
  session window.
- Refund remains disabled until a human-approved authorization and accounting
  policy exists.

## Rejected alternatives

MoMo and ZaloPay are reasonable second adapters but do not justify parallel
gateway complexity now. VietQR alone does not provide the desired general
hosted gateway lifecycle. Stripe and PayPal are reserved for international
expansion.
