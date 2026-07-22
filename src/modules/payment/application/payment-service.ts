import { createHash, randomBytes } from 'node:crypto';

import {
  PaymentMethod,
  PaymentSessionStatus,
  PaymentStatus,
  PaymentWebhookOutcome,
  Prisma,
} from '@prisma/client';

import { CatalogError } from '@/modules/catalog';
import { lockPayment } from '@/modules/commerce/infrastructure/order-repository';
import { type IdentityActor } from '@/modules/identity';
import {
  canApplyWebhookOutcome,
  canStartOnlinePayment,
  webhookPaymentOutcome,
} from '@/modules/payment/domain/payment-lifecycle';
import {
  buildVnpayPaymentUrl,
  getVnpayConfig,
  parseVnpayDate,
  toVnpayDate,
  verifyVnpaySignature,
  vnpayEventKey,
  type VnpayParameters,
} from '@/modules/payment/infrastructure/vnpay';
import { type PaymentCreateInput } from '@/modules/payment/presentation/schemas';
import { prisma } from '@/shared/db/client';

const sessionMinutes = 15;

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requireCustomer(actor: IdentityActor | null): IdentityActor {
  if (!actor) throw new CatalogError('UNAUTHENTICATED');
  if (!actor.roles.includes('CUSTOMER')) throw new CatalogError('FORBIDDEN');
  return actor;
}

function providerReference(): string {
  return `247${Date.now()}${randomBytes(5).toString('hex')}`;
}

function normalizedClientIp(value: string): string {
  const candidate = value.split(',')[0]?.trim() ?? '';
  return /^[0-9a-fA-F:.]{3,45}$/.test(candidate) ? candidate : '127.0.0.1';
}

function paymentDescription(orderNumber: string): string {
  return `Thanh toan don hang ${orderNumber}`.slice(0, 255);
}

function sessionDto(
  session: {
    id: string;
    providerReference: string;
    expiresAt: Date;
    payment: {
      id: string;
      amount: bigint;
      currency: string;
      order: { orderNumber: string };
    };
  },
  clientIp: string,
) {
  const config = getVnpayConfig();
  const createdAt = new Date();
  const parameters: VnpayParameters = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: config.tmnCode,
    vnp_Amount: (session.payment.amount * 100n).toString(),
    vnp_CurrCode: session.payment.currency,
    vnp_TxnRef: session.providerReference,
    vnp_OrderInfo: paymentDescription(session.payment.order.orderNumber),
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: config.returnUrl,
    vnp_IpAddr: normalizedClientIp(clientIp),
    vnp_CreateDate: toVnpayDate(createdAt),
    vnp_ExpireDate: toVnpayDate(session.expiresAt),
  };
  return {
    id: session.payment.id,
    sessionId: session.id,
    status: PaymentStatus.PROCESSING,
    amount: session.payment.amount.toString(),
    currency: session.payment.currency,
    expiresAt: session.expiresAt,
    paymentUrl: buildVnpayPaymentUrl(config, parameters),
  };
}

export async function createOnlinePaymentSession(
  actor: IdentityActor | null,
  input: PaymentCreateInput,
  idempotencyKey: string,
  clientIp: string,
  requestId: string,
) {
  const customer = requireCustomer(actor);
  const keyHash = hash(idempotencyKey);
  const fingerprint = hash(JSON.stringify(input));
  const reference = providerReference();
  const expiresAt = new Date(Date.now() + sessionMinutes * 60 * 1_000);

  const result = await prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findFirst({
      where: { id: input.orderId, userId: customer.userId },
      select: {
        id: true,
        orderNumber: true,
        grandTotal: true,
        currency: true,
        payment: { select: { id: true } },
      },
    });
    if (!order?.payment) throw new CatalogError('NOT_FOUND');
    if (!(await lockPayment(transaction, order.payment.id)))
      throw new CatalogError('NOT_FOUND');

    const payment = await transaction.payment.findUniqueOrThrow({
      where: { id: order.payment.id },
      include: {
        order: {
          select: { orderNumber: true, grandTotal: true, currency: true },
        },
      },
    });
    if (payment.method !== PaymentMethod.VNPAY)
      throw new CatalogError('INVALID_STATE_TRANSITION');
    if (
      payment.amount !== payment.order.grandTotal ||
      payment.currency !== payment.order.currency ||
      payment.currency !== 'VND'
    )
      throw new CatalogError('CONFLICT', 'PAYMENT_AMOUNT_MISMATCH');
    if (!canStartOnlinePayment(payment.status))
      throw new CatalogError('INVALID_STATE_TRANSITION');

    const previous = await transaction.paymentSession.findUnique({
      where: {
        paymentId_idempotencyHash: {
          paymentId: payment.id,
          idempotencyHash: keyHash,
        },
      },
      include: {
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            order: { select: { orderNumber: true } },
          },
        },
      },
    });
    if (previous) {
      if (previous.requestFingerprint !== fingerprint)
        throw new CatalogError('IDEMPOTENCY_CONFLICT');
      return { replayed: true, session: previous };
    }

    const updated = await transaction.payment.updateMany({
      where: {
        id: payment.id,
        version: payment.version,
        status: payment.status,
      },
      data: { status: PaymentStatus.PROCESSING, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new CatalogError('CONCURRENT_MODIFICATION');

    const session = await transaction.paymentSession.create({
      data: {
        paymentId: payment.id,
        provider: PaymentMethod.VNPAY,
        status: PaymentSessionStatus.PENDING,
        providerReference: reference,
        idempotencyHash: keyHash,
        requestFingerprint: fingerprint,
        expiresAt,
      },
      include: {
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            order: { select: { orderNumber: true } },
          },
        },
      },
    });
    await transaction.auditLog.create({
      data: {
        actorUserId: customer.userId,
        action: 'payment.session_created',
        targetType: 'payment',
        targetId: payment.id,
        before: { status: payment.status, version: payment.version },
        after: {
          status: PaymentStatus.PROCESSING,
          version: payment.version + 1,
          provider: PaymentMethod.VNPAY,
          sessionId: session.id,
        },
        requestId,
      },
    });
    return { replayed: false, session };
  });

  return {
    replayed: result.replayed,
    payment: sessionDto(result.session, clientIp),
  };
}

const paymentDetailSelect = {
  id: true,
  method: true,
  status: true,
  amount: true,
  currency: true,
  referenceCode: true,
  providerTransactionId: true,
  providerResponseCode: true,
  paidAt: true,
  failedAt: true,
  updatedAt: true,
  version: true,
  order: {
    select: { id: true, orderNumber: true, userId: true, status: true },
  },
} satisfies Prisma.PaymentSelect;

export async function getCustomerPayment(
  actor: IdentityActor | null,
  paymentId: string,
) {
  const customer = requireCustomer(actor);
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, order: { userId: customer.userId } },
    select: paymentDetailSelect,
  });
  if (!payment) throw new CatalogError('NOT_FOUND');
  return {
    ...payment,
    amount: payment.amount.toString(),
    order: {
      id: payment.order.id,
      orderNumber: payment.order.orderNumber,
      status: payment.order.status,
    },
  };
}

export async function getCustomerPaymentByProviderReference(
  actor: IdentityActor | null,
  providerReference: string,
) {
  const customer = requireCustomer(actor);
  const session = await prisma.paymentSession.findFirst({
    where: {
      providerReference,
      payment: { order: { userId: customer.userId } },
    },
    select: { payment: { select: paymentDetailSelect } },
  });
  if (!session) throw new CatalogError('NOT_FOUND');
  return {
    ...session.payment,
    amount: session.payment.amount.toString(),
    order: {
      id: session.payment.order.id,
      orderNumber: session.payment.order.orderNumber,
      status: session.payment.order.status,
    },
  };
}

export type VnpayWebhookResult = {
  message: string;
  rspCode: '00' | '01' | '02' | '04';
};

export async function processVnpayWebhook(
  parameters: VnpayParameters,
  requestId: string,
): Promise<VnpayWebhookResult> {
  const config = getVnpayConfig();
  if (!verifyVnpaySignature(parameters, config.hashSecret))
    throw new CatalogError('FORBIDDEN', 'INVALID_PAYMENT_SIGNATURE');
  if (parameters.vnp_TmnCode !== config.tmnCode)
    throw new CatalogError('FORBIDDEN', 'INVALID_MERCHANT');

  const reference = parameters.vnp_TxnRef;
  const providerTransactionId = parameters.vnp_TransactionNo;
  const responseCode = parameters.vnp_ResponseCode;
  const transactionStatus = parameters.vnp_TransactionStatus;
  const rawAmount = parameters.vnp_Amount;
  if (
    !reference ||
    !providerTransactionId ||
    !responseCode ||
    !transactionStatus ||
    !rawAmount ||
    !/^\d{1,14}$/.test(rawAmount)
  )
    throw new CatalogError('CONFLICT', 'INVALID_PROVIDER_PAYLOAD');

  const eventKey = vnpayEventKey(parameters);
  const next = webhookPaymentOutcome({ responseCode, transactionStatus });

  return prisma.$transaction(async (transaction) => {
    const session = await transaction.paymentSession.findUnique({
      where: { providerReference: reference },
      select: { id: true, paymentId: true, status: true },
    });
    if (!session) return { rspCode: '01', message: 'Order not found' };
    if (!(await lockPayment(transaction, session.paymentId)))
      return { rspCode: '01', message: 'Order not found' };

    const existingEvent = await transaction.paymentWebhookEvent.findUnique({
      where: { eventKey },
      select: { id: true },
    });
    if (existingEvent)
      return { rspCode: '02', message: 'Order already confirmed' };

    const payment = await transaction.payment.findUniqueOrThrow({
      where: { id: session.paymentId },
      include: { order: true },
    });
    const providerAmount = BigInt(rawAmount);
    if (
      payment.method !== PaymentMethod.VNPAY ||
      payment.currency !== 'VND' ||
      providerAmount !== payment.amount * 100n
    )
      return { rspCode: '04', message: 'Invalid amount' };

    const applicable = canApplyWebhookOutcome(payment.status, next);
    if (!applicable) {
      await transaction.paymentWebhookEvent.create({
        data: {
          paymentId: payment.id,
          sessionId: session.id,
          provider: PaymentMethod.VNPAY,
          eventKey,
          providerTransactionId,
          amount: providerAmount,
          currency: payment.currency,
          responseCode,
          transactionStatus,
          payDate: parseVnpayDate(parameters.vnp_PayDate),
          outcome: PaymentWebhookOutcome.DUPLICATE,
          requestId,
          processedAt: new Date(),
        },
      });
      return { rspCode: '02', message: 'Order already confirmed' };
    }

    const now = new Date();
    const updated = await transaction.payment.updateMany({
      where: {
        id: payment.id,
        version: payment.version,
        status: payment.status,
      },
      data: {
        status: next,
        version: { increment: 1 },
        ...(next === 'PAID' ? { providerTransactionId } : {}),
        providerResponseCode: responseCode,
        ...(next === 'PAID' ? { paidAt: now } : { failedAt: now }),
      },
    });
    if (updated.count !== 1) throw new CatalogError('CONCURRENT_MODIFICATION');

    await transaction.paymentSession.update({
      where: { id: session.id },
      data: {
        status:
          next === 'PAID'
            ? PaymentSessionStatus.COMPLETED
            : PaymentSessionStatus.FAILED,
        completedAt: now,
      },
    });

    let orderStatus = payment.order.status;
    let orderVersion = payment.order.version;
    if (next === 'PAID' && payment.order.status === 'PENDING_CONFIRMATION') {
      const confirmed = await transaction.order.updateMany({
        where: {
          id: payment.order.id,
          version: payment.order.version,
          status: 'PENDING_CONFIRMATION',
        },
        data: {
          status: 'CONFIRMED',
          confirmedAt: now,
          version: { increment: 1 },
        },
      });
      if (confirmed.count !== 1)
        throw new CatalogError('CONCURRENT_MODIFICATION');
      orderStatus = 'CONFIRMED';
      orderVersion += 1;
    }

    await transaction.paymentWebhookEvent.create({
      data: {
        paymentId: payment.id,
        sessionId: session.id,
        provider: PaymentMethod.VNPAY,
        eventKey,
        providerTransactionId,
        amount: providerAmount,
        currency: payment.currency,
        responseCode,
        transactionStatus,
        payDate: parseVnpayDate(parameters.vnp_PayDate),
        outcome: PaymentWebhookOutcome.PROCESSED,
        requestId,
        processedAt: now,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorUserId: payment.order.userId,
        action: next === 'PAID' ? 'payment.vnpay_paid' : 'payment.vnpay_failed',
        targetType: 'payment',
        targetId: payment.id,
        before: { status: payment.status, version: payment.version },
        after: {
          status: next,
          version: payment.version + 1,
          orderStatus,
          orderVersion,
          provider: PaymentMethod.VNPAY,
          responseCode,
        },
        requestId,
      },
    });
    return { rspCode: '00', message: 'Confirm Success' };
  });
}
