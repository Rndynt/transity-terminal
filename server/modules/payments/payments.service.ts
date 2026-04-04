import { IStorage } from "@server/storage.interface";
import { InsertPayment, Payment } from "@shared/schema";

export class PaymentsService {
  constructor(private storage: IStorage) {}

  async getPaymentsByBooking(bookingId: string): Promise<Payment[]> {
    return await this.storage.getPayments(bookingId);
  }

  async createPayment(data: InsertPayment): Promise<Payment> {
    return await this.storage.createPayment(data);
  }
}
