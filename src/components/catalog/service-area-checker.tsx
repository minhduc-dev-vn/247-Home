'use client';

import { MapPin } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AreaResult =
  | {
      status: 'SUPPORTED';
      area: { provinceName: string; districtName: string };
    }
  | { status: 'UNSUPPORTED'; area: null };

export function ServiceAreaChecker() {
  const [result, setResult] = useState<AreaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    setError(null);

    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch('/api/v1/service-areas/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provinceCode: form.get('provinceCode'),
          districtCode: form.get('districtCode'),
        }),
      });
      const payload: unknown = await response.json();
      if (
        response.ok &&
        typeof payload === 'object' &&
        payload &&
        'data' in payload
      ) {
        setResult((payload as { data: AreaResult }).data);
      } else {
        setError('Không thể kiểm tra khu vực lúc này. Vui lòng thử lại.');
      }
    } catch {
      setError('Không thể kết nối để kiểm tra khu vực. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="py-10 sm:py-12" aria-labelledby="service-area-title">
      <div className="max-w-2xl">
        <p className="flex items-center gap-2 text-sm font-bold text-[var(--primary)]">
          <MapPin aria-hidden="true" className="size-4" />
          Phạm vi phục vụ
        </p>
        <h2 className="mt-2 text-2xl font-bold" id="service-area-title">
          Kiểm tra khu vực lắp đặt
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Nhập mã tỉnh/thành và quận/huyện để xác nhận dịch vụ tại địa chỉ của
          bạn.
        </p>
      </div>
      <form
        className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={onSubmit}
      >
        <div>
          <label
            className="mb-2 block text-sm font-semibold"
            htmlFor="province-code"
          >
            Mã tỉnh/thành
          </label>
          <Input
            defaultValue="HCM"
            id="province-code"
            name="provinceCode"
            pattern="[A-Za-z0-9_-]+"
            required
          />
        </div>
        <div>
          <label
            className="mb-2 block text-sm font-semibold"
            htmlFor="district-code"
          >
            Mã quận/huyện
          </label>
          <Input
            defaultValue="Q1"
            id="district-code"
            name="districtCode"
            pattern="[A-Za-z0-9_-]+"
            required
          />
        </div>
        <Button loading={pending} type="submit">
          Kiểm tra
        </Button>
      </form>
      {result ? (
        <Alert
          className="mt-4 max-w-3xl"
          title={
            result.status === 'SUPPORTED'
              ? 'Dịch vụ khả dụng'
              : 'Chưa hỗ trợ khu vực'
          }
          variant={result.status === 'SUPPORTED' ? 'success' : 'warning'}
        >
          {result.status === 'SUPPORTED'
            ? `Có phục vụ tại ${result.area.provinceName}, ${result.area.districtName}.`
            : 'Khu vực này chưa được hỗ trợ.'}
        </Alert>
      ) : null}
      {error ? (
        <Alert
          className="mt-4 max-w-3xl"
          title="Kiểm tra thất bại"
          variant="error"
        >
          {error}
        </Alert>
      ) : null}
    </section>
  );
}
