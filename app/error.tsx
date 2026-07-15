'use client';

export default function GlobalError({
  reset,
}: Readonly<{ error: Error; reset: () => void }>) {
  return (
    <html lang="vi">
      <body>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
          <p className="text-sm font-medium text-[var(--muted)]">247 Home</p>
          <h1 className="mt-3 text-3xl font-semibold">
            Đã có lỗi không mong muốn.
          </h1>
          <p className="mt-3 text-[var(--muted)]">
            Vui lòng thử lại. Nếu lỗi tiếp diễn, hãy liên hệ đội ngũ hỗ trợ.
          </p>
          <button
            className="mt-8 w-fit rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
            onClick={reset}
            type="button"
          >
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
