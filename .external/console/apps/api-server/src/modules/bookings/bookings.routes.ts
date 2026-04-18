import type { FastifyPluginAsync } from "fastify";
import { ListBookingsQueryParams } from "@workspace/api-zod";
import * as service from "./bookings.service.js";
import * as repo from "./bookings.repository.js";

const bookingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/bookings", async (request, reply) => {
    const parsed = ListBookingsQueryParams.safeParse(request.query);
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
    const { operatorId, status, page = 1, limit = 20, startDate, endDate } = parsed.data;
    return service.list({ operatorId, status, startDate, endDate }, { page, limit });
  });

  // Rekonsil manual: ubah status booking (untuk admin)
  fastify.post("/bookings/:id/reconcile", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, notes } = request.body as { status: string; notes?: string };

    const ALLOWED = ["confirmed", "cancelled", "expired", "pending", "completed"];
    if (!ALLOWED.includes(status)) {
      return reply.status(400).send({ error: `Status tidak valid. Pilih: ${ALLOWED.join(", ")}` });
    }

    const booking = await repo.findById(id);
    if (!booking) return reply.status(404).send({ error: "Booking tidak ditemukan" });

    await repo.updateStatus(id, status);

    return {
      success: true,
      bookingId: id,
      previousStatus: booking.status,
      newStatus: status,
      notes: notes || null,
    };
  });

  // Detail booking single (untuk halaman rekonsil)
  fastify.get("/bookings/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const booking = await repo.findById(id);
    if (!booking) return reply.status(404).send({ error: "Booking tidak ditemukan" });
    return service.formatBooking(booking);
  });
};

export default bookingsRoutes;
