import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: '247 Home',
  description:
    'Thiết bị nhà thông minh và dịch vụ lắp đặt tận nơi cho gia đình Việt.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="vi">
      <body>{children}</body>
    </html>
  );
}
