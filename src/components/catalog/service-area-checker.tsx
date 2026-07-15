'use client';

import { useState, type FormEvent } from 'react';

type AreaResult =
  | {
      status: 'SUPPORTED';
      area: { provinceName: string; districtName: string };
    }
  | { status: 'UNSUPPORTED'; area: null };

export function ServiceAreaChecker() {
  const [result, setResult] = useState<AreaResult | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResult(null);
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
    }
    setPending(false);
  }

  return (
    <section className="border-t py-10">
      <h2 className="text-xl font-semibold">Kiem tra khu vuc lap dat</h2>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={onSubmit}
      >
        <input
          aria-label="Ma tinh thanh"
          className="h-10 border bg-white px-3"
          defaultValue="HCM"
          name="provinceCode"
          pattern="[A-Za-z0-9_-]+"
          required
        />
        <input
          aria-label="Ma quan huyen"
          className="h-10 border bg-white px-3"
          defaultValue="Q1"
          name="districtCode"
          pattern="[A-Za-z0-9_-]+"
          required
        />
        <button
          className="h-10 bg-[var(--primary)] px-4 font-medium text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Dang kiem tra' : 'Kiem tra'}
        </button>
      </form>
      {result ? (
        <p className="mt-3 text-sm text-[var(--muted)]" role="status">
          {result.status === 'SUPPORTED'
            ? `Co phuc vu tai ${result.area.provinceName}, ${result.area.districtName}.`
            : 'Khu vuc nay chua duoc ho tro.'}
        </p>
      ) : null}
    </section>
  );
}
