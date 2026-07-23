import { getVnpayConfig } from '@/modules/payment';

const environment = process.env.VNPAY_ENVIRONMENT;
if (!['staging', 'production'].includes(environment ?? ''))
  throw new Error('VNPAY_ENVIRONMENT must be staging or production.');

const config = getVnpayConfig();
const queryUrl = new URL(
  process.env.VNPAY_QUERY_URL ??
    'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
);
const paymentUrl = new URL(config.paymentUrl);
const returnUrl = new URL(config.returnUrl);

for (const [name, url] of [
  ['VNPAY_PAYMENT_URL', paymentUrl],
  ['VNPAY_QUERY_URL', queryUrl],
  ['VNPAY_RETURN_URL', returnUrl],
] as const) {
  if (url.protocol !== 'https:') throw new Error(`${name} must use HTTPS.`);
}
if (environment === 'staging') {
  if (
    !paymentUrl.hostname.startsWith('sandbox.') ||
    !queryUrl.hostname.startsWith('sandbox.')
  )
    throw new Error('Staging must use VNPay sandbox endpoints.');
} else if (
  paymentUrl.hostname.startsWith('sandbox.') ||
  queryUrl.hostname.startsWith('sandbox.')
) {
  throw new Error('Production must not use VNPay sandbox endpoints.');
}
if (
  ['localhost', '127.0.0.1'].includes(returnUrl.hostname) ||
  /example|replace|placeholder/i.test(returnUrl.toString())
)
  throw new Error('VNPAY_RETURN_URL must be a canonical public HTTPS URL.');

console.log(
  JSON.stringify({
    check: 'vnpay-configuration',
    environment,
    paymentHost: paymentUrl.hostname,
    queryHost: queryUrl.hostname,
    returnOrigin: returnUrl.origin,
    status: 'PASS',
  }),
);
