import { IStorage } from "@server/storage.interface";
import { InsertPayment, Payment } from "@shared/schema";
import { requirePermission, type ServiceContext } from "@modules/rbac/rbac.guard";

/**
 * S1-09 (Sprint 2): pencatatan pembayaran kasir memanggil
 * `requirePermission(ctx, 'action.payment.create')` supaya hanya staf
 * dengan flag tersebut yang boleh menulis row payments. Caller internal
 * (mis. webhook payment gateway) wajib pakai SYSTEM_CONTEXT.
 */
export class PaymentsService {
  constructor(private storage: IStorage) {}

  async getPaymentsByBooking(bookingId: string): Promise<Payment[]> {
    return await this.storage.getPayments(bookingId);
  }

  async createPayment(data: InsertPayment, ctx: ServiceContext): Promise<Payment> {
    requirePermission(ctx, "action.payment.create");
    return await this.storage.createPayment(data);
  }
}
