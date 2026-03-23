import { db } from "../../db";
import { sql } from "drizzle-orm";

const ROLES = [
  { id: "owner",          name: "Owner",          description: "Full akses semua fitur dan master data" },
  { id: "finance",        name: "Finance",         description: "Akses laporan finansial dan booking (read-only)" },
  { id: "manager",        name: "Manager",         description: "Akses operasional penuh dan semua laporan" },
  { id: "spv_operations", name: "SPV Operations",  description: "Kelola jadwal, SPJ, manifest, dan kargo" },
  { id: "operations",     name: "Operations",      description: "Operasional harian, aksi terbatas" },
  { id: "spv_cso",        name: "SPV CSO",         description: "CSO dengan akses unseat dan reschedule" },
  { id: "cso",            name: "CSO",             description: "Booking dan transaksi harian saja" },
];

const FEATURE_FLAGS = [
  { id: "page.cso",       name: "Halaman CSO",          description: "Akses halaman Reservasi / CSO",         category: "page" },
  { id: "page.cargo",     name: "Halaman Kargo",         description: "Akses halaman Kargo",                   category: "page" },
  { id: "page.bookings",  name: "Halaman All Bookings",  description: "Akses halaman semua booking",            category: "page" },
  { id: "page.schedule",  name: "Halaman Jadwal",        description: "Akses halaman Jadwal Harian",           category: "page" },
  { id: "page.spj",       name: "Halaman SPJ",           description: "Akses halaman SPJ",                     category: "page" },
  { id: "page.manifest",  name: "Halaman Manifest",      description: "Akses halaman Manifest",                category: "page" },
  { id: "page.reports",   name: "Halaman Laporan",       description: "Akses section Laporan",                 category: "page" },
  { id: "page.masters",   name: "Halaman Master",        description: "Akses section Master Data",             category: "page" },

  { id: "report.revenue",            name: "Laporan Pendapatan",     description: "Akses laporan pendapatan",      category: "report" },
  { id: "report.sales",              name: "Laporan Penjualan",      description: "Akses laporan penjualan",       category: "report" },
  { id: "report.trip_profitability", name: "Laba Rugi Trip",         description: "Akses laporan laba rugi trip",  category: "report" },
  { id: "report.load_factor",        name: "Load Factor",            description: "Akses laporan load factor",     category: "report" },
  { id: "report.cancellations",      name: "Laporan Pembatalan",     description: "Akses laporan pembatalan",      category: "report" },
  { id: "report.cargo",              name: "Laporan Kargo",          description: "Akses laporan kargo",           category: "report" },
  { id: "report.payments",           name: "Laporan Pembayaran",     description: "Akses laporan pembayaran",      category: "report" },
  { id: "report.commercial_fee",    name: "Laporan Commercial Fee", description: "Akses laporan commercial fee",  category: "report" },

  { id: "master.stops",          name: "Master Stops",           description: "Kelola data stops",                  category: "master" },
  { id: "master.outlets",        name: "Master Outlets",         description: "Kelola data outlets",                category: "master" },
  { id: "master.vehicles",       name: "Master Kendaraan",       description: "Kelola data kendaraan",              category: "master" },
  { id: "master.drivers",        name: "Master Driver",          description: "Kelola data driver",                 category: "master" },
  { id: "master.layouts",        name: "Layout Kursi",           description: "Kelola layout kursi",                category: "master" },
  { id: "master.trip_patterns",  name: "Trip Patterns",          description: "Kelola trip patterns",               category: "master" },
  { id: "master.trips",          name: "Data Trips",             description: "Kelola data trips",                  category: "master" },
  { id: "master.price_rules",    name: "Aturan Harga",           description: "Kelola aturan harga",                category: "master" },
  { id: "master.promos",         name: "Promo & Voucher",        description: "Kelola promo dan voucher",           category: "master" },
  { id: "master.cargo_types",    name: "Jenis Kargo",            description: "Kelola jenis kargo",                 category: "master" },
  { id: "master.cargo_rates",    name: "Tarif Kargo",            description: "Kelola tarif kargo",                 category: "master" },
  { id: "master.cost_templates", name: "Biaya Perjalanan",       description: "Kelola template biaya perjalanan",   category: "master" },

  { id: "action.booking.create",        name: "Buat Booking",           description: "Buat booking baru",                     category: "action" },
  { id: "action.booking.cancel",        name: "Cancel Tiket",           description: "Cancel tiket atau booking",              category: "action" },
  { id: "action.passenger.unseat",      name: "Unseat Penumpang",       description: "Unseat penumpang dari kursi",            category: "action" },
  { id: "action.passenger.reschedule",  name: "Reschedule Penumpang",   description: "Reschedule penumpang ke trip lain",      category: "action" },
  { id: "action.passenger.assign_seat", name: "Assign Kursi",           description: "Assign kursi ke penumpang unseated",     category: "action" },
  { id: "action.trip.materialize",      name: "Materialize Trip",       description: "Materialize trip dari base/template",    category: "action" },
  { id: "action.trip.close",            name: "Close Trip",             description: "Tutup trip yang telah selesai",          category: "action" },
  { id: "action.trip.batch_reschedule", name: "Batch Reschedule",       description: "Reschedule semua penumpang saat tutup trip", category: "action" },
  { id: "page.schedule.closed",        name: "Lihat Jadwal Closed",    description: "Tampilkan trip closed di list Jadwal Harian",  category: "page" },
  { id: "page.cso.view_closed",        name: "Akses Seatmap Closed",   description: "Masuk ke trip closed dan lihat seatmap di Reservasi", category: "page" },
  { id: "action.payment.create",        name: "Buat Pembayaran",        description: "Buat transaksi pembayaran",              category: "action" },
  { id: "action.cargo.create",          name: "Buat Kargo",             description: "Buat pengiriman kargo baru",             category: "action" },
  { id: "action.cargo.manage",          name: "Kelola Status Kargo",    description: "Update status pengiriman kargo",         category: "action" },
  { id: "action.spj.create",            name: "Buat SPJ",               description: "Buat Surat Perintah Jalan",             category: "action" },
  { id: "action.spj.issue",             name: "Terbitkan SPJ",          description: "Terbitkan / issue SPJ",                 category: "action" },
  { id: "action.spj.settle",            name: "Settle SPJ",             description: "Selesaikan / settle SPJ",               category: "action" },

  { id: "admin.staff.manage", name: "Kelola Staff",         description: "Tambah/edit/hapus staff dan assign role & outlet", category: "admin" },
  { id: "admin.flags.manage", name: "Kelola Feature Flags", description: "Toggle feature flags per role",                    category: "admin" },
];

type RoleId = "owner" | "finance" | "manager" | "spv_operations" | "operations" | "spv_cso" | "cso";
type FlagMatrix = Record<RoleId, boolean>;

const DEFAULT_MATRIX: Record<string, FlagMatrix> = {
  "page.cso":       { owner: true,  finance: false, manager: true,  spv_operations: false, operations: false, spv_cso: true,  cso: true  },
  "page.cargo":     { owner: true,  finance: false, manager: true,  spv_operations: true,  operations: true,  spv_cso: true,  cso: true  },
  "page.bookings":  { owner: true,  finance: true,  manager: true,  spv_operations: true,  operations: false, spv_cso: true,  cso: false },
  "page.schedule":  { owner: true,  finance: false, manager: true,  spv_operations: true,  operations: true,  spv_cso: false, cso: false },
  "page.spj":       { owner: true,  finance: false, manager: true,  spv_operations: true,  operations: true,  spv_cso: false, cso: false },
  "page.manifest":  { owner: true,  finance: false, manager: true,  spv_operations: true,  operations: true,  spv_cso: true,  cso: true  },
  "page.reports":   { owner: true,  finance: true,  manager: true,  spv_operations: false, operations: false, spv_cso: false, cso: false },
  "page.masters":   { owner: true,  finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },

  "report.revenue":            { owner: true, finance: true,  manager: true,  spv_operations: false, operations: false, spv_cso: false, cso: false },
  "report.sales":              { owner: true, finance: true,  manager: true,  spv_operations: false, operations: false, spv_cso: false, cso: false },
  "report.trip_profitability": { owner: true, finance: true,  manager: true,  spv_operations: false, operations: false, spv_cso: false, cso: false },
  "report.load_factor":        { owner: true, finance: false, manager: true,  spv_operations: true,  operations: false, spv_cso: false, cso: false },
  "report.cancellations":      { owner: true, finance: true,  manager: true,  spv_operations: false, operations: false, spv_cso: false, cso: false },
  "report.cargo":              { owner: true, finance: true,  manager: true,  spv_operations: true,  operations: false, spv_cso: false, cso: false },
  "report.payments":           { owner: true, finance: true,  manager: true,  spv_operations: false, operations: false, spv_cso: false, cso: false },
  "report.commercial_fee":    { owner: true, finance: true,  manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },

  "master.stops":          { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
  "master.outlets":        { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
  "master.vehicles":       { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
  "master.drivers":        { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
  "master.layouts":        { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
  "master.trip_patterns":  { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
  "master.trips":          { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
  "master.price_rules":    { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
  "master.promos":         { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
  "master.cargo_types":    { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
  "master.cargo_rates":    { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
  "master.cost_templates": { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },

  "action.booking.create":        { owner: true, finance: false, manager: true,  spv_operations: false, operations: false, spv_cso: true,  cso: true  },
  "action.booking.cancel":        { owner: true, finance: false, manager: true,  spv_operations: false, operations: false, spv_cso: true,  cso: true  },
  "action.passenger.unseat":      { owner: true, finance: false, manager: true,  spv_operations: false, operations: false, spv_cso: true,  cso: false },
  "action.passenger.reschedule":  { owner: true, finance: false, manager: true,  spv_operations: false, operations: false, spv_cso: true,  cso: false },
  "action.passenger.assign_seat": { owner: true, finance: false, manager: true,  spv_operations: false, operations: false, spv_cso: true,  cso: true  },
  "action.trip.materialize":      { owner: true, finance: false, manager: true,  spv_operations: true,  operations: false, spv_cso: false, cso: false },
  "action.trip.close":            { owner: true, finance: false, manager: true,  spv_operations: true,  operations: false, spv_cso: false, cso: false },
  "action.trip.batch_reschedule": { owner: true, finance: false, manager: true,  spv_operations: true,  operations: false, spv_cso: false, cso: false },
  "page.schedule.closed":        { owner: true, finance: false, manager: true,  spv_operations: true,  operations: false, spv_cso: false, cso: false },
  "page.cso.view_closed":        { owner: true, finance: false, manager: true,  spv_operations: true,  operations: false, spv_cso: false, cso: false },
  "action.payment.create":        { owner: true, finance: false, manager: true,  spv_operations: false, operations: false, spv_cso: true,  cso: true  },
  "action.cargo.create":          { owner: true, finance: false, manager: true,  spv_operations: true,  operations: true,  spv_cso: true,  cso: true  },
  "action.cargo.manage":          { owner: true, finance: false, manager: true,  spv_operations: true,  operations: true,  spv_cso: false, cso: false },
  "action.spj.create":            { owner: true, finance: false, manager: true,  spv_operations: true,  operations: true,  spv_cso: false, cso: false },
  "action.spj.issue":             { owner: true, finance: false, manager: true,  spv_operations: true,  operations: false, spv_cso: false, cso: false },
  "action.spj.settle":            { owner: true, finance: false, manager: true,  spv_operations: true,  operations: false, spv_cso: false, cso: false },

  "admin.staff.manage": { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
  "admin.flags.manage": { owner: true, finance: false, manager: false, spv_operations: false, operations: false, spv_cso: false, cso: false },
};

export async function seedRbac() {
  console.log("[RBAC] Seeding roles...");
  for (const role of ROLES) {
    await db.execute(sql`
      INSERT INTO roles (id, name, description)
      VALUES (${role.id}, ${role.name}, ${role.description})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description
    `);
  }
  console.log(`  ✓ ${ROLES.length} roles`);

  console.log("[RBAC] Seeding feature flags...");
  for (const flag of FEATURE_FLAGS) {
    await db.execute(sql`
      INSERT INTO feature_flags (id, name, description, category)
      VALUES (${flag.id}, ${flag.name}, ${flag.description}, ${flag.category})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category
    `);
  }
  console.log(`  ✓ ${FEATURE_FLAGS.length} feature flags`);

  console.log("[RBAC] Seeding role_flags (default matrix)...");
  let count = 0;
  for (const [flagId, matrix] of Object.entries(DEFAULT_MATRIX)) {
    for (const roleId of Object.keys(matrix) as RoleId[]) {
      const enabled = matrix[roleId];
      await db.execute(sql`
        INSERT INTO role_flags (role_id, flag_id, enabled)
        VALUES (${roleId}, ${flagId}, ${enabled})
        ON CONFLICT (role_id, flag_id) DO UPDATE SET enabled = EXCLUDED.enabled
      `);
      count++;
    }
  }
  console.log(`  ✓ ${count} role-flag mappings (upserted)`);

  console.log("[RBAC] Seed complete.");
}
