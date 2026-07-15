'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  formatServiceDateTime,
  toServiceDate,
} from '@/shared/date/service-time';
import { formatVnd } from '@/shared/money/format-vnd';

type Address = {
  id: string;
  recipientName: string;
  line1: string;
  wardName: string;
  districtName: string;
  provinceName: string;
  serviceAreaId: string | null;
};
type Cart = {
  id: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    servicePackageId: string | null;
  }>;
};
type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  available: number;
};
type Quote = {
  subtotal: string;
  installationFee: string;
  shippingFee: string;
  grandTotal: string;
};

async function json<T>(response: Response) {
  const payload = (await response.json()) as {
    data?: T;
    error?: { code?: string; message?: string };
  };
  if (!response.ok || !payload.data)
    throw new Error(
      payload.error?.code ?? payload.error?.message ?? 'REQUEST_FAILED',
    );
  return payload.data;
}

export function CheckoutFlow({
  cart,
  initialAddresses,
}: {
  cart: Cart;
  initialAddresses: Address[];
}) {
  const router = useRouter();
  const requiresInstallation = cart.items.some(
    (item) => item.servicePackageId !== null,
  );
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddresses[0]?.id ?? '');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'BANK_TRANSFER'>(
    'COD',
  );
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const address = addresses.find((item) => item.id === addressId) ?? null;

  function selectAddress(id: string) {
    setAddressId(id);
    setSlotId('');
    setSlots([]);
    setQuote(null);
  }

  function selectSlot(id: string) {
    setSlotId(id);
    setQuote(null);
  }

  useEffect(() => {
    if (!requiresInstallation || !address?.serviceAreaId) return;
    const from = new Date(Date.now() + 24 * 60 * 60 * 1_000);
    const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1_000);
    const params = new URLSearchParams({
      serviceAreaId: address.serviceAreaId,
      fromDate: toServiceDate(from),
      toDate: toServiceDate(to),
    });
    void fetch(`/api/v1/installation-slots?${params}`)
      .then((response) =>
        json<{ items: Slot[]; nextCursor: string | null }>(response),
      )
      .then((page) => setSlots(page.items))
      .catch(() => setMessage('Khong the tai lich lap dat.'));
  }, [address?.serviceAreaId, requiresInstallation]);

  useEffect(() => {
    if (!addressId || (requiresInstallation && !slotId)) return;
    void fetch('/api/v1/cart/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId, slotId: slotId || null }),
    })
      .then((response) => json<Quote>(response))
      .then(setQuote)
      .catch((error: Error) => setMessage(error.message));
  }, [addressId, requiresInstallation, slotId]);

  async function saveAddress(formData: FormData) {
    setMessage(null);
    setIsSubmitting(true);
    try {
      const saved = await json<Address>(
        await fetch('/api/v1/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(formData)),
        }),
      );
      setAddresses((current) => [saved, ...current]);
      selectAddress(saved.id);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Khong the luu dia chi.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function placeOrder() {
    if (!addressId || (requiresInstallation && !slotId)) return;
    setMessage(null);
    setIsSubmitting(true);
    try {
      const order = await json<{ id: string }>(
        await fetch('/api/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': `checkout-${crypto.randomUUID()}`,
          },
          body: JSON.stringify({
            cartId: cart.id,
            addressId,
            slotId: slotId || null,
            paymentMethod,
          }),
        }),
      );
      router.push(`/order-confirmation/${order.id}`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Khong the tao don hang.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <section className="border bg-white p-5">
        <h2 className="font-semibold">Dia chi giao hang</h2>
        <div className="mt-3 space-y-2">
          {addresses.map((item) => (
            <label className="flex gap-2 text-sm" key={item.id}>
              <input
                checked={addressId === item.id}
                name="address"
                onChange={() => selectAddress(item.id)}
                type="radio"
              />
              {item.line1}, {item.wardName}, {item.districtName},{' '}
              {item.provinceName}
            </label>
          ))}
        </div>
        <form action={saveAddress} className="mt-5 grid gap-3 sm:grid-cols-2">
          <input
            className="border px-3 py-2"
            name="recipientName"
            placeholder="Nguoi nhan"
            required
          />
          <input
            className="border px-3 py-2"
            name="phone"
            pattern="[0-9+ -]{8,20}"
            placeholder="So dien thoai"
            required
          />
          <input
            className="border px-3 py-2 sm:col-span-2"
            name="line1"
            placeholder="Dia chi"
            required
          />
          <input
            className="border px-3 py-2"
            name="wardName"
            placeholder="Phuong xa"
            required
          />
          <input
            className="border px-3 py-2"
            name="districtName"
            placeholder="Quan huyen"
            required
          />
          <input
            className="border px-3 py-2"
            defaultValue="Q1"
            name="districtCode"
            placeholder="Ma quan huyen"
            required
          />
          <input
            className="border px-3 py-2"
            defaultValue="HCM"
            name="provinceCode"
            placeholder="Ma tinh thanh"
            required
          />
          <input
            className="border px-3 py-2 sm:col-span-2"
            name="provinceName"
            placeholder="Tinh thanh"
            required
          />
          <button
            className="w-fit border px-3 py-2 text-sm font-medium"
            disabled={isSubmitting}
            type="submit"
          >
            Luu dia chi
          </button>
        </form>
      </section>
      {requiresInstallation && (
        <section className="border bg-white p-5">
          <h2 className="font-semibold">Lich lap dat</h2>
          {address && !address.serviceAreaId ? (
            <p className="mt-3 text-sm text-red-700">
              Dia chi nay nam ngoai khu vuc phuc vu.
            </p>
          ) : (
            <select
              className="mt-3 w-full border px-3 py-2"
              disabled={!addressId}
              onChange={(event) => selectSlot(event.target.value)}
              value={slotId}
            >
              <option value="">Chon khung gio</option>
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {formatServiceDateTime(slot.startsAt)} ({slot.available} cho)
                </option>
              ))}
            </select>
          )}
        </section>
      )}
      <section className="border bg-white p-5">
        <h2 className="font-semibold">Thanh toan va tong tien</h2>
        <select
          className="mt-3 border px-3 py-2"
          onChange={(event) =>
            setPaymentMethod(event.target.value as 'COD' | 'BANK_TRANSFER')
          }
          value={paymentMethod}
        >
          <option value="COD">COD</option>
          <option value="BANK_TRANSFER">Chuyen khoan thu cong</option>
        </select>
        {quote && (
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Tam tinh</dt>
              <dd>{formatVnd(quote.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Phi lap dat</dt>
              <dd>{formatVnd(quote.installationFee)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Phi giao hang</dt>
              <dd>{formatVnd(quote.shippingFee)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Tong cong</dt>
              <dd>{formatVnd(quote.grandTotal)}</dd>
            </div>
          </dl>
        )}
        <button
          className="mt-5 bg-[var(--primary)] px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={!quote || isSubmitting}
          onClick={() => void placeOrder()}
          type="button"
        >
          Dat hang
        </button>
      </section>
      {message && (
        <p className="text-sm text-red-700" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
