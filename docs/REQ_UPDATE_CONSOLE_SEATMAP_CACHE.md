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

## 4. Requirement: Error Translation di Gateway

### Prinsip Utama
Error teknis dari terminal **tidak boleh diteruskan langsung** ke TransityApp. User TransityApp adalah pelanggan/penumpang biasa yang tidak mengerti istilah teknis. Gateway (TransityConsole) bertanggung jawab menerjemahkan semua error ke bahasa yang ramah pelanggan.

### Contoh Error dari Terminal & Terjemahan yang Diharapkan

| Error Teknis dari Terminal | Pesan untuk TransityApp |
|---------------------------|------------------------|
| `Trip base with id ... not found` | `"Perjalanan tidak ditemukan. Silakan cari ulang."` |
| `Trip base is not eligible for this date` | `"Jadwal tidak tersedia untuk tanggal ini. Silakan pilih tanggal lain."` |
| `Missing X-Service-Key header` | `"Terjadi gangguan koneksi. Silakan coba lagi."` |
| `Invalid service key` | `"Terjadi gangguan koneksi. Silakan coba lagi."` |
| `Seat ... is not available` | `"Kursi {seatNo} sudah tidak tersedia. Silakan pilih kursi lain."` |
| `No suitable vehicle found` | `"Perjalanan ini sedang dalam persiapan. Silakan coba beberapa saat lagi."` |
| `TRIP_HAS_ACTIVE_BOOKINGS` | `"Perjalanan ini tidak bisa dibatalkan karena sudah ada pemesanan aktif."` |
| `unique constraint violation` / `duplicate` | `"Pemesanan sedang diproses. Silakan tunggu sebentar."` |
| `The operation was aborted due to timeout` | `"Server sedang sibuk. Silakan coba beberapa saat lagi."` |
| `ECONNREFUSED` / `ECONNRESET` / network error | `"Layanan operator sedang tidak tersedia. Silakan coba lagi nanti."` |
| HTTP 500 / Internal Server Error | `"Terjadi kesalahan sistem. Silakan coba lagi nanti."` |
| HTTP 429 / Rate Limit | `"Terlalu banyak permintaan. Silakan tunggu sebentar."` |

### Panduan Implementasi

#### 4a. Error Mapping Layer di Gateway
Buat middleware/helper di gateway yang menangkap semua error dari terminal dan menerjemahkannya:

```
Terminal response error
→ Log error teknis lengkap di server gateway (untuk debugging)
→ Map ke pesan user-friendly berdasarkan error code/message
→ Return pesan terjemahan ke TransityApp
```

#### 4b. Kategori Error & Handling

| Kategori | Contoh | Aksi Gateway | Pesan ke User |
|----------|--------|-------------|---------------|
| **Not Found** (404) | Trip/seatmap tidak ada | Log + return pesan ramah | "... tidak ditemukan. Silakan cari ulang." |
| **Validation** (400/422) | Tanggal salah, base tidak eligible | Log + return pesan spesifik | "Jadwal tidak tersedia untuk tanggal ini." |
| **Conflict** (409) | Duplikat booking, kursi diambil | Log + invalidate cache | "Kursi sudah tidak tersedia." |
| **Auth** (401) | Service key salah | Log + alert admin | "Terjadi gangguan koneksi." |
| **Server Error** (500) | Bug di terminal | Log + alert admin | "Terjadi kesalahan sistem. Coba lagi nanti." |
| **Timeout/Network** | Terminal tidak merespons | Log + retry 1x, lalu return | "Layanan sedang sibuk. Coba lagi nanti." |

#### 4c. Aturan Penting
1. **Jangan pernah tampilkan UUID, nama tabel, atau stack trace** ke user
2. **Jangan tampilkan nama field teknis** (baseId, tripId, patternId) — gunakan istilah umum (perjalanan, jadwal, kursi)
3. **Bahasa Indonesia** — semua pesan error ke TransityApp harus dalam Bahasa Indonesia
4. **Log tetap teknis** — error asli dari terminal tetap di-log lengkap di server gateway untuk keperluan debugging
5. **Konsisten** — gunakan nada yang sama di semua pesan (sopan, informatif, ada saran aksi)

---

## 5. Ringkasan Perubahan yang Diperlukan

### TransityConsole (Gateway)
| No | Perubahan | Prioritas |
|----|-----------|-----------|
| 1 | Panggil `POST /api/app/trips/materialize` saat user klik trip virtual, sebelum fetch detail/seatmap | **Tinggi** |
| 2 | Gunakan `tripId` real (dari response materialize) untuk semua request berikutnya (detail, seatmap, booking) | **Tinggi** |
| 3 | Error translation layer — semua error teknis dari terminal diterjemahkan ke bahasa pelanggan (lihat bagian 4) | **Tinggi** |
| 4 | Implementasi cache layer untuk seatmap (TTL 30-60 detik) | **Sedang** |
| 5 | Invalidate seatmap cache setelah booking berhasil | **Sedang** |
| 6 | Handle error seat-unavailable dari terminal → invalidate cache → return pesan jelas | **Sedang** |
| 7 | Cache data jarang berubah (cities, service-lines, operator-info) dengan TTL lebih panjang | **Rendah** |

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
