import { Container } from '@/components/layout/container';

export default function ProductDetailLoading() {
  return (
    <main aria-busy="true" aria-label="Đang tải chi tiết sản phẩm">
      <Container className="py-10">
        <div className="h-4 w-48 animate-pulse rounded bg-[var(--secondary)]" />
        <div className="mt-7 grid gap-8 lg:grid-cols-2">
          <div className="aspect-[4/3] animate-pulse rounded-lg bg-[var(--secondary)]" />
          <div>
            <div className="h-6 w-32 animate-pulse rounded bg-[var(--secondary)]" />
            <div className="mt-5 h-12 w-full animate-pulse rounded bg-[var(--secondary)]" />
            <div className="mt-4 h-20 w-full animate-pulse rounded bg-[var(--secondary)]" />
            <div className="mt-6 h-64 w-full animate-pulse rounded-lg bg-[var(--secondary)]" />
          </div>
        </div>
      </Container>
    </main>
  );
}
