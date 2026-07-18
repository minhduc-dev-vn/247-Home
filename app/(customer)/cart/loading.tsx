import { Container } from '@/components/layout/container';

export default function CartLoading() {
  return (
    <main aria-busy="true" aria-label="Đang tải giỏ hàng">
      <section className="border-b bg-[var(--surface)] py-10">
        <Container>
          <div className="h-4 w-36 animate-pulse rounded bg-[var(--secondary)]" />
          <div className="mt-7 h-10 w-64 animate-pulse rounded bg-[var(--secondary)]" />
        </Container>
      </section>
      <Container className="grid gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="h-96 animate-pulse rounded-lg bg-[var(--secondary)]" />
        <div className="h-72 animate-pulse rounded-lg bg-[var(--secondary)]" />
      </Container>
    </main>
  );
}
