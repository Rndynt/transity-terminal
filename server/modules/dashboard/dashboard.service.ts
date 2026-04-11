import { db } from "@server/db";
import { sql } from "drizzle-orm";

function getRow(result: any, index = 0) {
  const rows = Array.isArray(result) ? result : result?.rows || [];
  return rows[index] || {};
}

function getRows(result: any) {
  return Array.isArray(result) ? result : result?.rows || [];
}

export class DashboardService {
  async getTodaySummary() {
    const today = new Date().toISOString().split('T')[0];

    const tripsResult = getRow(await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS canceled,
        COUNT(*) FILTER (WHERE driver_id IS NULL)::int AS no_driver
      FROM trips WHERE service_date = ${today}
    `));

    const bookingsResult = getRow(await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'paid')::int AS paid,
        COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int AS canceled
      FROM bookings WHERE created_at::date = ${today}
    `));

    const revenueResult = getRow(await db.execute(sql`
      SELECT COALESCE(SUM(amount), 0)::numeric AS total
      FROM payments WHERE status = 'success' AND paid_at::date = ${today}
    `));

    const cargoResult = getRow(await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(weight_kg), 0)::numeric AS total_weight,
        COALESCE(SUM(total_amount), 0)::numeric AS revenue
      FROM cargo_shipments WHERE created_at::date = ${today}
    `));

    const pendingOld = getRow(await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM bookings
      WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 minutes'
    `));

    const spjOverdue = getRow(await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM spj
      WHERE status IN ('issued', 'on_trip') AND created_at < NOW() - INTERVAL '3 days'
    `));

    const recentBookings = getRows(await db.execute(sql`
      SELECT b.id, b.booking_code, b.status, b.total_amount, b.channel, b.created_at,
             o.name AS origin_name, d.name AS dest_name
      FROM bookings b
      LEFT JOIN stops o ON o.id = b.origin_stop_id
      LEFT JOIN stops d ON d.id = b.destination_stop_id
      ORDER BY b.created_at DESC LIMIT 10
    `));

    const loadFactor = getRow(await db.execute(sql`
      SELECT
        COALESCE(AVG(
          CASE WHEN v.capacity > 0
            THEN (SELECT COUNT(*) FROM passengers p
                  JOIN bookings bk ON bk.id = p.booking_id
                  WHERE bk.trip_id = t.id AND p.ticket_status NOT IN ('cancelled', 'unseated'))::numeric / v.capacity * 100
            ELSE 0 END
        ), 0)::numeric AS avg_load
      FROM trips t
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      WHERE t.service_date = ${today}
    `));

    return {
      trips: tripsResult,
      bookings: bookingsResult,
      revenue: Number(revenueResult?.total || 0),
      cargo: {
        total: cargoResult?.total || 0,
        totalWeight: Number(cargoResult?.total_weight || 0),
        revenue: Number(cargoResult?.revenue || 0),
      },
      alerts: {
        tripsNoDriver: tripsResult?.no_driver || 0,
        pendingBookingsOld: pendingOld?.count || 0,
        spjOverdue: spjOverdue?.count || 0,
      },
      avgLoadFactor: Number(loadFactor?.avg_load || 0),
      recentBookings,
    };
  }
}
