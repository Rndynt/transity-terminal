import { Pool } from "pg";
import { randomUUID, randomBytes, createHash } from "node:crypto";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    console.log("[seed] Inserting operators...");
    const operators = [
      {
        id: randomUUID(),
        name: "Bus Harapan Jaya",
        slug: "harapan-jaya",
        apiUrl: "https://api.harapanjaya.example.com",
        serviceKey: "svc_harapan_" + randomBytes(8).toString("hex"),
        commissionPct: "5.00",
        primaryColor: "#1e40af",
        webhookSecret: randomBytes(16).toString("hex"),
      },
      {
        id: randomUUID(),
        name: "Pahala Kencana",
        slug: "pahala-kencana",
        apiUrl: "https://api.pahalakencana.example.com",
        serviceKey: "svc_pahala_" + randomBytes(8).toString("hex"),
        commissionPct: "6.50",
        primaryColor: "#dc2626",
        webhookSecret: randomBytes(16).toString("hex"),
      },
      {
        id: randomUUID(),
        name: "Sinar Jaya",
        slug: "sinar-jaya",
        apiUrl: "https://api.sinarjaya.example.com",
        serviceKey: "svc_sinar_" + randomBytes(8).toString("hex"),
        commissionPct: "7.00",
        primaryColor: "#f59e0b",
        webhookSecret: randomBytes(16).toString("hex"),
      },
      {
        id: randomUUID(),
        name: "Rosalia Indah",
        slug: "rosalia-indah",
        apiUrl: "https://api.rosaliaindah.example.com",
        serviceKey: "svc_rosalia_" + randomBytes(8).toString("hex"),
        commissionPct: "5.75",
        primaryColor: "#16a34a",
        webhookSecret: randomBytes(16).toString("hex"),
      },
    ];

    for (const op of operators) {
      await client.query(
        `INSERT INTO operators (id, name, slug, api_url, service_key, active, commission_pct, primary_color, webhook_secret)
         VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8)
         ON CONFLICT (slug) DO NOTHING`,
        [op.id, op.name, op.slug, op.apiUrl, op.serviceKey, op.commissionPct, op.primaryColor, op.webhookSecret],
      );
    }

    console.log("[seed] Inserting terminal_health snapshots...");
    const statuses = ["online", "online", "degraded", "offline"];
    for (let i = 0; i < operators.length; i++) {
      await client.query(
        `INSERT INTO terminal_health (operator_id, status, latency_ms)
         VALUES ($1,$2,$3)`,
        [operators[i].id, statuses[i], (50 + Math.random() * 200).toFixed(2)],
      );
    }

    console.log("[seed] Inserting customers...");
    const customers = [];
    const sample = [
      ["Budi Santoso", "budi@example.com", "081234567001"],
      ["Siti Aminah", "siti@example.com", "081234567002"],
      ["Andi Wijaya", "andi@example.com", "081234567003"],
      ["Dewi Lestari", "dewi@example.com", "081234567004"],
      ["Rahmat Hidayat", "rahmat@example.com", "081234567005"],
    ];
    for (const [fullName, email, phone] of sample) {
      const id = randomUUID();
      const passwordHash = "$2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUV";
      const r = await client.query(
        `INSERT INTO customers (id, full_name, email, phone, password_hash, is_verified)
         VALUES ($1,$2,$3,$4,$5,'true')
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [id, fullName, email, phone, passwordHash],
      );
      customers.push({ id: r.rows[0].id, fullName, phone });
    }

    console.log("[seed] Inserting vouchers...");
    const now = new Date();
    const future = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 60);
    const past = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7);
    const vouchers = [
      ["WELCOME10", "percentage", "10.00", "50000.00", "25000.00", past, future, 1000],
      ["MUDIK2026", "percentage", "15.00", "100000.00", "50000.00", past, future, 500],
      ["FLAT20K", "fixed", "20000.00", "75000.00", null, past, future, 2000],
      ["WEEKEND5", "percentage", "5.00", null, "15000.00", past, future, null],
    ];
    for (const [code, type, value, minP, maxD, vf, vu, limit] of vouchers) {
      await client.query(
        `INSERT INTO vouchers (code, discount_type, discount_value, min_purchase, max_discount, valid_from, valid_until, usage_limit, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
         ON CONFLICT (code) DO NOTHING`,
        [code, type, value, minP, maxD, vf, vu, limit],
      );
    }

    console.log("[seed] Inserting bookings...");
    const routes = [
      { origin: "Jakarta", destination: "Surabaya", originCity: "Jakarta", destCity: "Surabaya", fare: "350000" },
      { origin: "Bandung", destination: "Yogyakarta", originCity: "Bandung", destCity: "Yogyakarta", fare: "275000" },
      { origin: "Jakarta", destination: "Semarang", originCity: "Jakarta", destCity: "Semarang", fare: "225000" },
      { origin: "Surabaya", destination: "Malang", originCity: "Surabaya", destCity: "Malang", fare: "85000" },
      { origin: "Jakarta", destination: "Bandung", originCity: "Jakarta", destCity: "Bandung", fare: "120000" },
    ];
    const statusesB = ["confirmed", "confirmed", "pending", "confirmed", "cancelled", "confirmed", "completed", "completed"];
    const today = new Date();

    for (let i = 0; i < 24; i++) {
      const op = operators[i % operators.length];
      const cust = customers[i % customers.length];
      const route = routes[i % routes.length];
      const status = statusesB[i % statusesB.length];
      const seatCount = 1 + (i % 3);
      const seats = Array.from({ length: seatCount }, (_, k) => `${String.fromCharCode(65 + (i % 5))}${k + 1}`);
      const fareNum = Number(route.fare);
      const total = fareNum * seatCount;
      const commission = (total * Number(op.commissionPct)) / 100;
      const departDate = new Date(today.getTime() + (i - 8) * 24 * 60 * 60 * 1000);
      const dateStr = departDate.toISOString().slice(0, 10);
      const departAt = `${dateStr}T${String(6 + (i % 14)).padStart(2, "0")}:00:00+07:00`;
      const arriveHour = 6 + (i % 14) + 5;
      const arriveAt = `${dateStr}T${String(arriveHour % 24).padStart(2, "0")}:00:00+07:00`;
      const bookingCode = "TRX" + String(100000 + i);

      await client.query(
        `INSERT INTO bookings (
          operator_id, operator_name, customer_id, booking_code,
          trip_id, departure_date, origin, destination,
          origin_name, origin_city, depart_at,
          destination_name, destination_city, arrive_at,
          pattern_name, passenger_name, passenger_phone, seat_numbers,
          fare_per_person, total_amount, commission_amount, final_amount,
          status, payment_method, terminal_notified
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
          $19,$20,$21,$22,$23,$24,$25
        )`,
        [
          op.id, op.name, cust.id, bookingCode,
          `trip_${op.slug}_${i}`, dateStr, route.origin, route.destination,
          `Terminal ${route.origin}`, route.originCity, departAt,
          `Terminal ${route.destination}`, route.destCity, arriveAt,
          `${route.origin} - ${route.destination} Eksekutif`,
          cust.fullName, cust.phone, seats,
          route.fare, total.toFixed(2), commission.toFixed(2), total.toFixed(2),
          status, i % 3 === 0 ? "qris" : i % 3 === 1 ? "va_bca" : "cash",
          status === "confirmed" || status === "completed",
        ],
      );
    }

    console.log("[seed] Inserting api_keys...");
    const rawKey = "tk_live_" + randomBytes(24).toString("hex");
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    await client.query(
      `INSERT INTO api_keys (name, key_hash, prefix, scopes, active)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (key_hash) DO NOTHING`,
      ["Demo Integration Key", keyHash, rawKey.slice(0, 12), ["bookings:read", "bookings:write"]],
    );
    console.log(`[seed] Demo API key (save this — only shown once): ${rawKey}`);

    await client.query("COMMIT");
    console.log("[seed] Done.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[seed] Failed:", err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
