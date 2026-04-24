import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { BookingsController } from "./bookings.controller";
import { RoundTripController } from "./roundTrip.controller";
import { IStorage } from "@server/storage.interface";
import { requireFlag, requireOutletScope } from "@modules/rbac/rbac.middleware";
import { webSocketService } from "@server/realtime/ws";
import { db } from "@server/db";
import { eq, and, inArray, sql, ilike } from "drizzle-orm";
import {
  bookingHistory, passengers as passengersTable, seatInventory, bookings as bookingsTable,
  bookingPromoApplications as bpaTable, promotions as promotionsTable, vouchers as vouchersTable
} from "@shared/schema";
import { trips } from "@shared/schema";

export function registerBookingsRoutes(app: FastifyInstance, storage: IStorage) {
  const bookingsController = new BookingsController(storage);
  const roundTripController = new RoundTripController(storage);

  app.post('/api/holds', async (req, reply) => bookingsController.createHold(req, reply));
  app.delete('/api/holds/:holdRef', async (req, reply) => bookingsController.releaseHold(req, reply));

  app.get('/api/bookings', { preHandler: [requireOutletScope()] }, async (req, reply) => bookingsController.getAll(req, reply));
  app.get('/api/bookings/by-code/:code', async (req, reply) => {
    const booking = await storage.getBookingByCode((req.params as any).code.toUpperCase());
    if (!booking) return reply.code(404).send({ message: 'Booking tidak ditemukan' });
    reply.send(booking);
  });
  app.get('/api/bookings/search', {
    preHandler: [requireFlag('page.bookings')],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (req, reply) => {
    const q = ((req.query as any).q || '').toUpperCase().trim();
    if (!q || q.length < 3) return reply.send([]);

    const bookingRows = await db
      .select({
        id: bookingsTable.id,
        bookingCode: bookingsTable.bookingCode,
        status: bookingsTable.status,
        totalAmount: bookingsTable.totalAmount,
        channel: bookingsTable.channel,
        snapOriginStopName: bookingsTable.snapOriginStopName,
        snapDestinationStopName: bookingsTable.snapDestinationStopName,
        snapDepartureHHMM: bookingsTable.snapDepartureHHMM,
        serviceDate: trips.serviceDate,
        createdAt: bookingsTable.createdAt,
      })
      .from(bookingsTable)
      .leftJoin(trips, eq(bookingsTable.tripId, trips.id))
      .where(ilike(bookingsTable.bookingCode, `%${q}%`))
      .orderBy(bookingsTable.createdAt)
      .limit(10);

    if (bookingRows.length === 0) return reply.send([]);

    const bookingIds = bookingRows.map(b => b.id);
    const paxRows = await db
      .select({
        bookingId: passengersTable.bookingId,
        id: passengersTable.id,
        fullName: passengersTable.fullName,
        seatNo: passengersTable.seatNo,
        phone: passengersTable.phone,
        ticketStatus: passengersTable.ticketStatus,
        fareAmount: passengersTable.fareAmount,
      })
      .from(passengersTable)
      .where(inArray(passengersTable.bookingId, bookingIds));

    const paxMap = new Map<string, typeof paxRows>();
    for (const p of paxRows) {
      const list = paxMap.get(p.bookingId) || [];
      list.push(p);
      paxMap.set(p.bookingId, list);
    }

    reply.send(bookingRows.map(b => {
      const passengers = paxMap.get(b.id) || [];
      return {
        id: b.id,
        bookingCode: b.bookingCode,
        status: b.status,
        totalAmount: b.totalAmount,
        channel: b.channel,
        originStop: b.snapOriginStopName,
        destinationStop: b.snapDestinationStopName,
        departureTime: b.snapDepartureHHMM,
        serviceDate: b.serviceDate,
        customerName: passengers[0]?.fullName || null,
        customerPhone: passengers[0]?.phone || null,
        passengers: passengers.map(p => ({
          id: p.id,
          fullName: p.fullName,
          seatNo: p.seatNo,
          phone: p.phone,
          ticketStatus: p.ticketStatus,
          fareAmount: p.fareAmount,
        })),
      };
    }));
  });
  app.get('/api/bookings/:id', async (req, reply) => bookingsController.getById(req, reply));
  app.post('/api/bookings', { preHandler: [requireFlag('action.booking.create')] }, async (req, reply) => bookingsController.create(req, reply));
  app.post('/api/bookings/pending', { preHandler: [requireFlag('action.booking.create')] }, async (req, reply) => bookingsController.createPendingBooking(req, reply));
  app.get('/api/bookings/pending', async (req, reply) => bookingsController.getPendingBookings(req, reply));
  app.delete('/api/bookings/pending/:id', { preHandler: [requireFlag('action.booking.cancel')] }, async (req, reply) => bookingsController.releasePendingBooking(req, reply));

  app.post('/api/passengers/:passengerId/unseat', { preHandler: [requireFlag('action.passenger.unseat')] }, async (req, reply) => bookingsController.unseatPassenger(req, reply));
  app.post('/api/passengers/:passengerId/assign-seat', { preHandler: [requireFlag('action.passenger.assign_seat')] }, async (req, reply) => bookingsController.assignSeatToUnseated(req, reply));
  app.post('/api/passengers/:passengerId/reschedule', { preHandler: [requireFlag('action.passenger.reschedule')] }, async (req, reply) => bookingsController.reschedulePassenger(req, reply));
  app.post('/api/bookings/:bookingId/unseat-all', { preHandler: [requireFlag('action.passenger.unseat')] }, async (req, reply) => bookingsController.unseatAllPassengers(req, reply));
  app.get('/api/bookings/:bookingId/history', async (req, reply) => bookingsController.getBookingHistory(req, reply));

  app.patch('/api/passengers/:id/cancel', { preHandler: [requireFlag('action.booking.cancel')] }, async (req, reply) => {
    const { reason } = (req.body as any) || {};
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return reply.code(400).send({ error: 'Alasan pembatalan wajib diisi' });
    }

    const [passengerRow] = await db.select().from(passengersTable).where(eq(passengersTable.id, (req.params as any).id));
    if (!passengerRow) return reply.code(404).send({ error: 'Penumpang tidak ditemukan' });
    if (passengerRow.ticketStatus === 'cancelled') return reply.code(400).send({ error: 'Tiket sudah dibatalkan' });

    const booking = await storage.getBookingById(passengerRow.bookingId);
    if (!booking) return reply.code(404).send({ error: 'Booking tidak ditemukan' });

    const previousStatus = passengerRow.ticketStatus || 'active';
    const legIndexes: number[] = [];
    for (let i = booking.originSeq; i < booking.destinationSeq; i++) legIndexes.push(i);

    const performedBy = req.user?.id ?? 'system';

    const updatedPassenger = await db.transaction(async (tx) => {
      const [updated] = await tx.update(passengersTable)
        .set({ ticketStatus: 'cancelled' })
        .where(eq(passengersTable.id, (req.params as any).id))
        .returning();

      if (passengerRow.seatNo && legIndexes.length > 0) {
        // When the reservation engine sidecar owns inventory writes
        // (RESERVATION_ENGINE_ENABLED=true), the engine's HTTP cancel-seats
        // endpoint runs in its own DB tx — we can't compose it inside this
        // outer tx safely. Defer the release to AFTER tx.commit() below.
        // When the flag is off, do the legacy inline SQL inside the tx so
        // behavior is unchanged.
        const { isEngineEnabled } = await import("@modules/holds/holdsAdapter");
        if (!isEngineEnabled()) {
          await tx.update(seatInventory)
            .set({ booked: false, holdRef: null })
            .where(and(
              eq(seatInventory.tripId, booking.tripId),
              eq(seatInventory.seatNo, passengerRow.seatNo),
              inArray(seatInventory.legIndex, legIndexes)
            ));
        }
      }

      await tx.insert(bookingHistory).values({
        bookingId: booking.id,
        passengerId: (req.params as any).id,
        action: 'cancelled',
        details: {
          seatNo: passengerRow.seatNo,
          reason: reason.trim(),
          previousStatus
        },
        performedBy
      });

      const allPassengers = await tx.select().from(passengersTable).where(eq(passengersTable.bookingId, booking.id));
      const allInactive = allPassengers.every(p =>
        p.ticketStatus === 'cancelled' || p.ticketStatus === 'unseated' ||
        p.ticketStatus === 'refunded' || p.ticketStatus === 'no_show'
      );
      if (allInactive) {
        await tx.update(bookingsTable)
          .set({ status: 'cancelled' })
          .where(eq(bookingsTable.id, booking.id));

        // S1-03: decrement promo usageCount + revert voucher 'active' kalau
        // booking transit ke cancelled. GREATEST() supaya tidak negatif.
        const apps = await tx.select().from(bpaTable).where(eq(bpaTable.bookingId, booking.id));
        for (const app of apps) {
          await tx.update(promotionsTable)
            .set({ usageCount: sql`GREATEST(0, ${promotionsTable.usageCount} - 1)` })
            .where(eq(promotionsTable.id, app.promoId));
          if (app.voucherId) {
            await tx.update(vouchersTable)
              .set({ status: 'active', usedAt: null, usedByBookingId: null })
              .where(eq(vouchersTable.id, app.voucherId));
          }
        }
      }

      return updated;
    });

    // Engine-mode: release the seat back to inventory via the engine AFTER
    // the local booking-state tx has committed. The engine runs its own DB
    // tx, so composing it inside the outer tx would either deadlock or
    // produce inconsistent state on partial failure. Doing it post-commit
    // matches how cancel-seats works in single-writer Node mode (the SQL
    // and the booking row update are functionally one logical operation).
    let engineModeCancel = false;
    if (passengerRow.seatNo && legIndexes.length > 0) {
      const { isEngineEnabled } = await import("@modules/holds/holdsAdapter");
      engineModeCancel = isEngineEnabled();
      if (engineModeCancel) {
        try {
          const { HoldsAdapter } = await import("@modules/holds/holdsAdapter");
          const { AtomicHoldService } = await import("./atomicHold.service");
          const adapter = new HoldsAdapter(new AtomicHoldService(storage));
          await adapter.cancelSeats({
            tripId: booking.tripId,
            seatNo: passengerRow.seatNo,
            legIndexes,
          });
        } catch (e) {
          // Booking is already marked cancelled in TT; engine call failed.
          // Enqueue for the scheduler to retry asynchronously, then surface
          // a 502 so the operator knows the seat may not be sellable yet.
          // The retry guarantees we never leak the seat permanently.
          console.error('[BOOKINGS] engine cancelSeats failed after tx commit, enqueuing:', e);
          const { enqueueCancelSeats } = await import("@modules/holds/compensationQueue");
          await enqueueCancelSeats({
            tripId: booking.tripId,
            seatNo: passengerRow.seatNo,
            legIndexes,
            context: { source: 'bookings.routes.cancel', bookingId: booking.id, passengerId: passengerRow.id },
          });
          return reply.code(502).send({
            error: 'Booking marked cancelled. Seat release queued for retry — it will become available within a minute.',
          });
        }
      }
    }

    // Adapter.cancelSeats already emitted per-seat WS in engine mode.
    if (passengerRow.seatNo && !engineModeCancel) {
      for (const legIdx of legIndexes) {
        webSocketService.emitInventoryUpdated(booking.tripId, passengerRow.seatNo, [legIdx]);
      }
    }

    reply.send(updatedPassenger);
  });

  app.get('/api/tickets/:ticketNumber', async (req, reply) => {
    const passenger = await storage.getPassengerByTicketNumber((req.params as any).ticketNumber.toUpperCase());
    if (!passenger) return reply.code(404).send({ message: 'Tiket tidak ditemukan' });
    reply.send(passenger);
  });

  app.post('/api/bookings/round-trip', { preHandler: [requireFlag('action.booking.create')] }, async (req, reply) => roundTripController.createRoundTrip(req, reply));
  app.get('/api/booking-groups/:groupCode', async (req, reply) => roundTripController.getGroupByCode(req, reply));
}
