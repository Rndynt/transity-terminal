import { z } from "zod";
import { ReportsRepository, type ReportFilters } from "@server/repositories/reports.repository";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const reportFiltersSchema = z.object({
  dateFrom: z.string().regex(dateRegex, 'Invalid date format'),
  dateTo: z.string().regex(dateRegex, 'Invalid date format'),
  dateMode: z.enum(['departure', 'paid', 'created']).optional(),
  outletId: z.string().regex(uuidRegex, 'Invalid UUID').optional(),
  channel: z.enum(['CSO', 'WEB', 'APP', 'OTA']).optional(),
  salesChannelCode: z.string().min(1).max(64).optional(),
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
    const PPN_RATE = 0.11;

    const VOLUME_TIERS = [
      { min: 1_000_000_000, rate: 0.0225, label: 'Tier 4' },
      { min: 500_000_000, rate: 0.025, label: 'Tier 3' },
      { min: 200_000_000, rate: 0.0275, label: 'Tier 2' },
      { min: 0, rate: 0.03, label: 'Tier 1' },
    ];

    const data = await this.repo.getCommercialFeeData(f);

    const ticketGross = Number(data.ticketSummary?.gross_amount || 0);
    const cargoGross = Number(data.cargoSummary?.gross_amount || 0);
    const refundCredit = Number(data.refundCredit?.refund_amount || 0);
    const totalGross = ticketGross + cargoGross;

    const tier = VOLUME_TIERS.find(t => totalGross >= t.min) || VOLUME_TIERS[VOLUME_TIERS.length - 1];
    const feeRate = tier.rate;
    const feeAmount = totalGross * feeRate;
    const feeAfterCredit = Math.max(0, feeAmount - (refundCredit * feeRate));
    const ppnAmount = feeAfterCredit * PPN_RATE;
    const totalCharge = feeAfterCredit + ppnAmount;

    const dailyMap = new Map<string, { ticket: number; cargo: number }>();
    for (const row of data.ticketDaily as Array<{ date: string; gross_amount: string | number }>) {
      const existing = dailyMap.get(row.date) || { ticket: 0, cargo: 0 };
      existing.ticket = Number(row.gross_amount);
      dailyMap.set(row.date, existing);
    }
    for (const row of data.cargoDaily as Array<{ date: string; gross_amount: string | number }>) {
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
        fee: (vals.ticket + vals.cargo) * feeRate,
      }));

    return {
      summary: {
        ticket_gross: ticketGross,
        cargo_gross: cargoGross,
        total_gross: totalGross,
        total_bookings: Number(data.ticketSummary?.total_bookings || 0),
        total_shipments: Number(data.cargoSummary?.total_shipments || 0),
        fee_rate: feeRate,
        tier_label: tier.label,
        fee_amount: feeAmount,
        refund_credit: refundCredit,
        refund_fee_credit: refundCredit * feeRate,
        fee_after_credit: feeAfterCredit,
        ppn_rate: PPN_RATE,
        ppn_amount: ppnAmount,
        total_charge: totalCharge,
      },
      daily,
      ticketByRoute: (data.ticketByRoute as Array<Record<string, unknown> & { gross_amount: string | number }>).map(r => ({
        ...r,
        gross_amount: Number(r.gross_amount),
        fee: Number(r.gross_amount) * feeRate,
      })),
      cargoByRoute: (data.cargoByRoute as Array<Record<string, unknown> & { gross_amount: string | number }>).map(r => ({
        ...r,
        gross_amount: Number(r.gross_amount),
        fee: Number(r.gross_amount) * feeRate,
      })),
      ticketByOutlet: (data.ticketByOutlet as Array<Record<string, unknown> & { gross_amount: string | number }>).map(r => ({
        ...r,
        gross_amount: Number(r.gross_amount),
        fee: Number(r.gross_amount) * feeRate,
      })),
      recentTickets: data.recentTickets,
      recentCargo: data.recentCargo,
      volumeTiers: VOLUME_TIERS.map(t => ({
        min: t.min,
        rate: t.rate,
        label: t.label,
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
