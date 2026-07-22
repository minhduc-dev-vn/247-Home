import { notFound } from 'next/navigation';

import { PaymentResult } from '@/components/commerce/payment-result';
import { getCustomerPayment } from '@/modules/payment';
import { requirePageActor } from '@/shared/auth/server';

export const dynamic = 'force-dynamic';

export default async function PaymentFailurePage({
  searchParams,
}: {
  searchParams: Promise<{ paymentId?: string }>;
}) {
  const paymentId = (await searchParams).paymentId;
  if (!paymentId) notFound();
  const payment = await getCustomerPayment(await requirePageActor(), paymentId);
  if (payment.status === 'PAID')
    return <PaymentResult kind="success" payment={payment} />;
  return <PaymentResult kind="failure" payment={payment} />;
}
