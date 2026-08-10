'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function PaymentStatusRefresh({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fetch(`/api/v1/payment/${paymentId}`, { cache: 'no-store' });
          router.refresh();
        } finally {
          setLoading(false);
        }
      }}
      type="button"
    >
      <RefreshCw
        aria-hidden="true"
        className={loading ? 'size-4 animate-spin' : 'size-4'}
      />
      {loading ? 'Đang kiểm tra' : 'Kiểm tra lại'}
    </Button>
  );
}
