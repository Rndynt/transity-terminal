import type { FastifyInstance } from "fastify";
import { ReportsController } from "./reports.controller";
import { requireFlag, requireAnyFlag } from "../rbac/rbac.middleware";

export function registerReportsRoutes(app: FastifyInstance) {
  const reportsController = new ReportsController();

  app.get('/api/reports/filter-options', { preHandler: [requireAnyFlag('page.reports', 'report.revenue', 'report.sales', 'report.trip_profitability', 'report.load_factor', 'report.cancellations', 'report.cargo', 'report.payments', 'report.commercial_fee')] }, async (req, reply) => reportsController.getFilterOptions(req, reply));
  app.get('/api/reports/revenue', { preHandler: [requireFlag('report.revenue')] }, async (req, reply) => reportsController.getRevenue(req, reply));
  app.get('/api/reports/sales', { preHandler: [requireFlag('report.sales')] }, async (req, reply) => reportsController.getSales(req, reply));
  app.get('/api/reports/trip-profitability', { preHandler: [requireFlag('report.trip_profitability')] }, async (req, reply) => reportsController.getTripProfitability(req, reply));
  app.get('/api/reports/load-factor', { preHandler: [requireFlag('report.load_factor')] }, async (req, reply) => reportsController.getLoadFactor(req, reply));
  app.get('/api/reports/cancellations', { preHandler: [requireFlag('report.cancellations')] }, async (req, reply) => reportsController.getCancellations(req, reply));
  app.get('/api/reports/cargo', { preHandler: [requireFlag('report.cargo')] }, async (req, reply) => reportsController.getCargo(req, reply));
  app.get('/api/reports/payments', { preHandler: [requireFlag('report.payments')] }, async (req, reply) => reportsController.getPayments(req, reply));
  app.get('/api/reports/commercial-fee', { preHandler: [requireFlag('report.commercial_fee')] }, async (req, reply) => reportsController.getCommercialFee(req, reply));
}
