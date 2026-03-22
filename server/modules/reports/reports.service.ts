import { db } from "../../db";
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const reportFiltersSchema = z.object({
  dateFrom: z.string().regex(dateRegex, 'Invalid date format'),
  dateTo: z.string().regex(dateRegex, 'Invalid date format'),
  outletId: z.string().regex(uuidRegex, 'Invalid UUID').optional(),
  channel: z.enum(['CSO', 'WEB', 'APP', 'OTA']).optional(),
  patternId: z.string().regex(uuidRegex, 'Invalid UUID').optional(),
});

export type ReportFilters = z.infer<typeof reportFiltersSchema>;

const PAID_STATUSES_SQL = sql.raw(`('paid','confirmed','checked_in')`);
const ACTIVE_TICKET_SQL = sql.raw(`('active','checked_in')`);
const EXCLUDE_CARGO_SQL = sql.raw(`('canceled','returned')`);

function bookingFilters(f: ReportFilters, bAlias: string, tAlias: string): SQL[] {
  const conds: SQL[] = [
    sql.raw(`${tAlias}.service_date >= `).append(sql`${f.dateFrom}`),
    sql.raw(`${tAlias}.service_date <= `).append(sql`${f.dateTo}`),
  ];
  if (f.outletId) conds.push(sql.raw(`${bAlias}.outlet_id = `).append(sql`${f.outletId}`));
  if (f.channel) conds.push(sql.raw(`${bAlias}.channel = `).append(sql`${f.channel}`));
  if (f.patternId) conds.push(sql.raw(`${tAlias}.pattern_id = `).append(sql`${f.patternId}`));
  return conds;
}

function tripFilters(f: ReportFilters, tAlias: string): SQL[] {
  const conds: SQL[] = [
    sql.raw(`${tAlias}.service_date >= `).append(sql`${f.dateFrom}`),
    sql.raw(`${tAlias}.service_date <= `).append(sql`${f.dateTo}`),
  ];
  if (f.patternId) conds.push(sql.raw(`${tAlias}.pattern_id = `).append(sql`${f.patternId}`));
  return conds;
}

function joinConditions(conds: SQL[]): SQL {
  let result = conds[0];
  for (let i = 1; i < conds.length; i++) {
    result = sql`${result} AND ${conds[i]}`;
  }
  return result;
}

export class ReportsService {

  async getRevenueSummary(f: ReportFilters) {
    const where = joinConditions([...bookingFilters(f, 'b', 't'), sql`b.status IN ${PAID_STATUSES_SQL}`]);

    const summary = await db.execute(sql`
      SELECT
        COALESCE(SUM(b.total_amount::numeric), 0) as total_revenue,
        COUNT(*)::int as total_bookings,
        COALESCE(AVG(b.total_amount::numeric), 0) as avg_per_booking,
        COUNT(DISTINCT b.trip_id)::int as total_trips
      FROM bookings b
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
    `);

    const daily = await db.execute(sql`
      SELECT
        t.service_date::text as date,
        COALESCE(SUM(b.total_amount::numeric), 0) as revenue,
        COUNT(*)::int as bookings
      FROM bookings b
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
      GROUP BY t.service_date
      ORDER BY t.service_date
    `);

    const byChannel = await db.execute(sql`
      SELECT
        b.channel,
        COALESCE(SUM(b.total_amount::numeric), 0) as revenue,
        COUNT(*)::int as bookings
      FROM bookings b
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
      GROUP BY b.channel
      ORDER BY revenue DESC
    `);

    const byOutlet = await db.execute(sql`
      SELECT
        o.name as outlet_name,
        COALESCE(SUM(b.total_amount::numeric), 0) as revenue,
        COUNT(*)::int as bookings
      FROM bookings b
      INNER JOIN trips t ON b.trip_id = t.id
      LEFT JOIN outlets o ON b.outlet_id = o.id
      WHERE ${where}
      GROUP BY o.name
      ORDER BY revenue DESC
    `);

    const byRoute = await db.execute(sql`
      SELECT
        tp.name as route_name,
        tp.code as route_code,
        COALESCE(SUM(b.total_amount::numeric), 0) as revenue,
        COUNT(*)::int as bookings
      FROM bookings b
      INNER JOIN trips t ON b.trip_id = t.id
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      WHERE ${where}
      GROUP BY tp.name, tp.code
      ORDER BY revenue DESC
    `);

    return {
      summary: summary.rows[0],
      daily: daily.rows,
      byChannel: byChannel.rows,
      byOutlet: byOutlet.rows,
      byRoute: byRoute.rows,
    };
  }

  async getSalesReport(f: ReportFilters) {
    const where = joinConditions(bookingFilters(f, 'b', 't'));

    const summary = await db.execute(sql`
      SELECT
        COUNT(*)::int as total_bookings,
        COUNT(*) FILTER (WHERE b.status = 'paid')::int as paid_count,
        COUNT(*) FILTER (WHERE b.status = 'canceled')::int as canceled_count,
        COUNT(*) FILTER (WHERE b.status = 'pending')::int as pending_count,
        COUNT(*) FILTER (WHERE b.status = 'confirmed')::int as confirmed_count,
        COUNT(*) FILTER (WHERE b.status = 'refunded')::int as refunded_count,
        COUNT(*) FILTER (WHERE b.status = 'unseated')::int as unseated_count,
        COALESCE(SUM(b.total_amount::numeric) FILTER (WHERE b.status IN ${PAID_STATUSES_SQL}), 0) as total_revenue,
        COUNT(DISTINCT b.trip_id)::int as total_trips
      FROM bookings b
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
    `);

    const byStatus = await db.execute(sql`
      SELECT
        b.status,
        COUNT(*)::int as count,
        COALESCE(SUM(b.total_amount::numeric), 0) as amount
      FROM bookings b
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
      GROUP BY b.status
      ORDER BY count DESC
    `);

    const byChannel = await db.execute(sql`
      SELECT
        b.channel,
        COUNT(*)::int as count,
        COALESCE(SUM(b.total_amount::numeric) FILTER (WHERE b.status IN ${PAID_STATUSES_SQL}), 0) as revenue
      FROM bookings b
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
      GROUP BY b.channel
      ORDER BY count DESC
    `);

    const byOutlet = await db.execute(sql`
      SELECT
        COALESCE(o.name, 'Tanpa Outlet') as outlet_name,
        COUNT(*)::int as count,
        COALESCE(SUM(b.total_amount::numeric) FILTER (WHERE b.status IN ${PAID_STATUSES_SQL}), 0) as revenue
      FROM bookings b
      INNER JOIN trips t ON b.trip_id = t.id
      LEFT JOIN outlets o ON b.outlet_id = o.id
      WHERE ${where}
      GROUP BY o.name
      ORDER BY count DESC
    `);

    const daily = await db.execute(sql`
      SELECT
        t.service_date::text as date,
        COUNT(*)::int as bookings,
        COALESCE(SUM(b.total_amount::numeric) FILTER (WHERE b.status IN ${PAID_STATUSES_SQL}), 0) as revenue,
        COUNT(*) FILTER (WHERE b.status = 'paid')::int as paid,
        COUNT(*) FILTER (WHERE b.status = 'canceled')::int as canceled
      FROM bookings b
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
      GROUP BY t.service_date
      ORDER BY t.service_date
    `);

    const recent = await db.execute(sql`
      SELECT
        b.id, b.booking_code, b.status, b.channel, b.total_amount,
        b.created_at, t.service_date,
        tp.name as route_name,
        COALESCE(o.name, '-') as outlet_name,
        os.name as origin_name, ds.name as destination_name
      FROM bookings b
      INNER JOIN trips t ON b.trip_id = t.id
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      LEFT JOIN outlets o ON b.outlet_id = o.id
      LEFT JOIN stops os ON b.origin_stop_id = os.id
      LEFT JOIN stops ds ON b.destination_stop_id = ds.id
      WHERE ${where}
      ORDER BY b.created_at DESC
      LIMIT 100
    `);

    return {
      summary: summary.rows[0],
      byStatus: byStatus.rows,
      byChannel: byChannel.rows,
      byOutlet: byOutlet.rows,
      daily: daily.rows,
      recent: recent.rows,
    };
  }

  async getTripProfitability(f: ReportFilters) {
    const where = joinConditions(tripFilters(f, 't'));

    const trips_data = await db.execute(sql`
      SELECT
        t.id as trip_id,
        t.service_date::text,
        t.status as trip_status,
        t.capacity,
        tp.name as route_name,
        tp.code as route_code,
        d.name as driver_name,
        v.plate as vehicle_plate,
        COALESCE(bk.ticket_revenue, 0) as ticket_revenue,
        COALESCE(bk.passenger_count, 0)::int as passenger_count,
        COALESCE(cr.cargo_revenue, 0) as cargo_revenue,
        COALESCE(cr.cargo_count, 0)::int as cargo_count,
        COALESCE(sc.estimated_cost, 0) as estimated_cost,
        COALESCE(sc.actual_cost, 0) as actual_cost,
        (COALESCE(bk.ticket_revenue, 0) + COALESCE(cr.cargo_revenue, 0)) as total_revenue,
        (COALESCE(bk.ticket_revenue, 0) + COALESCE(cr.cargo_revenue, 0) - COALESCE(sc.actual_cost, 0)) as profit
      FROM trips t
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN (
        SELECT trip_id,
          SUM(total_amount::numeric) FILTER (WHERE status IN ${PAID_STATUSES_SQL}) as ticket_revenue,
          COUNT(*) FILTER (WHERE status IN ${PAID_STATUSES_SQL}) as passenger_count
        FROM bookings GROUP BY trip_id
      ) bk ON bk.trip_id = t.id
      LEFT JOIN (
        SELECT trip_id,
          SUM(total_amount::numeric) FILTER (WHERE status NOT IN ${EXCLUDE_CARGO_SQL}) as cargo_revenue,
          COUNT(*) FILTER (WHERE status NOT IN ${EXCLUDE_CARGO_SQL}) as cargo_count
        FROM cargo_shipments GROUP BY trip_id
      ) cr ON cr.trip_id = t.id
      LEFT JOIN (
        SELECT s.trip_id,
          SUM(cl.estimated_amount::numeric) as estimated_cost,
          SUM(COALESCE(cl.actual_amount, cl.estimated_amount)::numeric) as actual_cost
        FROM spj s
        INNER JOIN spj_cost_lines cl ON cl.spj_id = s.id
        GROUP BY s.trip_id
      ) sc ON sc.trip_id = t.id
      WHERE ${where}
      ORDER BY t.service_date DESC, tp.name
    `);

    const totals = await db.execute(sql`
      SELECT
        COUNT(*)::int as total_trips,
        COALESCE(SUM(sub.total_revenue), 0) as total_revenue,
        COALESCE(SUM(sub.actual_cost), 0) as total_cost,
        COALESCE(SUM(sub.profit), 0) as total_profit
      FROM (
        SELECT
          t.id,
          (COALESCE(bk.ticket_revenue, 0) + COALESCE(cr.cargo_revenue, 0)) as total_revenue,
          COALESCE(sc.actual_cost, 0) as actual_cost,
          (COALESCE(bk.ticket_revenue, 0) + COALESCE(cr.cargo_revenue, 0) - COALESCE(sc.actual_cost, 0)) as profit
        FROM trips t
        LEFT JOIN (
          SELECT trip_id, SUM(total_amount::numeric) FILTER (WHERE status IN ${PAID_STATUSES_SQL}) as ticket_revenue
          FROM bookings GROUP BY trip_id
        ) bk ON bk.trip_id = t.id
        LEFT JOIN (
          SELECT trip_id, SUM(total_amount::numeric) FILTER (WHERE status NOT IN ${EXCLUDE_CARGO_SQL}) as cargo_revenue
          FROM cargo_shipments GROUP BY trip_id
        ) cr ON cr.trip_id = t.id
        LEFT JOIN (
          SELECT s.trip_id, SUM(COALESCE(cl.actual_amount, cl.estimated_amount)::numeric) as actual_cost
          FROM spj s INNER JOIN spj_cost_lines cl ON cl.spj_id = s.id
          GROUP BY s.trip_id
        ) sc ON sc.trip_id = t.id
        WHERE ${where}
      ) sub
    `);

    return {
      summary: totals.rows[0],
      trips: trips_data.rows,
    };
  }

  async getLoadFactor(f: ReportFilters) {
    const where = joinConditions(tripFilters(f, 't'));

    const trips_data = await db.execute(sql`
      SELECT
        t.id as trip_id,
        t.service_date::text,
        t.status as trip_status,
        t.capacity,
        tp.name as route_name,
        tp.code as route_code,
        d.name as driver_name,
        COALESCE(pax.count, 0)::int as passenger_count,
        CASE WHEN t.capacity > 0
          THEN ROUND(COALESCE(pax.count, 0)::numeric / t.capacity * 100, 1)
          ELSE 0
        END as load_factor_pct
      FROM trips t
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      LEFT JOIN (
        SELECT b.trip_id, COUNT(p.id) as count
        FROM passengers p
        INNER JOIN bookings b ON p.booking_id = b.id
        WHERE p.ticket_status IN ${ACTIVE_TICKET_SQL}
        GROUP BY b.trip_id
      ) pax ON pax.trip_id = t.id
      WHERE ${where}
      ORDER BY t.service_date DESC, tp.name
    `);

    const byRoute = await db.execute(sql`
      SELECT
        tp.name as route_name,
        tp.code as route_code,
        COUNT(t.id)::int as trip_count,
        SUM(t.capacity)::int as total_capacity,
        COALESCE(SUM(pax.count), 0)::int as total_passengers,
        CASE WHEN SUM(t.capacity) > 0
          THEN ROUND(COALESCE(SUM(pax.count), 0)::numeric / SUM(t.capacity) * 100, 1)
          ELSE 0
        END as avg_load_factor_pct
      FROM trips t
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      LEFT JOIN (
        SELECT b.trip_id, COUNT(p.id) as count
        FROM passengers p
        INNER JOIN bookings b ON p.booking_id = b.id
        WHERE p.ticket_status IN ${ACTIVE_TICKET_SQL}
        GROUP BY b.trip_id
      ) pax ON pax.trip_id = t.id
      WHERE ${where}
      GROUP BY tp.name, tp.code
      ORDER BY avg_load_factor_pct DESC
    `);

    const summary = await db.execute(sql`
      SELECT
        COUNT(t.id)::int as total_trips,
        COALESCE(SUM(t.capacity), 0)::int as total_capacity,
        COALESCE(SUM(pax.count), 0)::int as total_passengers,
        CASE WHEN SUM(t.capacity) > 0
          THEN ROUND(COALESCE(SUM(pax.count), 0)::numeric / SUM(t.capacity) * 100, 1)
          ELSE 0
        END as avg_load_factor_pct
      FROM trips t
      LEFT JOIN (
        SELECT b.trip_id, COUNT(p.id) as count
        FROM passengers p
        INNER JOIN bookings b ON p.booking_id = b.id
        WHERE p.ticket_status IN ${ACTIVE_TICKET_SQL}
        GROUP BY b.trip_id
      ) pax ON pax.trip_id = t.id
      WHERE ${where}
    `);

    const daily = await db.execute(sql`
      SELECT
        t.service_date::text as date,
        COUNT(t.id)::int as trips,
        SUM(t.capacity)::int as capacity,
        COALESCE(SUM(pax.count), 0)::int as passengers,
        CASE WHEN SUM(t.capacity) > 0
          THEN ROUND(COALESCE(SUM(pax.count), 0)::numeric / SUM(t.capacity) * 100, 1)
          ELSE 0
        END as load_factor_pct
      FROM trips t
      LEFT JOIN (
        SELECT b.trip_id, COUNT(p.id) as count
        FROM passengers p
        INNER JOIN bookings b ON p.booking_id = b.id
        WHERE p.ticket_status IN ${ACTIVE_TICKET_SQL}
        GROUP BY b.trip_id
      ) pax ON pax.trip_id = t.id
      WHERE ${where}
      GROUP BY t.service_date
      ORDER BY t.service_date
    `);

    return {
      summary: summary.rows[0],
      byRoute: byRoute.rows,
      daily: daily.rows,
      trips: trips_data.rows,
    };
  }

  async getCancellationsReport(f: ReportFilters) {
    const where = joinConditions(bookingFilters(f, 'b', 't'));

    const summary = await db.execute(sql`
      SELECT
        COUNT(DISTINCT bh.id)::int as total_events,
        COUNT(DISTINCT bh.id) FILTER (WHERE bh.action = 'canceled')::int as canceled_count,
        COUNT(DISTINCT bh.id) FILTER (WHERE bh.action = 'unseated')::int as unseated_count,
        COUNT(DISTINCT bh.id) FILTER (WHERE bh.action = 'rescheduled')::int as rescheduled_count,
        COUNT(DISTINCT bh.id) FILTER (WHERE bh.action = 'reassigned')::int as reassigned_count
      FROM booking_history bh
      INNER JOIN bookings b ON bh.booking_id = b.id
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
    `);

    const byAction = await db.execute(sql`
      SELECT
        bh.action,
        COUNT(*)::int as count,
        COUNT(DISTINCT bh.booking_id)::int as booking_count
      FROM booking_history bh
      INNER JOIN bookings b ON bh.booking_id = b.id
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
      GROUP BY bh.action
      ORDER BY count DESC
    `);

    const daily = await db.execute(sql`
      SELECT
        t.service_date::text as date,
        COUNT(*) FILTER (WHERE bh.action = 'canceled')::int as canceled,
        COUNT(*) FILTER (WHERE bh.action = 'unseated')::int as unseated,
        COUNT(*) FILTER (WHERE bh.action = 'rescheduled')::int as rescheduled,
        COUNT(*) FILTER (WHERE bh.action = 'reassigned')::int as reassigned
      FROM booking_history bh
      INNER JOIN bookings b ON bh.booking_id = b.id
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
      GROUP BY t.service_date
      ORDER BY t.service_date
    `);

    const byRoute = await db.execute(sql`
      SELECT
        COALESCE(tp.name, '-') as route_name,
        tp.code as route_code,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE bh.action = 'canceled')::int as canceled,
        COUNT(*) FILTER (WHERE bh.action = 'unseated')::int as unseated
      FROM booking_history bh
      INNER JOIN bookings b ON bh.booking_id = b.id
      INNER JOIN trips t ON b.trip_id = t.id
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      WHERE ${where}
      GROUP BY tp.name, tp.code
      ORDER BY total DESC
    `);

    const recent = await db.execute(sql`
      SELECT
        bh.id, bh.action, bh.details, bh.performed_by, bh.created_at,
        b.booking_code,
        p.full_name as passenger_name, p.ticket_number,
        tp.name as route_name,
        t.service_date::text
      FROM booking_history bh
      INNER JOIN bookings b ON bh.booking_id = b.id
      INNER JOIN trips t ON b.trip_id = t.id
      LEFT JOIN passengers p ON bh.passenger_id = p.id
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      WHERE ${where}
      ORDER BY bh.created_at DESC
      LIMIT 100
    `);

    return {
      summary: summary.rows[0],
      byAction: byAction.rows,
      daily: daily.rows,
      byRoute: byRoute.rows,
      recent: recent.rows,
    };
  }

  async getCargoReport(f: ReportFilters) {
    const where = joinConditions([
      sql.raw(`t.service_date >= `).append(sql`${f.dateFrom}`),
      sql.raw(`t.service_date <= `).append(sql`${f.dateTo}`),
      ...(f.patternId ? [sql.raw(`t.pattern_id = `).append(sql`${f.patternId}`)] : []),
      ...(f.outletId ? [sql.raw(`cs.outlet_id = `).append(sql`${f.outletId}`)] : []),
    ]);

    const summary = await db.execute(sql`
      SELECT
        COUNT(*)::int as total_shipments,
        COALESCE(SUM(cs.total_amount::numeric), 0) as total_revenue,
        COALESCE(SUM(cs.weight_kg::numeric), 0) as total_weight_kg,
        COUNT(*) FILTER (WHERE cs.status = 'delivered')::int as delivered_count,
        COUNT(*) FILTER (WHERE cs.status = 'canceled')::int as canceled_count,
        COUNT(*) FILTER (WHERE cs.status NOT IN ${EXCLUDE_CARGO_SQL})::int as active_count
      FROM cargo_shipments cs
      INNER JOIN trips t ON cs.trip_id = t.id
      WHERE ${where}
    `);

    const byStatus = await db.execute(sql`
      SELECT
        cs.status,
        COUNT(*)::int as count,
        COALESCE(SUM(cs.total_amount::numeric), 0) as revenue
      FROM cargo_shipments cs
      INNER JOIN trips t ON cs.trip_id = t.id
      WHERE ${where}
      GROUP BY cs.status
      ORDER BY count DESC
    `);

    const daily = await db.execute(sql`
      SELECT
        t.service_date::text as date,
        COUNT(*)::int as shipments,
        COALESCE(SUM(cs.total_amount::numeric), 0) as revenue
      FROM cargo_shipments cs
      INNER JOIN trips t ON cs.trip_id = t.id
      WHERE ${where}
      GROUP BY t.service_date
      ORDER BY t.service_date
    `);

    const byRoute = await db.execute(sql`
      SELECT
        COALESCE(tp.name, '-') as route_name,
        tp.code as route_code,
        COUNT(*)::int as shipments,
        COALESCE(SUM(cs.total_amount::numeric), 0) as revenue,
        COALESCE(SUM(cs.weight_kg::numeric), 0) as total_weight
      FROM cargo_shipments cs
      INNER JOIN trips t ON cs.trip_id = t.id
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      WHERE ${where}
      GROUP BY tp.name, tp.code
      ORDER BY revenue DESC
    `);

    const recent = await db.execute(sql`
      SELECT
        cs.id, cs.waybill_number, cs.status, cs.sender_name, cs.recipient_name,
        cs.item_description, cs.quantity, cs.weight_kg, cs.total_amount,
        cs.payment_method, cs.created_at,
        tp.name as route_name,
        t.service_date::text,
        os.name as origin_name, ds.name as destination_name
      FROM cargo_shipments cs
      INNER JOIN trips t ON cs.trip_id = t.id
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      LEFT JOIN stops os ON cs.origin_stop_id = os.id
      LEFT JOIN stops ds ON cs.destination_stop_id = ds.id
      WHERE ${where}
      ORDER BY cs.created_at DESC
      LIMIT 100
    `);

    return {
      summary: summary.rows[0],
      byStatus: byStatus.rows,
      daily: daily.rows,
      byRoute: byRoute.rows,
      recent: recent.rows,
    };
  }

  async getPaymentsReport(f: ReportFilters) {
    const where = joinConditions(bookingFilters(f, 'b', 't'));

    const summary = await db.execute(sql`
      SELECT
        COUNT(*)::int as total_payments,
        COALESCE(SUM(py.amount::numeric), 0) as total_amount,
        COUNT(*) FILTER (WHERE py.status = 'success')::int as success_count,
        COUNT(*) FILTER (WHERE py.status = 'pending')::int as pending_count,
        COUNT(*) FILTER (WHERE py.status = 'failed')::int as failed_count,
        COALESCE(SUM(py.amount::numeric) FILTER (WHERE py.status = 'success'), 0) as success_amount
      FROM payments py
      INNER JOIN bookings b ON py.booking_id = b.id
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
    `);

    const byMethod = await db.execute(sql`
      SELECT
        py.method,
        COUNT(*)::int as count,
        COALESCE(SUM(py.amount::numeric), 0) as amount,
        COUNT(*) FILTER (WHERE py.status = 'success')::int as success_count
      FROM payments py
      INNER JOIN bookings b ON py.booking_id = b.id
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
      GROUP BY py.method
      ORDER BY amount DESC
    `);

    const byStatus = await db.execute(sql`
      SELECT
        py.status,
        COUNT(*)::int as count,
        COALESCE(SUM(py.amount::numeric), 0) as amount
      FROM payments py
      INNER JOIN bookings b ON py.booking_id = b.id
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
      GROUP BY py.status
      ORDER BY count DESC
    `);

    const daily = await db.execute(sql`
      SELECT
        t.service_date::text as date,
        COUNT(*)::int as payments,
        COALESCE(SUM(py.amount::numeric) FILTER (WHERE py.status = 'success'), 0) as amount
      FROM payments py
      INNER JOIN bookings b ON py.booking_id = b.id
      INNER JOIN trips t ON b.trip_id = t.id
      WHERE ${where}
      GROUP BY t.service_date
      ORDER BY t.service_date
    `);

    const byOutlet = await db.execute(sql`
      SELECT
        COALESCE(o.name, 'Tanpa Outlet') as outlet_name,
        COUNT(*)::int as count,
        COALESCE(SUM(py.amount::numeric) FILTER (WHERE py.status = 'success'), 0) as amount
      FROM payments py
      INNER JOIN bookings b ON py.booking_id = b.id
      INNER JOIN trips t ON b.trip_id = t.id
      LEFT JOIN outlets o ON b.outlet_id = o.id
      WHERE ${where}
      GROUP BY o.name
      ORDER BY amount DESC
    `);

    const recent = await db.execute(sql`
      SELECT
        py.id, py.method, py.status, py.amount, py.provider_ref, py.paid_at,
        b.booking_code, b.channel,
        tp.name as route_name,
        t.service_date::text,
        COALESCE(o.name, '-') as outlet_name
      FROM payments py
      INNER JOIN bookings b ON py.booking_id = b.id
      INNER JOIN trips t ON b.trip_id = t.id
      LEFT JOIN trip_patterns tp ON t.pattern_id = tp.id
      LEFT JOIN outlets o ON b.outlet_id = o.id
      WHERE ${where}
      ORDER BY py.paid_at DESC NULLS LAST
      LIMIT 100
    `);

    return {
      summary: summary.rows[0],
      byMethod: byMethod.rows,
      byStatus: byStatus.rows,
      daily: daily.rows,
      byOutlet: byOutlet.rows,
      recent: recent.rows,
    };
  }

  async getFilterOptions() {
    const outlets = await db.execute(sql`SELECT id, name FROM outlets ORDER BY name`);
    const patterns = await db.execute(sql`SELECT id, code, name FROM trip_patterns WHERE active = true ORDER BY name`);
    return {
      outlets: outlets.rows,
      patterns: patterns.rows,
      channels: ['CSO', 'WEB', 'APP', 'OTA'],
    };
  }
}
