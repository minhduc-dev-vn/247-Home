import { OrderStatus } from '@prisma/client';
import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  Package,
  PackageSearch,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';

import {
  AppointmentStatusBadge,
  OrderStatusBadge,
  PaymentStatusBadge,
  orderStatusPresentation,
} from '@/components/commerce/order-status';
import { Container } from '@/components/layout/container';
import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { Pagination } from '@/components/navigation/pagination';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { listOrders, orderListQuerySchema } from '@/modules/commerce';
import { requirePageActor } from '@/shared/auth/server';
import { formatVnd } from '@/shared/money/format-vnd';

export const dynamic = 'force-dynamic';

const pageSize = 6;

function optionalValue(value: string | string[] | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseStatus(value: string | undefined): OrderStatus | undefined {
  return Object.values(OrderStatus).find((status) => status === value);
}

function ordersHref({
  cursor,
  status,
}: {
  cursor?: string | null;
  status?: OrderStatus;
}) {
  const query = new URLSearchParams();
  if (cursor) query.set('cursor', cursor);
  if (status) query.set('status', status);
  const suffix = query.toString();
  return suffix ? `/orders?${suffix}` : '/orders';
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const cursor = optionalValue(raw.cursor);
  const status = parseStatus(optionalValue(raw.status));
  const parsedQuery = orderListQuerySchema.safeParse({
    cursor,
    limit: pageSize,
  });
  const query = parsedQuery.success
    ? parsedQuery.data
    : orderListQuerySchema.parse({ limit: pageSize });
  const result = await listOrders(await requirePageActor(), query);
  const visibleOrders = status
    ? result.items.filter((order) => order.status === status)
    : result.items;

  return (
    <main>
      <section className="border-b bg-[var(--surface)] py-8 sm:py-10">
        <Container>
          <Breadcrumb
            items={[{ href: '/', label: 'Trang chủ' }, { label: 'Đơn hàng' }]}
          />
          <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-bold text-[var(--primary)]">
                Tài khoản khách hàng
              </p>
              <h1 className="mt-2 text-3xl leading-tight font-bold sm:text-4xl">
                Đơn hàng của tôi
              </h1>
              <p className="mt-3 max-w-2xl leading-7 text-[var(--muted-foreground)]">
                Theo dõi thiết bị, thanh toán và tiến độ lắp đặt trong cùng một
                nơi.
              </p>
            </div>
            <Link
              className={buttonVariants({ intent: 'secondary' })}
              href="/products"
            >
              Tiếp tục mua sắm
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </Container>
      </section>

      <section className="py-8 sm:py-10" aria-labelledby="order-list-title">
        <Container className="max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <aside className="self-start lg:sticky lg:top-24">
              <div className="rounded-lg border bg-[var(--surface)] p-4">
                <form action="/orders" method="get">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal
                      aria-hidden="true"
                      className="size-4 text-[var(--primary)]"
                    />
                    <h2 className="font-semibold">Lọc đơn hàng</h2>
                  </div>
                  <label
                    className="mt-4 block text-sm font-medium"
                    htmlFor="order-status"
                  >
                    Trạng thái
                  </label>
                  <Select
                    className="mt-2"
                    defaultValue={status ?? ''}
                    id="order-status"
                    key={status ?? 'all-statuses'}
                    name="status"
                  >
                    <option value="">Tất cả trạng thái</option>
                    {Object.values(OrderStatus).map((value) => (
                      <option key={value} value={value}>
                        {orderStatusPresentation[value].label}
                      </option>
                    ))}
                  </Select>
                  <button
                    className={buttonVariants({
                      className: 'mt-3 w-full',
                      intent: 'primary',
                      size: 'sm',
                    })}
                    type="submit"
                  >
                    Áp dụng
                  </button>
                </form>
                {status ? (
                  <form action="/orders" method="get">
                    <button
                      className="mt-3 w-full text-center text-sm font-semibold text-[var(--primary)] hover:underline"
                      type="submit"
                    >
                      Xóa bộ lọc
                    </button>
                  </form>
                ) : null}
                <p className="mt-4 border-t pt-3 text-xs leading-5 text-[var(--muted)]">
                  Bộ lọc áp dụng cho các đơn trên trang hiện tại.
                </p>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="flex flex-col gap-2 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold" id="order-list-title">
                    {status
                      ? orderStatusPresentation[status].label
                      : 'Tất cả đơn hàng'}
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]" role="status">
                    {visibleOrders.length} đơn phù hợp trên trang này
                  </p>
                </div>
                {cursor ? <Badge variant="info">Trang tiếp theo</Badge> : null}
              </div>

              {visibleOrders.length ? (
                <div
                  className="mt-6 grid gap-4"
                  aria-label="Danh sách đơn hàng"
                >
                  {visibleOrders.map((order) => (
                    <Card data-testid="customer-order-card" key={order.id}>
                      <CardContent className="p-0">
                        <article>
                          <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-[var(--muted)] uppercase">
                                Mã đơn hàng
                              </p>
                              <h3 className="mt-1 truncate text-lg font-bold">
                                {order.orderNumber}
                              </h3>
                            </div>
                            <OrderStatusBadge status={order.status} />
                          </div>

                          <div className="grid gap-5 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                            <div className="min-w-0">
                              <div className="flex items-start gap-3">
                                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                                  <Package
                                    aria-hidden="true"
                                    className="size-5"
                                  />
                                </span>
                                <div className="min-w-0">
                                  <p className="font-semibold">
                                    {order.items[0]?.productName ?? 'Đơn hàng'}
                                  </p>
                                  <p className="mt-1 text-sm text-[var(--muted)]">
                                    {order.items.length > 1
                                      ? `${order.items.length} sản phẩm trong đơn`
                                      : order.items[0]?.variantName}
                                  </p>
                                </div>
                              </div>
                              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                                <div className="flex items-center justify-between gap-3 sm:block">
                                  <dt className="flex items-center gap-2 text-[var(--muted)]">
                                    <CreditCard
                                      aria-hidden="true"
                                      className="size-4"
                                    />
                                    Thanh toán
                                  </dt>
                                  <dd className="mt-1 sm:mt-2">
                                    {order.payment.status ? (
                                      <PaymentStatusBadge
                                        status={order.payment.status}
                                      />
                                    ) : (
                                      <Badge>Chưa cập nhật</Badge>
                                    )}
                                  </dd>
                                </div>
                                <div className="flex items-center justify-between gap-3 sm:block">
                                  <dt className="flex items-center gap-2 text-[var(--muted)]">
                                    <Wrench
                                      aria-hidden="true"
                                      className="size-4"
                                    />
                                    Lắp đặt
                                  </dt>
                                  <dd className="mt-1 sm:mt-2">
                                    {order.appointment ? (
                                      <AppointmentStatusBadge
                                        status={order.appointment.status}
                                      />
                                    ) : (
                                      <Badge>Không có lịch</Badge>
                                    )}
                                  </dd>
                                </div>
                              </dl>
                            </div>

                            <div className="flex items-end justify-between gap-4 border-t pt-4 lg:block lg:min-w-44 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6 lg:text-right">
                              <div>
                                <p className="text-xs text-[var(--muted)]">
                                  Tổng thanh toán
                                </p>
                                <p className="mt-1 text-lg font-bold">
                                  {formatVnd(order.grandTotal)}
                                </p>
                              </div>
                              <Link
                                aria-label={`Xem chi tiết ${order.orderNumber}`}
                                className={buttonVariants({
                                  className: 'mt-4',
                                  intent: 'primary',
                                  size: 'sm',
                                })}
                                href={`/orders/${order.id}`}
                              >
                                Xem chi tiết
                                <ArrowRight
                                  aria-hidden="true"
                                  className="size-4"
                                />
                              </Link>
                            </div>
                          </div>
                        </article>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  action={
                    status ? (
                      <Link
                        className={buttonVariants({ intent: 'secondary' })}
                        href={ordersHref({ cursor, status: undefined })}
                      >
                        Xem tất cả trên trang này
                      </Link>
                    ) : (
                      <Link
                        className={buttonVariants({ intent: 'primary' })}
                        href="/products"
                      >
                        Khám phá sản phẩm
                      </Link>
                    )
                  }
                  className="mt-6 rounded-lg border border-dashed bg-[var(--surface)]"
                  description={
                    status
                      ? 'Không có đơn phù hợp với trạng thái đã chọn trên trang này.'
                      : 'Khi hoàn tất mua hàng, đơn của bạn sẽ xuất hiện tại đây.'
                  }
                  icon={<PackageSearch aria-hidden="true" className="size-5" />}
                  title={
                    status ? 'Không có kết quả phù hợp' : 'Bạn chưa có đơn hàng'
                  }
                />
              )}

              {(result.nextCursor || cursor) && (
                <div className="mt-8 border-t pt-6">
                  <Pagination
                    label="Lịch sử đơn hàng"
                    nextHref={
                      result.nextCursor
                        ? ordersHref({ cursor: result.nextCursor, status })
                        : undefined
                    }
                    previousHref={cursor ? ordersHref({ status }) : undefined}
                  />
                </div>
              )}

              <div className="mt-8 flex items-start gap-3 rounded-lg border bg-[var(--surface)] p-4 text-sm text-[var(--muted-foreground)]">
                <CalendarClock
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-[var(--primary)]"
                />
                <p>
                  Thời gian lắp đặt hiển thị theo múi giờ Việt Nam và được cập
                  nhật theo tiến độ vận hành thực tế.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
