import type { FastifyRequest, FastifyReply } from "fastify";
import { TripsService } from "./trips.service";
import { IStorage } from "@server/storage.interface";
import { insertTripSchema } from "@shared/schema";
import { z } from "zod";

export class TripsController {
  private tripsService: TripsService;

  constructor(storage: IStorage) {
    this.tripsService = new TripsService(storage);
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const { date } = req.query as { date?: string };
    // Trips are system-wide resources (no outlet_id column in schema).
    // Outlet-scoped staff use GET /api/cso/available-trips (which enforces outlet).
    // This endpoint is primarily used by admin/manager roles that have no outlet restriction.
    const trips = await this.tripsService.getAllTrips(date as string);
    reply.send(trips);
  }

  async getCsoAvailableTrips(req: FastifyRequest, reply: FastifyReply) {
    const { date } = req.query as { date?: string };
    let { outletId } = req.query as { outletId?: string };
    
    // ABAC: enforce outlet scope unless CSO has cross_outlet permission.
    // With cross_outlet: CSO may browse any outlet's trips; payment is still recorded to their outlet.
    // Without cross_outlet: always override with their assigned outlet.
    const hasCrossOutlet = req.rbac?.flags.has('action.cso.cross_outlet') ?? false;
    if (!hasCrossOutlet) {
      const scopedOutlet = req.scopedOutletId ?? req.rbac?.outletId ?? null;
      if (scopedOutlet) {
        outletId = scopedOutlet;
      }
    }

    // Validate required parameters
    if (!date) {
      return reply.code(400).send({ error: 'date parameter is required' });
    }
    if (!outletId) {
      return reply.code(400).send({ error: 'outletId parameter is required' });
    }

    try {
      const trips = await this.tripsService.getCsoAvailableTrips(date as string, outletId as string);
      reply.send(trips);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return reply.code(404).send({ error: error.message });
      }
      throw error;
    }
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const trip = await this.tripsService.getTripById(id);
    reply.send(trip);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const validatedData = insertTripSchema.parse(req.body);
    const trip = await this.tripsService.createTrip(validatedData);
    reply.code(201).send(trip);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const validatedData = insertTripSchema.partial().parse(req.body);
    const trip = await this.tripsService.updateTrip(id, validatedData);
    reply.send(trip);
  }

  async delete(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    try {
      await this.tripsService.deleteTrip(id);
      reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'TRIP_HAS_ACTIVE_BOOKINGS') {
        return reply.code(409).send({
          error: 'Trip has active bookings',
          message: 'Cannot delete trip that has active bookings (pending or paid). Please cancel active bookings first.',
          code: 'TRIP_HAS_ACTIVE_BOOKINGS'
        });
      }
      throw error;
    }
  }

  async bulkDelete(req: FastifyRequest, reply: FastifyReply) {
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: 'ids must be a non-empty array' });
    }
    const result = await this.tripsService.bulkDeleteTrips(ids);
    reply.send(result);
  }

  async bulkUpdateStatus(req: FastifyRequest, reply: FastifyReply) {
    const { ids, status } = req.body as { ids: string[]; status: string };
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: 'ids must be a non-empty array' });
    }
    if (!['scheduled', 'cancelled', 'closed'].includes(status)) {
      return reply.code(400).send({ error: 'Invalid status value' });
    }
    const result = await this.tripsService.bulkUpdateTripStatus(ids, status);
    reply.send(result);
  }

  async deriveLegs(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.tripsService.deriveLegs(id);
    reply.send({ message: "Trip legs derived successfully" });
  }

  async precomputeSeatInventory(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.tripsService.precomputeSeatInventory(id);
    reply.send({ message: "Seat inventory precomputed successfully" });
  }

  async getSeatmap(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const schema = z.object({
      originSeq: z.coerce.number(),
      destinationSeq: z.coerce.number()
    });
    
    const { originSeq, destinationSeq } = schema.parse(req.query);
    const seatmap = await this.tripsService.getSeatmap(id, originSeq, destinationSeq);
    reply.send(seatmap);
  }

  async getSeatPassengerDetails(req: FastifyRequest, reply: FastifyReply) {
    const { tripId, seatNo } = req.params as { tripId: string; seatNo: string };
    const schema = z.object({
      originSeq: z.coerce.number(),
      destinationSeq: z.coerce.number()
    });
    
    const { originSeq, destinationSeq } = schema.parse(req.query);
    const passengerDetails = await this.tripsService.getSeatPassengerDetails(tripId, seatNo, originSeq, destinationSeq);
    reply.send(passengerDetails);
  }
}
