import { z } from 'zod';

export const paymentCreateSchema = z
  .object({
    orderId: z.string().cuid(),
    paymentMethod: z.literal('VNPAY'),
  })
  .strict();

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
