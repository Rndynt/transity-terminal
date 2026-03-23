import type { FastifyInstance } from "fastify";
import { ReportsController } from "./reports.controller";

export function registerReportsRoutes(app: FastifyInstance) {
  const reportsController = new ReportsController();

  app.get('/api/reports/filter-options', async (req, reply) => reportsController.getFilterOptions(req, reply));
  app.get('/api/reports/revenue', async (req, reply) => reportsController.getRevenue(req, reply));
  app.get('/api/reports/sales', async (req, reply) => reportsController.getSales(req, reply));
  app.get('/api/reports/trip-profitability', async (req, reply) => reportsController.getTripProfitability(req, reply));
  app.get('/api/reports/load-factor', async (req, reply) => reportsController.getLoadFactor(req, reply));
  app.get('/api/reports/cancellations', async (req, reply) => reportsController.getCancellations(req, reply));
  app.get('/api/reports/cargo', async (req, reply) => reportsController.getCargo(req, reply));
  app.get('/api/reports/payments', async (req, reply) => reportsController.getPayments(req, reply));
  app.get('/api/reports/commercial-fee', async (req, reply) => reportsController.getCommercialFee(req, reply));
}
