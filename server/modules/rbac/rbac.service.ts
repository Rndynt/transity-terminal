import { db } from "../../db";
import { roleFlags, staffMembers } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";

export interface EffectivePermissions {
  flags: Set<string>;
  outletId: string | null;
  roleId: string | null;
}

interface StaffRow {
  roleId: string;
  outletId: string | null;
  isActive: boolean;
}

interface RoleFlagRow {
  flagId: string;
  enabled: boolean;
}

const FALLBACK_FLAGS: Record<string, string[]> = {
  owner: [
    "page.cso", "page.cargo", "page.bookings", "page.schedule", "page.spj", "page.manifest", "page.reports", "page.masters",
    "report.revenue", "report.sales", "report.trip_profitability", "report.load_factor", "report.cancellations", "report.cargo", "report.payments",
    "master.stops", "master.outlets", "master.vehicles", "master.drivers", "master.layouts", "master.trip_patterns", "master.trips", "master.price_rules", "master.promos", "master.cargo_types", "master.cargo_rates", "master.cost_templates",
    "action.booking.create", "action.booking.cancel", "action.passenger.unseat", "action.passenger.reschedule", "action.passenger.assign_seat",
    "action.trip.materialize", "action.trip.close", "action.trip.batch_reschedule", "action.payment.create", "action.cargo.create", "action.cargo.manage",
    "action.spj.create", "action.spj.issue", "action.spj.settle",
    "admin.staff.manage", "admin.flags.manage", "page.schedule.closed", "page.cso.view_closed",
  ],
  finance: [
    "page.bookings", "page.reports",
    "report.revenue", "report.sales", "report.trip_profitability", "report.cancellations", "report.cargo", "report.payments",
  ],
  manager: [
    "page.cso", "page.cargo", "page.bookings", "page.schedule", "page.spj", "page.manifest", "page.reports",
    "report.revenue", "report.sales", "report.trip_profitability", "report.load_factor", "report.cancellations", "report.cargo", "report.payments",
    "action.booking.create", "action.booking.cancel", "action.passenger.unseat", "action.passenger.reschedule", "action.passenger.assign_seat",
    "action.trip.materialize", "action.trip.close", "action.trip.batch_reschedule", "action.payment.create", "action.cargo.create", "action.cargo.manage",
    "action.spj.create", "action.spj.issue", "action.spj.settle", "page.schedule.closed", "page.cso.view_closed",
  ],
  spv_operations: [
    "page.cargo", "page.bookings", "page.schedule", "page.spj", "page.manifest",
    "report.load_factor", "report.cargo",
    "action.trip.materialize", "action.trip.close", "action.trip.batch_reschedule", "action.cargo.create", "action.cargo.manage",
    "action.spj.create", "action.spj.issue", "action.spj.settle", "page.schedule.closed", "page.cso.view_closed",
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
    const rows: RoleFlagRow[] = await db
      .select({ flagId: roleFlags.flagId, enabled: roleFlags.enabled })
      .from(roleFlags)
      .where(and(eq(roleFlags.roleId, roleId), eq(roleFlags.enabled, true)));
    return new Set(rows.map((r) => r.flagId));
  } catch {
    return new Set(FALLBACK_FLAGS[roleId] ?? []);
  }
}

export async function getEffectiveFlags(userId: string, userRoleHint?: string | null): Promise<Set<string>> {
  const perms = await getEffectivePermissions(userId, userRoleHint);
  return perms.flags;
}

export async function getEffectivePermissions(
  userId: string,
  userRoleHint?: string | null
): Promise<EffectivePermissions> {
  try {
    const staffRows: StaffRow[] = await db
      .select({
        roleId: staffMembers.roleId,
        outletId: staffMembers.outletId,
        isActive: staffMembers.isActive,
      })
      .from(staffMembers)
      .where(and(eq(staffMembers.userId, userId), eq(staffMembers.isActive, true)))
      .limit(1);

    const staff = staffRows[0];

    if (staff) {
      const flags = await getFlagsFromDb(staff.roleId);
      return {
        flags,
        outletId: staff.outletId ?? null,
        roleId: staff.roleId,
      };
    }

    if (userRoleHint) {
      const flags = await getFlagsFromDb(userRoleHint);
      if (flags.size > 0) {
        return { flags, outletId: null, roleId: userRoleHint };
      }
      return {
        flags: new Set(FALLBACK_FLAGS[userRoleHint] ?? []),
        outletId: null,
        roleId: userRoleHint,
      };
    }

    return { flags: new Set(), outletId: null, roleId: null };
  } catch {
    if (userRoleHint) {
      return {
        flags: new Set(FALLBACK_FLAGS[userRoleHint] ?? []),
        outletId: null,
        roleId: userRoleHint,
      };
    }
    return { flags: new Set(), outletId: null, roleId: null };
  }
}
