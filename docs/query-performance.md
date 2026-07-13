# Query Performance Analysis — TransityTerminal

Dokumen ini berisi semua query berat yang diidentifikasi pada alur CSO reservasi, trip operasional, dan laporan. Setiap query disertai EXPLAIN ANALYZE yang dijalankan terhadap dataset perfload (60K trips, 840K seat_inventory, 260K bookings).

**Dataset perfload:**
- Stops / Outlets   : 25 / 25
- Trips             : 60.000 (30 hari, 100 rute × 20 jadwal)
- Seat Inventory    : 840.000 rows
- Bookings          : ~260.000
- Seat Holds        : 5.000

**Cara menjalankan ulang:**
```bash
npx tsx docs/run-explain.ts 2>&1 | tee docs/explain-results.txt
```

---

## Daftar Query

| # | Nama | File Sumber | Tabel Utama | Bobot |
|---|------|-------------|-------------|-------|
| Q01 | getCsoAvailableTrips (real trips CTE) | `scheduling.repository.ts:433` | trips, bookings, seat_holds, passengers, trip_stop_times | ⚠️⚠️⚠️ Sangat Berat |
| Q02 | getSeatInventory | `scheduling.repository.ts:877` | seat_inventory | ✅ Ringan |
| Q03 | atomicHold SELECT FOR UPDATE | `atomicHold.service.ts:96` | seat_inventory, seat_holds | ⚠️ Sedang |
| Q04 | getManifest | `scheduling.repository.ts:943` | passengers, bookings, stops | ⚠️ Sedang |
| Q05 | getManifestFull (header + pax + cargo) | `scheduling.repository.ts:983` | trips, vehicles, drivers, trip_patterns, pattern_stops, stops | ⚠️ Sedang |
| Q06 | getRevenueSummary — ringkasan | `reports.repository.ts:139` | bookings, trips | ⚠️⚠️ Berat |
| Q07 | getRevenueSummary — harian | `reports.repository.ts:171` | bookings, trips | ⚠️⚠️ Berat |
| Q08 | getRevenueSummary — per outlet | `reports.repository.ts:196` | bookings, trips, outlets | ⚠️⚠️ Berat |
| Q09 | getRevenueSummary — per rute | `reports.repository.ts:222` | bookings, trips, trip_patterns | ⚠️⚠️ Berat |
| Q10 | getSalesReport — ringkasan | `reports.repository.ts:250` | bookings, trips | ⚠️⚠️ Berat |
| Q11 | getSalesReport — recent (5 JOIN) | `reports.repository.ts:353` | bookings, trips, trip_patterns, outlets, stops×2 | ⚠️⚠️ Berat |
| Q12 | getLoadFactor — per trip | `reports.repository.ts:472` | trips, trip_patterns, drivers, passengers, bookings | ⚠️⚠️ Berat |
| Q13 | getLoadFactor — per rute | `reports.repository.ts:500` | trips, trip_patterns, passengers, bookings | ⚠️⚠️ Berat |
| Q14 | getLoadFactor — harian | `reports.repository.ts:545` | trips, passengers, bookings | ⚠️⚠️ Berat |
| Q15 | getCancellationsReport — ringkasan | `reports.repository.ts:580` | booking_history, bookings, trips | ⚠️ Sedang |
| Q16 | getBookingsPaginated (tanpa filter) | `booking.repository.ts:52` | bookings | ⚠️⚠️ Berat |
| Q17 | getActiveBookingsForTrip | `booking.repository.ts:25` | bookings | ✅ Ringan |

---

## EXPLAIN ANALYZE Results

> **Dijalankan:** 2026-07-13T19:58:49.336Z
> **Dataset:** 60K trips · 840K seat_inventory · ~260K bookings
> **today=** `2026-07-13`  |  **range:** `2026-06-28` → `2026-07-27`

### Ringkasan Waktu Eksekusi

| ID | Query | Plan (ms) | Exec (ms) | Severity |
|---|---|---:|---:|:---:|
| Q01 | getCsoAvailableTrips — Real Trips CTE | 70.0 | 2648.0 | 💀 |
| Q02 | getSeatInventory — per trip | 0.5 | 0.1 | ✅ |
| Q03 | atomicHold — SELECT FOR UPDATE (simulasi hold 1 kursi) | 0.2 | 127.5 | 🟠 |
| Q04 | getManifest — manifest penumpang per trip | 1.2 | 23.5 | 🟡 |
| Q05 | getManifestFull — header trip (correlated subquery pattern_stops) | 17.4 | 11.3 | 🟡 |
| Q06 | getRevenueSummary — ringkasan keseluruhan (30 hari) | 4.5 | 1477.2 | 🔴 |
| Q07 | getRevenueSummary — harian (GROUP BY service_date) | 0.5 | 469.4 | 🟠 |
| Q08 | getRevenueSummary — per outlet (LEFT JOIN outlets) | 10.4 | 624.6 | 🔴 |
| Q09 | getRevenueSummary — per rute (LEFT JOIN trip_patterns) | 0.5 | 812.3 | 🔴 |
| Q10 | getSalesReport — ringkasan dengan FILTER aggregates | 0.4 | 1025.3 | 🔴 |
| Q11 | getSalesReport — recent 100 booking (5 JOIN + ORDER BY created_at DESC) | 3.5 | 67.4 | 🟡 |
| Q12 | getLoadFactor — per trip (subquery pax) | 2.0 | 2311.8 | 💀 |
| Q13 | getLoadFactor — per rute (GROUP BY route) | 1.3 | 1402.6 | 🔴 |
| Q14 | getLoadFactor — harian (GROUP BY service_date) | 0.7 | 1728.2 | 🔴 |
| Q15 | getCancellationsReport — ringkasan booking_history | 5.4 | 0.1 | ✅ |
| Q16 | getBookingsPaginated — tanpa filter outlet (all bookings page 1) | 0.1 | 169.3 | 🟠 |
| Q16b | getBookingsPaginated — SELECT halaman pertama (ORDER BY created_at DESC) | 0.4 | 0.1 | ✅ |
| Q17 | getActiveBookingsForTrip — booking aktif per trip | 0.2 | 2.4 | ✅ |
| Q18 | seat_inventory bulk scan — precompute check | 0.1 | 0.4 | ✅ |
| Q19 | seat_holds expired cleanup — scheduler | 0.1 | 3.2 | ✅ |

### Detail Plan

#### Q01 — getCsoAvailableTrips — Real Trips CTE
**Source:** `scheduling.repository.ts:433`  
**Purpose:** Query utama CSO jadwal: 9 CTE (eligible_trips, outlet_stop_info, trip_bounds_agg, trip_bounds, boarding_check, booked_counts, hold_counts, pattern_paths, price_rule_check). Dijalankan setiap kali CSO buka halaman jadwal untuk satu tanggal.  
**Timing:** Planning `70.04ms` · Execution `2647.95ms` 💀

```
Hash Left Join  (cost=12375.78..12582.27 rows=11 width=163) (actual time=2644.690..2645.798 rows=80 loops=1)
  Hash Cond: (et.pattern_id = pp.pattern_id)
  Buffers: shared hit=36939 read=7073 dirtied=225 written=3582
  CTE eligible_trips
    ->  Index Scan using idx_trips_service_date on trips t  (cost=0.29..2505.88 rows=3919 width=88) (actual time=0.019..2.686 rows=4000 loops=1)
          Index Cond: (service_date = '2026-07-13'::date)
          Filter: (deleted_at IS NULL)
          Buffers: shared hit=138 read=3 written=3
  CTE outlet_stop_info
    ->  Nested Loop  (cost=88.60..603.68 rows=165 width=28) (actual time=35.749..920.713 rows=160 loops=1)
          Buffers: shared hit=10587 read=1711 written=872
          ->  HashAggregate  (cost=88.18..90.18 rows=200 width=16) (actual time=5.128..7.052 rows=4000 loops=1)
                Group Key: eligible_trips_4.id
                Batches: 1  Memory Usage: 481kB
                Buffers: shared hit=135 read=3 written=3
                ->  CTE Scan on eligible_trips eligible_trips_4  (cost=0.00..78.38 rows=3919 width=16) (actual time=0.000..3.927 rows=4000 loops=1)
                      Buffers: shared hit=135 read=3 written=3
          ->  Index Scan using idx_tst_trip_stop on trip_stop_times tst_1  (cost=0.42..2.56 rows=1 width=36) (actual time=0.228..0.228 rows=0 loops=4000)
                Index Cond: ((trip_id = eligible_trips_4.id) AND (stop_id = '2f7003fe-4495-4aed-af1d-957883644f17'::uuid))
                Buffers: shared hit=10452 read=1708 written=869
  CTE trip_bounds
    ->  Hash Join  (cost=739.25..7598.84 rows=90 width=36) (actual time=1139.233..1257.617 rows=4000 loops=1)
          Hash Cond: ((tst_last.trip_id = tst_2.trip_id) AND (tst_last.stop_sequence = (max(tst_2.stop_sequence))))
          Buffers: shared hit=10572 read=4629 dirtied=214 written=2439
          ->  Seq Scan on trip_stop_times tst_last  (cost=0.00..5599.73 rows=239973 width=28) (actual time=0.903..148.372 rows=240000 loops=1)
                Filter: (deleted_at IS NULL)
                Buffers: shared hit=3 read=3197 dirtied=214 written=1450
          ->  Hash  (cost=613.10..613.10 rows=8410 width=28) (actual time=1079.997..1080.000 rows=4000 loops=1)
                Buckets: 16384  Batches: 1  Memory Usage: 363kB
                Buffers: shared hit=10569 read=1432 written=989
                ->  HashAggregate  (cost=507.98..613.10 rows=8410 width=28) (actual time=1078.668..1079.280 rows=4000 loops=1)
                      Group Key: tst_2.trip_id
                      Batches: 1  Memory Usage: 913kB
                      Buffers: shared hit=10569 read=1432 written=989
                      ->  Nested Loop  (cost=88.60..423.88 rows=8410 width=20) (actual time=4.608..1075.106 rows=8000 loops=1)
                            Buffers: shared hit=10569 read=1432 written=989
                            ->  HashAggregate  (cost=88.18..90.18 rows=200 width=16) (actual time=1.268..2.703 rows=4000 loops=1)
                                  Group Key: eligible_trips_5.id
                                  Batches: 1  Memory Usage: 481kB
                                  ->  CTE Scan on eligible_trips eligible_trips_5  (cost=0.00..78.38 rows=3919 width=16) (actual time=0.001..0.287 rows=4000 loops=1)
                            ->  Index Only Scan using idx_tst_trip_seq on trip_stop_times tst_2  (cost=0.42..1.65 rows=2 width=20) (actual time=0.267..0.267 rows=2 loops=4000)
                                  Index Cond: (trip_id = eligible_trips_5.id)
                                  Heap Fetches: 0
                                  Buffers: shared hit=10569 read=1432 written=989
  ->  Hash Left Join  (cost=1533.07..1664.75 rows=11 width=138) (actual time=2640.047..2640.850 rows=80 loops=1)
        Hash Cond: (et.id = hc.trip_id)
        Buffers: shared hit=36777 read=7065 dirtied=225 written=3574
        ->  Hash Left Join  (cost=682.41..814.06 rows=11 width=130) (actual time=2629.514..2630.290 rows=80 loops=1)
              Hash Cond: (et.id = bc.trip_id)
              Buffers: shared hit=36462 read=7026 dirtied=214 written=3536
              ->  Hash Join  (cost=323.55..455.17 rows=11 width=122) (actual time=2254.663..2255.371 rows=80 loops=1)
                    Hash Cond: (osi.trip_id = tb_1.trip_id)
                    Buffers: shared hit=33556 read=6354 dirtied=214 written=3317
                    ->  Hash Left Join  (cost=24.52..149.42 rows=1763 width=154) (actual time=2188.444..2189.112 rows=160 loops=1)
                          Hash Cond: (et.driver_id = d.id)
                          Buffers: shared hit=21163 read=6347 dirtied=214 written=3317
                          ->  Hash Left Join  (cost=22.62..142.79 rows=1763 width=156) (actual time=2187.561..2188.199 rows=160 loops=1)
                                Hash Cond: (et.vehicle_id = v.id)
                                Buffers: shared hit=21163 read=6346 dirtied=214 written=3316
                                ->  Hash Join  (cost=18.37..133.81 rows=1763 width=152) (actual time=2184.844..2185.445 rows=160 loops=1)
                                      Hash Cond: (et.pattern_id = tp.id)
                                      Buffers: shared hit=21163 read=6344 dirtied=214 written=3315
                                      ->  Hash Join  (cost=8.87..119.58 rows=1763 width=144) (actual time=2184.193..2184.760 rows=160 loops=1)
                                            Hash Cond: (et.id = osi.trip_id)
                                            Buffers: shared hit=21162 read=6340 dirtied=214 written=3311
                                            ->  CTE Scan on eligible_trips et  (cost=0.00..78.38 rows=3919 width=88) (actual time=0.021..0.262 rows=4000 loops=1)
                                                  Buffers: shared hit=3
                                            ->  Hash  (cost=7.74..7.74 rows=90 width=56) (actual time=2184.153..2184.156 rows=160 loops=1)
                                                  Buckets: 1024  Batches: 1  Memory Usage: 23kB
                                                  Buffers: shared hit=21159 read=6340 dirtied=214 written=3311
                                                  ->  Hash Join  (cost=2.92..7.74 rows=90 width=56) (actual time=1298.490..2183.983 rows=160 loops=1)
                                                        Hash Cond: (osi.trip_id = tb.trip_id)
                                                        Buffers: shared hit=21159 read=6340 dirtied=214 written=3311
                                                        ->  CTE Scan on outlet_stop_info osi  (cost=0.00..3.30 rows=165 width=28) (actual time=35.751..920.921 rows=160 loops=1)
                                                              Buffers: shared hit=10587 read=1711 written=872
                                                        ->  Hash  (cost=1.80..1.80 rows=90 width=28) (actual time=1262.728..1262.729 rows=4000 loops=1)
                                                              Buckets: 4096 (originally 1024)  Batches: 1 (originally 1)  Memory Usage: 267kB
                                                              Buffers: shared hit=10572 read=4629 dirtied=214 written=2439
                                                              ->  CTE Scan on trip_bounds tb  (cost=0.00..1.80 rows=90 width=28) (actual time=1139.238..1262.050 rows=4000 loops=1)
                                                                    Buffers: shared hit=10572 read=4629 dirtied=214 written=2439
                                      ->  Hash  (cost=7.00..7.00 rows=200 width=24) (actual time=0.433..0.434 rows=200 loops=1)
                                            Buckets: 1024  Batches: 1  Memory Usage: 20kB
                                            Buffers: shared hit=1 read=4 written=4
                                            ->  Seq Scan on trip_patterns tp  (cost=0.00..7.00 rows=200 width=24) (actual time=0.008..0.402 rows=200 loops=1)
                                                  Buffers: shared hit=1 read=4 written=4
                                ->  Hash  (cost=3.00..3.00 rows=100 width=36) (actual time=2.688..2.688 rows=100 loops=1)
                                      Buckets: 1024  Batches: 1  Memory Usage: 15kB
                                      Buffers: shared read=2 written=1
                                      ->  Seq Scan on vehicles v  (cost=0.00..3.00 rows=100 width=36) (actual time=2.632..2.660 rows=100 loops=1)
                                            Buffers: shared read=2 written=1
                          ->  Hash  (cost=1.40..1.40 rows=40 width=30) (actual time=0.855..0.856 rows=40 loops=1)
                                Buckets: 1024  Batches: 1  Memory Usage: 11kB
                                Buffers: shared read=1 written=1
                                ->  Seq Scan on drivers d  (cost=0.00..1.40 rows=40 width=30) (actual time=0.836..0.842 rows=40 loops=1)
                                      Buffers: shared read=1 written=1
                    ->  Hash  (cost=299.02..299.02 rows=1 width=48) (actual time=66.179..66.186 rows=80 loops=1)
                          Buckets: 1024  Batches: 1  Memory Usage: 15kB
                          Buffers: shared hit=12393 read=7
                          ->  Nested Loop Left Join  (cost=179.97..299.02 rows=1 width=48) (actual time=7.644..66.145 rows=80 loops=1)
                                Filter: COALESCE(tst.boarding_allowed, ps.boarding_allowed, true)
                                Buffers: shared hit=12393 read=7
                                ->  Nested Loop  (cost=91.52..210.52 rows=1 width=65) (actual time=7.326..50.388 rows=80 loops=1)
                                      Join Filter: ((tst.stop_sequence < tb_1.max_seq) AND (tb_1.trip_id = tst.trip_id))
                                      Buffers: shared hit=12156 read=4
                                      ->  Hash Join  (cost=91.10..94.75 rows=45 width=36) (actual time=7.199..9.501 rows=4000 loops=1)
                                            Hash Cond: (eligible_trips.id = tb_1.trip_id)
                                            ->  HashAggregate  (cost=88.18..90.18 rows=200 width=16) (actual time=5.879..6.564 rows=4000 loops=1)
                                                  Group Key: eligible_trips.id
                                                  Batches: 1  Memory Usage: 481kB
                                                  ->  CTE Scan on eligible_trips  (cost=0.00..78.38 rows=3919 width=16) (actual time=0.001..0.384 rows=4000 loops=1)
                                            ->  Hash  (cost=1.80..1.80 rows=90 width=20) (actual time=1.302..1.303 rows=4000 loops=1)
                                                  Buckets: 4096 (originally 1024)  Batches: 1 (originally 1)  Memory Usage: 236kB
                                                  ->  CTE Scan on trip_bounds tb_1  (cost=0.00..1.80 rows=90 width=20) (actual time=0.001..0.562 rows=4000 loops=1)
                                      ->  Index Scan using idx_tst_trip_stop on trip_stop_times tst  (cost=0.42..2.56 rows=1 width=37) (actual time=0.010..0.010 rows=0 loops=4000)
                                            Index Cond: ((trip_id = eligible_trips.id) AND (stop_id = '2f7003fe-4495-4aed-af1d-957883644f17'::uuid))
                                            Filter: (depart_at IS NOT NULL)
                                            Rows Removed by Filter: 0
                                            Buffers: shared hit=12156 read=4
                                ->  Index Scan using idx_pattern_stops_pattern_id on pattern_stops ps  (cost=88.45..88.49 rows=1 width=33) (actual time=0.002..0.002 rows=1 loops=80)
                                      Index Cond: (pattern_id = (SubPlan 6))
                                      Filter: ((deleted_at IS NULL) AND (stop_id = '2f7003fe-4495-4aed-af1d-957883644f17'::uuid))
                                      Rows Removed by Filter: 1
                                      Buffers: shared hit=237 read=3
                                      SubPlan 6
                                        ->  CTE Scan on eligible_trips et_1  (cost=0.00..88.18 rows=20 width=16) (actual time=0.002..0.193 rows=1 loops=80)
                                              Filter: (id = tst.trip_id)
                                              Rows Removed by Filter: 3999
              ->  Hash  (cost=358.84..358.84 rows=1 width=24) (actual time=374.839..374.845 rows=80 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 13kB
                    Buffers: shared hit=2906 read=672 written=219
                    ->  Subquery Scan on bc  (cost=358.81..358.84 rows=1 width=24) (actual time=374.686..374.796 rows=80 loops=1)
                          Buffers: shared hit=2906 read=672 written=219
                          ->  GroupAggregate  (cost=358.81..358.83 rows=1 width=24) (actual time=374.683..374.781 rows=80 loops=1)
                                Group Key: b.trip_id
                                Buffers: shared hit=2906 read=672 written=219
                                ->  Sort  (cost=358.81..358.82 rows=1 width=32) (actual time=374.672..374.701 rows=409 loops=1)
                                      Sort Key: b.trip_id
                                      Sort Method: quicksort  Memory: 47kB
                                      Buffers: shared hit=2906 read=672 written=219
                                      ->  Nested Loop  (cost=95.22..358.80 rows=1 width=32) (actual time=18.496..374.227 rows=409 loops=1)
                                            Buffers: shared hit=2903 read=672 written=219
                                            ->  Nested Loop  (cost=94.80..357.33 rows=1 width=32) (actual time=15.610..156.350 rows=409 loops=1)
                                                  Join Filter: (dest_tst.stop_id = b.destination_stop_id)
                                                  Buffers: shared hit=1669 read=270 written=93
                                                  ->  Nested Loop  (cost=94.38..316.38 rows=3 width=96) (actual time=4.222..85.587 rows=80 loops=1)
                                                        Join Filter: (osi_1.stop_sequence < dest_tst.stop_sequence)
                                                        Rows Removed by Join Filter: 400
                                                        Buffers: shared hit=1435 read=172 written=60
                                                        ->  Nested Loop  (cost=93.96..308.68 rows=4 width=68) (actual time=2.320..5.164 rows=240 loops=1)
                                                              Buffers: shared hit=623 read=19 written=11
                                                              ->  Hash Join  (cost=93.54..97.94 rows=82 width=36) (actual time=2.306..3.870 rows=160 loops=1)
                                                                    Hash Cond: (eligible_trips_1.id = osi_1.trip_id)
                                                                    ->  HashAggregate  (cost=88.18..90.18 rows=200 width=16) (actual time=2.098..2.969 rows=4000 loops=1)
                                                                          Group Key: eligible_trips_1.id
                                                                          Batches: 1  Memory Usage: 481kB
                                                                          ->  CTE Scan on eligible_trips eligible_trips_1  (cost=0.00..78.38 rows=3919 width=16) (actual time=0.000..0.269 rows=4000 loops=1)
                                                                    ->  Hash  (cost=3.30..3.30 rows=165 width=20) (actual time=0.095..0.095 rows=160 loops=1)
                                                                          Buckets: 1024  Batches: 1  Memory Usage: 17kB
                                                                          ->  CTE Scan on outlet_stop_info osi_1  (cost=0.00..3.30 rows=165 width=20) (actual time=0.001..0.017 rows=160 loops=1)
                                                              ->  Index Scan using idx_tst_trip_seq on trip_stop_times origin_tst  (cost=0.42..2.56 rows=1 width=36) (actual time=0.006..0.007 rows=2 loops=160)
                                                                    Index Cond: ((trip_id = osi_1.trip_id) AND (stop_sequence <= osi_1.stop_sequence))
                                                                    Buffers: shared hit=623 read=19 written=11
                                                        ->  Index Scan using idx_tst_trip_id on trip_stop_times dest_tst  (cost=0.42..1.90 rows=2 width=36) (actual time=0.333..0.334 rows=2 loops=240)
                                                              Index Cond: (trip_id = origin_tst.trip_id)
                                                              Filter: (deleted_at IS NULL)
                                                              Buffers: shared hit=812 read=153 written=49
                                                  ->  Index Scan using idx_bookings_trip_id on bookings b  (cost=0.42..13.64 rows=1 width=64) (actual time=0.860..0.881 rows=5 loops=80)
                                                        Index Cond: (trip_id = origin_tst.trip_id)
                                                        Filter: ((origin_tst.stop_id = origin_stop_id) AND (status = ANY ('{pending,confirmed,checked_in,paid}'::booking_status[])))
                                                        Buffers: shared hit=234 read=98 written=33
                                            ->  Index Scan using idx_passengers_booking_id on passengers p  (cost=0.42..1.46 rows=1 width=32) (actual time=0.523..0.523 rows=1 loops=409)
                                                  Index Cond: (booking_id = b.id)
                                                  Buffers: shared hit=1234 read=402 written=126
        ->  Hash  (cost=850.18..850.18 rows=39 width=24) (actual time=10.447..10.453 rows=0 loops=1)
              Buckets: 1024  Batches: 1  Memory Usage: 8kB
              Buffers: shared hit=315 read=39 dirtied=11 written=38
              ->  Subquery Scan on hc  (cost=849.11..850.18 rows=39 width=24) (actual time=10.446..10.452 rows=0 loops=1)
                    Buffers: shared hit=315 read=39 dirtied=11 written=38
                    ->  GroupAggregate  (cost=849.11..849.79 rows=39 width=24) (actual time=10.445..10.451 rows=0 loops=1)
                          Group Key: sh.trip_id
                          Buffers: shared hit=315 read=39 dirtied=11 written=38
                          ->  Sort  (cost=849.11..849.20 rows=39 width=16) (actual time=10.444..10.449 rows=0 loops=1)
                                Sort Key: sh.trip_id
                                Sort Method: quicksort  Memory: 25kB
                                Buffers: shared hit=315 read=39 dirtied=11 written=38
                                ->  Nested Loop  (cost=93.82..848.08 rows=39 width=16) (actual time=10.433..10.438 rows=0 loops=1)
                                      Join Filter: ((osi_2.trip_id = sh.trip_id) AND (SubPlan 7))
                                      Buffers: shared hit=315 read=39 dirtied=11 written=38
                                      ->  Hash Join  (cost=93.54..97.94 rows=82 width=36) (actual time=1.976..3.139 rows=160 loops=1)
                                            Hash Cond: (eligible_trips_2.id = osi_2.trip_id)
                                            ->  HashAggregate  (cost=88.18..90.18 rows=200 width=16) (actual time=1.899..2.547 rows=4000 loops=1)
                                                  Group Key: eligible_trips_2.id
                                                  Batches: 1  Memory Usage: 481kB
                                                  ->  CTE Scan on eligible_trips eligible_trips_2  (cost=0.00..78.38 rows=3919 width=16) (actual time=0.002..0.370 rows=4000 loops=1)
                                            ->  Hash  (cost=3.30..3.30 rows=165 width=20) (actual time=0.051..0.052 rows=160 loops=1)
                                                  Buckets: 1024  Batches: 1  Memory Usage: 17kB
                                                  ->  CTE Scan on outlet_stop_info osi_2  (cost=0.00..3.30 rows=165 width=20) (actual time=0.003..0.023 rows=160 loops=1)
                                      ->  Index Scan using idx_seat_holds_trip_id on seat_holds sh  (cost=0.28..0.97 rows=1 width=41) (actual time=0.045..0.045 rows=0 loops=160)
                                            Index Cond: (trip_id = eligible_trips_2.id)
                                            Filter: ((booking_id IS NULL) AND (expires_at > now()))
                                            Buffers: shared hit=315 read=39 dirtied=11 written=38
                                      SubPlan 7
                                        ->  Nested Loop  (cost=1.26..8.17 rows=1 width=0) (never executed)
                                              Join Filter: (tl.to_stop_id = ld.stop_id)
                                              ->  Nested Loop  (cost=0.84..5.51 rows=1 width=16) (never executed)
                                                    Join Filter: (tl.from_stop_id = lo.stop_id)
                                                    ->  Nested Loop  (cost=0.42..2.86 rows=1 width=32) (never executed)
                                                          Join Filter: (leg_idx.leg_idx = tl.leg_index)
                                                          ->  Index Scan using idx_trip_legs_trip_id on trip_legs tl  (cost=0.42..2.64 rows=1 width=36) (never executed)
                                                                Index Cond: (trip_id = sh.trip_id)
                                                          ->  Function Scan on unnest leg_idx  (cost=0.00..0.10 rows=10 width=4) (never executed)
                                                    ->  Index Scan using idx_tst_trip_seq on trip_stop_times lo  (cost=0.42..2.64 rows=1 width=16) (never executed)
                                                          Index Cond: ((trip_id = sh.trip_id) AND (stop_sequence <= osi_2.stop_sequence))
                                              ->  Index Scan using idx_tst_trip_seq on trip_stop_times ld  (cost=0.42..2.64 rows=1 width=16) (never executed)
                                                    Index Cond: ((trip_id = sh.trip_id) AND (stop_sequence > osi_2.stop_sequence))
  ->  Hash  (cost=131.80..131.80 rows=200 width=48) (actual time=3.941..3.945 rows=200 loops=1)
        Buckets: 1024  Batches: 1  Memory Usage: 24kB
        Buffers: shared hit=4 read=6 written=6
        ->  Subquery Scan on pp  (cost=124.30..131.80 rows=200 width=48) (actual time=3.719..3.839 rows=200 loops=1)
              Buffers: shared hit=4 read=6 written=6
              ->  GroupAggregate  (cost=124.30..129.80 rows=200 width=48) (actual time=3.717..3.820 rows=200 loops=1)
                    Group Key: ps_1.pattern_id
                    Buffers: shared hit=4 read=6 written=6
                    ->  Sort  (cost=124.30..125.30 rows=400 width=34) (actual time=3.678..3.698 rows=400 loops=1)
                          Sort Key: ps_1.pattern_id, ps_1.stop_sequence
                          Sort Method: quicksort  Memory: 49kB
                          Buffers: shared hit=4 read=6 written=6
                          ->  Hash Join  (cost=94.80..107.01 rows=400 width=34) (actual time=1.077..3.509 rows=400 loops=1)
                                Hash Cond: (ps_1.pattern_id = eligible_trips_3.pattern_id)
                                Buffers: shared hit=1 read=6 written=6
                                ->  Hash Join  (cost=2.12..13.26 rows=400 width=34) (actual time=0.069..2.440 rows=400 loops=1)
                                      Hash Cond: (ps_1.stop_id = s.id)
                                      Buffers: shared hit=1 read=6 written=6
                                      ->  Seq Scan on pattern_stops ps_1  (cost=0.00..10.00 rows=400 width=36) (actual time=0.009..2.317 rows=400 loops=1)
                                            Filter: (deleted_at IS NULL)
                                            Buffers: shared hit=1 read=5 written=5
                                      ->  Hash  (cost=1.50..1.50 rows=50 width=30) (actual time=0.054..0.055 rows=50 loops=1)
                                            Buckets: 1024  Batches: 1  Memory Usage: 12kB
                                            Buffers: shared read=1 written=1
                                            ->  Seq Scan on stops s  (cost=0.00..1.50 rows=50 width=30) (actual time=0.019..0.027 rows=50 loops=1)
                                                  Buffers: shared read=1 written=1
                                ->  Hash  (cost=90.18..90.18 rows=200 width=16) (actual time=0.991..0.992 rows=200 loops=1)
                                      Buckets: 1024  Batches: 1  Memory Usage: 18kB
                                      ->  HashAggregate  (cost=88.18..90.18 rows=200 width=16) (actual time=0.950..0.965 rows=200 loops=1)
                                            Group Key: eligible_trips_3.pattern_id
                                            Batches: 1  Memory Usage: 48kB
                                            ->  CTE Scan on eligible_trips eligible_trips_3  (cost=0.00..78.38 rows=3919 width=16) (actual time=0.001..0.316 rows=4000 loops=1)
  SubPlan 4
    ->  Subquery Scan on prc  (cost=0.14..6.79 rows=1 width=0) (actual time=0.011..0.011 rows=1 loops=80)
          Buffers: shared hit=158 read=2 written=2
          ->  Limit  (cost=0.14..6.78 rows=1 width=16) (actual time=0.011..0.011 rows=1 loops=80)
                Buffers: shared hit=158 read=2 written=2
                ->  Nested Loop Semi Join  (cost=0.14..6.78 rows=1 width=16) (actual time=0.011..0.011 rows=1 loops=80)
                      Buffers: shared hit=158 read=2 written=2
                      ->  Index Scan using idx_price_rules_pattern_id on price_rules pr  (cost=0.14..2.36 rows=1 width=16) (actual time=0.009..0.009 rows=1 loops=80)
                            Index Cond: (pattern_id = et.pattern_id)
                            Filter: (deleted_at IS NULL)
                            Buffers: shared hit=158 read=2 written=2
                      ->  Limit  (cost=0.00..4.41 rows=1 width=16) (actual time=0.001..0.001 rows=1 loops=80)
                            ->  CTE Scan on eligible_trips eligible_trips_6  (cost=0.00..88.18 rows=20 width=16) (actual time=0.001..0.001 rows=1 loops=80)
                                  Filter: (pattern_id = et.pattern_id)
                                  Rows Removed by Filter: 30
Planning:
  Buffers: shared hit=795 read=96 dirtied=7 written=92
Planning Time: 70.043 ms
Execution Time: 2647.951 ms
```

#### Q02 — getSeatInventory — per trip
**Source:** `scheduling.repository.ts:877`  
**Purpose:** Fetch semua seat_inventory untuk satu trip (14 rows × 1 leg). Dipanggil setiap kali seatmap dibuka.  
**Timing:** Planning `0.50ms` · Execution `0.08ms` ✅

```
Index Scan using idx_seat_inv_trip_id on seat_inventory  (cost=0.43..82.06 rows=72 width=72) (actual time=0.033..0.069 rows=14 loops=1)
  Index Cond: (trip_id = 'f3769fd5-bf4d-4ab3-bc7b-8176baddb41a'::uuid)
  Filter: (leg_index = ANY ('{1}'::integer[]))
  Buffers: shared hit=2 read=5 written=5
Planning:
  Buffers: shared hit=88 read=6 written=6
Planning Time: 0.499 ms
Execution Time: 0.082 ms
```

#### Q03 — atomicHold — SELECT FOR UPDATE (simulasi hold 1 kursi)
**Source:** `atomicHold.service.ts:96`  
**Purpose:** Row-level lock pada seat_inventory + LEFT JOIN seat_holds untuk validasi ketersediaan sebelum hold. Dijalankan dalam transaksi untuk setiap klik 'Pesan'.  
**Timing:** Planning `0.25ms` · Execution `127.53ms` 🟠

```
LockRows  (cost=0.72..19.79 rows=5 width=106) (actual time=127.286..127.296 rows=1 loops=1)
  Buffers: shared hit=4 read=1 dirtied=1 written=1
  ->  Nested Loop Left Join  (cost=0.72..19.74 rows=5 width=106) (actual time=0.049..0.057 rows=1 loops=1)
        Buffers: shared hit=3 read=1 written=1
        ->  Index Scan using idx_seat_inv_trip_seat on seat_inventory si  (cost=0.43..7.13 rows=5 width=42) (actual time=0.028..0.034 rows=1 loops=1)
              Index Cond: ((trip_id = 'f3769fd5-bf4d-4ab3-bc7b-8176baddb41a'::uuid) AND (seat_no = '2C'::text))
              Filter: (leg_index = ANY ('{1}'::integer[]))
              Buffers: shared hit=3 read=1 written=1
        ->  Memoize  (cost=0.29..2.51 rows=1 width=79) (actual time=0.019..0.020 rows=0 loops=1)
              Cache Key: si.hold_ref
              Cache Mode: logical
              Hits: 0  Misses: 1  Evictions: 0  Overflows: 0  Memory Usage: 1kB
              ->  Index Scan using seat_holds_hold_ref_unique on seat_holds sh  (cost=0.28..2.50 rows=1 width=79) (actual time=0.001..0.001 rows=0 loops=1)
                    Index Cond: (hold_ref = si.hold_ref)
Planning:
  Buffers: shared hit=12 read=1 written=1
Planning Time: 0.247 ms
Execution Time: 127.528 ms
```

#### Q04 — getManifest — manifest penumpang per trip
**Source:** `scheduling.repository.ts:943`  
**Purpose:** Ambil semua penumpang untuk satu trip: passengers JOIN bookings LEFT JOIN stops × 2. Dipanggil saat cetak manifest.  
**Timing:** Planning `1.16ms` · Execution `23.51ms` 🟡

```
Sort  (cost=98.14..98.20 rows=24 width=156) (actual time=23.470..23.474 rows=9 loops=1)
  Sort Key: p.seat_no
  Sort Method: quicksort  Memory: 26kB
  Buffers: shared hit=22 read=20 written=17
  ->  Hash Left Join  (cost=5.09..97.59 rows=24 width=156) (actual time=6.658..23.406 rows=9 loops=1)
        Hash Cond: (b.destination_stop_id = ds.id)
        Buffers: shared hit=22 read=20 written=17
        ->  Hash Left Join  (cost=2.97..95.40 rows=24 width=158) (actual time=6.641..23.382 rows=9 loops=1)
              Hash Cond: (b.origin_stop_id = os.id)
              Buffers: shared hit=21 read=20 written=17
              ->  Nested Loop  (cost=0.84..93.21 rows=24 width=160) (actual time=6.611..23.341 rows=9 loops=1)
                    Buffers: shared hit=20 read=20 written=17
                    ->  Index Scan using idx_bookings_trip_id on bookings b  (cost=0.42..29.55 rows=24 width=75) (actual time=3.794..3.800 rows=9 loops=1)
                          Index Cond: (trip_id = '83b36bce-1751-4ff8-a0c6-b7c26560bc37'::uuid)
                          Filter: (status <> ALL ('{cancelled,refunded,unseated}'::booking_status[]))
                          Buffers: shared hit=2 read=2 written=1
                    ->  Index Scan using idx_passengers_booking_seat on passengers p  (cost=0.42..2.64 rows=1 width=117) (actual time=2.168..2.169 rows=1 loops=9)
                          Index Cond: (booking_id = b.id)
                          Filter: (COALESCE(ticket_status, 'active'::ticket_status) <> ALL ('{unseated,cancelled}'::ticket_status[]))
                          Buffers: shared hit=18 read=18 written=16
              ->  Hash  (cost=1.50..1.50 rows=50 width=30) (actual time=0.020..0.020 rows=50 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 12kB
                    Buffers: shared hit=1
                    ->  Seq Scan on stops os  (cost=0.00..1.50 rows=50 width=30) (actual time=0.007..0.012 rows=50 loops=1)
                          Buffers: shared hit=1
        ->  Hash  (cost=1.50..1.50 rows=50 width=30) (actual time=0.012..0.012 rows=50 loops=1)
              Buckets: 1024  Batches: 1  Memory Usage: 12kB
              Buffers: shared hit=1
              ->  Seq Scan on stops ds  (cost=0.00..1.50 rows=50 width=30) (actual time=0.002..0.006 rows=50 loops=1)
                    Buffers: shared hit=1
Planning:
  Buffers: shared hit=59 read=31 dirtied=2 written=30
Planning Time: 1.155 ms
Execution Time: 23.513 ms
```

#### Q05 — getManifestFull — header trip (correlated subquery pattern_stops)
**Source:** `scheduling.repository.ts:983`  
**Purpose:** Header manifest: trips JOIN vehicles JOIN trip_patterns LEFT JOIN drivers LEFT JOIN pattern_stops (correlated subquery MIN/MAX) LEFT JOIN stops × 2.  
**Timing:** Planning `17.37ms` · Execution `11.28ms` 🟡

```
Nested Loop Left Join  (cost=3.76..30.54 rows=1 width=145) (actual time=11.073..11.091 rows=1 loops=1)
  Buffers: shared hit=26 read=5 written=5
  ->  Nested Loop Left Join  (cost=3.62..30.37 rows=1 width=147) (actual time=11.070..11.087 rows=1 loops=1)
        Buffers: shared hit=24 read=5 written=5
        ->  Nested Loop Left Join  (cost=3.35..19.75 rows=1 width=147) (actual time=11.056..11.072 rows=1 loops=1)
              Buffers: shared hit=15 read=5 written=5
              ->  Nested Loop Left Join  (cost=3.21..19.58 rows=1 width=149) (actual time=11.050..11.065 rows=1 loops=1)
                    Buffers: shared hit=13 read=5 written=5
                    ->  Nested Loop  (cost=2.94..8.95 rows=1 width=133) (actual time=10.959..10.971 rows=1 loops=1)
                          Buffers: shared hit=4 read=5 written=5
                          ->  Nested Loop  (cost=2.79..6.57 rows=1 width=97) (actual time=10.939..10.950 rows=1 loops=1)
                                Buffers: shared hit=3 read=4 written=4
                                ->  Hash Right Join  (cost=2.65..4.16 rows=1 width=93) (actual time=10.930..10.941 rows=1 loops=1)
                                      Hash Cond: (d.id = t.driver_id)
                                      Buffers: shared hit=1 read=4 written=4
                                      ->  Seq Scan on drivers d  (cost=0.00..1.40 rows=40 width=43) (actual time=0.006..0.009 rows=40 loops=1)
                                            Buffers: shared hit=1
                                      ->  Hash  (cost=2.64..2.64 rows=1 width=82) (actual time=10.913..10.913 rows=1 loops=1)
                                            Buckets: 1024  Batches: 1  Memory Usage: 9kB
                                            Buffers: shared read=4 written=4
                                            ->  Index Scan using trips_pkey on trips t  (cost=0.42..2.64 rows=1 width=82) (actual time=10.907..10.908 rows=1 loops=1)
                                                  Index Cond: (id = '83b36bce-1751-4ff8-a0c6-b7c26560bc37'::uuid)
                                                  Buffers: shared read=4 written=4
                                ->  Index Scan using vehicles_pkey on vehicles v  (cost=0.14..2.36 rows=1 width=36) (actual time=0.004..0.005 rows=1 loops=1)
                                      Index Cond: (id = t.vehicle_id)
                                      Buffers: shared hit=2
                          ->  Index Scan using trip_patterns_pkey on trip_patterns tp  (cost=0.14..2.36 rows=1 width=52) (actual time=0.017..0.018 rows=1 loops=1)
                                Index Cond: (id = t.pattern_id)
                                Buffers: shared hit=1 read=1 written=1
                    ->  Index Scan using idx_pattern_stops_pattern_id on pattern_stops ps_origin  (cost=0.27..10.62 rows=1 width=36) (actual time=0.088..0.091 rows=1 loops=1)
                          Index Cond: (pattern_id = t.pattern_id)
                          Filter: (stop_sequence = (SubPlan 1))
                          Rows Removed by Filter: 1
                          Buffers: shared hit=9
                          SubPlan 1
                            ->  Aggregate  (cost=3.50..3.51 rows=1 width=4) (actual time=0.040..0.040 rows=1 loops=2)
                                  Buffers: shared hit=6
                                  ->  Bitmap Heap Scan on pattern_stops ps2  (cost=1.39..3.50 rows=2 width=4) (actual time=0.035..0.035 rows=2 loops=2)
                                        Recheck Cond: (pattern_id = t.pattern_id)
                                        Heap Blocks: exact=2
                                        Buffers: shared hit=6
                                        ->  Bitmap Index Scan on idx_pattern_stops_pattern_id  (cost=0.00..1.39 rows=2 width=0) (actual time=0.019..0.019 rows=2 loops=2)
                                              Index Cond: (pattern_id = t.pattern_id)
                                              Buffers: shared hit=4
              ->  Index Scan using stops_pkey on stops origin_s  (cost=0.14..0.17 rows=1 width=30) (actual time=0.004..0.004 rows=1 loops=1)
                    Index Cond: (id = ps_origin.stop_id)
                    Buffers: shared hit=2
        ->  Index Scan using idx_pattern_stops_pattern_id on pattern_stops ps_dest  (cost=0.27..10.62 rows=1 width=36) (actual time=0.012..0.012 rows=1 loops=1)
              Index Cond: (pattern_id = t.pattern_id)
              Filter: (stop_sequence = (SubPlan 2))
              Rows Removed by Filter: 1
              Buffers: shared hit=9
              SubPlan 2
                ->  Aggregate  (cost=3.50..3.51 rows=1 width=4) (actual time=0.004..0.004 rows=1 loops=2)
                      Buffers: shared hit=6
                      ->  Bitmap Heap Scan on pattern_stops ps3  (cost=1.39..3.50 rows=2 width=4) (actual time=0.002..0.002 rows=2 loops=2)
                            Recheck Cond: (pattern_id = t.pattern_id)
                            Heap Blocks: exact=2
                            Buffers: shared hit=6
                            ->  Bitmap Index Scan on idx_pattern_stops_pattern_id  (cost=0.00..1.39 rows=2 width=0) (actual time=0.001..0.001 rows=2 loops=2)
                                  Index Cond: (pattern_id = t.pattern_id)
                                  Buffers: shared hit=4
  ->  Index Scan using stops_pkey on stops dest_s  (cost=0.14..0.17 rows=1 width=30) (actual time=0.001..0.001 rows=1 loops=1)
        Index Cond: (id = ps_dest.stop_id)
        Buffers: shared hit=2
Planning:
  Buffers: shared hit=83 read=20 dirtied=5 written=16
Planning Time: 17.373 ms
Execution Time: 11.280 ms
```

#### Q06 — getRevenueSummary — ringkasan keseluruhan (30 hari)
**Source:** `reports.repository.ts:139`  
**Purpose:** SUM + COUNT bookings INNER JOIN trips, filter service_date range, status paid/confirmed/checked_in. Rentang 30 hari ~260K booking.  
**Timing:** Planning `4.47ms` · Execution `1477.23ms` 🔴

```
Aggregate  (cost=82566.90..82566.91 rows=1 width=72) (actual time=1475.028..1475.033 rows=1 loops=1)
  Buffers: shared hit=21 read=18743 written=3460, temp read=1727 written=1735
  ->  Sort  (cost=78065.76..79191.05 rows=450113 width=21) (actual time=1289.891..1398.218 rows=449406 loops=1)
        Sort Key: b.trip_id
        Sort Method: external merge  Disk: 13816kB
        Buffers: shared hit=21 read=18743 written=3460, temp read=1727 written=1735
        ->  Hash Join  (cost=7301.11..30392.41 rows=450113 width=21) (actual time=390.491..1034.503 rows=449406 loops=1)
              Hash Cond: (b.trip_id = t.id)
              Buffers: shared hit=21 read=18743 written=3460
              ->  Seq Scan on bookings b  (cost=0.00..21909.71 rows=450113 width=21) (actual time=0.020..339.526 rows=449406 loops=1)
                    Filter: (status = ANY ('{paid,confirmed,checked_in}'::booking_status[]))
                    Rows Removed by Filter: 70576
                    Buffers: shared hit=16 read=14747 written=27
              ->  Hash  (cost=5801.06..5801.06 rows=120004 width=16) (actual time=390.158..390.159 rows=120000 loops=1)
                    Buckets: 131072  Batches: 1  Memory Usage: 6649kB
                    Buffers: shared hit=5 read=3996 written=3433
                    ->  Seq Scan on trips t  (cost=0.00..5801.06 rows=120004 width=16) (actual time=0.016..347.626 rows=120000 loops=1)
                          Filter: ((service_date >= '2026-06-28'::date) AND (service_date <= '2026-07-27'::date))
                          Buffers: shared hit=5 read=3996 written=3433
Planning:
  Buffers: shared hit=33 read=18 dirtied=2 written=18
Planning Time: 4.466 ms
Execution Time: 1477.230 ms
```

#### Q07 — getRevenueSummary — harian (GROUP BY service_date)
**Source:** `reports.repository.ts:171`  
**Purpose:** Revenue per hari: bookings JOIN trips GROUP BY service_date, 30 hari data.  
**Timing:** Planning `0.51ms` · Execution `469.45ms` 🟠

```
Finalize GroupAggregate  (cost=26016.92..26025.12 rows=30 width=72) (actual time=464.931..469.301 rows=30 loops=1)
  Group Key: t.service_date
  Buffers: shared hit=4088 read=14720 written=81
  ->  Gather Merge  (cost=26016.92..26023.92 rows=60 width=44) (actual time=464.914..469.255 rows=87 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=4088 read=14720 written=81
        ->  Sort  (cost=25016.89..25016.97 rows=30 width=44) (actual time=452.275..452.279 rows=29 loops=3)
              Sort Key: t.service_date
              Sort Method: quicksort  Memory: 28kB
              Buffers: shared hit=4088 read=14720 written=81
              Worker 0:  Sort Method: quicksort  Memory: 28kB
              Worker 1:  Sort Method: quicksort  Memory: 27kB
              ->  Partial HashAggregate  (cost=25015.78..25016.16 rows=30 width=44) (actual time=452.182..452.195 rows=29 loops=3)
                    Group Key: t.service_date
                    Batches: 1  Memory Usage: 32kB
                    Buffers: shared hit=4072 read=14720 written=81
                    Worker 0:  Batches: 1  Memory Usage: 32kB
                    Worker 1:  Batches: 1  Memory Usage: 32kB
                    ->  Parallel Hash Join  (cost=5376.05..23609.18 rows=187547 width=9) (actual time=60.775..376.597 rows=149802 loops=3)
                          Hash Cond: (b.trip_id = t.id)
                          Buffers: shared hit=4072 read=14720 written=81
                          ->  Parallel Seq Scan on bookings b  (cost=0.00..17740.80 rows=187547 width=21) (actual time=0.057..121.783 rows=149802 loops=3)
                                Filter: (status = ANY ('{paid,confirmed,checked_in}'::booking_status[]))
                                Rows Removed by Filter: 23525
                                Buffers: shared hit=48 read=14715 written=76
                          ->  Parallel Hash  (cost=4751.02..4751.02 rows=50002 width=20) (actual time=45.506..45.507 rows=40000 loops=3)
                                Buckets: 131072  Batches: 1  Memory Usage: 7680kB
                                Buffers: shared hit=4001
                                ->  Parallel Seq Scan on trips t  (cost=0.00..4751.02 rows=50002 width=20) (actual time=0.009..7.023 rows=40000 loops=3)
                                      Filter: ((service_date >= '2026-06-28'::date) AND (service_date <= '2026-07-27'::date))
                                      Buffers: shared hit=4001
Planning:
  Buffers: shared hit=37 read=3 written=1
Planning Time: 0.505 ms
Execution Time: 469.449 ms
```

#### Q08 — getRevenueSummary — per outlet (LEFT JOIN outlets)
**Source:** `reports.repository.ts:196`  
**Purpose:** Revenue breakdown per outlet: bookings JOIN trips LEFT JOIN outlets, GROUP BY outlet name.  
**Timing:** Planning `10.37ms` · Execution `624.63ms` 🔴

```
Sort  (cost=29692.33..29717.33 rows=10000 width=68) (actual time=622.810..623.708 rows=50 loops=1)
  Sort Key: (COALESCE(sum((b.total_amount)::numeric), '0'::numeric)) DESC
  Sort Method: quicksort  Memory: 27kB
  Buffers: shared hit=4181 read=14620 written=62
  ->  Finalize HashAggregate  (cost=28877.95..29027.95 rows=10000 width=68) (actual time=622.603..623.571 rows=50 loops=1)
        Group Key: (COALESCE(b.snap_outlet_name, o.name))
        Batches: 1  Memory Usage: 433kB
        Buffers: shared hit=4178 read=14620 written=62
        ->  Gather  (cost=26552.95..28677.95 rows=20000 width=72) (actual time=618.994..623.351 rows=150 loops=1)
              Workers Planned: 2
              Workers Launched: 2
              Buffers: shared hit=4178 read=14620 written=62
              ->  Partial HashAggregate  (cost=25552.95..25677.95 rows=10000 width=72) (actual time=605.492..605.584 rows=50 loops=3)
                    Group Key: COALESCE(b.snap_outlet_name, o.name)
                    Batches: 1  Memory Usage: 433kB
                    Buffers: shared hit=4178 read=14620 written=62
                    Worker 0:  Batches: 1  Memory Usage: 433kB
                    Worker 1:  Batches: 1  Memory Usage: 433kB
                    ->  Hash Left Join  (cost=5379.17..24146.35 rows=187547 width=37) (actual time=108.353..499.291 rows=149802 loops=3)
                          Hash Cond: (b.outlet_id = o.id)
                          Buffers: shared hit=4178 read=14620 written=62
                          ->  Parallel Hash Join  (cost=5376.05..23609.18 rows=187547 width=53) (actual time=108.308..389.406 rows=149802 loops=3)
                                Hash Cond: (b.trip_id = t.id)
                                Buffers: shared hit=4173 read=14619 written=62
                                ->  Parallel Seq Scan on bookings b  (cost=0.00..17740.80 rows=187547 width=69) (actual time=0.058..146.061 rows=149802 loops=3)
                                      Filter: (status = ANY ('{paid,confirmed,checked_in}'::booking_status[]))
                                      Rows Removed by Filter: 23525
                                      Buffers: shared hit=144 read=14619 written=62
                                ->  Parallel Hash  (cost=4751.02..4751.02 rows=50002 width=16) (actual time=104.394..104.395 rows=40000 loops=3)
                                      Buckets: 131072  Batches: 1  Memory Usage: 6720kB
                                      Buffers: shared hit=4001
                                      ->  Parallel Seq Scan on trips t  (cost=0.00..4751.02 rows=50002 width=16) (actual time=0.010..19.311 rows=40000 loops=3)
                                            Filter: ((service_date >= '2026-06-28'::date) AND (service_date <= '2026-07-27'::date))
                                            Buffers: shared hit=4001
                          ->  Hash  (cost=2.50..2.50 rows=50 width=30) (actual time=0.027..0.028 rows=50 loops=3)
                                Buckets: 1024  Batches: 1  Memory Usage: 12kB
                                Buffers: shared hit=5 read=1
                                ->  Seq Scan on outlets o  (cost=0.00..2.50 rows=50 width=30) (actual time=0.008..0.017 rows=50 loops=3)
                                      Buffers: shared hit=5 read=1
Planning:
  Buffers: shared hit=49 read=10 dirtied=1 written=3
Planning Time: 10.369 ms
Execution Time: 624.627 ms
```

#### Q09 — getRevenueSummary — per rute (LEFT JOIN trip_patterns)
**Source:** `reports.repository.ts:222`  
**Purpose:** Revenue per rute: bookings JOIN trips LEFT JOIN trip_patterns GROUP BY route.  
**Timing:** Planning `0.50ms` · Execution `812.25ms` 🔴

```
Sort  (cost=138558.74..139684.02 rows=450113 width=100) (actual time=812.042..812.055 rows=200 loops=1)
  Sort Key: (COALESCE(sum((b.total_amount)::numeric), '0'::numeric)) DESC
  Sort Method: quicksort  Memory: 39kB
  Buffers: shared hit=4243 read=14526 written=22, temp read=1759 written=1759
  ->  HashAggregate  (cost=64572.37..81873.59 rows=450113 width=100) (actual time=811.790..811.953 rows=200 loops=1)
        Group Key: COALESCE(t.snap_route_name, tp.name), COALESCE(t.snap_route_code, tp.code)
        Planned Partitions: 32  Batches: 1  Memory Usage: 913kB
        Buffers: shared hit=4243 read=14526 written=22, temp read=1759 written=1759
        ->  Hash Left Join  (cost=8600.61..39464.50 rows=450113 width=69) (actual time=84.688..673.492 rows=449406 loops=1)
              Hash Cond: (t.pattern_id = tp.id)
              Buffers: shared hit=4243 read=14526 written=22, temp read=1759 written=1759
              ->  Hash Join  (cost=8591.11..38248.41 rows=450113 width=52) (actual time=84.580..547.780 rows=449406 loops=1)
                    Hash Cond: (b.trip_id = t.id)
                    Buffers: shared hit=4241 read=14523 written=21, temp read=1759 written=1759
                    ->  Seq Scan on bookings b  (cost=0.00..21909.71 rows=450113 width=21) (actual time=0.024..280.675 rows=449406 loops=1)
                          Filter: (status = ANY ('{paid,confirmed,checked_in}'::booking_status[]))
                          Rows Removed by Filter: 70576
                          Buffers: shared hit=240 read=14523 written=21
                    ->  Hash  (cost=5801.06..5801.06 rows=120004 width=63) (actual time=84.391..84.392 rows=120000 loops=1)
                          Buckets: 131072  Batches: 2  Memory Usage: 6635kB
                          Buffers: shared hit=4001, temp written=616
                          ->  Seq Scan on trips t  (cost=0.00..5801.06 rows=120004 width=63) (actual time=0.005..60.721 rows=120000 loops=1)
                                Filter: ((service_date >= '2026-06-28'::date) AND (service_date <= '2026-07-27'::date))
                                Buffers: shared hit=4001
              ->  Hash  (cost=7.00..7.00 rows=200 width=60) (actual time=0.098..0.098 rows=200 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 27kB
                    Buffers: shared hit=2 read=3 written=1
                    ->  Seq Scan on trip_patterns tp  (cost=0.00..7.00 rows=200 width=60) (actual time=0.006..0.068 rows=200 loops=1)
                          Buffers: shared hit=2 read=3 written=1
Planning:
  Buffers: shared hit=40 read=2 written=2
Planning Time: 0.496 ms
Execution Time: 812.255 ms
```

#### Q10 — getSalesReport — ringkasan dengan FILTER aggregates
**Source:** `reports.repository.ts:250`  
**Purpose:** COUNT dengan FILTER per status (paid, cancelled, pending, confirmed, refunded, unseated). Seluruh booking 30 hari.  
**Timing:** Planning `0.35ms` · Execution `1025.28ms` 🔴

```
Aggregate  (cost=105397.36..105397.39 rows=1 width=60) (actual time=1022.563..1022.567 rows=1 loops=1)
  Buffers: shared hit=4273 read=14491 written=11, temp read=2257 written=2267
  ->  Sort  (cost=85256.62..86556.02 rows=519761 width=25) (actual time=863.991..923.238 rows=519982 loops=1)
        Sort Key: b.trip_id
        Sort Method: external merge  Disk: 18056kB
        Buffers: shared hit=4273 read=14491 written=11, temp read=2257 written=2267
        ->  Hash Join  (cost=7301.11..28626.14 rows=519761 width=25) (actual time=30.699..442.399 rows=519982 loops=1)
              Hash Cond: (b.trip_id = t.id)
              Buffers: shared hit=4273 read=14491 written=11
              ->  Seq Scan on bookings b  (cost=0.00..19960.61 rows=519761 width=25) (actual time=0.035..245.063 rows=519982 loops=1)
                    Buffers: shared hit=272 read=14491 written=11
              ->  Hash  (cost=5801.06..5801.06 rows=120004 width=16) (actual time=30.585..30.586 rows=120000 loops=1)
                    Buckets: 131072  Batches: 1  Memory Usage: 6649kB
                    Buffers: shared hit=4001
                    ->  Seq Scan on trips t  (cost=0.00..5801.06 rows=120004 width=16) (actual time=0.004..17.705 rows=120000 loops=1)
                          Filter: ((service_date >= '2026-06-28'::date) AND (service_date <= '2026-07-27'::date))
                          Buffers: shared hit=4001
Planning:
  Buffers: shared hit=28
Planning Time: 0.354 ms
Execution Time: 1025.282 ms
```

#### Q11 — getSalesReport — recent 100 booking (5 JOIN + ORDER BY created_at DESC)
**Source:** `reports.repository.ts:353`  
**Purpose:** 100 booking terbaru dengan 5 LEFT JOIN (trip_patterns, outlets, stops×2) + ORDER BY created_at DESC LIMIT 100. Hot path untuk tabel booking terkini.  
**Timing:** Planning `3.52ms` · Execution `67.37ms` 🟡

```
Limit  (cost=1.45..32.51 rows=100 width=180) (actual time=9.009..67.222 rows=100 loops=1)
  Buffers: shared hit=439 read=89 written=79
  ->  Nested Loop Left Join  (cost=1.45..161424.64 rows=519761 width=180) (actual time=9.007..67.199 rows=100 loops=1)
        Buffers: shared hit=439 read=89 written=79
        ->  Nested Loop Left Join  (cost=1.30..148572.41 rows=519761 width=217) (actual time=9.001..67.053 rows=100 loops=1)
              Buffers: shared hit=395 read=89 written=79
              ->  Nested Loop Left Join  (cost=1.15..135720.19 rows=519761 width=219) (actual time=8.992..66.942 rows=100 loops=1)
                    Buffers: shared hit=379 read=89 written=79
                    ->  Nested Loop Left Join  (cost=1.00..122867.96 rows=519761 width=221) (actual time=8.983..66.810 rows=100 loops=1)
                          Buffers: shared hit=363 read=89 written=79
                          ->  Nested Loop  (cost=0.85..109879.88 rows=519761 width=201) (actual time=8.954..66.531 rows=100 loops=1)
                                Buffers: shared hit=307 read=87 written=77
                                ->  Index Scan Backward using idx_bookings_created_at on bookings b  (cost=0.42..80602.85 rows=519761 width=174) (actual time=1.947..2.022 rows=100 loops=1)
                                      Buffers: shared hit=31 read=3
                                ->  Memoize  (cost=0.43..0.79 rows=1 width=59) (actual time=0.643..0.643 rows=1 loops=100)
                                      Cache Key: b.trip_id
                                      Cache Mode: logical
                                      Hits: 10  Misses: 90  Evictions: 0  Overflows: 0  Memory Usage: 16kB
                                      Buffers: shared hit=276 read=84 written=77
                                      ->  Index Scan using trips_pkey on trips t  (cost=0.42..0.78 rows=1 width=59) (actual time=0.713..0.713 rows=1 loops=90)
                                            Index Cond: (id = b.trip_id)
                                            Filter: ((service_date >= '2026-06-28'::date) AND (service_date <= '2026-07-27'::date))
                                            Buffers: shared hit=276 read=84 written=77
                          ->  Memoize  (cost=0.15..0.17 rows=1 width=52) (actual time=0.002..0.002 rows=1 loops=100)
                                Cache Key: t.pattern_id
                                Cache Mode: logical
                                Hits: 71  Misses: 29  Evictions: 0  Overflows: 0  Memory Usage: 5kB
                                Buffers: shared hit=56 read=2 written=2
                                ->  Index Scan using trip_patterns_pkey on trip_patterns tp  (cost=0.14..0.16 rows=1 width=52) (actual time=0.004..0.004 rows=1 loops=29)
                                      Index Cond: (id = t.pattern_id)
                                      Buffers: shared hit=56 read=2 written=2
                    ->  Memoize  (cost=0.15..0.17 rows=1 width=30) (actual time=0.001..0.001 rows=1 loops=100)
                          Cache Key: b.outlet_id
                          Cache Mode: logical
                          Hits: 92  Misses: 8  Evictions: 0  Overflows: 0  Memory Usage: 2kB
                          Buffers: shared hit=16
                          ->  Index Scan using outlets_pkey on outlets o  (cost=0.14..0.16 rows=1 width=30) (actual time=0.003..0.003 rows=1 loops=8)
                                Index Cond: (id = b.outlet_id)
                                Buffers: shared hit=16
              ->  Memoize  (cost=0.15..0.17 rows=1 width=30) (actual time=0.001..0.001 rows=1 loops=100)
                    Cache Key: b.origin_stop_id
                    Cache Mode: logical
                    Hits: 92  Misses: 8  Evictions: 0  Overflows: 0  Memory Usage: 2kB
                    Buffers: shared hit=16
                    ->  Index Scan using stops_pkey on stops os  (cost=0.14..0.16 rows=1 width=30) (actual time=0.002..0.002 rows=1 loops=8)
                          Index Cond: (id = b.origin_stop_id)
                          Buffers: shared hit=16
        ->  Memoize  (cost=0.15..0.17 rows=1 width=30) (actual time=0.001..0.001 rows=1 loops=100)
              Cache Key: b.destination_stop_id
              Cache Mode: logical
              Hits: 78  Misses: 22  Evictions: 0  Overflows: 0  Memory Usage: 4kB
              Buffers: shared hit=44
              ->  Index Scan using stops_pkey on stops ds  (cost=0.14..0.16 rows=1 width=30) (actual time=0.002..0.002 rows=1 loops=22)
                    Index Cond: (id = b.destination_stop_id)
                    Buffers: shared hit=44
Planning:
  Buffers: shared hit=69 read=19 written=12
Planning Time: 3.518 ms
Execution Time: 67.366 ms
```

#### Q12 — getLoadFactor — per trip (subquery pax)
**Source:** `reports.repository.ts:472`  
**Purpose:** Load factor per trip: trips LEFT JOIN trip_patterns LEFT JOIN drivers LEFT JOIN (passengers INNER JOIN bookings GROUP BY trip_id). Full table scan trips + correlated pax subquery.  
**Timing:** Planning `2.03ms` · Execution `2311.79ms` 💀

```
Sort  (cost=70407.58..70707.59 rows=120004 width=228) (actual time=2235.105..2297.448 rows=120000 loops=1)
  Sort Key: t.service_date DESC, tp.name
  Sort Method: external merge  Disk: 17096kB
  Buffers: shared hit=1332 read=24384 written=1499, temp read=8782 written=9382
  ->  Hash Left Join  (cost=43107.82..52594.06 rows=120004 width=228) (actual time=1623.811..2049.641 rows=120000 loops=1)
        Hash Cond: (t.id = pax.trip_id)
        Buffers: shared hit=1332 read=24384 written=1499, temp read=6645 written=7240
        ->  Hash Left Join  (cost=11.40..6482.53 rows=120004 width=131) (actual time=0.096..241.873 rows=120000 loops=1)
              Hash Cond: (t.driver_id = d.id)
              Buffers: shared hit=1016 read=2991 written=1314
              ->  Hash Left Join  (cost=9.50..6132.25 rows=120004 width=133) (actual time=0.082..193.447 rows=120000 loops=1)
                    Hash Cond: (t.pattern_id = tp.id)
                    Buffers: shared hit=1015 read=2991 written=1314
                    ->  Seq Scan on trips t  (cost=0.00..5801.06 rows=120004 width=105) (actual time=0.006..94.062 rows=120000 loops=1)
                          Filter: ((service_date >= '2026-06-28'::date) AND (service_date <= '2026-07-27'::date))
                          Buffers: shared hit=1011 read=2990 written=1313
                    ->  Hash  (cost=7.00..7.00 rows=200 width=60) (actual time=0.071..0.072 rows=200 loops=1)
                          Buckets: 1024  Batches: 1  Memory Usage: 27kB
                          Buffers: shared hit=4 read=1 written=1
                          ->  Seq Scan on trip_patterns tp  (cost=0.00..7.00 rows=200 width=60) (actual time=0.004..0.049 rows=200 loops=1)
                                Buffers: shared hit=4 read=1 written=1
              ->  Hash  (cost=1.40..1.40 rows=40 width=30) (actual time=0.011..0.011 rows=40 loops=1)
                    Buckets: 1024  Batches: 1  Memory Usage: 11kB
                    Buffers: shared hit=1
                    ->  Seq Scan on drivers d  (cost=0.00..1.40 rows=40 width=30) (actual time=0.002..0.005 rows=40 loops=1)
                          Buffers: shared hit=1
        ->  Hash  (cost=42837.02..42837.02 rows=20752 width=24) (actual time=1623.591..1638.739 rows=108702 loops=1)
              Buckets: 131072 (originally 32768)  Batches: 1 (originally 1)  Memory Usage: 6969kB
              Buffers: shared hit=316 read=21393 written=185, temp read=6645 written=7240
              ->  Subquery Scan on pax  (cost=42421.98..42837.02 rows=20752 width=24) (actual time=1557.014..1625.680 rows=108702 loops=1)
                    Buffers: shared hit=316 read=21393 written=185, temp read=6645 written=7240
                    ->  Finalize HashAggregate  (cost=42421.98..42629.50 rows=20752 width=24) (actual time=1557.013..1591.447 rows=108702 loops=1)
                          Group Key: b.trip_id
                          Batches: 5  Memory Usage: 8241kB  Disk Usage: 3448kB
                          Buffers: shared hit=316 read=21393 written=185, temp read=6645 written=7240
                          ->  Gather  (cost=37856.54..42214.46 rows=41504 width=24) (actual time=1295.463..1430.922 rows=244480 loops=1)
                                Workers Planned: 2
                                Workers Launched: 2
                                Buffers: shared hit=316 read=21393 written=185, temp read=6358 written=6604
                                ->  Partial HashAggregate  (cost=36856.54..37064.06 rows=20752 width=24) (actual time=1281.035..1335.644 rows=81493 loops=3)
                                      Group Key: b.trip_id
                                      Batches: 5  Memory Usage: 8241kB  Disk Usage: 1632kB
                                      Buffers: shared hit=316 read=21393 written=185, temp read=6358 written=6604
                                      Worker 0:  Batches: 1  Memory Usage: 7953kB
                                      Worker 1:  Batches: 1  Memory Usage: 7953kB
                                      ->  Parallel Hash Join  (cost=21116.76..35773.11 rows=216685 width=32) (actual time=575.201..954.419 rows=173327 loops=3)
                                            Hash Cond: (p.booking_id = b.id)
                                            Buffers: shared hit=316 read=21393 written=185, temp read=6214 written=6300
                                            ->  Parallel Seq Scan on passengers p  (cost=0.00..9642.56 rows=216685 width=32) (actual time=0.954..221.474 rows=173327 loops=3)
                                                  Filter: (ticket_status = ANY ('{active,checked_in}'::ticket_status[]))
                                                  Buffers: shared hit=6 read=6934 written=92
                                            ->  Parallel Hash  (cost=16928.67..16928.67 rows=216567 width=32) (actual time=220.054..220.055 rows=173327 loops=3)
                                                  Buckets: 131072  Batches: 8  Memory Usage: 5152kB
                                                  Buffers: shared hit=304 read=14459 written=93, temp written=2936
                                                  ->  Parallel Seq Scan on bookings b  (cost=0.00..16928.67 rows=216567 width=32) (actual time=0.040..91.732 rows=173327 loops=3)
                                                        Buffers: shared hit=304 read=14459 written=93
Planning:
  Buffers: shared hit=34 read=16 written=16
Planning Time: 2.034 ms
Execution Time: 2311.786 ms
```

#### Q13 — getLoadFactor — per rute (GROUP BY route)
**Source:** `reports.repository.ts:500`  
**Purpose:** Load factor rata-rata per rute: trips LEFT JOIN pax subquery GROUP BY snap_route_name. 30 hari × 100 rute = 3.000 trips per hari.  
**Timing:** Planning `1.28ms` · Execution `1402.59ms` 🔴

```
Sort  (cost=78936.63..79236.64 rows=120004 width=108) (actual time=1378.678..1401.190 rows=200 loops=1)
  Sort Key: (CASE WHEN (sum(t.capacity) > 0) THEN round(((COALESCE(sum(pax.count), '0'::numeric) / (sum(t.capacity))::numeric) * '100'::numeric), 1) ELSE '0'::numeric END) DESC
  Sort Method: quicksort  Memory: 40kB
  Buffers: shared hit=3083 read=22632 written=777, temp read=6626 written=7211
  ->  HashAggregate  (cost=57311.13..64727.00 rows=120004 width=108) (actual time=1378.404..1401.109 rows=200 loops=1)
        Group Key: COALESCE(t.snap_route_name, tp.name), COALESCE(t.snap_route_code, tp.code)
        Planned Partitions: 8  Batches: 1  Memory Usage: 849kB
        Buffers: shared hit=3083 read=22632 written=777, temp read=6626 written=7211
        ->  Hash Left Join  (cost=43105.92..49543.69 rows=120004 width=92) (actual time=1182.155..1366.027 rows=120000 loops=1)
              Hash Cond: (t.id = pax.trip_id)
              Buffers: shared hit=3083 read=22632 written=777, temp read=6626 written=7211
              ->  Hash Left Join  (cost=9.50..6132.25 rows=120004 width=95) (actual time=0.068..90.957 rows=120000 loops=1)
                    Hash Cond: (t.pattern_id = tp.id)
                    Buffers: shared hit=3019 read=987 written=686
                    ->  Seq Scan on trips t  (cost=0.00..5801.06 rows=120004 width=67) (actual time=0.007..30.341 rows=120000 loops=1)
                          Filter: ((service_date >= '2026-06-28'::date) AND (service_date <= '2026-07-27'::date))
                          Buffers: shared hit=3014 read=987 written=686
                    ->  Hash  (cost=7.00..7.00 rows=200 width=60) (actual time=0.056..0.057 rows=200 loops=1)
                          Buckets: 1024  Batches: 1  Memory Usage: 27kB
                          Buffers: shared hit=5
                          ->  Seq Scan on trip_patterns tp  (cost=0.00..7.00 rows=200 width=60) (actual time=0.005..0.033 rows=200 loops=1)
                                Buffers: shared hit=5
              ->  Hash  (cost=42837.02..42837.02 rows=20752 width=24) (actual time=1182.067..1204.566 rows=108702 loops=1)
                    Buckets: 131072 (originally 32768)  Batches: 1 (originally 1)  Memory Usage: 6969kB
                    Buffers: shared hit=64 read=21645 written=91, temp read=6626 written=7211
                    ->  Subquery Scan on pax  (cost=42421.98..42837.02 rows=20752 width=24) (actual time=1097.833..1164.155 rows=108702 loops=1)
                          Buffers: shared hit=64 read=21645 written=91, temp read=6626 written=7211
                          ->  Finalize HashAggregate  (cost=42421.98..42629.50 rows=20752 width=24) (actual time=1097.832..1151.125 rows=108702 loops=1)
                                Group Key: b.trip_id
                                Batches: 5  Memory Usage: 8241kB  Disk Usage: 3464kB
                                Buffers: shared hit=64 read=21645 written=91, temp read=6626 written=7211
                                ->  Gather  (cost=37856.54..42214.46 rows=41504 width=24) (actual time=812.958..941.998 rows=246084 loops=1)
                                      Workers Planned: 2
                                      Workers Launched: 2
                                      Buffers: shared hit=64 read=21645 written=91, temp read=6326 written=6557
                                      ->  Partial HashAggregate  (cost=36856.54..37064.06 rows=20752 width=24) (actual time=808.332..838.143 rows=82028 loops=3)
                                            Group Key: b.trip_id
                                            Batches: 5  Memory Usage: 8241kB  Disk Usage: 1560kB
                                            Buffers: shared hit=64 read=21645 written=91, temp read=6326 written=6557
                                            Worker 0:  Batches: 1  Memory Usage: 7953kB
                                            Worker 1:  Batches: 5  Memory Usage: 8241kB  Disk Usage: 200kB
                                            ->  Parallel Hash Join  (cost=21116.76..35773.11 rows=216685 width=32) (actual time=494.342..665.358 rows=173327 loops=3)
                                                  Hash Cond: (p.booking_id = b.id)
                                                  Buffers: shared hit=64 read=21645 written=91, temp read=6211 written=6256
                                                  ->  Parallel Seq Scan on passengers p  (cost=0.00..9642.56 rows=216685 width=32) (actual time=0.156..86.579 rows=173327 loops=3)
                                                        Filter: (ticket_status = ANY ('{active,checked_in}'::ticket_status[]))
                                                        Buffers: shared hit=6 read=6934 written=52
                                                  ->  Parallel Hash  (cost=16928.67..16928.67 rows=216567 width=32) (actual time=194.311..194.312 rows=173327 loops=3)
                                                        Buckets: 131072  Batches: 8  Memory Usage: 5152kB
                                                        Buffers: shared hit=52 read=14711 written=39, temp written=2920
                                                        ->  Parallel Seq Scan on bookings b  (cost=0.00..16928.67 rows=216567 width=32) (actual time=0.031..126.377 rows=173327 loops=3)
                                                              Buffers: shared hit=52 read=14711 written=39
Planning:
  Buffers: shared hit=43 read=3 written=2
Planning Time: 1.278 ms
Execution Time: 1402.590 ms
```

#### Q14 — getLoadFactor — harian (GROUP BY service_date)
**Source:** `reports.repository.ts:545`  
**Purpose:** Load factor per hari: trips LEFT JOIN pax GROUP BY service_date, 30 hari.  
**Timing:** Planning `0.71ms` · Execution `1728.23ms` 🔴

```
Sort  (cost=50414.40..50414.48 rows=30 width=80) (actual time=1711.446..1726.659 rows=30 loops=1)
  Sort Key: t.service_date
  Sort Method: quicksort  Memory: 26kB
  Buffers: shared hit=3505 read=22205 written=573, temp read=6655 written=7165
  ->  HashAggregate  (cost=50412.54..50413.67 rows=30 width=80) (actual time=1711.414..1726.642 rows=30 loops=1)
        Group Key: t.service_date
        Batches: 1  Memory Usage: 24kB
        Buffers: shared hit=3505 read=22205 written=573, temp read=6655 written=7165
        ->  Hash Left Join  (cost=43096.42..49212.50 rows=120004 width=32) (actual time=1597.042..1705.897 rows=120000 loops=1)
              Hash Cond: (t.id = pax.trip_id)
              Buffers: shared hit=3505 read=22205 written=573, temp read=6655 written=7165
              ->  Seq Scan on trips t  (cost=0.00..5801.06 rows=120004 width=24) (actual time=0.006..40.956 rows=120000 loops=1)
                    Filter: ((service_date >= '2026-06-28'::date) AND (service_date <= '2026-07-27'::date))
                    Buffers: shared hit=3249 read=752 written=431
              ->  Hash  (cost=42837.02..42837.02 rows=20752 width=24) (actual time=1596.933..1612.142 rows=108702 loops=1)
                    Buckets: 131072 (originally 32768)  Batches: 1 (originally 1)  Memory Usage: 6969kB
                    Buffers: shared hit=256 read=21453 written=142, temp read=6655 written=7165
                    ->  Subquery Scan on pax  (cost=42421.98..42837.02 rows=20752 width=24) (actual time=1502.140..1586.008 rows=108702 loops=1)
                          Buffers: shared hit=256 read=21453 written=142, temp read=6655 written=7165
                          ->  Finalize HashAggregate  (cost=42421.98..42629.50 rows=20752 width=24) (actual time=1502.139..1572.075 rows=108702 loops=1)
                                Group Key: b.trip_id
                                Batches: 5  Memory Usage: 8241kB  Disk Usage: 3488kB
                                Buffers: shared hit=256 read=21453 written=142, temp read=6655 written=7165
                                ->  Gather  (cost=37856.54..42214.46 rows=41504 width=24) (actual time=882.875..1108.974 rows=246821 loops=1)
                                      Workers Planned: 2
                                      Workers Launched: 2
                                      Buffers: shared hit=256 read=21453 written=142, temp read=6344 written=6500
                                      ->  Partial HashAggregate  (cost=36856.54..37064.06 rows=20752 width=24) (actual time=875.024..910.570 rows=82274 loops=3)
                                            Group Key: b.trip_id
                                            Batches: 5  Memory Usage: 8241kB  Disk Usage: 776kB
                                            Buffers: shared hit=256 read=21453 written=142, temp read=6344 written=6500
                                            Worker 0:  Batches: 5  Memory Usage: 8241kB  Disk Usage: 256kB
                                            Worker 1:  Batches: 1  Memory Usage: 7953kB
                                            ->  Parallel Hash Join  (cost=21116.76..35773.11 rows=216685 width=32) (actual time=395.864..653.638 rows=173327 loops=3)
                                                  Hash Cond: (p.booking_id = b.id)
                                                  Buffers: shared hit=256 read=21453 written=142, temp read=6215 written=6280
                                                  ->  Parallel Seq Scan on passengers p  (cost=0.00..9642.56 rows=216685 width=32) (actual time=0.065..114.160 rows=173327 loops=3)
                                                        Filter: (ticket_status = ANY ('{active,checked_in}'::ticket_status[]))
                                                        Buffers: shared hit=102 read=6838 written=82
                                                  ->  Parallel Hash  (cost=16928.67..16928.67 rows=216567 width=32) (actual time=189.215..189.228 rows=173327 loops=3)
                                                        Buckets: 131072  Batches: 8  Memory Usage: 5152kB
                                                        Buffers: shared hit=148 read=14615 written=60, temp written=2932
                                                        ->  Parallel Seq Scan on bookings b  (cost=0.00..16928.67 rows=216567 width=32) (actual time=0.052..108.604 rows=173327 loops=3)
                                                              Buffers: shared hit=148 read=14615 written=60
Planning:
  Buffers: shared hit=26
Planning Time: 0.708 ms
Execution Time: 1728.234 ms
```

#### Q15 — getCancellationsReport — ringkasan booking_history
**Source:** `reports.repository.ts:580`  
**Purpose:** COUNT DISTINCT events dari booking_history INNER JOIN bookings INNER JOIN trips. Tabel booking_history mungkin tidak terisi perfload data (tanpa riwayat pembatalan).  
**Timing:** Planning `5.38ms` · Execution `0.05ms` ✅

```
Aggregate  (cost=1797.83..1797.85 rows=1 width=16) (actual time=0.011..0.011 rows=1 loops=1)
  ->  Sort  (cost=1787.23..1788.55 rows=530 width=20) (actual time=0.008..0.008 rows=0 loops=1)
        Sort Key: bh.id
        Sort Method: quicksort  Memory: 25kB
        ->  Nested Loop  (cost=0.84..1763.25 rows=530 width=20) (actual time=0.003..0.004 rows=0 loops=1)
              ->  Nested Loop  (cost=0.42..1347.40 rows=530 width=36) (actual time=0.003..0.004 rows=0 loops=1)
                    ->  Seq Scan on booking_history bh  (cost=0.00..15.30 rows=530 width=36) (actual time=0.003..0.003 rows=0 loops=1)
                    ->  Index Scan using bookings_pkey on bookings b  (cost=0.42..2.51 rows=1 width=32) (never executed)
                          Index Cond: (id = bh.booking_id)
              ->  Index Scan using trips_pkey on trips t  (cost=0.42..0.78 rows=1 width=16) (never executed)
                    Index Cond: (id = b.trip_id)
                    Filter: ((service_date >= '2026-06-28'::date) AND (service_date <= '2026-07-27'::date))
Planning:
  Buffers: shared hit=57 read=17 written=16
Planning Time: 5.382 ms
Execution Time: 0.051 ms
```

#### Q16 — getBookingsPaginated — tanpa filter outlet (all bookings page 1)
**Source:** `booking.repository.ts:52`  
**Purpose:** Daftar semua booking paginated tanpa outlet filter (dev user / owner). COUNT(*) + SELECT dengan ORDER BY created_at DESC. Total ~260K rows.  
**Timing:** Planning `0.07ms` · Execution `169.28ms` 🟠

```
Finalize Aggregate  (cost=9472.37..9472.38 rows=1 width=4) (actual time=165.565..169.204 rows=1 loops=1)
  Buffers: shared hit=15150 read=2745 written=2531
  ->  Gather  (cost=9472.15..9472.36 rows=2 width=8) (actual time=163.191..169.195 rows=3 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        Buffers: shared hit=15150 read=2745 written=2531
        ->  Partial Aggregate  (cost=8472.15..8472.16 rows=1 width=8) (actual time=160.588..160.589 rows=1 loops=3)
              Buffers: shared hit=15150 read=2745 written=2531
              ->  Parallel Index Only Scan using idx_bookings_created_at on bookings  (cost=0.42..7930.74 rows=216567 width=0) (actual time=1.166..143.872 rows=173327 loops=3)
                    Heap Fetches: 88050
                    Buffers: shared hit=15150 read=2745 written=2531
Planning:
  Buffers: shared hit=3
Planning Time: 0.073 ms
Execution Time: 169.275 ms
```

#### Q16b — getBookingsPaginated — SELECT halaman pertama (ORDER BY created_at DESC)
**Source:** `booking.repository.ts:62`  
**Purpose:** SELECT 20 booking pertama ORDER BY created_at DESC LIMIT 20 OFFSET 0 tanpa filter.  
**Timing:** Planning `0.36ms` · Execution `0.06ms` ✅

```
Limit  (cost=0.42..1.35 rows=20 width=402) (actual time=0.021..0.029 rows=20 loops=1)
  Buffers: shared hit=9 read=1 written=1
  ->  Index Scan Backward using idx_bookings_created_at on bookings  (cost=0.42..24104.60 rows=519761 width=402) (actual time=0.020..0.026 rows=20 loops=1)
        Buffers: shared hit=9 read=1 written=1
Planning:
  Buffers: shared hit=44 read=4 written=4
Planning Time: 0.361 ms
Execution Time: 0.057 ms
```

#### Q17 — getActiveBookingsForTrip — booking aktif per trip
**Source:** `booking.repository.ts:25`  
**Purpose:** Semua booking aktif (bukan cancelled/refunded/unseated) untuk satu trip. Dipanggil saat seatmap dibuka.  
**Timing:** Planning `0.18ms` · Execution `2.38ms` ✅

```
Index Scan using idx_bookings_trip_id on bookings  (cost=0.42..29.55 rows=24 width=402) (actual time=2.349..2.351 rows=6 loops=1)
  Index Cond: (trip_id = 'f3769fd5-bf4d-4ab3-bc7b-8176baddb41a'::uuid)
  Filter: (status <> ALL ('{cancelled,refunded,unseated}'::booking_status[]))
  Buffers: shared read=4 written=4
Planning:
  Buffers: shared hit=3
Planning Time: 0.178 ms
Execution Time: 2.382 ms
```

#### Q18 — seat_inventory bulk scan — precompute check
**Source:** `seatInventory.service.ts (precomputeInventory)`  
**Purpose:** Scan seluruh seat_inventory untuk satu trip saat precompute. 14 rows per trip.  
**Timing:** Planning `0.06ms` · Execution `0.45ms` ✅

```
Index Scan using uniq_seat_inv_trip_seat_leg on seat_inventory si  (cost=0.43..81.98 rows=72 width=40) (actual time=0.046..0.440 rows=14 loops=1)
  Index Cond: (trip_id = 'f3769fd5-bf4d-4ab3-bc7b-8176baddb41a'::uuid)
  Buffers: shared hit=3 read=5 written=5
Planning Time: 0.059 ms
Execution Time: 0.449 ms
```

#### Q19 — seat_holds expired cleanup — scheduler
**Source:** `scheduler (every 60s)`  
**Purpose:** Cleanup holds expired: UPDATE seat_inventory + DELETE seat_holds WHERE expires_at < NOW(). Dijalankan scheduler setiap 60 detik.  
**Timing:** Planning `0.12ms` · Execution `3.17ms` ✅

```
Bitmap Heap Scan on seat_holds sh  (cost=5.17..107.38 rows=347 width=83) (actual time=0.925..3.115 rows=123 loops=1)
  Recheck Cond: (expires_at <= now())
  Filter: (booking_id IS NULL)
  Heap Blocks: exact=95
  Buffers: shared read=98 dirtied=74 written=94
  ->  Bitmap Index Scan on idx_seat_holds_expires_at  (cost=0.00..5.08 rows=347 width=0) (actual time=0.848..0.849 rows=386 loops=1)
        Index Cond: (expires_at <= now())
        Buffers: shared read=3 written=3
Planning:
  Buffers: shared hit=7 read=3 written=3
Planning Time: 0.115 ms
Execution Time: 3.170 ms
```
