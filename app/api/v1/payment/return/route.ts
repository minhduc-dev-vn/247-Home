import { NextResponse } from 'next/server';

import {
  getCustomerPaymentByProviderReference,
  getVnpayConfig,
  verifyVnpaySignature,
} from '@/modules/payment';
import { getCurrentActor } from '@/shared/auth/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parameters = Object.fromEntries(url.searchParams.entries());
  const baseUrl = new URL(process.env.NEXTAUTH_URL ?? request.url);
  const failure = new URL('/payment/failure', baseUrl);
  const config = getVnpayConfig();
  if (!verifyVnpaySignature(parameters, config.hashSecret))
    return NextResponse.redirect(failure);

  try {
    const payment = await getCustomerPaymentByProviderReference(
      await getCurrentActor(),
      parameters.vnp_TxnRef ?? '',
    );
    const route =
      payment.status === 'PAID'
        ? '/payment/success'
        : payment.status === 'FAILED'
          ? '/payment/failure'
          : '/payment/pending';
    const destination = new URL(route, baseUrl);
    destination.searchParams.set('paymentId', payment.id);
    return NextResponse.redirect(destination);
  } catch {
    return NextResponse.redirect(failure);
  }
}
