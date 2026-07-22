import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  PackageCheck,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Container } from '@/components/layout/container';
import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getOrder } from '@/modules/commerce';
import { requirePageActor } from '@/shared/auth/server';
import { formatServiceDateTime } from '@/shared/date/service-time';
import { formatVnd } from '@/shared/money/format-vnd';

export const dynamic = 'force-dynamic';

const orderStatusLabels: Record<string, string> = {
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  READY_FOR_INSTALLATION: 'Sẵn sàng lắp đặt',
};

const paymentMethodLabels: Record<string, string> = {
  BANK_TRANSFER: 'Chuyển khoản thủ công',
  COD: 'Thanh toán COD',
  VNPAY: 'Thanh toán trực tuyến VNPay',
};

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const order = await getOrder(await requirePageActor(), (await params).id);
  if (!order) notFound();

  const orderStatus = orderStatusLabels[order.status] ?? order.status;
  const paymentMethod = order.payment.method
    ? (paymentMethodLabels[order.payment.method] ?? order.payment.method)
    : 'Chưa xác định';

  return (
    <main>
      <section className="border-b bg-[var(--surface)] py-8 sm:py-10">
        <Container className="max-w-5xl">
          <Breadcrumb
            items={[
              { href: '/', label: 'Trang chủ' },
              { href: '/orders', label: 'Đơn hàng' },
              { label: 'Xác nhận' },
            ]}
          />
          <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-[var(--success-soft)] text-[var(--success)]">
              <CheckCircle2 aria-hidden="true" className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--success)]">
                Đặt hàng thành công
              </p>
              <h1 className="mt-2 text-3xl font-bold break-all sm:text-4xl">
                {order.orderNumber}
              </h1>
              <p className="mt-3 max-w-2xl text-[var(--muted)]">
                Đơn hàng đã được ghi nhận. Bạn có thể theo dõi trạng thái và
                lịch lắp đặt trong trang chi tiết đơn hàng.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="info">{orderStatus}</Badge>
                <Badge>{paymentMethod}</Badge>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section
        aria-label="Chi tiết xác nhận đơn hàng"
        className="py-8 sm:py-10"
      >
        <Container className="max-w-5xl">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <PackageCheck
                      aria-hidden="true"
                      className="size-5 text-[var(--primary)]"
                    />
                    <h2 className="font-bold">Sản phẩm trong đơn</h2>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {order.items.map((item) => (
                      <li
                        className="flex flex-col justify-between gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row"
                        key={item.id}
                      >
                        <div>
                          <p className="font-semibold">{item.productName}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {item.variantName} · Số lượng {item.quantity}
                          </p>
                        </div>
                        <p className="shrink-0 font-semibold">
                          {formatVnd(item.lineTotal)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CalendarCheck
                      aria-hidden="true"
                      className="size-5 text-[var(--primary)]"
                    />
                    <h2 className="font-bold">Thông tin lắp đặt</h2>
                  </div>
                </CardHeader>
                <CardContent>
                  {order.appointment ? (
                    <dl className="grid gap-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-[var(--muted)]">Trạng thái</dt>
                        <dd className="mt-1 font-semibold">
                          {order.appointment.status}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--muted)]">Khung giờ</dt>
                        <dd className="mt-1 font-semibold">
                          {formatServiceDateTime(
                            order.appointment.scheduledStartAt,
                          )}
                          {' – '}
                          {formatServiceDateTime(
                            order.appointment.scheduledEndAt,
                          )}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      Đơn hàng này không có lịch lắp đặt.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6 lg:sticky lg:top-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CircleDollarSign
                      aria-hidden="true"
                      className="size-5 text-[var(--primary)]"
                    />
                    <h2 className="font-bold">Thanh toán</h2>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[var(--muted)]">Phương thức</p>
                  <p className="mt-1 font-semibold">{paymentMethod}</p>
                  <p className="mt-4 text-sm text-[var(--muted)]">Tổng cộng</p>
                  <p className="mt-1 text-xl font-bold text-[var(--primary)]">
                    {formatVnd(order.grandTotal)}
                  </p>
                  {order.payment.referenceCode ? (
                    <div className="mt-4 rounded-md bg-[var(--surface-subtle)] p-3 text-sm">
                      <p className="text-[var(--muted)]">Mã tham chiếu</p>
                      <p className="mt-1 font-semibold break-all">
                        {order.payment.referenceCode}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <h2 className="font-bold">Bước tiếp theo</h2>
                  <ol className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
                    <li>1. 247 Home xác nhận đơn và tình trạng thanh toán.</li>
                    <li>2. Đội ngũ chuẩn bị thiết bị và lịch phục vụ.</li>
                    <li>3. Theo dõi cập nhật trong chi tiết đơn hàng.</li>
                  </ol>
                  <Link
                    className={buttonVariants({ className: 'mt-5 w-full' })}
                    href={`/orders/${order.id}`}
                  >
                    Xem đơn hàng
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                  <Link
                    className={buttonVariants({
                      className: 'mt-3 w-full',
                      intent: 'secondary',
                    })}
                    href="/products"
                  >
                    Tiếp tục mua sắm
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
