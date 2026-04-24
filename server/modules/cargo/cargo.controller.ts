import type { FastifyRequest, FastifyReply } from "fastify";
import { CargoService } from "./cargo.service";
import { IStorage } from "@server/storage.interface";
import { insertCargoShipmentSchema, insertCargoTypeSchema, insertCargoRateSchema } from "@shared/schema";
import { buildServiceContext } from "@modules/rbac/rbac.guard";

export class CargoController {
  private cargoService: CargoService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.cargoService = new CargoService(storage);
    this.storage = storage;
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const { tripId, status } = req.query as any;
    const scopedOutlet = req.scopedOutletId ?? req.rbac?.outletId ?? null;
    const outletId = scopedOutlet ?? (req.query as any).outletId;
    const shipments = await this.cargoService.getAllShipments({
      tripId: tripId as string,
      status: status as string,
      outletId: outletId as string
    });
    const pageParam = (req.query as any).page;
    if (pageParam) {
      const page = Math.max(1, parseInt(pageParam) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt((req.query as any).pageSize) || 50));
      const total = shipments.length;
      const paginated = shipments.slice((page - 1) * pageSize, page * pageSize);
      return reply.send({ data: paginated, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    }
    reply.send(shipments);
  }

  async getById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const shipment = await this.cargoService.getShipmentById(id);
    reply.send(shipment);
  }

  async getByWaybill(req: FastifyRequest, reply: FastifyReply) {
    const { waybillNumber } = req.params as { waybillNumber: string };
    const shipment = await this.cargoService.getShipmentByWaybill(waybillNumber);
    reply.send(shipment);
  }

  async create(req: FastifyRequest, reply: FastifyReply) {
    const validated = insertCargoShipmentSchema.omit({ waybillNumber: true }).parse(req.body);
    const scopedOutlet = req.scopedOutletId ?? req.rbac?.outletId ?? null;
    if (scopedOutlet) {
      validated.outletId = scopedOutlet;
    }
    const shipment = await this.cargoService.createShipment(validated, buildServiceContext(req));
    reply.code(201).send(shipment);
  }

  async update(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const validated = insertCargoShipmentSchema.partial().parse(req.body);
    const shipment = await this.cargoService.updateShipment(id, validated, buildServiceContext(req));
    reply.send(shipment);
  }

  async updateStatus(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const { status } = (req.body ?? {}) as { status?: string };
    if (!status) {
      return reply.code(400).send({ error: 'Status is required' });
    }
    try {
      const shipment = await this.cargoService.updateShipmentStatus(id, status, buildServiceContext(req));
      reply.send(shipment);
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message?.includes('Invalid status') || err.message?.includes('Cannot transition')) {
        return reply.code(400).send({ error: err.message });
      }
      throw error;
    }
  }

  async getAvailableTrips(req: FastifyRequest, reply: FastifyReply) {
    const { date, originStopId, destinationStopId } = req.query as any;
    if (!date || !originStopId || !destinationStopId) {
      return reply.code(400).send({ error: 'date, originStopId, destinationStopId are required' });
    }
    const trips = await this.cargoService.getAvailableTrips(date, originStopId, destinationStopId);
    reply.send(trips);
  }

  async quoteTariff(req: FastifyRequest, reply: FastifyReply) {
    const { cargoTypeId, originStopId, destinationStopId, weightKg, tripId } = req.query as { cargoTypeId?: string; originStopId?: string; destinationStopId?: string; weightKg?: string; tripId?: string };
    if (!cargoTypeId || !originStopId || !destinationStopId || !weightKg) {
      return reply.code(400).send({ error: 'cargoTypeId, originStopId, destinationStopId, weightKg are required' });
    }
    const result = await this.cargoService.calculateTariff(
      cargoTypeId as string,
      originStopId as string,
      destinationStopId as string,
      parseFloat(weightKg as string),
      tripId as string | undefined
    );
    if (!result) {
      return reply.send({ found: false, calculatedAmount: 0 });
    }
    reply.send({ found: true, ...result });
  }

  async getCargoTypes(_req: FastifyRequest, reply: FastifyReply) {
    const types = await this.storage.getCargoTypes();
    reply.send(types);
  }

  async getCargoTypeById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const ct = await this.storage.getCargoTypeById(id);
    if (!ct) return reply.code(404).send({ error: 'Cargo type not found' });
    reply.send(ct);
  }

  async createCargoType(req: FastifyRequest, reply: FastifyReply) {
    const validated = insertCargoTypeSchema.parse(req.body);
    const ct = await this.storage.createCargoType(validated);
    reply.code(201).send(ct);
  }

  async updateCargoType(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const validated = insertCargoTypeSchema.partial().parse(req.body);
    const ct = await this.storage.updateCargoType(id, validated);
    reply.send(ct);
  }

  async deleteCargoType(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.storage.deleteCargoType(id);
    reply.code(204).send();
  }

  async getCargoRates(req: FastifyRequest, reply: FastifyReply) {
    const { cargoTypeId } = req.query as { cargoTypeId?: string };
    const rates = await this.storage.getCargoRates(cargoTypeId as string);
    reply.send(rates);
  }

  async getCargoRateById(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const cr = await this.storage.getCargoRateById(id);
    if (!cr) return reply.code(404).send({ error: 'Cargo rate not found' });
    reply.send(cr);
  }

  async createCargoRate(req: FastifyRequest, reply: FastifyReply) {
    const validated = insertCargoRateSchema.parse(req.body);
    if (validated.scope && validated.scope !== 'global' && !validated.scopeRefId) {
      return reply.code(400).send({ message: 'scopeRefId is required when scope is pattern or trip' });
    }
    const cr = await this.storage.createCargoRate(validated);
    reply.code(201).send(cr);
  }

  async updateCargoRate(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const validated = insertCargoRateSchema.partial().parse(req.body);
    const existing = await this.storage.getCargoRateById(id);
    if (!existing) return reply.code(404).send({ error: 'Cargo rate not found' });
    const effectiveScope = validated.scope ?? existing.scope ?? 'global';
    const effectiveRefId = validated.scopeRefId !== undefined ? validated.scopeRefId : existing.scopeRefId;
    if (effectiveScope !== 'global' && !effectiveRefId) {
      return reply.code(400).send({ message: 'scopeRefId is required when scope is pattern or trip' });
    }
    const cr = await this.storage.updateCargoRate(id, validated);
    reply.send(cr);
  }

  async deleteCargoRate(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.storage.deleteCargoRate(id);
    reply.code(204).send();
  }
}
