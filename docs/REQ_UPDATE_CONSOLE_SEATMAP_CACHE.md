# Requirement Update: TransityConsole — Seatmap Caching & Trip Materialization

**Tanggal:** 5 April 2026  
**Dari:** TransityTerminal (Nusa Shuttle)  
**Untuk:** TransityConsole (Gateway)  
**Terkait:** TransityApp (Consumer)

---

## 1. Endpoint Baru: POST /api/app/trips/materialize

### Latar Belakang

Saat user di TransityApp klik trip virtual dari hasil search, gateway perlu **materialisasi** trip tersebut terlebih dahulu agar bisa mengambil trip detail dan seatmap.

Sebelumnya, materialisasi hanya bisa dilakukan melalui CSO console (`POST /api/cso/materialize-trip`) yang memerlukan session auth. Endpoint baru ini bisa diakses menggunakan **service key**.

### Spesifikasi

```
POST /api/app/trips/materialize
```

**Auth:** `X-Service-Key` header (sama seperti `/api/app/trips/search`, `/api/app/cities`, dll)

**Request Body:**
```json
{
  "baseId": "uuid-dari-virtual-trip (tanpa prefix virtual-)",
  "serviceDate": "YYYY-MM-DD"
}
```

**Response (200 OK):**
```json
{
  "tripId": "uuid-trip-yang-sudah-dimaterialisasi"
}
```

**Error Responses:**
| Code | Kondisi | Body |
|------|---------|------|
| 400 | Validasi gagal (baseId bukan UUID, serviceDate format salah) | `{ "error": "Validation failed", "details": {...} }` |
| 401 | Service key tidak valid / tidak ada | `{ "error": "Missing X-Service-Key header" }` |
| 404 | Base ID tidak ditemukan | `{ "error": "Trip base with id ... not found" }` |
| 422 | Base tidak eligible untuk tanggal tersebut (hari tidak aktif, di luar validFrom/validTo, ada exception) | `{ "error": "Trip base is not eligible for this date" }` |

**Catatan Penting:**
- Endpoint ini **idempoten** — memanggil berulang kali dengan baseId & serviceDate yang sama akan mengembalikan tripId yang sama
- Race-safe — jika dua request masuk bersamaan, hanya satu trip yang dibuat

### Cara Mengekstrak baseId

Dari response `/api/app/trips/search`, trip virtual punya format ID: `virtual-{baseId}`

Contoh:
- `tripId` dari search: `virtual-316a4a38-eb22-4ff7-b3c6-87ee4fe40bec`
- `baseId` untuk materialize: `316a4a38-eb22-4ff7-b3c6-87ee4fe40bec`

---

## 2. Alur Baru yang Direkomendasikan (Gateway → Terminal)

### Alur Saat Ini (Bermasalah)
```
User search → Gateway fetch trips → User klik trip virtual
→ Gateway fetch detail → 404 (belum dimaterialisasi)
→ Gateway fetch seatmap → 404
```

### Alur Baru (Dengan Materialisasi)
```
User search → Gateway fetch trips → User klik trip virtual
→ Gateway POST /api/app/trips/materialize (kirim baseId + serviceDate)
→ Dapat tripId real
→ Gateway GET /api/app/trips/{tripId} (detail)
→ Gateway GET /api/app/trips/{tripId}/seatmap (seatmap)
→ Tampilkan ke user
```

---

## 3. Requirement: Seatmap Caching di Gateway

### Alasan
- **Race condition:** Seatmap realtime bisa konflik dengan CSO di terminal yang sedang melakukan hold/booking secara langsung
- **Performa:** Setiap request seatmap dari TransityApp tidak perlu langsung menghantam terminal
- **Standar industri:** OTA (Traveloka, RedBus, dll) menggunakan cached seatmap

### Rekomendasi Implementasi

#### 3a. Cache Layer di Gateway
```
User request seatmap
→ Cek cache (Redis/in-memory)
  → HIT: Return cached seatmap
  → MISS: Fetch dari terminal → Simpan di cache → Return
```

#### 3b. TTL (Time-To-Live) yang Disarankan
| Data | TTL | Alasan |
|------|-----|--------|
| Seatmap | 30–60 detik | Cukup fresh tapi tidak membebani terminal |
| Trip list/search | 60–120 detik | Jadwal jarang berubah dalam hitungan detik |
| Cities / Service Lines | 5–10 menit | Data master, sangat jarang berubah |
| Operator info | 10–30 menit | Hampir tidak pernah berubah |

#### 3c. Cache Invalidation Saat Booking
Setelah gateway berhasil membuat booking (`POST /api/app/bookings`), **invalidate cache seatmap** untuk trip tersebut agar user lain yang search selanjutnya melihat data terbaru.

```
User booking berhasil
→ Invalidate cache key: seatmap:{operatorSlug}:{tripId}
→ Request seatmap berikutnya akan fetch fresh dari terminal
```

#### 3d. Handling Stale Data Saat Booking
Karena seatmap di-cache, ada kemungkinan user memilih kursi yang sudah diambil CSO di terminal. Terminal akan menolak booking dengan error seat-unavailable. Gateway harus:

1. Tangkap error dari terminal
2. Invalidate cache seatmap
3. Return error yang jelas ke TransityApp: `"Kursi {seatNo} sudah tidak tersedia. Silakan pilih kursi lain."`
4. TransityApp otomatis refresh seatmap

---

## 4. Ringkasan Perubahan yang Diperlukan

### TransityConsole (Gateway)
| No | Perubahan | Prioritas |
|----|-----------|-----------|
| 1 | Panggil `POST /api/app/trips/materialize` saat user klik trip virtual, sebelum fetch detail/seatmap | **Tinggi** |
| 2 | Gunakan `tripId` real (dari response materialize) untuk semua request berikutnya (detail, seatmap, booking) | **Tinggi** |
| 3 | Implementasi cache layer untuk seatmap (TTL 30-60 detik) | **Sedang** |
| 4 | Invalidate seatmap cache setelah booking berhasil | **Sedang** |
| 5 | Handle error seat-unavailable dari terminal → invalidate cache → return pesan jelas | **Sedang** |
| 6 | Cache data jarang berubah (cities, service-lines, operator-info) dengan TTL lebih panjang | **Rendah** |

### TransityApp (Consumer)
| No | Perubahan | Prioritas |
|----|-----------|-----------|
| 1 | Handle error "kursi tidak tersedia" → auto-refresh seatmap | **Sedang** |
| 2 | Jangan gunakan WebSocket untuk seatmap update — gunakan polling/refresh manual | **Rendah** |
| 3 | Tampilkan pesan informatif: "Ketersediaan kursi dapat berubah sewaktu-waktu" | **Rendah** |

### TransityTerminal (Sudah Selesai)
| No | Perubahan | Status |
|----|-----------|--------|
| 1 | Endpoint `POST /api/app/trips/materialize` dengan service key auth | ✅ Selesai |
