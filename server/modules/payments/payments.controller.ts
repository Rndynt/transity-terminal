import type { FastifyRequest, FastifyReply } from "fastify";
import { PaymentsService } from "./payments.service";
import { IStorage } from "../../storage.interface";
import { insertPaymentSchema } from "@shared/schema";

export class PaymentsController {
  private paymentsService: PaymentsService;

  constructor(storage: IStorage) {
    this.paymentsService = new PaymentsService(storage);
  }

  async getByBooking(req: FastifyRequest, reply: FastifyReply) {
    const { bookingId } = req.params;
    const payments = await this.paymentsService.getPaymentsByBooking(bookingId);
    reply.send(payments);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const validatedData = insertPaymentSchema.parse(req.body);
    const payment = await this.paymentsService.createPayment(validatedData);
    reply.code(201).send(payment);
  }
}
