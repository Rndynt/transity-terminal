/**
 * Fix: insert seat_holds untuk data PL- yang sudah ada.
 * Jalankan ini satu kali setelah seeder v2 gagal di phase 9.
 */
import "@server/lib/loadEnv";
import { db } from "@server/db";
import { sql } from "drizzle-orm";
import { seatHolds } from "@shared/schema/inventory";

const CHUNK   = 2000;
const LEG_IDX = 1;
const TOTAL_HOLDS = 5000;
const BASES_PER_PATTERN = 20;
const NUM_PATTERNS      = 100;
const DAYS              = 30;
const PAST_DAYS         = 15;
const CAPACITY          = 14;

const SEAT_NOS = ["1A","1B","2A","2B","2C","3A","3B","3C","4A","4B","4C","5A","5B","5C"];

function chunkArr<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function pseudoRand(seed: number, min: number, max: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return min + Math.floor((x - Math.floor(x)) * (max - min + 1));
}

async function main() {
  console.log("Fetching existing PL- trip UUIDs (60K) ...");

  // Ambil semua trip PL- dengan urutan yang sama persis seperti saat seed
  // Order: snap_route_code ASC, service_date ASC, origin_depart_hhmm ASC
  const tripRows = await db.execute(sql`
    SELECT id, snap_route_code, service_date, origin_depart_hhmm
    FROM trips
    WHERE snap_route_code LIKE 'PL-%'
    ORDER BY snap_route_code ASC, service_date ASC, origin_depart_hhmm ASC
  `);

  const tripIds: string[] = (tripRows.rows as any[]).map(r => r.id);
  console.log(`  Loaded ${tripIds.length} trip IDs`);

  // Build booked set from existing bookings
  console.log("Building bookedMap from existing bookings ...");
  const bookedRows = await db.execute(sql`
    SELECT b.trip_id, p.seat_no
    FROM bookings b
    JOIN passengers p ON p.booking_id = b.id
    WHERE b.booking_code LIKE 'PL-%'
      AND b.status IN ('paid', 'confirmed', 'checked_in')
  `);
  const bookedMap = new Map<string, Set<string>>();
  for (const r of bookedRows.rows as any[]) {
    if (!bookedMap.has(r.trip_id)) bookedMap.set(r.trip_id, new Set());
    bookedMap.get(r.trip_id)!.add(r.seat_no);
  }
  console.log(`  bookedMap: ${bookedMap.size} trips with bookings`);

  // Delete existing PL- holds first (cleanup)
  await db.execute(sql`DELETE FROM seat_holds WHERE hold_ref LIKE 'PL-%'`);
  console.log("  Existing PL- holds cleared");

  const now      = new Date();
  const holdRows: any[] = [];

  for (let h = 0; h < TOTAL_HOLDS; h++) {
    const isActive  = h % 3 !== 0;
    const dayOffset = isActive
      ? pseudoRand(h, 0, DAYS - PAST_DAYS - 1)
      : pseudoRand(h, 0, PAST_DAYS - 1);
    const d = isActive ? PAST_DAYS + dayOffset : dayOffset;
    const p = pseudoRand(h * 7,  0, NUM_PATTERNS      - 1);
    const t = pseudoRand(h * 13, 0, BASES_PER_PATTERN - 1);

    // Index dalam array yang sudah disorting:
    // pattern p → route code PL-P0XX, masing-masing 20 depart × 30 days
    const tidIdx = p * BASES_PER_PATTERN * DAYS + t * DAYS + d;
    if (tidIdx >= tripIds.length) continue;
    const tid = tripIds[tidIdx];

    const takenSeats = bookedMap.get(tid) ?? new Set<string>();
    const freeSeat   = SEAT_NOS.find((sn, si) => !takenSeats.has(SEAT_NOS[(si + h) % CAPACITY]));
    const seatNo     = freeSeat ?? SEAT_NOS[h % CAPACITY];

    const expiresAt = isActive
      ? new Date(now.getTime() + pseudoRand(h, 5, 30) * 60_000)
      : new Date(now.getTime() - pseudoRand(h, 1, 120) * 60_000);

    holdRows.push({
      holdRef:    `PL-HOLD-${String(h + 1).padStart(6, "0")}`,
      tripId:     tid,
      seatNo,
      legIndexes: [LEG_IDX],
      ttlClass:   isActive ? "CSO_LONG" : "CSO_SHORT",
      operatorId: "perfload-operator",
      bookingId:  null,
      expiresAt,
    });
  }

  console.log(`Inserting ${holdRows.length} seat holds ...`);
  for (const c of chunkArr(holdRows, CHUNK)) {
    await (db.insert(seatHolds) as any).values(c);
  }

  const activeCount = holdRows.filter(r => r.expiresAt > now).length;
  console.log(`  ✓ ${holdRows.length} seat holds inserted (${activeCount} aktif, ${holdRows.length - activeCount} expired)`);
  console.log("\nDone!");
}

main().catch(err => { console.error(err); process.exit(1); }).finally(() => process.exit(0));
