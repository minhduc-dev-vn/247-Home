import { Container } from '@/components/layout/container';
import { Loading } from '@/components/ui/loading';

export default function OrdersLoading() {
  return (
    <main>
      <div className="border-b bg-[var(--surface)] py-10">
        <Container className="max-w-6xl">
          <div className="h-8 w-64 animate-pulse rounded bg-[var(--surface-subtle)]" />
          <div className="mt-4 h-5 w-full max-w-lg animate-pulse rounded bg-[var(--surface-subtle)]" />
        </Container>
      </div>
      <Container className="max-w-6xl py-10">
        <Loading className="min-h-64" label="Đang tải lịch sử đơn hàng..." />
      </Container>
    </main>
  );
}
