'use client';

import { RotateCcw } from 'lucide-react';

import { Container } from '@/components/layout/container';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function OrdersError({ reset }: { reset: () => void }) {
  return (
    <main>
      <Container className="max-w-4xl py-12">
        <Alert title="Chưa thể tải đơn hàng" variant="error">
          Dữ liệu đơn hàng tạm thời không khả dụng. Vui lòng thử lại.
        </Alert>
        <Button className="mt-5" intent="secondary" onClick={reset}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Thử lại
        </Button>
      </Container>
    </main>
  );
}
