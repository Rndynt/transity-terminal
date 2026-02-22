# CSO UI/UX Analysis - TransityCore

**Analysis Date:** 2026-02-22
**Branch:** feature/cso-ui-redesign
**Status:** Analysis Complete

---

## RINGKASAN EKSEKUTIF

Analisis mendalam terhadap halaman CSO (Customer Service Officer) mengungkapkan **23 issue** yang terbagi menjadi:
- **7 Bug Kritis** - Menghambat workflow booking
- **8 Masalah UI/UX** - Mengurangi usability
- **8 Potensi Improvement** - Peluang peningkatan

---

## 1. MASALAH STEP & NAVIGASI

### 1.1 STEPPER TIDAK KONSISTEN

**Masalah:**
```tsx
// Step 1 & 2 digabung dalam TripSelector
// Step 3: Route (Origin/Destination selection)
// Step 4: Seats
// Step 5: Passengers
// Step 6: Payment
// Step 7: Print (hidden)

// TAPI di renderMiddleColumn():
if (state.currentStep <= 2) { ... }  // Kedua step tampil sama
```

**Dampak:**
- CSO bingung step mana yang sedang aktif
- Progress indicator tidak akurat
- Step 1 dan 2 sebenarnya adalah satu step yang sama

### 1.2 AUTO-NAVIGATION TIDAK KONSISTEN

**Masalah:**
```tsx
// Auto-navigation di beberapa tempat:
if (state.currentStep === 1) { nextStep(); }  // Di handleOutletSelect
if (state.currentStep === 2) { nextStep(); }  // Di handleTripSelect
setTimeout(() => nextStep(), 100);  // Di handleDestinationSelect (race condition!)
```

**Dampak:**
- Navigasi otomatis tanpa feedback visual
- `setTimeout` menunjukkan race condition
- CSO tidak memiliki kontrol penuh

### 1.3 TOMBOL NAVIGASI TERSEMBUNYI

**Masalah:**
- Di step 3 dan 4, tombol navigasi ada di dalam komponen anak
- Di step 5 dan 6, tombol navigasi tersembunyi dalam kondisi
- Tombol "Start Over" tidak jelas fungsinya

**Solusi:**
- Navigation bar tetap di footer
- Tombol Back/Continue selalu visible
- Progress bar yang jelas

---

## 2. MASALAH TAMPILAN TRIP

### 2.1 INFORMASI TRIP TIDAK LENGKAP

**Masalah:**
```tsx
// Trip card hanya menampilkan:
- Jam keberangkatan
- Jumlah kursi tersedia
- Badge Virtual/Real
- Nomor kendaraan

// TIDAK menampilkan:
- Estimasi waktu tiba (arrival time)
- Durasi perjalanan
- Harga tiket
- Rute lengkap dengan stop
```

**Dampak:**
- CSO harus memilih trip dulu untuk lihat detail
- Tidak bisa compare trip secara langsung

### 2.2 FORMAT WAKTU TIDAK KONSISTEN

**Masalah:**
```tsx
// Di TripSelector.tsx:
new Date(trip.departAtAtOutlet).toLocaleTimeString('id-ID', { 
  hour: '2-digit', 
  minute: '2-digit', 
  hour12: false, 
  timeZone: 'Asia/Jakarta' 
})
// Hasil: "08:00" - TANPA label WIB

// Di RouteTimeline.tsx:
date.toLocaleTimeString('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Jakarta'
})
// Hasil: "09:00" - TANPA label WIB
```

**Dampak:**
- CSO tidak tahu apakah waktu sudah benar
- Potensi kebingungan dengan zona waktu berbeda

### 2.3 VIRTUAL TRIP TIDAK JELAS

**Masalah:**
- Badge "Virtual" tidak dijelaskan artinya
- Tidak ada indikasi bahwa trip akan di-materialize
- Loading state saat materialize tidak jelas

---

## 3. MASALAH ROUTE SELECTION

### 3.1 TIMELINE TIDAK INFORMATIF

**Masalah:**
```tsx
// RouteTimeline menampilkan:
- Nama stop
- Kode stop
- Tombol Origin/Destination

// TIDAK menampilkan:
- Waktu kedatangan di setiap stop
- Durasi perjalanan antar stop
- Jarak tempuh
- Harga per segmen
```

### 3.2 PICKUP-ONLY TIDAK JELAS

**Masalah:**
```tsx
// Tombol disabled untuk pickup-only:
<Button disabled={!canBoard} ...>Origin</Button>

// TAPI tidak ada penjelasan visual kenapa disabled
// Hanya ada tooltip kecil: "No pickup at this stop"
```

**Dampak:**
- CSO harus hover untuk tahu kenapa tombol disabled
- Tidak ada indikasi visual langsung

### 3.3 DURASI TIDAK DIHITUNG

**Masalah:**
```tsx
// Journey Summary:
<span className="ml-2">Est. 2h 0m</span>  // HARDCODED!

// Seharusnya dihitung dari:
arriveAt - departAt = duration
```

---

## 4. MASALAH INTERAKSI

### 4.1 DOUBLE SUBMISSION RISK

**Masalah:**
- Tombol select trip bisa diklik berkali-kali saat materialize
- Race condition antara `materializeMutation` dan `onTripSelect`

**Dampak:**
- Potensi double booking
- User experience buruk

### 4.2 FEEDBACK KURANG SAAT MEMILIH TRIP

**Masalah:**
- Saat memilih virtual trip, tidak ada loading indicator yang jelas
- `materializingBaseId` state hanya untuk loading button kecil
- Tidak ada progress feedback saat materialisasi

### 4.3 SEAT MAP TIDAK RESPONSIVE

**Masalah:**
- Grid kursi tidak menyesuaikan ukuran layar
- Di mobile, seat map bisa terpotong
- Tidak ada zoom capability

---

## 5. MASALAH STATE MANAGEMENT

### 5.1 STATE TIDAK SYNC ANTAR KOMPONEN

**Masalah:**
```tsx
// Di CsoPage.tsx
const [selectedCsoTrip, setSelectedCsoTrip] = useState<CsoAvailableTrip>();

// Di useBookingFlow.ts
const [state, setState] = useState<BookingFlowState>({...});
```

**Dampak:**
- `selectedCsoTrip` dan `state.trip` adalah dua state terpisah
- Potensi inkonsistensi data

### 5.2 TRIP CONVERSION LOSE DATA

**Masalah:**
```tsx
// handleTripSelect mengkonversi CsoAvailableTrip ke Trip:
const trip: Trip = {
  id: csoTrip.tripId || '',
  patternId: '',           // HILANG!
  vehicleId: '',          // HILANG!
  serviceDate: new Date().toISOString().split('T')[0], // BISA SALAH!
  capacity: csoTrip.capacity || 0,
  // ... data lain hilang
};
```

**Dampak:**
- Informasi penting hilang saat konversi
- Perlu API call tambahan untuk dapat data lengkap

---

## 6. MASALAH MINOR

### 6.1 DEFAULT DATE TIDAK FLEKSIBEL

**Masalah:**
```tsx
const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
```

**Dampak:**
- Selalu menampilkan hari ini
- Tidak bisa booking untuk hari lain tanpa ganti tanggal

### 6.2 SEAT HOLD TIDAK OTOMATIS RELEASE

**Masalah:**
- Saat CSO kembali ke step sebelumnya, seat hold tidak dilepas
- Perlu manual cleanup dengan `releaseAllHolds()`

---

## 7. REKOMENDASI PERBAIKAN

### 7.1 REDESIGN FLOW (PRIORITY: HIGH)

**Solusi:**
1. Gabungkan Step 1 & 2 menjadi satu step "Trip Selection"
2. Step baru:
   - **Step 1:** Trip Selection (Outlet + Date + Trip)
   - **Step 2:** Route & Seats (Origin, Destination, Seats)
   - **Step 3:** Passengers
   - **Step 4:** Payment & Print

3. Navigation bar tetap di footer dengan tombol Back/Continue yang jelas
4. Progress bar yang akurat

### 7.2 PERBAIKAN TAMPILAN (PRIORITY: HIGH)

**1. Trip Card yang Informatif:**
```
┌─────────────────────────────────────┐
│ 08:00 WIB                           │
│ Jakarta → Bandung via Purwakarta    │
│ ────────────────────────────────── │
│ Durasi: 2h 0m    Est. Tiba: 10:00   │
│ Kursi: 8/12      Rp 50.000          │
│ [Virtual] [BUS-A]                   │
└─────────────────────────────────────┘
```

**2. Waktu dengan Label WIB:**
```tsx
// Sebelum: "08:00"
// Sesudah: "08:00 WIB"
```

**3. Route Timeline dengan Waktu:**
```
Jakarta (JKT)      08:00 WIB    [Origin]
    │    60 menit
Purwakarta (PWK)   09:00 WIB    [Pickup Only]
    │    60 menit
Bandung (BDG)      10:00 WIB    [Destination]
```

### 7.3 PERBAIKAN INTERAKSI (PRIORITY: MEDIUM)

**1. Loading States:**
- Skeleton loading untuk trip list
- Progress indicator saat materialize
- Optimistic UI updates

**2. Seat Map Improvement:**
- Responsive grid dengan max-width
- Zoom capability untuk mobile
- Legend yang lebih jelas

**3. Route Selection:**
- Visual timeline yang jelas
- Animasi saat memilih
- Badge untuk pickup-only/drop-only

### 7.4 PERBAIKAN DATA (PRIORITY: MEDIUM)

**1. State Unification:**
```tsx
// Single source of truth
interface BookingFlowState {
  outlet?: Outlet;
  csoTrip?: CsoAvailableTrip;  // Simpan seluruh data, jangan convert
  originStop?: Stop;
  destinationStop?: Stop;
  // ...
}
```

**2. Preserve CsoAvailableTrip Data:**
- Jangan convert ke Trip type yang kehilangan data
- Simpan seluruh data di state

---

## 8. IMPLEMENTATION PLAN

### Phase 1: Critical Fixes (Week 1)
- [ ] Fix stepper inconsistency
- [ ] Add price display to trip selection
- [ ] Add duration calculation to RouteTimeline
- [ ] Add WIB label to all time displays
- [ ] Fix double submission on materialize

### Phase 2: UI Improvements (Week 2)
- [ ] Redesign trip card with complete info
- [ ] Improve route timeline visualization
- [ ] Add loading skeletons
- [ ] Fix responsive issues

### Phase 3: Flow Optimization (Week 3)
- [ ] Consolidate steps (1 & 2 merge)
- [ ] Add clear navigation buttons
- [ ] Improve seat selection UX
- [ ] Add confirmation dialogs

### Phase 4: Polish (Week 4)
- [ ] Add animations
- [ ] Improve accessibility
- [ ] Add keyboard shortcuts
- [ ] Performance optimization

---

## 9. WIREFRAME KONSEP (3-KOLOM)

```
┌──────────────────────────────────────────────────────────────────────┐
│  PROGRESS: [1. Trip] → [2. Route & Seats] → [3. Passengers] → [4. Pay]  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────┬──────────────────┬──────────────────┐
│   TRIP SELECTION │  ROUTE & SEATS   │  BOOKING SUMMARY │
├──────────────────┼──────────────────┼──────────────────┤
│                  │                  │                  │
│  ┌────────────┐  │  Timeline:       │  Outlet:         │
│  │ Outlet ▼   │  │  JKT ───┐        │  Jakarta Terminal│
│  └────────────┘  │  08:00  │        │                  │
│                  │         │        │  Trip:           │
│  ┌────────────┐  │  PWK    │ 09:00  │  JKT→BDG 08:00   │
│  │ 22 Feb ▼  │  │  │      │ pickup │  Durasi: 2h      │
│  └────────────┘  │  └───┐  │ only   │                  │
│                  │      │  │        │  Route:          │
│  ──────────────  │  BDG ─┘  10:00   │  Jakarta→Bandung │
│  Available:      │                  │                  │
│                  │  ──────────────  │  Seats: 1A, 1B   │
│  ┌────────────┐  │  [Seat Map]      │                  │
│  │ 08:00 WIB  │  │  □ Avail  █ Sold │  ──────────────  │
│  │ JKT→BDG    │  │  ▣ Held   ▣ Book │  Subtotal:       │
│  │ 2h 0m      │  │                  │  Rp 100.000      │
│  │ Rp 50.000  │  │  Selected: 1A,1B │                  │
│  │ ▣ Virtual  │  │                  │  ──────────────  │
│  │ 8/12 seats │  │  ──────────────  │  [Continue →]    │
│  └────────────┘  │  [← Back] [Next→]│                  │
│                  │                  │                  │
└──────────────────┴──────────────────┴──────────────────┘
```

---

## 10. KESIMPULAN

Halaman CSO memiliki **potensi besar** untuk ditingkatkan dengan:

1. **Konsolidasi step** - Gabungkan step 1 & 2
2. **Informasi lengkap** - Tambahkan durasi, harga, estimasi tiba
3. **Visual feedback** - Loading states, progress indicator
4. **Responsive design** - Seat map yang adaptif
5. **State management** - Single source of truth

**Prioritas utama** adalah memperbaiki:
1. Stepper yang tidak konsisten
2. Tampilan waktu tanpa label WIB
3. Informasi trip yang tidak lengkap
4. Durasi yang di-hardcode
