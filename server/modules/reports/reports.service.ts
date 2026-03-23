import { z } from "zod";
import { ReportsRepository, type ReportFilters } from "../../repositories/reports.repository";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const reportFiltersSchema = z.object({
  dateFrom: z.string().regex(dateRegex, 'Invalid date format'),
  dateTo: z.string().regex(dateRegex, 'Invalid date format'),
  dateMode: z.enum(['departure', 'paid', 'created']).optional(),
  outletId: z.string().regex(uuidRegex, 'Invalid UUID').optional(),
  channel: z.enum(['CSO', 'WEB', 'APP', 'OTA']).optional(),
  patternId: z.string().regex(uuidRegex, 'Invalid UUID').optional(),
});

export type { ReportFilters };

export class ReportsService {
  private repo = new ReportsRepository();

  async getRevenueSummary(f: ReportFilters) {
    return await this.repo.getRevenueSummary(f);
  }

  async getSalesReport(f: ReportFilters) {
    return await this.repo.getSalesReport(f);
  }

  async getTripProfitability(f: ReportFilters) {
    return await this.repo.getTripProfitability(f);
  }

  async getLoadFactor(f: ReportFilters) {
    return await this.repo.getLoadFactor(f);
  }

  async getCancellationsReport(f: ReportFilters) {
    return await this.repo.getCancellationsReport(f);
  }

  async getCargoReport(f: ReportFilters) {
    return await this.repo.getCargoReport(f);
  }

  async getPaymentsReport(f: ReportFilters) {
    return await this.repo.getPaymentsReport(f);
  }

  async getCommercialFeeReport(f: ReportFilters) {
    const FEE_RATE = 0.03;
    const PPN_RATE = 0.11;

    const VOLUME_TIERS = [
      { min: 1_000_000_000, discount: 0.15 },
      { min: 500_000_000, discount: 0.10 },
      { min: 100_000_000, discount: 0.05 },
      { min: 0, discount: 0 },
    ];

    const data = await this.repo.getCommercialFeeData(f);

    const ticketGross = Number(data.ticketSummary?.gross_amount || 0);
    const cargoGross = Number(data.cargoSummary?.gross_amount || 0);
    const totalGross = ticketGross + cargoGross;

    const tier = VOLUME_TIERS.find(t => totalGross >= t.min) || VOLUME_TIERS[VOLUME_TIERS.length - 1];
    const feeBeforeDiscount = totalGross * FEE_RATE;
    const discountAmount = feeBeforeDiscount * tier.discount;
    const feeAfterDiscount = feeBeforeDiscount - discountAmount;
    const ppnAmount = feeAfterDiscount * PPN_RATE;
    const totalCharge = feeAfterDiscount + ppnAmount;

    const dailyMap = new Map<string, { ticket: number; cargo: number }>();
    for (const row of data.ticketDaily as any[]) {
      const existing = dailyMap.get(row.date) || { ticket: 0, cargo: 0 };
      existing.ticket = Number(row.gross_amount);
      dailyMap.set(row.date, existing);
    }
    for (const row of data.cargoDaily as any[]) {
      const existing = dailyMap.get(row.date) || { ticket: 0, cargo: 0 };
      existing.cargo = Number(row.gross_amount);
      dailyMap.set(row.date, existing);
    }
    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date,
        ticket_gross: vals.ticket,
        cargo_gross: vals.cargo,
        total_gross: vals.ticket + vals.cargo,
        fee: (vals.ticket + vals.cargo) * FEE_RATE,
      }));

    return {
      summary: {
        ticket_gross: ticketGross,
        cargo_gross: cargoGross,
        total_gross: totalGross,
        total_bookings: Number(data.ticketSummary?.total_bookings || 0),
        total_shipments: Number(data.cargoSummary?.total_shipments || 0),
        fee_rate: FEE_RATE,
        fee_before_discount: feeBeforeDiscount,
        volume_discount_pct: tier.discount,
        discount_amount: discountAmount,
        fee_after_discount: feeAfterDiscount,
        ppn_rate: PPN_RATE,
        ppn_amount: ppnAmount,
        total_charge: totalCharge,
      },
      daily,
      ticketByRoute: (data.ticketByRoute as any[]).map(r => ({
        ...r,
        gross_amount: Number(r.gross_amount),
        fee: Number(r.gross_amount) * FEE_RATE,
      })),
      cargoByRoute: (data.cargoByRoute as any[]).map(r => ({
        ...r,
        gross_amount: Number(r.gross_amount),
        fee: Number(r.gross_amount) * FEE_RATE,
      })),
      ticketByOutlet: (data.ticketByOutlet as any[]).map(r => ({
        ...r,
        gross_amount: Number(r.gross_amount),
        fee: Number(r.gross_amount) * FEE_RATE,
      })),
      recentTickets: data.recentTickets,
      recentCargo: data.recentCargo,
      volumeTiers: VOLUME_TIERS.map(t => ({
        min: t.min,
        discount: t.discount,
        effective_rate: FEE_RATE * (1 - t.discount),
      })),
    };
  }

  async getFilterOptions() {
    const data = await this.repo.getFilterOptions();
    return {
      ...data,
      channels: ['CSO', 'WEB', 'APP', 'OTA'],
    };
  }
}
