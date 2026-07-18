import { Container } from '@/components/layout/container';

export default function ProductsLoading() {
  return (
    <main aria-busy="true" aria-label="Đang tải danh sách sản phẩm">
      <section className="border-b bg-[var(--surface)] py-10">
        <Container>
          <div className="h-4 w-36 animate-pulse rounded bg-[var(--secondary)]" />
          <div className="mt-7 h-10 max-w-xl animate-pulse rounded bg-[var(--secondary)]" />
          <div className="mt-4 h-5 max-w-2xl animate-pulse rounded bg-[var(--secondary)]" />
        </Container>
      </section>
      <Container className="py-10">
        <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <div className="hidden h-80 animate-pulse rounded bg-[var(--secondary)] lg:block" />
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                className="h-96 animate-pulse rounded-lg border bg-[var(--surface)]"
                key={index}
              />
            ))}
          </div>
        </div>
      </Container>
    </main>
  );
}
