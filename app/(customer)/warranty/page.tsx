import { WarrantyStatus } from '@prisma/client';
import {
  ArrowRight,
  Headphones,
  PackageCheck,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { Pagination } from '@/components/navigation/pagination';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Select } from '@/components/ui/select';
import { WarrantyCreateForm } from '@/components/warranty/warranty-mutations';
import {
  WarrantyStatusBadge,
  warrantyCoverageLabels,
  warrantyStatusPresentation,
} from '@/components/warranty/warranty-presentation';
import {
  listEligibleWarrantyItems,
  listWarrantyRequests,
  warrantyListSchema,
} from '@/modules/warranty';
import { requirePageRole } from '@/shared/auth/server';

export const dynamic = 'force-dynamic';

const pageSize = 8;

function optionalValue(value: string | string[] | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseStatus(value: string | undefined): WarrantyStatus | undefined {
  return Object.values(WarrantyStatus).find((status) => status === value);
}

function warrantyHref(cursor?: string | null, status?: WarrantyStatus) {
  const query = new URLSearchParams();
  if (cursor) query.set('cursor', cursor);
  if (status) query.set('status', status);
  const suffix = query.toString();
  return suffix ? `/warranty?${suffix}` : '/warranty';
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(
    value,
  );
}

export default async function WarrantyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePageRole('CUSTOMER');
  const raw = await searchParams;
  const cursor = optionalValue(raw.cursor);
  const status = parseStatus(optionalValue(raw.status));
  const query = warrantyListSchema.parse({ cursor, limit: pageSize, status });
  const [requests, eligibleItems] = await Promise.all([
    listWarrantyRequests(actor, query),
    listEligibleWarrantyItems(actor),
  ]);

  return (
    <main>
      <section className="border-b bg-[var(--surface)] py-8 sm:py-10">
        <Container className="max-w-6xl">
          <Breadcrumb
            items={[{ href: '/', label: 'Trang chủ' }, { label: 'Bảo hành' }]}
          />
          <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-bold text-[var(--primary)]">
                Hỗ trợ sau bán hàng
              </p>
              <h1 className="mt-2 text-3xl leading-tight font-bold sm:text-4xl">
                Bảo hành của tôi
              </h1>
              <p className="mt-3 leading-7 text-[var(--muted-foreground)]">
                Theo dõi quá trình tiếp nhận, xử lý và kết quả bảo hành cho
                thiết bị đã mua.
              </p>
            </div>
            <a
              className={buttonVariants({ intent: 'primary' })}
              href="#create-warranty"
            >
              <Plus aria-hidden="true" className="size-4" />
              Tạo yêu cầu mới
            </a>
          </div>
        </Container>
      </section>

      <section className="py-8 sm:py-10" aria-labelledby="warranty-list-title">
        <Container className="max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <aside className="self-start lg:sticky lg:top-24">
              <form
                action="/warranty"
                className="rounded-lg border bg-[var(--surface)] p-4"
                method="get"
              >
                <label
                  className="block text-sm font-semibold"
                  htmlFor="warranty-status"
                >
                  Trạng thái
                </label>
                <Select
                  className="mt-2"
                  defaultValue={status ?? ''}
                  id="warranty-status"
                  name="status"
                >
                  <option value="">Tất cả trạng thái</option>
                  {Object.values(WarrantyStatus).map((value) => (
                    <option key={value} value={value}>
                      {warrantyStatusPresentation[value].label}
                    </option>
                  ))}
                </Select>
                <button
                  className={buttonVariants({
                    className: 'mt-3 w-full',
                    size: 'sm',
                  })}
                  type="submit"
                >
                  Áp dụng
                </button>
                {status ? (
                  <Link
                    className="mt-3 block text-center text-sm font-semibold text-[var(--primary)] hover:underline"
                    href="/warranty"
                  >
                    Xóa bộ lọc
                  </Link>
                ) : null}
              </form>
            </aside>

            <div className="min-w-0">
              <div className="flex items-end justify-between gap-4 border-b pb-5">
                <div>
                  <h2 className="text-xl font-bold" id="warranty-list-title">
                    Yêu cầu bảo hành
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]" role="status">
                    {requests.items.length} yêu cầu trên trang này
                  </p>
                </div>
                {cursor ? <Badge variant="info">Trang tiếp theo</Badge> : null}
              </div>

              {requests.items.length ? (
                <div
                  className="mt-6 grid gap-4"
                  aria-label="Danh sách yêu cầu bảo hành"
                >
                  {requests.items.map((request) => (
                    <Card data-testid="customer-warranty-card" key={request.id}>
                      <CardContent className="p-0">
                        <article className="grid gap-4 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold break-all">
                                {request.requestNumber}
                              </h3>
                              <WarrantyStatusBadge status={request.status} />
                            </div>
                            <p className="mt-3 font-semibold">
                              {request.orderItem.productName}
                            </p>
                            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                              {request.orderItem.variantName}
                              {request.orderItem.servicePackageName
                                ? ` - ${request.orderItem.servicePackageName}`
                                : ''}
                            </p>
                            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                              <div>
                                <dt className="text-[var(--muted)]">
                                  Đơn hàng
                                </dt>
                                <dd className="mt-1 font-semibold">
                                  {request.orderItem.order.orderNumber}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[var(--muted)]">Phạm vi</dt>
                                <dd className="mt-1 font-semibold">
                                  {warrantyCoverageLabels[request.coverageType]}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-[var(--muted)]">
                                  Gửi ngày
                                </dt>
                                <dd className="mt-1 font-semibold">
                                  {formatDate(request.submittedAt)}
                                </dd>
                              </div>
                            </dl>
                          </div>
                          <Link
                            aria-label={`Xem chi tiết ${request.requestNumber}`}
                            className={buttonVariants({
                              intent: 'secondary',
                              size: 'sm',
                            })}
                            href={`/warranty/${request.id}`}
                          >
                            Xem chi tiết
                            <ArrowRight aria-hidden="true" className="size-4" />
                          </Link>
                        </article>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  className="mt-6 rounded-lg border border-dashed bg-[var(--surface)]"
                  description={
                    status
                      ? 'Không có yêu cầu phù hợp với trạng thái đã chọn.'
                      : 'Yêu cầu đủ điều kiện của bạn sẽ xuất hiện tại đây.'
                  }
                  icon={<Headphones aria-hidden="true" className="size-5" />}
                  title={
                    status ? 'Không có kết quả' : 'Chưa có yêu cầu bảo hành'
                  }
                />
              )}

              {requests.nextCursor || cursor ? (
                <div className="mt-8 border-t pt-6">
                  <Pagination
                    label="Danh sách bảo hành"
                    nextHref={
                      requests.nextCursor
                        ? warrantyHref(requests.nextCursor, status)
                        : undefined
                    }
                    previousHref={
                      cursor ? warrantyHref(null, status) : undefined
                    }
                  />
                </div>
              ) : null}
            </div>
          </div>
        </Container>
      </section>

      <section
        className="border-t bg-[var(--surface-subtle)] py-10"
        id="create-warranty"
        aria-labelledby="create-warranty-title"
      >
        <Container className="max-w-4xl">
          <div className="grid gap-6 md:grid-cols-[15rem_minmax(0,1fr)]">
            <div>
              <span className="grid size-11 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <h2
                className="mt-4 text-2xl font-bold"
                id="create-warranty-title"
              >
                Tạo yêu cầu mới
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Chỉ các hạng mục còn thời hạn và chưa có yêu cầu trùng lặp mới
                được hiển thị.
              </p>
            </div>
            <div className="rounded-lg border bg-[var(--surface)] p-5 sm:p-6">
              <WarrantyCreateForm items={eligibleItems} />
            </div>
          </div>
          <div className="mt-6 flex items-start gap-3 text-sm text-[var(--muted-foreground)]">
            <PackageCheck
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-[var(--primary)]"
            />
            <p>
              Thông tin đơn hàng, sản phẩm và thời hạn được đọc trực tiếp từ hệ
              thống 247 Home.
            </p>
          </div>
        </Container>
      </section>
    </main>
  );
}
