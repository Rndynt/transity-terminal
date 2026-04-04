import { db } from "@server/db";
import { sql } from "drizzle-orm";

async function backfillSnapshots() {
  console.log("[BACKFILL] Starting snapshot backfill...");

  const tripRoute = await db.execute(sql`
    UPDATE trips SET
      snap_route_name = tp.name,
      snap_route_code = tp.code
    FROM trip_patterns tp
    WHERE tp.id = trips.pattern_id
      AND trips.snap_route_name IS NULL
  `);
  console.log(`[BACKFILL] Trip route snaps: ${tripRoute.rowCount}`);

  const tripDriver = await db.execute(sql`
    UPDATE trips SET
      snap_driver_name = d.name
    FROM drivers d
    WHERE d.id = trips.driver_id
      AND trips.snap_driver_name IS NULL
  `);
  console.log(`[BACKFILL] Trip driver snaps: ${tripDriver.rowCount}`);

  const tripVehicle = await db.execute(sql`
    UPDATE trips SET
      snap_vehicle_plate = v.plate
    FROM vehicles v
    WHERE v.id = trips.vehicle_id
      AND trips.snap_vehicle_plate IS NULL
  `);
  console.log(`[BACKFILL] Trip vehicle snaps: ${tripVehicle.rowCount}`);

  const bookingOrigin = await db.execute(sql`
    UPDATE bookings SET
      snap_origin_stop_name = s.name
    FROM stops s
    WHERE s.id = bookings.origin_stop_id
      AND bookings.snap_origin_stop_name IS NULL
  `);
  console.log(`[BACKFILL] Booking origin stop snaps: ${bookingOrigin.rowCount}`);

  const bookingDest = await db.execute(sql`
    UPDATE bookings SET
      snap_destination_stop_name = s.name
    FROM stops s
    WHERE s.id = bookings.destination_stop_id
      AND bookings.snap_destination_stop_name IS NULL
  `);
  console.log(`[BACKFILL] Booking destination stop snaps: ${bookingDest.rowCount}`);

  const bookingOutlet = await db.execute(sql`
    UPDATE bookings SET
      snap_outlet_name = o.name
    FROM outlets o
    WHERE o.id = bookings.outlet_id
      AND bookings.snap_outlet_name IS NULL
  `);
  console.log(`[BACKFILL] Booking outlet snaps: ${bookingOutlet.rowCount}`);

  const bookingDepart = await db.execute(sql`
    UPDATE bookings SET
      snap_departure_hhmm = t.origin_depart_hhmm
    FROM trips t
    WHERE t.id = bookings.trip_id
      AND bookings.snap_departure_hhmm IS NULL
      AND t.origin_depart_hhmm IS NOT NULL
  `);
  console.log(`[BACKFILL] Booking departure time snaps: ${bookingDepart.rowCount}`);

  console.log("[BACKFILL] Snapshot backfill complete.");
}

backfillSnapshots()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[BACKFILL] Error:", err);
    process.exit(1);
  });
