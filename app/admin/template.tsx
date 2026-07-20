import type { ReactNode } from 'react';

export default function AdminTemplate({ children }: { children: ReactNode }) {
  return <div className="motion-page-enter">{children}</div>;
}
