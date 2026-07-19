import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { IStorage } from "@server/storage.interface";
import { buildServiceContext } from "@modules/rbac/rbac.guard";
import { PriceRulesService, StalePriceRuleError } from "./priceRules.service";
import { listPricedDestinationsFromOrigin } from "./priceRules.resolver";

const cellSchema = z.object({
  originStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
  price: z.coerce.number().min(0),
});

const savePriceRuleSchema = z.object({
  scope: z.enum(['global', 'pattern']),
  patternId: z.string().uuid().optional(),
  kind: z.enum(['regular', 'seasonal']).default('regular'),
  matrixId: z.string().uuid().optional(),
  name: z.string().optional(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  cells: z.array(cellSchema),
  expectedUpdatedAt: z.string().nullable(),
});

const seasonalCreateSchema = z.object({
  name: z.string().min(1, 'Nama template wajib diisi'),
  validFrom: z.string(),
  validTo: z.string(),
  duplicateFromRegular: z.boolean().default(true),
});

const tripExceptionUpsertSchema = z.object({
  tripId: z.string().uuid(),
  originStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
  price: z.coerce.number().min(0),
});

export class PriceRulesController {
  private service: PriceRulesService;

  constructor(storage: IStorage) {
    this.service = new PriceRulesService(storage);
  }

  async getPatternGrid(req: FastifyRequest, reply: FastifyReply) {
    const { patternId } = req.params as { patternId: string };
    const { kind, matrixId } = req.query as { kind?: 'regular' | 'seasonal'; matrixId?: string };
    const grid = await this.service.getPatternPriceGrid(patternId, kind ?? 'regular', matrixId);
    reply.send(grid);
  }

  async getGlobalList(_req: FastifyRequest, reply: FastifyReply) {
    const list = await this.service.getGlobalPriceList();
    reply.send(list);
  }

  async listPriceRules(req: FastifyRequest, reply: FastifyReply) {
    const { patternId } = req.query as { patternId?: string };
    const rows = await this.service.listPriceRules(patternId);
    reply.send(rows);
  }

  async savePriceRule(req: FastifyRequest, reply: FastifyReply) {
    try {
      const data = savePriceRuleSchema.parse(req.body);
      if (data.scope === 'pattern' && !data.patternId) {
        return reply.code(400).send({ error: 'patternId wajib diisi untuk scope pattern' });
      }
      const saved = await this.service.savePriceRule(data, buildServiceContext(req));
      reply.send(saved);
    } catch (err) {
      this.handleError(req, reply, err);
    }
  }

  async listSeasonalTemplates(req: FastifyRequest, reply: FastifyReply) {
    const { patternId } = req.params as { patternId: string };
    const rows = await this.service.listSeasonalTemplates(patternId);
    reply.send(rows);
  }

  async createSeasonalTemplate(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { patternId } = req.params as { patternId: string };
      const data = seasonalCreateSchema.parse(req.body);
      const created = await this.service.createSeasonalTemplate(patternId, data.name, data.validFrom, data.validTo, data.duplicateFromRegular, buildServiceContext(req));
      reply.code(201).send(created);
    } catch (err) {
      this.handleError(req, reply, err);
    }
  }

  async setPriceRuleActive(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    const { isActive } = req.body as { isActive: boolean };
    await this.service.setPriceRuleActive(id, !!isActive, buildServiceContext(req));
    reply.send({ success: true });
  }

  async deletePriceRule(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.service.deletePriceRule(id, buildServiceContext(req));
    reply.send({ success: true });
  }

  async getSyncStatus(req: FastifyRequest, reply: FastifyReply) {
    const { patternId } = req.params as { patternId: string };
    const status = await this.service.computePriceSyncStatus(patternId);
    reply.send(status);
  }

  async sync(req: FastifyRequest, reply: FastifyReply) {
    const { patternId } = req.params as { patternId: string };
    const updated = await this.service.syncMissingPairs(patternId, buildServiceContext(req));
    reply.send(updated);
  }

  async listTripExceptions(req: FastifyRequest, reply: FastifyReply) {
    const { tripId } = req.params as { tripId: string };
    const rows = await this.service.listTripExceptions(tripId);
    reply.send(rows);
  }

  async upsertTripException(req: FastifyRequest, reply: FastifyReply) {
    try {
      const data = tripExceptionUpsertSchema.parse(req.body);
      const row = await this.service.upsertTripException(data.tripId, data.originStopId, data.destinationStopId, data.price, buildServiceContext(req));
      reply.send(row);
    } catch (err) {
      this.handleError(req, reply, err);
    }
  }

  async deleteTripException(req: FastifyRequest, reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await this.service.deleteTripException(id, buildServiceContext(req));
    reply.send({ success: true });
  }

  async pricedDestinations(req: FastifyRequest, reply: FastifyReply) {
    const query = req.query as { patternId?: string; originStopId?: string; destinationStopIds?: string; serviceDate?: string };
    if (!query.patternId || !query.originStopId || !query.serviceDate) {
      return reply.code(400).send({ error: 'patternId, originStopId, dan serviceDate wajib diisi' });
    }
    const destinationStopIds = (query.destinationStopIds || '').split(',').filter(Boolean);
    const list = await listPricedDestinationsFromOrigin({
      patternId: query.patternId,
      originStopId: query.originStopId,
      destinationStopIds,
      serviceDate: query.serviceDate,
    });
    reply.send(list);
  }

  /**
   * Exception-aware priced OD matrix for one trip — powers CSO's "Pilih
   * Rute" (RouteTimeline.tsx) OD-aware Naik/Turun gating. Unlike
   * pricedDestinations above (pattern+global only), this is accurate
   * against trip-exceptions too, matching exactly what booking will
   * actually charge/allow. Same authority as GET /api/app/trips/:id's
   * pricedMatrix field (both call PriceRulesService.getPricedMatrixForTrip
   * -> buildPricedMatrix), so CSO and the App API never disagree.
   */
  async tripPricedMatrix(req: FastifyRequest, reply: FastifyReply) {
    try {
      const { tripId } = req.params as { tripId: string };
      const matrix = await this.service.getPricedMatrixForTrip(tripId);
      reply.send(matrix);
    } catch (err) {
      this.handleError(req, reply, err);
    }
  }

  private handleError(req: FastifyRequest, reply: FastifyReply, err: unknown) {
    req.log.error({ err }, 'Price rule error');
    if (err instanceof StalePriceRuleError) {
      return reply.code(409).send({ error: err.message, code: 'STALE_PRICE_RULE' });
    }
    const error = err as { name?: string; message?: string; errors?: unknown };
    if (error.name === 'ZodError') {
      return reply.code(400).send({ error: 'Validasi gagal', code: 'VALIDATION_ERROR', details: error.errors });
    }
    reply.code(500).send({ error: error.message || 'Internal server error' });
  }
}
