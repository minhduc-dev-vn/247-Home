'use client';

import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  MapPin,
  PackageCheck,
  ShieldCheck,
  UserRound,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  formatServiceDateTime,
  toServiceDate,
} from '@/shared/date/service-time';
import { formatVnd } from '@/shared/money/format-vnd';

type Address = {
  districtCode: string;
  districtName: string;
  id: string;
  isDefault: boolean;
  line1: string;
  provinceCode: string;
  provinceName: string;
  recipientName: string;
  serviceAreaId: string | null;
  wardName: string;
};

type Cart = {
  id: string;
  items: Array<{
    availability: string;
    deviceUnitPrice: string;
    id: string;
    name: string;
    quantity: number;
    servicePackageId: string | null;
    servicePackageName: string | null;
    serviceUnitPrice: string;
  }>;
};

type Customer = { email: string; name: string };
type Slot = {
  available: number;
  endsAt: string;
  id: string;
  startsAt: string;
};
type Quote = {
  currency: string;
  discountTotal: string;
  grandTotal: string;
  installationFee: string;
  shippingFee: string;
  subtotal: string;
};

class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function responseData<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    data?: T;
    error?: { code?: string; message?: string };
  };
  if (!response.ok || !payload.data) {
    throw new ApiRequestError(
      payload.error?.code ?? 'REQUEST_FAILED',
      response.status,
      payload.error?.message ?? 'Không thể xử lý yêu cầu.',
    );
  }
  return payload.data;
}

const checkoutErrorMessages: Record<string, string> = {
  CART_EMPTY: 'Giỏ hàng không còn sản phẩm. Vui lòng quay lại giỏ hàng.',
  CONFLICT: 'Dữ liệu checkout vừa thay đổi. Vui lòng kiểm tra lại.',
  IDEMPOTENCY_CONFLICT:
    'Thông tin đặt hàng đã thay đổi trong lần thử lại. Vui lòng kiểm tra lại.',
  INVENTORY_INSUFFICIENT:
    'Một sản phẩm vừa hết hàng hoặc không còn đủ số lượng.',
  RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
  SERVICE_AREA_UNSUPPORTED:
    'Địa chỉ này chưa nằm trong khu vực hỗ trợ lắp đặt.',
  SLOT_UNAVAILABLE:
    'Khung giờ vừa được người khác chọn hoặc không còn khả dụng.',
  VALIDATION_ERROR: 'Thông tin gửi lên chưa hợp lệ. Vui lòng kiểm tra lại.',
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError)
    return checkoutErrorMessages[error.code] ?? error.message;
  return error instanceof Error ? error.message : fallback;
}

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function SectionTitle({
  children,
  icon,
  step,
}: {
  children: ReactNode;
  icon: ReactNode;
  step: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-[var(--muted)]">BƯỚC {step}</p>
        <h2 className="font-bold">{children}</h2>
      </div>
    </div>
  );
}

export function CheckoutFlow({
  cart,
  customer,
  initialAddresses,
}: {
  cart: Cart;
  customer: Customer;
  initialAddresses: Address[];
}) {
  const router = useRouter();
  const requiresInstallation = cart.items.some(
    (item) => item.servicePackageId !== null,
  );
  const initialAddress = initialAddresses[0] ?? null;
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState(initialAddress?.id ?? '');
  const [showAddressForm, setShowAddressForm] = useState(
    initialAddresses.length === 0,
  );
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotId, setSlotId] = useState('');
  const [slotReload, setSlotReload] = useState(0);
  const [slotsLoading, setSlotsLoading] = useState(
    requiresInstallation && Boolean(initialAddress?.serviceAreaId),
  );
  const [slotError, setSlotError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'BANK_TRANSFER'>(
    'COD',
  );
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(
    Boolean(
      initialAddress && (!requiresInstallation || initialAddress.serviceAreaId),
    ),
  );
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const orderSubmittingRef = useRef(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const address = addresses.find((item) => item.id === addressId) ?? null;

  function resetCheckoutIntent() {
    idempotencyKeyRef.current = null;
    setCheckoutError(null);
  }

  function selectAddress(id: string, selectedAddress?: Address) {
    const selected =
      selectedAddress ?? addresses.find((item) => item.id === id) ?? null;
    setAddressId(id);
    setSlotId('');
    setSlots([]);
    setSlotError(null);
    setSlotsLoading(requiresInstallation && Boolean(selected?.serviceAreaId));
    setQuote(null);
    setQuoteError(null);
    setQuoteLoading(
      Boolean(selected && (!requiresInstallation || selected.serviceAreaId)),
    );
    resetCheckoutIntent();
  }

  function selectSlot(id: string) {
    setSlotId(id);
    setQuote(null);
    setQuoteError(null);
    setQuoteLoading(Boolean(addressId));
    resetCheckoutIntent();
  }

  function reloadSlots() {
    setSlots([]);
    setSlotError(null);
    setSlotsLoading(true);
    setSlotReload((value) => value + 1);
  }

  useEffect(() => {
    if (!requiresInstallation || !address?.serviceAreaId) return;

    const controller = new AbortController();
    const from = new Date(Date.now() + 24 * 60 * 60 * 1_000);
    const to = new Date(Date.now() + 14 * 24 * 60 * 60 * 1_000);
    const params = new URLSearchParams({
      serviceAreaId: address.serviceAreaId,
      fromDate: toServiceDate(from),
      toDate: toServiceDate(to),
      limit: '100',
    });

    void fetch(`/api/v1/installation-slots?${params}`, {
      signal: controller.signal,
    })
      .then((response) =>
        responseData<{ items: Slot[]; nextCursor: string | null }>(response),
      )
      .then((page) => setSlots(page.items))
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setSlotError(errorMessage(error, 'Không thể tải lịch lắp đặt.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setSlotsLoading(false);
      });

    return () => controller.abort();
  }, [address?.serviceAreaId, requiresInstallation, slotReload]);

  useEffect(() => {
    if (!addressId || (requiresInstallation && !address?.serviceAreaId)) return;

    const controller = new AbortController();
    void fetch('/api/v1/cart/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId, slotId: slotId || null }),
      signal: controller.signal,
    })
      .then((response) => responseData<Quote>(response))
      .then(setQuote)
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setQuoteError(errorMessage(error, 'Không thể xác nhận tổng tiền.'));
      })
      .finally(() => {
        if (!controller.signal.aborted) setQuoteLoading(false);
      });

    return () => controller.abort();
  }, [address?.serviceAreaId, addressId, requiresInstallation, slotId]);

  async function saveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;

    setAddressError(null);
    setAddressSubmitting(true);
    const formData = new FormData(form);
    try {
      const line2 = stringField(formData, 'line2');
      const postalCode = stringField(formData, 'postalCode');
      const saved = await responseData<Address>(
        await fetch('/api/v1/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientName: stringField(formData, 'recipientName'),
            phone: stringField(formData, 'phone'),
            line1: stringField(formData, 'line1'),
            line2: line2 || null,
            wardName: stringField(formData, 'wardName'),
            districtName: stringField(formData, 'districtName'),
            districtCode: stringField(formData, 'districtCode'),
            provinceName: stringField(formData, 'provinceName'),
            provinceCode: stringField(formData, 'provinceCode'),
            postalCode: postalCode || null,
            isDefault: formData.get('isDefault') === 'on',
          }),
        }),
      );
      setAddresses((current) => [saved, ...current]);
      selectAddress(saved.id, saved);
      setShowAddressForm(false);
      form.reset();
    } catch (error: unknown) {
      setAddressError(errorMessage(error, 'Không thể lưu địa chỉ.'));
    } finally {
      setAddressSubmitting(false);
    }
  }

  async function placeOrder() {
    if (orderSubmittingRef.current) return;
    if (!addressId || !quote) {
      setCheckoutError('Vui lòng chọn địa chỉ và chờ hệ thống xác nhận giá.');
      return;
    }
    if (requiresInstallation && !slotId) {
      setCheckoutError('Vui lòng chọn khung giờ lắp đặt còn khả dụng.');
      return;
    }

    orderSubmittingRef.current = true;
    setCheckoutError(null);
    setOrderSubmitting(true);
    idempotencyKeyRef.current ??= `checkout-${crypto.randomUUID()}`;
    try {
      const order = await responseData<{ id: string }>(
        await fetch('/api/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKeyRef.current,
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
    } catch (error: unknown) {
      const message = errorMessage(error, 'Không thể tạo đơn hàng.');
      setCheckoutError(message);
      if (
        error instanceof ApiRequestError &&
        error.code === 'SLOT_UNAVAILABLE'
      ) {
        selectSlot('');
        reloadSlots();
      }
    } finally {
      orderSubmittingRef.current = false;
      setOrderSubmitting(false);
    }
  }

  const canPlaceOrder =
    Boolean(addressId && quote) &&
    (!requiresInstallation || Boolean(address?.serviceAreaId && slotId));

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <SectionTitle
              icon={<UserRound aria-hidden="true" className="size-4" />}
              step="1"
            >
              Thông tin khách hàng
            </SectionTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-[var(--muted)]">HỌ TÊN</p>
              <p className="mt-1 font-semibold">{customer.name}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[var(--muted)]">EMAIL</p>
              <p className="mt-1 font-semibold break-all">{customer.email}</p>
            </div>
            <p className="text-sm leading-6 text-[var(--muted)] sm:col-span-2">
              Thông tin tài khoản chỉ được dùng để nhận diện đơn hàng. Checkout
              không thay đổi hồ sơ của bạn.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <SectionTitle
              icon={<MapPin aria-hidden="true" className="size-4" />}
              step="2"
            >
              Địa chỉ nhận hàng và lắp đặt
            </SectionTitle>
          </CardHeader>
          <CardContent>
            {addresses.length > 0 ? (
              <fieldset>
                <legend className="text-sm font-semibold">
                  Chọn địa chỉ đã lưu
                </legend>
                <div className="mt-3 grid gap-3">
                  {addresses.map((item) => (
                    <label
                      className="flex cursor-pointer items-start gap-3 rounded-md border p-4 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-soft)]"
                      key={item.id}
                    >
                      <input
                        checked={addressId === item.id}
                        className="mt-1 size-4 accent-[var(--primary)]"
                        name="address"
                        onChange={() => selectAddress(item.id)}
                        type="radio"
                        value={item.id}
                      />
                      <span className="min-w-0 text-sm leading-6">
                        <span className="flex flex-wrap items-center gap-2 font-semibold">
                          {item.recipientName}
                          {item.isDefault ? <Badge>Mặc định</Badge> : null}
                        </span>
                        <span className="mt-1 block text-[var(--muted)]">
                          {item.line1}, {item.wardName}, {item.districtName},{' '}
                          {item.provinceName}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            {address ? (
              <div className="mt-4">
                {address.serviceAreaId ? (
                  <Alert title="Khu vực được hỗ trợ" variant="success">
                    Hệ thống đã xác nhận địa chỉ thuộc khu vực phục vụ hiện tại.
                  </Alert>
                ) : requiresInstallation ? (
                  <Alert title="Khu vực chưa được hỗ trợ" variant="error">
                    Không thể đặt dịch vụ lắp đặt tại địa chỉ này.
                  </Alert>
                ) : (
                  <Alert title="Ngoài khu vực lắp đặt" variant="warning">
                    Giỏ hàng không có gói lắp đặt; server vẫn sẽ kiểm tra lại
                    địa chỉ khi tạo đơn.
                  </Alert>
                )}
              </div>
            ) : null}

            <Button
              className="mt-5"
              intent="secondary"
              onClick={() => setShowAddressForm((value) => !value)}
              type="button"
            >
              <MapPin aria-hidden="true" className="size-4" />
              {showAddressForm ? 'Đóng form địa chỉ' : 'Thêm địa chỉ mới'}
            </Button>

            {showAddressForm ? (
              <form
                className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-2"
                onSubmit={(event) => void saveAddress(event)}
              >
                <label className="grid gap-2 text-sm font-semibold">
                  Họ tên người nhận
                  <Input
                    autoComplete="name"
                    defaultValue={customer.name}
                    maxLength={120}
                    name="recipientName"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Số điện thoại
                  <Input
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={20}
                    name="phone"
                    pattern="[0-9+ -]{8,20}"
                    placeholder="Ví dụ: 0901234567"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                  Địa chỉ chi tiết
                  <Input
                    autoComplete="address-line1"
                    maxLength={240}
                    name="line1"
                    placeholder="Số nhà, tên đường"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold sm:col-span-2">
                  Ghi chú giao nhận (không bắt buộc)
                  <Textarea
                    maxLength={240}
                    name="line2"
                    placeholder="Tòa nhà, tầng, chỉ dẫn vào cửa..."
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Phường/xã
                  <Input maxLength={120} name="wardName" required />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Quận/huyện
                  <Input maxLength={120} name="districtName" required />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Mã quận/huyện
                  <Input
                    autoCapitalize="characters"
                    maxLength={32}
                    name="districtCode"
                    placeholder="Ví dụ: Q1"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Tỉnh/thành
                  <Input maxLength={120} name="provinceName" required />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Mã tỉnh/thành
                  <Input
                    autoCapitalize="characters"
                    maxLength={32}
                    name="provinceCode"
                    placeholder="Ví dụ: HCM"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  Mã bưu chính (không bắt buộc)
                  <Input
                    autoComplete="postal-code"
                    maxLength={20}
                    name="postalCode"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    className="size-4 accent-[var(--primary)]"
                    name="isDefault"
                    type="checkbox"
                  />
                  Dùng làm địa chỉ mặc định
                </label>
                {addressError ? (
                  <Alert className="sm:col-span-2" variant="error">
                    {addressError}
                  </Alert>
                ) : null}
                <Button
                  className="w-full sm:col-span-2 sm:w-fit"
                  loading={addressSubmitting}
                  type="submit"
                >
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                  Lưu và kiểm tra khu vực
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        {requiresInstallation ? (
          <Card>
            <CardHeader>
              <SectionTitle
                icon={<CalendarClock aria-hidden="true" className="size-4" />}
                step="3"
              >
                Chọn lịch lắp đặt
              </SectionTitle>
            </CardHeader>
            <CardContent>
              {!addressId ? (
                <p className="text-sm text-[var(--muted)]">
                  Chọn địa chỉ để tải các khung giờ phù hợp.
                </p>
              ) : !address?.serviceAreaId ? (
                <Alert variant="error">
                  Lịch lắp đặt chỉ khả dụng tại khu vực được hỗ trợ.
                </Alert>
              ) : slotsLoading ? (
                <p aria-live="polite" className="text-sm text-[var(--muted)]">
                  Đang tải lịch lắp đặt...
                </p>
              ) : slotError ? (
                <div>
                  <Alert variant="error">{slotError}</Alert>
                  <Button
                    className="mt-4"
                    intent="secondary"
                    onClick={reloadSlots}
                    type="button"
                  >
                    Thử tải lại
                  </Button>
                </div>
              ) : slots.length === 0 ? (
                <Alert variant="warning">
                  Chưa có khung giờ trong 14 ngày tới. Vui lòng thử lại sau.
                </Alert>
              ) : (
                <fieldset>
                  <legend className="text-sm text-[var(--muted)]">
                    Thời gian hiển thị theo múi giờ Việt Nam. Khung giờ chỉ được
                    giữ khi server tạo đơn thành công.
                  </legend>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {slots.map((slot) => (
                      <label
                        className="flex cursor-pointer items-start gap-3 rounded-md border p-4 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-soft)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55"
                        data-testid={`installation-slot-${slot.id}`}
                        key={slot.id}
                      >
                        <input
                          checked={slotId === slot.id}
                          className="mt-1 size-4 accent-[var(--primary)]"
                          disabled={slot.available <= 0}
                          name="installationSlot"
                          onChange={() => selectSlot(slot.id)}
                          type="radio"
                          value={slot.id}
                        />
                        <span className="text-sm">
                          <span className="block font-semibold">
                            {formatServiceDateTime(slot.startsAt)}
                          </span>
                          <span className="mt-1 block text-[var(--muted)]">
                            {slot.available > 0
                              ? `Còn ${slot.available} chỗ`
                              : 'Đã hết chỗ'}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <SectionTitle
              icon={<CreditCard aria-hidden="true" className="size-4" />}
              step={requiresInstallation ? '4' : '3'}
            >
              Phương thức thanh toán
            </SectionTitle>
          </CardHeader>
          <CardContent>
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">Chọn phương thức thanh toán</legend>
              {[
                {
                  description: 'Thanh toán khi nhận thiết bị.',
                  label: 'Thanh toán COD',
                  value: 'COD' as const,
                },
                {
                  description: 'Nhân viên xác nhận giao dịch thủ công.',
                  label: 'Chuyển khoản thủ công',
                  value: 'BANK_TRANSFER' as const,
                },
              ].map((method) => (
                <label
                  className="flex cursor-pointer items-start gap-3 rounded-md border p-4 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-soft)]"
                  key={method.value}
                >
                  <input
                    checked={paymentMethod === method.value}
                    className="mt-1 size-4 accent-[var(--primary)]"
                    name="paymentMethod"
                    onChange={() => {
                      setPaymentMethod(method.value);
                      resetCheckoutIntent();
                    }}
                    type="radio"
                    value={method.value}
                  />
                  <span className="text-sm">
                    <span className="block font-semibold">{method.label}</span>
                    <span className="mt-1 block text-[var(--muted)]">
                      {method.description}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-24" data-testid="checkout-summary">
        <CardHeader>
          <div className="flex items-center gap-2">
            <PackageCheck
              aria-hidden="true"
              className="size-5 text-[var(--primary)]"
            />
            <h2 className="font-bold">Tóm tắt đơn hàng</h2>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {cart.items.map((item) => (
              <li className="py-4 first:pt-0" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.name}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Số lượng: {item.quantity}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold">
                    {formatVnd(
                      (BigInt(item.deviceUnitPrice) +
                        BigInt(item.serviceUnitPrice)) *
                        BigInt(item.quantity),
                    )}
                  </p>
                </div>
                <p className="mt-2 flex items-start gap-2 text-sm text-[var(--muted)]">
                  <Wrench
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  {item.servicePackageName ?? 'Không có dịch vụ lắp đặt'}
                </p>
              </li>
            ))}
          </ul>

          <div className="border-t pt-4">
            {quoteLoading ? (
              <p aria-live="polite" className="text-sm text-[var(--muted)]">
                Đang xác nhận giá và phí...
              </p>
            ) : quoteError ? (
              <Alert variant="error">{quoteError}</Alert>
            ) : quote ? (
              <dl className="space-y-3 text-sm" data-testid="checkout-quote">
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Sản phẩm và dịch vụ</dt>
                  <dd className="font-medium">{formatVnd(quote.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Phí lắp đặt khu vực</dt>
                  <dd className="font-medium">
                    {formatVnd(quote.installationFee)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--muted)]">Phí giao hàng</dt>
                  <dd className="font-medium">
                    {formatVnd(quote.shippingFee)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t pt-4 text-base">
                  <dt className="font-bold">Tổng cộng</dt>
                  <dd className="font-bold text-[var(--primary)]">
                    {formatVnd(quote.grandTotal)}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm leading-6 text-[var(--muted)]">
                Chọn địa chỉ để server xác nhận giá và phí áp dụng.
              </p>
            )}
          </div>

          {checkoutError ? (
            <Alert className="mt-5" title="Chưa thể đặt hàng" variant="error">
              {checkoutError}
            </Alert>
          ) : null}

          <Button
            className="mt-5 w-full"
            data-testid="confirm-order"
            disabled={!canPlaceOrder}
            loading={orderSubmitting}
            onClick={() => void placeOrder()}
            size="lg"
            type="button"
          >
            <ShieldCheck aria-hidden="true" className="size-4" />
            Xác nhận đặt hàng
          </Button>
          <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
            Giá, tồn kho, quyền sở hữu giỏ hàng và khả năng phục vụ được server
            kiểm tra lại trong transaction khi tạo đơn.
          </p>
          <Link
            className={buttonVariants({
              className: 'mt-4 w-full',
              intent: 'secondary',
            })}
            href="/cart"
          >
            Quay lại giỏ hàng
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
