import { AlertCircle, CheckCircle2, Clock3 } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { PaymentStatusRefresh } from '@/components/commerce/payment-status-refresh';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatVnd } from '@/shared/money/format-vnd';

type PaymentResultKind = 'failure' | 'pending' | 'success';

const presentation = {
  failure: {
    title: 'Thanh toán chưa thành công',
    description:
      'Giao dịch không được hoàn tất. Đơn hàng vẫn được giữ để bạn theo dõi và xử lý tiếp.',
    icon: AlertCircle,
    color: 'text-[var(--error)] bg-[var(--error-soft)]',
  },
  pending: {
    title: 'Đang xác nhận thanh toán',
    description:
      '247 Home chưa nhận được xác nhận cuối cùng từ VNPay. Vui lòng kiểm tra lại sau ít phút.',
    icon: Clock3,
    color: 'text-[var(--warning)] bg-[var(--warning-soft)]',
  },
  success: {
    title: 'Thanh toán thành công',
    description:
      'VNPay đã xác nhận giao dịch và đơn hàng của bạn đã được cập nhật an toàn.',
    icon: CheckCircle2,
    color: 'text-[var(--success)] bg-[var(--success-soft)]',
  },
} satisfies Record<
  PaymentResultKind,
  {
    color: string;
    description: string;
    icon: typeof CheckCircle2;
    title: string;
  }
>;

export function PaymentResult({
  kind,
  payment,
}: {
  kind: PaymentResultKind;
  payment: {
    amount: string;
    currency: string;
    id: string;
    order: { id: string; orderNumber: string; status: string };
    status: string;
  };
}) {
  const content = presentation[kind];
  const Icon = content.icon;
  return (
    <main className="py-10 sm:py-16">
      <Container className="max-w-2xl">
        <Card>
          <CardContent className="p-6 sm:p-8">
            <div
              className={cn(
                'grid size-12 place-items-center rounded-lg',
                content.color,
              )}
            >
              <Icon aria-hidden="true" className="size-6" />
            </div>
            <h1 className="mt-5 text-2xl font-bold sm:text-3xl">
              {content.title}
            </h1>
            <p className="mt-3 leading-7 text-[var(--muted)]">
              {content.description}
            </p>
            <dl className="mt-6 grid gap-4 border-y py-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--muted)]">Đơn hàng</dt>
                <dd className="mt-1 font-semibold">
                  {payment.order.orderNumber}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Số tiền</dt>
                <dd className="mt-1 font-semibold">
                  {formatVnd(payment.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Thanh toán</dt>
                <dd className="mt-1">
                  <Badge>{payment.status}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Trạng thái đơn</dt>
                <dd className="mt-1">
                  <Badge variant="info">{payment.order.status}</Badge>
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              {kind === 'pending' ? (
                <PaymentStatusRefresh paymentId={payment.id} />
              ) : null}
              <Link
                className={buttonVariants({
                  intent: kind === 'pending' ? 'secondary' : 'primary',
                })}
                href={`/orders/${payment.order.id}`}
              >
                Xem đơn hàng
              </Link>
            </div>
          </CardContent>
        </Card>
      </Container>
    </main>
  );
}
