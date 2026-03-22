import type { FastifyRequest, FastifyReply } from "fastify";
import { ReportsService, reportFiltersSchema } from "./reports.service";

const reportsService = new ReportsService();

function parseFilters(req: FastifyRequest) {
  const today = new Date().toISOString().split('T')[0];
  const raw = {
    dateFrom: req.query.dateFrom || today,
    dateTo: req.query.dateTo || today,
    dateMode: req.query.dateMode || undefined,
    outletId: req.query.outletId || undefined,
    channel: req.query.channel || undefined,
    patternId: req.query.patternId || undefined,
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
      console.error('[reports] revenue error:', e);
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
      console.error('[reports] sales error:', e);
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
      console.error('[reports] trip-profitability error:', e);
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
      console.error('[reports] load-factor error:', e);
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
      console.error('[reports] cancellations error:', e);
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
      console.error('[reports] cargo error:', e);
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
      console.error('[reports] payments error:', e);
      reply.code(500).send({ error: 'Gagal memuat laporan pembayaran' });
    }
  }

  async getFilterOptions(_req: FastifyRequest, reply: FastifyReply) {
    try {
      const data = await reportsService.getFilterOptions();
      reply.send(data);
    } catch (e: any) {
      console.error('[reports] filter-options error:', e);
      reply.code(500).send({ error: 'Gagal memuat opsi filter' });
    }
  }
}
