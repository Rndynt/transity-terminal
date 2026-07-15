import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { CargoService } from "./cargo.service";
import { CargoRatesService, StaleCargoRateError } from "./cargoRates.service";
import { listPricedDestinationsFromOriginCargo } from "./cargoRates.resolver";
import { IStorage } from "@server/storage.interface";
import { insertCargoShipmentSchema, insertCargoTypeSchema } from "@shared/schema";
import { buildServiceContext } from "@modules/rbac/rbac.guard";
import { LIST_DEFAULT_LIMIT, LIST_MAX_LIMIT } from "@server/constants/pagination";

const cargoCellSchema = z.object({
  originStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
  pricePerKg: z.coerce.number().min(0),
});

const saveCargoRateSchema = z.object({
  patternId: z.string().uuid(),
  cargoTypeId: z.string().uuid(),
  kind: z.enum(['regular', 'seasonal']).default('regular'),
  matrixId: z.string().uuid().optional(),
  name: z.string().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  cells: z.array(cargoCellSchema),
  expectedUpdatedAt: z.string().nullable(),
});

const cargoSeasonalCreateSchema = z.object({
  name: z.string().min(1, 'Nama template wajib diisi'),
  validFrom: z.string(),
  validTo: z.string(),
  duplicateFromRegular: z.boolean().default(true),
});

const cargoTripExceptionUpsertSchema = z.object({
  tripId: z.string().uuid(),
  cargoTypeId: z.string().uuid(),
  originStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
  pricePerKg: z.coerce.number().min(0),
});

const duplicateCargoRateSchema = z.object({
  sourceMatrixId: z.string().uuid(),
  toCargoTypeId: z.string().uuid(),
});

export class CargoController {
  private cargoService: CargoService;
  private cargoRatesService: CargoRatesService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.cargoService = new CargoService(storage);
    this.cargoRatesService = new CargoRatesService(storage);
    this.storage = storage;
  }

  async getAll(req: FastifyRequest, reply: FastifyReply) {
    const query = (req.query as { tripId?: string; status?: string; outletId?: string; page?: string; pageSize?: string } | undefined) || {};
    const { tripId, status } = query;
    const scopedOutlet = req.scopedOutletId ?? req.rbac?.outletId ?? null;
    const outletId = scopedOutlet ?? query.outletId;
    const filters = {
      tripId: tripId as string,
      status: status as string,
      outletId: outletId as string,
    };
    const pageParam = query.page;

    if (pageParam) {
      // β-2: SQL-level pagination (sebelumnya pull all rows lalu .slice() di JS).
      const page = Math.max(1, parseInt(pageParam) || 1);
      const pageSize = Math.min(LIST_MAX_LIMIT, Math.max(1, parseInt(query.pageSize ?? '') || 50));
      const offset = (page - 1) * pageSize;
      const [data, total] = await Promise.all([
        this.cargoService.getAllShipments(filters, { limit: pageSize, offset }),
        this.cargoService.countShipments(filters),
      ]);
      return reply.send({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    }

    // β-2: cap legacy unwrapped response juga supaya tidak unbounded.
    // Caller yang butuh > LIST_DEFAULT_LIMIT row harus pakai ?page query.
    const shipments = await this.cargoService.getAllShipments(filters, { limit: LIST_DEFAULT_LIMIT });
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
    if (validated.destinationOutletId) {
      const destOutlet = await this.storage.getOutletById(validated.destinationOutletId);
      if (!destOutlet || destOutlet.stopId !== validated.destinationStopId) {
        return reply.code(400).send({ error: 'destinationOutletId tidak berada di destinationStopId yang dikirim' });
      }
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
    const { date, originStopId, destinationStopId, destinationStopIds } = (req.query as {
      date?: string; originStopId?: string; destinationStopId?: string; destinationStopIds?: string;
    } | undefined) || {};
    // destinationStopIds (CSV) mendukung pencarian per-kota (banyak stop
    // sekaligus); destinationStopId (single) dipertahankan untuk kompatibilitas.
    const stopIds = destinationStopIds
      ? destinationStopIds.split(',').map(s => s.trim()).filter(Boolean)
      : (destinationStopId ? [destinationStopId] : []);
    if (!date || !originStopId || stopIds.length === 0) {
      return reply.code(400).send({ error: 'date, originStopId, and destinationStopId(s) are required' });
    }
    const trips = await this.cargoService.getAvailableTrips(date, originStopId, stopIds);
    reply.send(trips);
  }

  async quoteTariff(req: FastifyRequest, reply: FastifyReply) {
    const { cargoTypeId, originStopId, destinationStopId, weightKg, tripId, serviceDate } = req.query as { cargoTypeId?: string; originStopId?: string; destinationStopId?: string; weightKg?: string; tripId?: string; serviceDate?: string };
    if (!cargoTypeId || !originStopId || !destinationStopId || !weightKg) {
      return reply.code(400).send({ error: 'cargoTypeId, originStopId, destinationStopId, weightKg are required' });
    }
    const result = await this.cargoService.calculateTariff(
      cargoTypeId as string,
      originStopId as string,
      destinationStopId as string,
      parseFloat(weightKg as string),
      tripId as string | undefined,
      serviceDate as string | undefined,
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

  async getCargoRatePatternGrid(req: FastifyRequest, reply: FastifyReply) {
    const { patternId } = req.params as { patternId: string };
    const { cargoTypeId, kind, matrixId } = req.query as { cargoTypeId?: string; kind?: 'regular' | 'seasonal'; matrixId?: string };
    if (!cargoTypeId) {
      return reply.code(400).send({ error: 'cargoTypeId wajib diisi' });
    }
    const grid = await this.cargoRatesService.getPatternCargoGrid(patternId, cargoTypeId, kind ?? 'regular', matrixId);
    reply.send(grid);
  }

  async saveCargoRate(req: FastifyRequest, reply: FastifyReply) {
    try {
      const data = saveCargoRateSchema.parse(req.body);
      const saved = await this.cargoRatesService.saveCargoRate(data, buildServiceContext(req));
      reply.send(saved);
    } catch (err) {
      this.handleRateError(req, reply, err);
    }
  }

  async listCargoSeasonalTemplates(req: FastifyRequest, reply: FastifyReply) {
    const { patternId } = req.params as { patternId: string };
    const { cargoTypeId } = req.query as { cargoTypeId?: string };
    if (!cargoTypeId) {
      return reply.code(400).send({ error: 'cargoTypeId wajib diisi' });
    }
    const rows = await this.cargoRatesService.listSeasonalTemplates(patternId, cargoTypeId);
    reply.send(rows);
  }

  async createCargoSeasonalTemplate(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { patternId } = req.params as { patternId: string };
      const { cargoTypeId } = req.query as { cargoTypeId?: string };
      if (!cargoTypeId) {
        return reply.code(400).send({ error: 'cargoTypeId wajib diisi' });
      }
      const data = cargoSeasonalCreateSchema.parse(req.body);
      const created = await this.cargoRatesService.createSeasonalTemplate(patternId, cargoTypeId, data.name, data.validFrom, data.validTo, data.duplicateFromRegular, buildServiceContext(req));
      reply.code(201).send(created);
    } catch (err) {
      this.handleRateError(req, reply, err);
    }
  }

  async duplicateCargoRate(req: FastifyRequest, reply: FastifyReply) {
    try {
      const data = duplicateCargoRateSchema.parse(req.body);
      const created = await this.cargoRatesService.duplicateMatrixToCargoType(data.sourceMatrixId, data.toCargoTypeId, buildServiceContext(req));
      reply.code(201).send(created);
    } catch (err) {
      this.handleRateError(req, reply, err);
    }
  }

  async setCargoRateActive(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const { isActive } = req.body as { isActive: boolean };
    await this.cargoRatesService.setCargoRateActive(id, !!isActive, buildServiceContext(req));
    reply.send({ success: true });
  }

  async deleteCargoRate(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.cargoRatesService.deleteCargoRate(id, buildServiceContext(req));
    reply.send({ success: true });
  }

  async getCargoRateSyncStatus(req: FastifyRequest, reply: FastifyReply) {
    const { patternId } = req.params as { patternId: string };
    const { cargoTypeId } = req.query as { cargoTypeId?: string };
    if (!cargoTypeId) {
      return reply.code(400).send({ error: 'cargoTypeId wajib diisi' });
    }
    const status = await this.cargoRatesService.computeCargoSyncStatus(patternId, cargoTypeId);
    reply.send(status);
  }

  async syncCargoRate(req: FastifyRequest, reply: FastifyReply) {
    const { patternId } = req.params as { patternId: string };
    const { cargoTypeId } = req.query as { cargoTypeId?: string };
    if (!cargoTypeId) {
      return reply.code(400).send({ error: 'cargoTypeId wajib diisi' });
    }
    const updated = await this.cargoRatesService.syncMissingPairs(patternId, cargoTypeId, buildServiceContext(req));
    reply.send(updated);
  }

  async listCargoTripExceptions(req: FastifyRequest, reply: FastifyReply) {
    const { tripId } = req.params as { tripId: string };
    const rows = await this.cargoRatesService.listTripExceptions(tripId);
    reply.send(rows);
  }

  async upsertCargoTripException(req: FastifyRequest, reply: FastifyReply) {
    try {
      const data = cargoTripExceptionUpsertSchema.parse(req.body);
      const row = await this.cargoRatesService.upsertTripException(data.tripId, data.cargoTypeId, data.originStopId, data.destinationStopId, data.pricePerKg, buildServiceContext(req));
      reply.send(row);
    } catch (err) {
      this.handleRateError(req, reply, err);
    }
  }

  async deleteCargoTripException(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.cargoRatesService.deleteTripException(id, buildServiceContext(req));
    reply.send({ success: true });
  }

  async cargoPricedDestinations(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as { patternId?: string; cargoTypeId?: string; originStopId?: string; destinationStopIds?: string; serviceDate?: string };
    if (!query.patternId || !query.cargoTypeId || !query.originStopId || !query.serviceDate) {
      return reply.code(400).send({ error: 'patternId, cargoTypeId, originStopId, dan serviceDate wajib diisi' });
    }
    const destinationStopIds = (query.destinationStopIds || '').split(',').filter(Boolean);
    const list = await listPricedDestinationsFromOriginCargo({
      patternId: query.patternId,
      cargoTypeId: query.cargoTypeId,
      originStopId: query.originStopId,
      destinationStopIds,
      serviceDate: query.serviceDate,
    });
    reply.send(list);
  }

  private handleRateError(req: FastifyRequest, reply: FastifyReply, err: unknown) {
    req.log.error({ err }, 'Cargo rate error');
    if (err instanceof StaleCargoRateError) {
      return reply.code(409).send({ error: err.message, code: 'STALE_CARGO_RATE' });
    }
    const error = err as { name?: string; message?: string; errors?: unknown };
    if (error.name === 'ZodError') {
      return reply.code(400).send({ error: 'Validasi gagal', code: 'VALIDATION_ERROR', details: error.errors });
    }
    reply.code(400).send({ error: error.message || 'Internal server error' });
  }
}
