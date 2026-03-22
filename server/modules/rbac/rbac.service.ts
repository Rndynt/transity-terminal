import { db } from "../../db";
import { sql } from "drizzle-orm";

export interface EffectivePermissions {
  flags: Set<string>;
  outletId: string | null;
  roleId: string | null;
}

const FALLBACK_FLAGS: Record<string, string[]> = {
  owner: [
    "page.cso", "page.cargo", "page.bookings", "page.schedule", "page.spj", "page.manifest", "page.reports", "page.masters",
    "report.revenue", "report.sales", "report.trip_profitability", "report.load_factor", "report.cancellations", "report.cargo", "report.payments",
    "master.stops", "master.outlets", "master.vehicles", "master.drivers", "master.layouts", "master.trip_patterns", "master.trips", "master.price_rules", "master.promos", "master.cargo_types", "master.cargo_rates", "master.cost_templates",
    "action.booking.create", "action.booking.cancel", "action.passenger.unseat", "action.passenger.reschedule", "action.passenger.assign_seat",
    "action.trip.materialize", "action.trip.close", "action.payment.create", "action.cargo.create", "action.cargo.manage",
    "action.spj.create", "action.spj.issue", "action.spj.settle",
    "admin.staff.manage", "admin.flags.manage",
  ],
  finance: [
    "page.bookings", "page.reports",
    "report.revenue", "report.sales", "report.trip_profitability", "report.cancellations", "report.cargo", "report.payments",
  ],
  manager: [
    "page.cso", "page.cargo", "page.bookings", "page.schedule", "page.spj", "page.manifest", "page.reports",
    "report.revenue", "report.sales", "report.trip_profitability", "report.load_factor", "report.cancellations", "report.cargo", "report.payments",
    "action.booking.create", "action.booking.cancel", "action.passenger.unseat", "action.passenger.reschedule", "action.passenger.assign_seat",
    "action.trip.materialize", "action.trip.close", "action.payment.create", "action.cargo.create", "action.cargo.manage",
    "action.spj.create", "action.spj.issue", "action.spj.settle",
  ],
  spv_operations: [
    "page.cargo", "page.bookings", "page.schedule", "page.spj", "page.manifest",
    "report.load_factor", "report.cargo",
    "action.trip.materialize", "action.trip.close", "action.cargo.create", "action.cargo.manage",
    "action.spj.create", "action.spj.issue", "action.spj.settle",
  ],
  operations: [
    "page.cargo", "page.schedule", "page.spj", "page.manifest",
    "action.cargo.create", "action.cargo.manage", "action.spj.create",
  ],
  spv_cso: [
    "page.cso", "page.cargo", "page.bookings", "page.manifest",
    "action.booking.create", "action.booking.cancel", "action.passenger.unseat", "action.passenger.reschedule", "action.passenger.assign_seat",
    "action.payment.create", "action.cargo.create",
  ],
  cso: [
    "page.cso", "page.cargo", "page.manifest",
    "action.booking.create", "action.booking.cancel", "action.passenger.assign_seat",
    "action.payment.create", "action.cargo.create",
  ],
};

async function getFlagsFromDb(roleId: string): Promise<Set<string>> {
  try {
    const rows = await db.execute(sql`
      SELECT flag_id FROM role_flags WHERE role_id = ${roleId} AND enabled = true
    `);
    return new Set((rows as any[]).map((r: any) => r.flag_id));
  } catch {
    return new Set(FALLBACK_FLAGS[roleId] ?? []);
  }
}

export async function getEffectivePermissions(
  userId: string,
  userRoleHint?: string | null
): Promise<EffectivePermissions> {
  try {
    const staffRows = await db.execute(sql`
      SELECT role_id, outlet_id, is_active
      FROM staff_members
      WHERE user_id = ${userId} AND is_active = true
      LIMIT 1
    `);

    const staff = (staffRows as any[])[0];

    if (staff) {
      const flags = await getFlagsFromDb(staff.role_id);
      return {
        flags,
        outletId: staff.outlet_id ?? null,
        roleId:   staff.role_id,
      };
    }

    if (userRoleHint) {
      const flags = await getFlagsFromDb(userRoleHint);
      if (flags.size > 0) {
        return { flags, outletId: null, roleId: userRoleHint };
      }
      return {
        flags:    new Set(FALLBACK_FLAGS[userRoleHint] ?? []),
        outletId: null,
        roleId:   userRoleHint,
      };
    }

    return { flags: new Set(), outletId: null, roleId: null };
  } catch {
    if (userRoleHint) {
      return {
        flags:    new Set(FALLBACK_FLAGS[userRoleHint] ?? []),
        outletId: null,
        roleId:   userRoleHint,
      };
    }
    return { flags: new Set(), outletId: null, roleId: null };
  }
}
