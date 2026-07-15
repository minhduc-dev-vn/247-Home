import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
      <p className="text-sm font-medium text-[var(--muted)]">404</p>
      <h1 className="mt-3 text-3xl font-semibold">Không tìm thấy trang.</h1>
      <p className="mt-3 text-[var(--muted)]">
        Đường dẫn này không tồn tại hoặc đã được di chuyển.
      </p>
      <Link
        className="mt-8 w-fit font-medium text-[var(--primary)] underline"
        href="/"
      >
        Về trang chủ
      </Link>
    </main>
  );
}
