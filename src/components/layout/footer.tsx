import Link from 'next/link';

import { Container } from '@/components/layout/container';

export function Footer() {
  return (
    <footer className="border-t bg-[var(--surface)]" id="footer">
      <Container className="grid gap-8 py-10 text-sm sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link className="text-lg font-bold text-[var(--primary)]" href="/">
            247 Home
          </Link>
          <p className="mt-3 max-w-sm leading-6 text-[var(--muted)]">
            Thiết bị gia đình, dịch vụ lắp đặt và hỗ trợ sau bán hàng trong một
            trải nghiệm liền mạch.
          </p>
        </div>
        <nav aria-label="Liên hệ">
          <h2 className="font-bold">Liên hệ</h2>
          <ul className="mt-3 grid gap-2 text-[var(--muted)]">
            <li>
              <Link className="hover:text-[var(--primary)]" href="/account">
                Trung tâm tài khoản
              </Link>
            </li>
            <li>
              <Link className="hover:text-[var(--primary)]" href="/orders">
                Theo dõi đơn hàng
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Hỗ trợ">
          <h2 className="font-bold">Hỗ trợ</h2>
          <ul className="mt-3 grid gap-2 text-[var(--muted)]">
            <li>
              <Link
                className="hover:text-[var(--primary)]"
                href="/#installation"
              >
                Dịch vụ lắp đặt
              </Link>
            </li>
            <li>
              <Link className="hover:text-[var(--primary)]" href="/#support">
                Bảo hành và hậu mãi
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <h2 className="font-bold">Chính sách</h2>
          <ul className="mt-3 grid gap-2 text-[var(--muted)]">
            <li>Bảo vệ thông tin khách hàng</li>
            <li>Giá và tồn kho do hệ thống xác nhận</li>
          </ul>
        </div>
      </Container>
      <div className="border-t">
        <Container className="py-4 text-xs text-[var(--muted)]">
          © 2026 247 Home. Mọi quyền được bảo lưu.
        </Container>
      </div>
    </footer>
  );
}
