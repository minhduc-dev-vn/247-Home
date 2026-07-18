import {
  CalendarDays,
  FileImage,
  Headphones,
  MessageSquareText,
  Package,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Container } from '@/components/layout/container';
import { Breadcrumb } from '@/components/navigation/breadcrumb';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  WarrantyCloseAction,
  WarrantyEvidenceUploader,
} from '@/components/warranty/warranty-mutations';
import {
  WarrantyStatusBadge,
  WarrantyTimeline,
  warrantyCoverageLabels,
  warrantyIssueLabels,
} from '@/components/warranty/warranty-presentation';
import { CatalogError } from '@/modules/catalog';
import { getWarrantyRequest, listWarrantyAudit } from '@/modules/warranty';
import { requirePageRole } from '@/shared/auth/server';

export const dynamic = 'force-dynamic';

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

const auditLabels: Record<string, string> = {
  'warranty.request-created': 'Yêu cầu được tạo',
  'warranty.evidence-added': 'Đã thêm ảnh hiện trạng',
  'warranty.state-transitioned': 'Trạng thái được cập nhật',
};

export default async function WarrantyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePageRole('CUSTOMER');
  const id = (await params).id;
  let request;
  try {
    request = await getWarrantyRequest(actor, id);
  } catch (error) {
    if (error instanceof CatalogError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const audit = await listWarrantyAudit(actor, id, { limit: 25 });
  const canUpload =
    request.status === 'SUBMITTED' || request.status === 'IN_REVIEW';
  const canClose =
    request.status === 'RESOLVED' || request.status === 'REJECTED';

  return (
    <main className="min-w-0 overflow-x-clip">
      <section className="border-b bg-[var(--surface)] py-8 sm:py-10">
        <Container className="max-w-6xl">
          <Breadcrumb
            items={[
              { href: '/', label: 'Trang chủ' },
              { href: '/warranty', label: 'Bảo hành' },
              { label: request.requestNumber },
            ]}
          />
          <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--primary)]">
                Chi tiết yêu cầu
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold break-all sm:text-3xl">
                  {request.requestNumber}
                </h1>
                <WarrantyStatusBadge status={request.status} />
              </div>
              <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                Cập nhật lần cuối {formatDate(request.updatedAt)}
              </p>
            </div>
            <Link
              className={buttonVariants({ intent: 'secondary', size: 'sm' })}
              href="/warranty"
            >
              Tất cả yêu cầu
            </Link>
          </div>
        </Container>
      </section>

      <section className="py-8 sm:py-10">
        <Container className="max-w-6xl">
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.8fr)] lg:items-start">
            <div className="grid min-w-0 gap-6">
              <Card className="min-w-0">
                <CardHeader>
                  <h2 className="font-bold">Tiến trình xử lý</h2>
                </CardHeader>
                <CardContent>
                  <div className="max-w-full min-w-0 overflow-x-auto pb-2">
                    <WarrantyTimeline status={request.status} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="font-bold">Sản phẩm và lắp đặt</h2>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
                      <Package aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <p className="font-bold">
                        {request.orderItem.productName}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {request.orderItem.variantName}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-5 grid gap-4 border-t pt-5 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[var(--muted)]">Đơn hàng</dt>
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
                      <dt className="text-[var(--muted)]">Gói lắp đặt</dt>
                      <dd className="mt-1 font-semibold">
                        {request.orderItem.servicePackageName ??
                          'Không áp dụng'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--muted)]">Thời hạn</dt>
                      <dd className="mt-1 font-semibold">
                        {formatDate(request.warrantyStartsAt)} -{' '}
                        {formatDate(request.warrantyExpiresAt)}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="font-bold">Mô tả và kết quả</h2>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <div>
                    <p className="text-sm font-semibold">
                      {warrantyIssueLabels[
                        request.issueType as keyof typeof warrantyIssueLabels
                      ] ?? request.issueType}
                    </p>
                    <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-[var(--muted-foreground)]">
                      {request.description}
                    </p>
                  </div>
                  {request.publicResolution ? (
                    <div className="border-t pt-5">
                      <p className="flex items-center gap-2 font-semibold">
                        <MessageSquareText
                          aria-hidden="true"
                          className="size-4 text-[var(--primary)]"
                        />
                        Kết quả từ 247 Home
                      </p>
                      <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">
                        {request.publicResolution}
                      </p>
                    </div>
                  ) : null}
                  {canClose ? (
                    <div className="border-t pt-5">
                      <WarrantyCloseAction
                        expectedVersion={request.version}
                        requestId={request.id}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <h2 className="font-bold">Ảnh hiện trạng</h2>
                </CardHeader>
                <CardContent>
                  {request.evidence.length ? (
                    <ul
                      className="grid gap-4 sm:grid-cols-2"
                      aria-label="Ảnh bảo hành đã tải lên"
                    >
                      {request.evidence.map((evidence, index) => (
                        <li
                          className="overflow-hidden rounded-lg border"
                          key={evidence.id}
                        >
                          <a
                            className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                            href={`/api/v1/warranty/${request.id}/evidence/${evidence.id}`}
                            target="_blank"
                          >
                            <Image
                              alt={`Ảnh hiện trạng bảo hành ${index + 1}`}
                              className="aspect-[4/3] w-full object-cover"
                              height={360}
                              src={`/api/v1/warranty/${request.id}/evidence/${evidence.id}`}
                              unoptimized
                              width={480}
                            />
                          </a>
                          <p className="px-3 py-2 text-xs text-[var(--muted)]">
                            {Math.ceil(evidence.byteSize / 1024)} KB -{' '}
                            {formatDate(evidence.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState
                      description="Ảnh bạn tải lên sẽ được hiển thị tại đây."
                      icon={<FileImage aria-hidden="true" className="size-5" />}
                      title="Chưa có ảnh hiện trạng"
                    />
                  )}
                  {canUpload ? (
                    <div className="mt-6 border-t pt-5">
                      <WarrantyEvidenceUploader
                        expectedVersion={request.version}
                        requestId={request.id}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <aside className="grid gap-6 lg:sticky lg:top-24">
              <Card>
                <CardHeader>
                  <h2 className="font-bold">Thông tin yêu cầu</h2>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 text-sm">
                    <div>
                      <dt className="flex items-center gap-2 text-[var(--muted)]">
                        <ReceiptText aria-hidden="true" className="size-4" />
                        Mã yêu cầu
                      </dt>
                      <dd className="mt-1 font-semibold break-all">
                        {request.requestNumber}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-2 text-[var(--muted)]">
                        <CalendarDays aria-hidden="true" className="size-4" />
                        Ngày gửi
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {formatDate(request.submittedAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-2 text-[var(--muted)]">
                        <Headphones aria-hidden="true" className="size-4" />
                        Liên hệ
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {request.contactPhone}
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <h2 className="font-bold">Lịch sử cập nhật</h2>
                </CardHeader>
                <CardContent>
                  <ol className="grid gap-4" data-testid="warranty-audit-list">
                    {audit.items.map((event) => (
                      <li
                        className="border-l-2 border-[var(--primary-soft)] pl-3"
                        key={event.id}
                      >
                        <p className="text-sm font-semibold">
                          {auditLabels[event.action] ?? 'Yêu cầu được cập nhật'}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {event.actor?.name ?? '247 Home'} -{' '}
                          {formatDate(event.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
              <div className="flex items-start gap-3 rounded-lg border bg-[var(--surface)] p-4 text-sm text-[var(--muted-foreground)]">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-[var(--primary)]"
                />
                <p>
                  Dữ liệu hiển thị được giới hạn theo tài khoản đang đăng nhập.
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </section>
    </main>
  );
}
