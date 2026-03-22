import { Request, Response } from "express";
import { TripsService } from "./trips.service";
import { IStorage } from "../../routes";
import { insertTripSchema } from "@shared/schema";
import { z } from "zod";

export class TripsController {
  private tripsService: TripsService;

  constructor(storage: IStorage) {
    this.tripsService = new TripsService(storage);
  }

  async getAll(req: Request, res: Response) {
    const { date } = req.query;
    // Trips are system-wide resources (no outlet_id column in schema).
    // Outlet-scoped staff use GET /api/cso/available-trips (which enforces outlet).
    // This endpoint is primarily used by admin/manager roles that have no outlet restriction.
    const trips = await this.tripsService.getAllTrips(date as string);
    res.json(trips);
  }

  async getCsoAvailableTrips(req: Request, res: Response) {
    const { date } = req.query;
    let { outletId } = req.query;
    
    // ABAC: if the authenticated user has an outlet scope, enforce it — ignore client-supplied outletId
    const scopedOutlet = req.scopedOutletId ?? req.rbac?.outletId ?? null;
    if (scopedOutlet) {
      outletId = scopedOutlet;
    }

    // Validate required parameters
    if (!date) {
      return res.status(400).json({ error: 'date parameter is required' });
    }
    if (!outletId) {
      return res.status(400).json({ error: 'outletId parameter is required' });
    }

    try {
      const trips = await this.tripsService.getCsoAvailableTrips(date as string, outletId as string);
      res.json(trips);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      throw error;
    }
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const trip = await this.tripsService.getTripById(id);
    res.json(trip);
  }

  async create(req: Request, res: Response) {
    const validatedData = insertTripSchema.parse(req.body);
    const trip = await this.tripsService.createTrip(validatedData);
    res.status(201).json(trip);
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const validatedData = insertTripSchema.partial().parse(req.body);
    const trip = await this.tripsService.updateTrip(id, validatedData);
    res.json(trip);
  }

  async delete(req: Request, res: Response) {
    const { id } = req.params;
    try {
      await this.tripsService.deleteTrip(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'TRIP_HAS_ACTIVE_BOOKINGS') {
        return res.status(409).json({
          error: 'Trip has active bookings',
          message: 'Cannot delete trip that has active bookings (pending or paid). Please cancel active bookings first.',
          code: 'TRIP_HAS_ACTIVE_BOOKINGS'
        });
      }
      throw error;
    }
  }

  async deriveLegs(req: Request, res: Response) {
    const { id } = req.params;
    await this.tripsService.deriveLegs(id);
    res.json({ message: "Trip legs derived successfully" });
  }

  async precomputeSeatInventory(req: Request, res: Response) {
    const { id } = req.params;
    await this.tripsService.precomputeSeatInventory(id);
    res.json({ message: "Seat inventory precomputed successfully" });
  }

  async getSeatmap(req: Request, res: Response) {
    const { id } = req.params;
    const schema = z.object({
      originSeq: z.coerce.number(),
      destinationSeq: z.coerce.number()
    });
    
    const { originSeq, destinationSeq } = schema.parse(req.query);
    const seatmap = await this.tripsService.getSeatmap(id, originSeq, destinationSeq);
    res.json(seatmap);
  }

  async getSeatPassengerDetails(req: Request, res: Response) {
    const { tripId, seatNo } = req.params;
    const schema = z.object({
      originSeq: z.coerce.number(),
      destinationSeq: z.coerce.number()
    });
    
    const { originSeq, destinationSeq } = schema.parse(req.query);
    const passengerDetails = await this.tripsService.getSeatPassengerDetails(tripId, seatNo, originSeq, destinationSeq);
    res.json(passengerDetails);
  }
}
