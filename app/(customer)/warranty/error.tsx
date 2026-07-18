'use client';

import { Container } from '@/components/layout/container';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function WarrantyError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main>
      <Container className="max-w-3xl py-16">
        <Alert title="Không thể tải bảo hành" variant="error">
          Vui lòng thử lại sau ít phút.
        </Alert>
        <Button className="mt-4" onClick={reset}>
          Thử lại
        </Button>
      </Container>
    </main>
  );
}
