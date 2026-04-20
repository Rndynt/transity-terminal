import type { FastifyRequest, FastifyReply } from "fastify";
import { ReportsService, reportFiltersSchema } from "./reports.service";

const reportsService = new ReportsService();

function parseFilters(req: FastifyRequest) {
  const today = new Date().toISOString().split('T')[0];
  const query = req.query as {
    dateFrom?: string;
    dateTo?: string;
    dateMode?: string;
    outletId?: string;
    channel?: string;
    salesChannelCode?: string;
    patternId?: string;
  };
  const channel = query.channel || undefined;
  const salesChannelCode = query.salesChannelCode || undefined;
  const raw = {
    dateFrom: query.dateFrom || today,
    dateTo: query.dateTo || today,
    dateMode: query.dateMode || undefined,
    outletId: query.outletId || undefined,
    channel,
    salesChannelCode: channel && channel !== 'OTA' ? undefined : salesChannelCode,
    patternId: query.patternId || undefined,
  };
  return reportFiltersSchema.parse(raw);
}

export class ReportsController {
  async getRevenue(req: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getRevenueSummary(filters);
      reply.send(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return reply.code(400).send({ error: 'Parameter filter tidak valid' });
      req.log.error({ err: e }, '[reports] revenue error');
      reply.code(500).send({ error: 'Gagal memuat laporan pendapatan' });
    }
  }

  async getSales(req: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getSalesReport(filters);
      reply.send(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return reply.code(400).send({ error: 'Parameter filter tidak valid' });
      req.log.error({ err: e }, '[reports] sales error');
      reply.code(500).send({ error: 'Gagal memuat laporan penjualan' });
    }
  }

  async getTripProfitability(req: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getTripProfitability(filters);
      reply.send(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return reply.code(400).send({ error: 'Parameter filter tidak valid' });
      req.log.error({ err: e }, '[reports] trip-profitability error');
      reply.code(500).send({ error: 'Gagal memuat laporan laba rugi' });
    }
  }

  async getLoadFactor(req: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getLoadFactor(filters);
      reply.send(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return reply.code(400).send({ error: 'Parameter filter tidak valid' });
      req.log.error({ err: e }, '[reports] load-factor error');
      reply.code(500).send({ error: 'Gagal memuat laporan load factor' });
    }
  }

  async getCancellations(req: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getCancellationsReport(filters);
      reply.send(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return reply.code(400).send({ error: 'Parameter filter tidak valid' });
      req.log.error({ err: e }, '[reports] cancellations error');
      reply.code(500).send({ error: 'Gagal memuat laporan pembatalan' });
    }
  }

  async getCargo(req: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getCargoReport(filters);
      reply.send(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return reply.code(400).send({ error: 'Parameter filter tidak valid' });
      req.log.error({ err: e }, '[reports] cargo error');
      reply.code(500).send({ error: 'Gagal memuat laporan kargo' });
    }
  }

  async getPayments(req: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getPaymentsReport(filters);
      reply.send(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return reply.code(400).send({ error: 'Parameter filter tidak valid' });
      req.log.error({ err: e }, '[reports] payments error');
      reply.code(500).send({ error: 'Gagal memuat laporan pembayaran' });
    }
  }

  async getCommercialFee(req: FastifyRequest, reply: FastifyReply) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getCommercialFeeReport(filters);
      reply.send(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return reply.code(400).send({ error: 'Parameter filter tidak valid' });
      req.log.error({ err: e }, '[reports] commercial-fee error');
      reply.code(500).send({ error: 'Gagal memuat laporan commercial fee' });
    }
  }

  async getFilterOptions(req: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await reportsService.getFilterOptions();
      reply.send(data);
    } catch (e: any) {
      req.log.error({ err: e }, '[reports] filter-options error');
      reply.code(500).send({ error: 'Gagal memuat opsi filter' });
    }
  }
}
