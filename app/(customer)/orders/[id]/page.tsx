import {
  ArrowLeft,
  CalendarClock,
  CreditCard,
  Headphones,
  MapPin,
  Package,
  ReceiptText,
  ShieldCheck,
  UserRound,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  AppointmentStatusBadge,
  InstallationTimeline,
  OrderStatusBadge,
  OrderStatusTimeline,
  PaymentStatusBadge,
  orderStatusPresentation,
  paymentMethodLabels,
} from '@/components/commerce/order-status';
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

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const order = await getOrder(await requirePageActor(), (await params).id);
  if (!order) notFound();

  const status = orderStatusPresentation[order.status];

  return (
    <main>
      <section className="border-b bg-[var(--surface)] py-8 sm:py-10">
        <Container className="max-w-6xl">
          <Breadcrumb
            items={[
              { href: '/', label: 'Trang chủ' },
              { href: '/orders', label: 'Đơn hàng' },
              { label: order.orderNumber },
            ]}
          />
          <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Link
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline"
                href="/orders"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                Quay lại lịch sử đơn hàng
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl leading-tight font-bold break-all sm:text-3xl">
                  {order.orderNumber}
                </h1>
                <OrderStatusBadge status={order.status} />
              </div>
              <p className="mt-3 max-w-2xl text-[var(--muted-foreground)]">
                {status.description}
              </p>
            </div>
            <div className="shrink-0 rounded-lg border bg-[var(--surface-subtle)] px-4 py-3 sm:text-right">
              <p className="text-xs text-[var(--muted)]">Tổng thanh toán</p>
              <p className="mt-1 text-xl font-bold">
                {formatVnd(order.grandTotal)}
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-8 sm:py-10">
        <Container className="max-w-6xl">
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)] lg:items-start">
            <div className="grid min-w-0 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                      <ReceiptText aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <h2 className="font-bold">Tiến độ đơn hàng</h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Trạng thái theo quy trình xử lý hiện tại
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <OrderStatusTimeline status={order.status} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                      <Package aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <h2 className="font-bold">Sản phẩm trong đơn</h2>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Giá trị được lưu tại thời điểm đặt hàng
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {order.items.map((item) => (
                      <article
                        className="grid min-w-0 gap-4 p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                        data-testid="order-product-item"
                        key={item.id}
                      >
                        <span className="grid size-12 place-items-center rounded-md bg-[var(--surface-subtle)] text-[var(--primary)]">
                          <Package aria-hidden="true" className="size-6" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-semibold">{item.productName}</h3>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {item.variantName} · Số lượng {item.quantity}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-xs text-[var(--muted)]">
                            Thành tiền
                          </p>
                          <p className="mt-1 font-bold">
                            {formatVnd(item.lineTotal)}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card id="installation">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                        <Wrench aria-hidden="true" className="size-5" />
                      </span>
                      <div>
                        <h2 className="font-bold">Theo dõi lắp đặt</h2>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          Tiến độ từ hệ thống vận hành 247 Home
                        </p>
                      </div>
                    </div>
                    {order.appointment ? (
                      <AppointmentStatusBadge
                        status={order.appointment.status}
                      />
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  {order.appointment ? (
                    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)]">
                      <InstallationTimeline status={order.appointment.status} />
                      <dl className="self-start rounded-md border bg-[var(--surface-subtle)] p-4 text-sm">
                        <div>
                          <dt className="flex items-center gap-2 text-[var(--muted)]">
                            <CalendarClock
                              aria-hidden="true"
                              className="size-4"
                            />
                            Khung giờ dự kiến
                          </dt>
                          <dd className="mt-2 font-semibold">
                            {formatServiceDateTime(
                              order.appointment.scheduledStartAt,
                            )}
                          </dd>
                          <dd className="mt-1 text-[var(--muted)]">
                            đến{' '}
                            {formatServiceDateTime(
                              order.appointment.scheduledEndAt,
                            )}
                          </dd>
                        </div>
                        <div className="mt-4 border-t pt-4">
                          <dt className="flex items-center gap-2 text-[var(--muted)]">
                            <UserRound aria-hidden="true" className="size-4" />
                            Kỹ thuật viên
                          </dt>
                          <dd className="mt-2 font-medium">
                            Thông tin kỹ thuật viên sẽ được cập nhật
                          </dd>
                        </div>
                      </dl>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 text-sm text-[var(--muted-foreground)]">
                      <ShieldCheck
                        aria-hidden="true"
                        className="mt-0.5 size-5 shrink-0 text-[var(--primary)]"
                      />
                      <p>Đơn hàng này không có lịch lắp đặt đi kèm.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <aside className="grid gap-6 lg:sticky lg:top-24">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <CreditCard
                      aria-hidden="true"
                      className="size-5 text-[var(--primary)]"
                    />
                    <h2 className="font-bold">Thanh toán</h2>
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-[var(--muted)]">Phương thức</dt>
                      <dd className="text-right font-medium">
                        {order.payment.method
                          ? paymentMethodLabels[order.payment.method]
                          : 'Chưa cập nhật'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t pt-4">
                      <dt className="text-[var(--muted)]">Trạng thái</dt>
                      <dd>
                        {order.payment.status ? (
                          <PaymentStatusBadge status={order.payment.status} />
                        ) : (
                          <Badge>Chưa cập nhật</Badge>
                        )}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 border-t pt-4">
                      <dt className="text-[var(--muted)]">Số tiền</dt>
                      <dd className="text-right font-bold">
                        {order.payment.amount
                          ? formatVnd(order.payment.amount)
                          : formatVnd(order.grandTotal)}
                      </dd>
                    </div>
                    {order.payment.referenceCode ? (
                      <div className="border-t pt-4">
                        <dt className="text-[var(--muted)]">Mã tham chiếu</dt>
                        <dd className="mt-1 font-mono text-xs break-all">
                          {order.payment.referenceCode}
                        </dd>
                      </div>
                    ) : null}
                    {order.payment.providerTransactionId ? (
                      <div className="border-t pt-4">
                        <dt className="text-[var(--muted)]">
                          Mã giao dịch VNPay
                        </dt>
                        <dd className="mt-1 font-mono text-xs break-all">
                          {order.payment.providerTransactionId}
                        </dd>
                      </div>
                    ) : null}
                    {order.payment.paidAt ? (
                      <div className="flex items-start justify-between gap-4 border-t pt-4">
                        <dt className="text-[var(--muted)]">Xác nhận lúc</dt>
                        <dd className="text-right font-medium">
                          {formatServiceDateTime(order.payment.paidAt)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <MapPin
                      aria-hidden="true"
                      className="size-5 text-[var(--primary)]"
                    />
                    <h2 className="font-bold">Địa chỉ giao và lắp đặt</h2>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-[var(--muted-foreground)]">
                    Chi tiết địa chỉ được bảo vệ và chưa có trong dữ liệu hiển
                    thị của đơn hàng.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Headphones
                      aria-hidden="true"
                      className="size-5 text-[var(--primary)]"
                    />
                    <h2 className="font-bold">Hỗ trợ đơn hàng</h2>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {order.appointment ? (
                    <Link
                      className={buttonVariants({ intent: 'primary' })}
                      href="#installation"
                    >
                      Xem tiến độ lắp đặt
                    </Link>
                  ) : null}
                  <Link
                    className={buttonVariants({ intent: 'secondary' })}
                    href="/#support"
                  >
                    Liên hệ hỗ trợ
                  </Link>
                </CardContent>
              </Card>
            </aside>
          </div>
        </Container>
      </section>
    </main>
  );
}
