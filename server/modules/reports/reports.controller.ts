import { Request, Response } from "express";
import { ReportsService, reportFiltersSchema } from "./reports.service";

const reportsService = new ReportsService();

function parseFilters(req: Request) {
  const today = new Date().toISOString().split('T')[0];
  const raw = {
    dateFrom: req.query.dateFrom || today,
    dateTo: req.query.dateTo || today,
    outletId: req.query.outletId || undefined,
    channel: req.query.channel || undefined,
    patternId: req.query.patternId || undefined,
  };
  return reportFiltersSchema.parse(raw);
}

export class ReportsController {
  async getRevenue(req: Request, res: Response) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getRevenueSummary(filters);
      res.json(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return res.status(400).json({ error: 'Parameter filter tidak valid' });
      console.error('[reports] revenue error:', e);
      res.status(500).json({ error: 'Gagal memuat laporan pendapatan' });
    }
  }

  async getSales(req: Request, res: Response) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getSalesReport(filters);
      res.json(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return res.status(400).json({ error: 'Parameter filter tidak valid' });
      console.error('[reports] sales error:', e);
      res.status(500).json({ error: 'Gagal memuat laporan penjualan' });
    }
  }

  async getTripProfitability(req: Request, res: Response) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getTripProfitability(filters);
      res.json(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return res.status(400).json({ error: 'Parameter filter tidak valid' });
      console.error('[reports] trip-profitability error:', e);
      res.status(500).json({ error: 'Gagal memuat laporan laba rugi' });
    }
  }

  async getLoadFactor(req: Request, res: Response) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getLoadFactor(filters);
      res.json(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return res.status(400).json({ error: 'Parameter filter tidak valid' });
      console.error('[reports] load-factor error:', e);
      res.status(500).json({ error: 'Gagal memuat laporan load factor' });
    }
  }

  async getCancellations(req: Request, res: Response) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getCancellationsReport(filters);
      res.json(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return res.status(400).json({ error: 'Parameter filter tidak valid' });
      console.error('[reports] cancellations error:', e);
      res.status(500).json({ error: 'Gagal memuat laporan pembatalan' });
    }
  }

  async getCargo(req: Request, res: Response) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getCargoReport(filters);
      res.json(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return res.status(400).json({ error: 'Parameter filter tidak valid' });
      console.error('[reports] cargo error:', e);
      res.status(500).json({ error: 'Gagal memuat laporan kargo' });
    }
  }

  async getPayments(req: Request, res: Response) {
    try {
      const filters = parseFilters(req);
      const data = await reportsService.getPaymentsReport(filters);
      res.json(data);
    } catch (e: any) {
      if (e.name === 'ZodError') return res.status(400).json({ error: 'Parameter filter tidak valid' });
      console.error('[reports] payments error:', e);
      res.status(500).json({ error: 'Gagal memuat laporan pembayaran' });
    }
  }

  async getFilterOptions(_req: Request, res: Response) {
    try {
      const data = await reportsService.getFilterOptions();
      res.json(data);
    } catch (e: any) {
      console.error('[reports] filter-options error:', e);
      res.status(500).json({ error: 'Gagal memuat opsi filter' });
    }
  }
}
