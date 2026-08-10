import type { ReactNode } from 'react';

export default function CustomerTemplate({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="motion-page-enter">{children}</div>;
}
