import { db } from "@server/db";
import { webSocketService } from "@server/realtime/ws";
import { 
  appUsers, reviews, bookings, payments, trips, tripPatterns, 
  tripStopTimes, stops, patternStops, vehicles, cargoShipments, cargoTypes,
  seatInventory, tripLegs, seatHolds, tripBases, scheduleExceptions,
  operatorSettings, vouchers, promotions, passengers, bookingPromoApplications,
  type AppUser, type InsertAppUser, type Review, type InsertReview
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte, inArray, gt, isNull, not } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken, type AppUserPayload } from "./app.auth";
import { IStorage } from "@server/storage.interface";
import { fromZonedHHMMToUtc } from "@server/utils/timezone";
import {
  computeLegIndexes,
  calculateBookingTotal,
  fetchBookingSnapshots,
  insertPassengerRows,
  validateBoardingAlighting,
  checkSeatsAvailable,
  createSeatHoldsForBooking,
  generateBookingCode,
} from "@modules/bookings/booking.helpers";
import { HoldsAdapter, isEngineEnabled } from "@modules/holds/holdsAdapter";
import { AtomicHoldService } from "@modules/bookings/atomicHold.service";
import { createComponentLogger } from "@server/lib/logger";

const log = createComponentLogger("app.service");

interface OperatorSummary {
  id: string;
  code: string;
  name: string;
  vehicleClass: string | null;
  active: boolean | null;
}

interface TripStopPoint {
  stopId: string;
  name: string;
  code: string;
  sequence: number;
  departAt: string | null;
  arriveAt: string | null;
}

interface TripStopPointWithCity extends TripStopPoint {
  city?: string;
  canPickup?: boolean;
  canDrop?: boolean;
}

interface AppliedPromoSummary {
  code: string;
  name: string;
  type: 'percentage' | 'fixed';
  discountValue: number;
  source: 'auto';
  stackable: boolean;
}

interface TripSearchResult {
  tripId: string;
  serviceDate: string;
  patternCode: string;
  patternName: string;
  vehicleCode: string | null;
  vehicleClass: string | null;
  operatorName: string;
  operatorLogo: string | null;
  origin: TripStopPoint;
  destination: TripStopPoint;
  availableSeats: number;
  /** Harga asli per orang (sebelum diskon promo). Backward-compat field. */
  farePerPerson: number;
  /** Harga asli per orang — alias eksplisit utk farePerPerson. */
  originalFarePerPerson: number;
  /** Diskon per orang dari auto-promo terbaik untuk konteks request. 0 jika tidak ada. */
  discountPerPerson: number;
  /** Harga final per orang setelah diskon (= originalFarePerPerson - discountPerPerson). */
  discountedFarePerPerson: number;
  /** Detail promo yang diaplikasikan; null jika tidak ada promo otomatis yang cocok. */
  appliedPromo: AppliedPromoSummary | null;
  stops: TripStopPointWithCity[];
  isVirtual?: boolean;
}

interface UserBookingSummary {
  id: string;
  tripId: string;
  serviceDate: string | null;
  patternCode: string;
  patternName: string;
  originStopId: string | null;
  destinationStopId: string | null;
  originSeq: number | null;
  destinationSeq: number | null;
  status: string | null;
  totalAmount: string | null;
  channel: string | null;
  createdAt: Date | null;
}

interface TripReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date | null;
  userName: string;
  userAvatar: string | null;
}

interface StopInfo {
  stopId: string;
  name: string;
  code: string;
  city: string | null;
}

interface QrDataItem {
  passengerId: string;
  seatNo: string;
  fullName: string;
  qrToken: string;
  qrPayload: string;
}

interface PassengerInfo {
  id: string;
  fullName: string;
  phone: string | null;
  seatNo: string;
  fareAmount: string | null;
}

interface PaymentInfo {
  id: string;
  method: string;
  amount: string | null;
  status: string | null;
  paidAt: Date | null;
}

interface PaymentIntentInfo {
  paymentId: string;
  method: string;
  amount: string | null;
  status: string | null;
  providerRef: string | null;
  expiresAt: string | null;
}

interface BookingDetailResponse {
  id: string;
  bookingCode: string | null;
  tripId: string;
  serviceDate: string | null | undefined;
  patternCode: string | null | undefined;
  patternName: string | null | undefined;
  origin: StopInfo | null;
  destination: StopInfo | null;
  departAt: string | null;
  arriveAt: string | null;
  status: string | null;
  totalAmount: string | null;
  channel: string | null;
  createdBy: string | null;
  salesChannelCode: string | null;
  salesChannelName: string | null;
  holdExpiresAt: string | null;
  qrData: QrDataItem[];
  passengers: PassengerInfo[];
  payments: PaymentInfo[];
  paymentIntent: PaymentIntentInfo | null;
  createdAt: Date | null;
}

interface SeatAvailability {
  total: number;
  sold: number;
  available: number;
}

interface TripDetailResponse {
  tripId: string;
  serviceDate: string | null;
  patternCode: string | null | undefined;
  patternName: string | null | undefined;
  vehicleClass: string | null | undefined;
  operatorName: string | null | undefined;
  operatorLogo: string | null;
  capacity: number | null;
  status: string | null;
  seatAvailability: SeatAvailability;
  stops: Array<{
    stopId: string;
    name: string;
    code: string;
    city: string | null;
    sequence: number;
    arriveAt: string | null;
    departAt: string | null;
    boardingAllowed: boolean;
    alightingAllowed: boolean;
  }>;
  reviews: { count: number; avgRating: number };
}

interface PaymentStatusResponse {
  bookingId: string;
  bookingStatus: string | null;
  paymentId: string;
  paymentStatus: string | null;
  method: string;
  amount: string | null;
  providerRef: string | null;
}

interface WebhookResult {
  status: 'success' | 'failed';
  bookingId: string;
  // S2-09: di-set true kalau webhook re-delivered (replay-safe response).
  idempotent?: boolean;
}

/**
 * Shape of one element in `trip_bases.default_stop_times` (jsonb).
 * Mirrors the editor-side `DefaultStopTime` in `TripBaseFormDialog.tsx`
 * and the identically-named type in `scheduling.repository.ts`.
 */
interface DefaultStopTime {
  stopSequence: number;
  stopName?: string;
  stopCode?: string;
  arriveAt?: string | null;
  departAt?: string | null;
}

/**
 * Shape of `price_rules.rule` jsonb payload that the app currently
 * honours. Extra keys are ignored so downstream consumers stay
 * forward-compatible with richer rule shapes.
 */
interface PriceRuleData {
  basePricePerLeg?: number;
  multiplier?: number;
  pricingMode?: 'flat' | 'per_leg' | string;
}

/**
 * Summary row returned by `getUserBookings` / `getBookingsByIds` /
 * `listBookings`. The drizzle select projects the listed columns;
 * `holdExpiresAt` + `finalAmount` + optional origin/destination/
 * passengerCount are decorations computed per-row.
 */
interface BookingListItem {
  id: string;
  tripId: string;
  serviceDate: string | null;
  patternCode?: string | null;
  patternName?: string | null;
  originStopId: string | null;
  destinationStopId: string | null;
  originSeq?: number | null;
  destinationSeq?: number | null;
  status: string | null;
  totalAmount: string | null;
  discountAmount: string | null;
  channel: string | null;
  pendingExpiresAt: Date | null;
  createdAt: Date | null;
  bookingCode?: string | null;
  voucherCode?: string | null;
  snapOriginStopName?: string | null;
  snapDestinationStopName?: string | null;
  origin?: { name: string; code: string; city: string | null } | null;
  destination?: { name: string; code: string; city: string | null } | null;
  passengerCount?: number;
  holdExpiresAt: string | null;
  finalAmount: string;
}

export class AppService {
  constructor(private storage: IStorage) {}

  /**
   * Lazily-constructed HoldsAdapter used by the B2C / OTA / WEB seat
   * flows. Each call site guards on `isEngineEnabled()` first so this
   * is effectively dead code when the flag is off; constructing the
   * adapter is cheap though (just wires the Node atomic-hold fallback)
   * so we don't bother with caching.
   */
  private holdsAdapter(): HoldsAdapter {
    return new HoldsAdapter(new AtomicHoldService(this.storage));
  }

  /**
   * B2C convention for engine operator_id. Matches `createdBy` semantics
   * so confirmForBooking's operator-ownership check resolves correctly:
   *   - APP / WEB with login user: "app:<userId>"
   *   - OTA (service-to-service):  "OTA:<salesChannelCode|unknown>"
   *   - Anything else:             "service-client"
   */
  private engineOperatorId(
    userId: string | null,
    channel: string | null,
    salesChannelCode: string | null | undefined,
  ): string {
    if (userId) return `app:${userId}`;
    if (channel === "OTA") return `OTA:${salesChannelCode ?? "unknown"}`;
    return "service-client";
  }

  async register(email: string, password: string, name: string, phone?: string): Promise<{ user: Omit<AppUser, "passwordHash">; token: string }> {
    const existing = await db.select().from(appUsers).where(eq(appUsers.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      throw new Error("Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(appUsers).values({
      email: email.toLowerCase(),
      passwordHash,
      name,
      phone
    }).returning();

    const token = signToken({ userId: user.id, email: user.email });
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  async login(email: string, password: string): Promise<{ user: Omit<AppUser, "passwordHash">; token: string }> {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.email, email.toLowerCase())).limit(1);
    if (!user) {
      throw new Error("Invalid email or password");
    }

    if (!user.isActive) {
      throw new Error("Account is deactivated");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error("Invalid email or password");
    }

    const token = signToken({ userId: user.id, email: user.email });
    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser, token };
  }

  async getProfile(userId: string): Promise<Omit<AppUser, "passwordHash">> {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.id, userId)).limit(1);
    if (!user) throw new Error("User not found");
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string; avatar?: string }): Promise<Omit<AppUser, "passwordHash">> {
    const updates: Partial<Pick<AppUser, 'name' | 'phone' | 'avatar'>> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.avatar !== undefined) updates.avatar = data.avatar;

    const [user] = await db.update(appUsers).set(updates).where(eq(appUsers.id, userId)).returning();
    if (!user) throw new Error("User not found");
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async getServiceLines(): Promise<OperatorSummary[]> {
    const result = await db.select({
      id: tripPatterns.id,
      code: tripPatterns.code,
      name: tripPatterns.name,
      vehicleClass: tripPatterns.vehicleClass,
      active: tripPatterns.active,
    })
    .from(tripPatterns)
    .where(and(eq(tripPatterns.active, true), isNull(tripPatterns.deletedAt)))
    .orderBy(tripPatterns.name);

    return result;
  }

  async getCities(): Promise<{ city: string; stopCount: number }[]> {
    const result = await db.execute(sql`
      SELECT city, COUNT(*)::int as stop_count
      FROM stops
      WHERE city IS NOT NULL AND city != '' AND deleted_at IS NULL
      GROUP BY city
      ORDER BY city
    `);
    return result.rows.map((r: Record<string, unknown>) => ({ city: r.city as string, stopCount: r.stop_count as number }));
  }

  async getOperatorInfo(): Promise<{
    tenantId: string;
    brandName: string | null;
    tagline: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accentColor: string | null;
  }> {
    const rows = await db.select({
      brandName: operatorSettings.brandName,
      tagline: operatorSettings.tagline,
      logoUrl: operatorSettings.logoUrl,
      primaryColor: operatorSettings.primaryColor,
      secondaryColor: operatorSettings.secondaryColor,
      accentColor: operatorSettings.accentColor,
    }).from(operatorSettings).limit(1);

    const settings = rows[0] ?? null;
    return {
      tenantId: process.env.REALMIO_TENANT_ID || 'transity',
      brandName: settings?.brandName ?? null,
      tagline: settings?.tagline ?? null,
      logoUrl: settings?.logoUrl ?? null,
      primaryColor: settings?.primaryColor ?? null,
      secondaryColor: settings?.secondaryColor ?? null,
      accentColor: settings?.accentColor ?? null,
    };
  }

  async searchTrips(params: {
    originCity: string;
    destinationCity: string;
    date: string;
    passengers?: number;
    page?: number;
    limit?: number;
    channel?: string;
    salesChannelCode?: string;
  }): Promise<{
    data: TripSearchResult[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 20));

    const [originStops, destStops] = await Promise.all([
      db.select({ id: stops.id, name: stops.name, code: stops.code, city: stops.city })
        .from(stops)
        .where(and(eq(stops.city, params.originCity), isNull(stops.deletedAt))),
      db.select({ id: stops.id, name: stops.name, code: stops.code, city: stops.city })
        .from(stops)
        .where(and(eq(stops.city, params.destinationCity), isNull(stops.deletedAt)))
    ]);

    if (originStops.length === 0 || destStops.length === 0) {
      return { data: [], total: 0, page, limit, hasMore: false };
    }

    const originStopIds = originStops.map(s => s.id);
    const destStopIds = destStops.map(s => s.id);

    const [realTrips, virtualTrips] = await Promise.all([
      this.searchRealTrips(params, originStopIds, destStopIds),
      this.searchVirtualTrips(params, originStopIds, destStopIds),
    ]);

    const realBaseIds = new Set(
      realTrips.map(t => t._baseId).filter(Boolean)
    );
    const filteredVirtual = virtualTrips.filter(v => !realBaseIds.has(v._baseId));

    const now = new Date();
    const all = [...realTrips, ...filteredVirtual]
      .filter(t => {
        if (!t.origin?.departAt) return true;
        return new Date(t.origin.departAt).getTime() > now.getTime();
      })
      .sort((a, b) => {
        const aTime = a.origin?.departAt ? new Date(a.origin.departAt).getTime() : 0;
        const bTime = b.origin?.departAt ? new Date(b.origin.departAt).getTime() : 0;
        return aTime - bTime;
      })
      .map(({ _baseId, ...rest }) => rest);

    const total = all.length;
    const offset = (page - 1) * limit;
    const pageSlice = all.slice(offset, offset + limit);

    // Hitung auto-promo per trip pada slice yang ditampilkan saja (efisien).
    // Konteks promo: channel (OTA/APP), patternId (perlu lookup), departureDate.
    const data = await this.enrichTripsWithPromo(pageSlice, {
      channel: params.channel,
      salesChannelCode: params.salesChannelCode,
    });

    return { data, total, page, limit, hasMore: offset + data.length < total };
  }

  private async enrichTripsWithPromo(
    list: TripSearchResult[],
    ctx: { channel?: string; salesChannelCode?: string }
  ): Promise<TripSearchResult[]> {
    if (list.length === 0) return list;
    const { PromosService } = await import('@modules/promos/promos.service');
    const promosService = new PromosService(this.storage);

    // patternId per trip — virtual sudah punya patternCode tapi tidak patternId; ambil dari DB.
    // Untuk performa, batch lookup pattern by code utk virtual trips.
    const virtualPatternCodes = Array.from(new Set(
      list.filter(t => t.isVirtual).map(t => t.patternCode).filter(Boolean)
    ));
    const realTripIds = list.filter(t => !t.isVirtual).map(t => t.tripId);

    let realTripPatternMap = new Map<string, string>();
    if (realTripIds.length > 0) {
      const rows = await db.select({ id: trips.id, patternId: trips.patternId })
        .from(trips).where(inArray(trips.id, realTripIds));
      for (const r of rows) realTripPatternMap.set(r.id, r.patternId);
    }
    let virtualPatternIdMap = new Map<string, string>();
    if (virtualPatternCodes.length > 0) {
      const rows = await db.select({ id: tripPatterns.id, code: tripPatterns.code })
        .from(tripPatterns).where(inArray(tripPatterns.code, virtualPatternCodes));
      for (const r of rows) virtualPatternIdMap.set(r.code, r.id);
    }

    return Promise.all(list.map(async (trip) => {
      const original = trip.farePerPerson;
      const patternId = trip.isVirtual
        ? virtualPatternIdMap.get(trip.patternCode)
        : realTripPatternMap.get(trip.tripId);

      let appliedPromo: AppliedPromoSummary | null = null;
      let discount = 0;
      if (original > 0) {
        try {
          const best = await promosService.findBestAutoApplicablePromo(original, {
            channel: ctx.channel,
            tripId: trip.isVirtual ? undefined : trip.tripId,
            patternId,
            salesChannelCode: ctx.salesChannelCode,
            departureDate: trip.serviceDate,
          });
          if (best) {
            discount = best.discountAmount;
            appliedPromo = {
              code: best.promotion.code,
              name: best.promotion.name,
              type: best.promotion.type as 'percentage' | 'fixed',
              discountValue: Number(best.promotion.discountValue),
              source: 'auto',
              stackable: !!best.promotion.stackable,
            };
          }
        } catch (err) {
          log.warn({ err, tripId: trip.tripId, op: "searchTrips" }, "promo lookup failed for trip");
        }
      }

      return {
        ...trip,
        originalFarePerPerson: original,
        discountPerPerson: discount,
        discountedFarePerPerson: Math.max(0, original - discount),
        appliedPromo,
      };
    }));
  }

  private async searchRealTrips(
    params: { originCity: string; destinationCity: string; date: string; passengers?: number },
    originStopIds: string[],
    destStopIds: string[]
  ): Promise<(TripSearchResult & { _baseId?: string })[]> {
    const result = await db.select({
      tripId: trips.id,
      baseId: trips.baseId,
      serviceDate: trips.serviceDate,
      patternId: trips.patternId,
      patternCode: tripPatterns.code,
      patternName: tripPatterns.name,
      vehicleClass: tripPatterns.vehicleClass,
      vehicleCode: vehicles.code,
      capacity: trips.capacity,
      status: trips.status,
    })
    .from(trips)
    .innerJoin(tripPatterns, eq(trips.patternId, tripPatterns.id))
    .leftJoin(vehicles, eq(trips.vehicleId, vehicles.id))
    .where(
      and(
        eq(trips.serviceDate, params.date),
        eq(trips.status, 'scheduled'),
        isNull(trips.deletedAt),
        sql`EXISTS (
          SELECT 1 FROM ${tripStopTimes} tst1
          INNER JOIN ${tripStopTimes} tst2 ON tst2.trip_id = tst1.trip_id
          WHERE tst1.trip_id = ${trips.id}
          AND tst1.stop_id IN (${sql.join(originStopIds.map(id => sql`${id}`), sql`, `)})
          AND tst2.stop_id IN (${sql.join(destStopIds.map(id => sql`${id}`), sql`, `)})
          AND tst1.stop_sequence < tst2.stop_sequence
        )`
      )
    );

    if (result.length === 0) return [];

    const tripIds = result.map(t => t.tripId);

    const allStopTimes = await db.select({
      tripId: tripStopTimes.tripId,
      stopId: tripStopTimes.stopId,
      stopSequence: tripStopTimes.stopSequence,
      arriveAt: tripStopTimes.arriveAt,
      departAt: tripStopTimes.departAt,
      boardingAllowed: tripStopTimes.boardingAllowed,
      alightingAllowed: tripStopTimes.alightingAllowed,
      stopName: stops.name,
      stopCode: stops.code,
      stopCity: stops.city,
    })
    .from(tripStopTimes)
    .innerJoin(stops, eq(tripStopTimes.stopId, stops.id))
    .where(inArray(tripStopTimes.tripId, tripIds))
    .orderBy(tripStopTimes.stopSequence);

    const stopTimesByTrip = new Map<string, typeof allStopTimes>();
    for (const st of allStopTimes) {
      const list = stopTimesByTrip.get(st.tripId) || [];
      list.push(st);
      stopTimesByTrip.set(st.tripId, list);
    }

    const allInventory = await db.select()
      .from(seatInventory)
      .where(inArray(seatInventory.tripId, tripIds));

    const inventoryByTrip = new Map<string, typeof allInventory>();
    for (const row of allInventory) {
      const list = inventoryByTrip.get(row.tripId) || [];
      list.push(row);
      inventoryByTrip.set(row.tripId, list);
    }

    const enrichedWithFares = await Promise.all(result.map(async (trip) => {
      const stopTimesForTrip = stopTimesByTrip.get(trip.tripId) || [];

      const originST = stopTimesForTrip.find(st => originStopIds.includes(st.stopId));
      const destSTList = stopTimesForTrip.filter(st => destStopIds.includes(st.stopId) && st.stopSequence > (originST?.stopSequence ?? 0));
      const destST = destSTList.length > 0 ? destSTList[destSTList.length - 1] : null;

      if (!originST || !destST) return null;

      const tripInventory = inventoryByTrip.get(trip.tripId) || [];
      const legIndexes: number[] = [];
      for (let i = originST.stopSequence; i < destST.stopSequence; i++) legIndexes.push(i);
      const relevantInv = tripInventory.filter(r => legIndexes.includes(r.legIndex));
      const seatMap = new Map<string, boolean>();
      for (const row of relevantInv) {
        if (row.booked || row.holdRef) {
          seatMap.set(row.seatNo, false);
        } else if (!seatMap.has(row.seatNo)) {
          seatMap.set(row.seatNo, true);
        }
      }
      const availableSeats = Array.from(seatMap.values()).filter(Boolean).length;

      const fareQuote = await this.getBaseFare(trip.tripId, originST.stopSequence, destST.stopSequence);

      return {
        _baseId: trip.baseId ?? undefined,
        tripId: trip.tripId,
        serviceDate: trip.serviceDate,
        patternCode: trip.patternCode,
        patternName: trip.patternName,
        vehicleCode: trip.vehicleCode,
        vehicleClass: trip.vehicleClass,
        operatorName: trip.patternName,
        operatorLogo: null,
        origin: { stopId: originST.stopId, name: originST.stopName, code: originST.stopCode, sequence: originST.stopSequence, departAt: originST.departAt },
        destination: { stopId: destST.stopId, name: destST.stopName, code: destST.stopCode, sequence: destST.stopSequence, arriveAt: destST.arriveAt },
        availableSeats,
        farePerPerson: fareQuote,
        originalFarePerPerson: fareQuote,
        discountPerPerson: 0,
        discountedFarePerPerson: fareQuote,
        appliedPromo: null,
        stops: stopTimesForTrip.map(st => ({
          stopId: st.stopId,
          name: st.stopName,
          code: st.stopCode,
          city: st.stopCity,
          sequence: st.stopSequence,
          arriveAt: st.arriveAt,
          departAt: st.departAt,
          canPickup: st.boardingAllowed !== false,
          canDrop: st.alightingAllowed !== false,
        }))
      };
    }));

    return enrichedWithFares.filter((t) => t !== null) as (TripSearchResult & { _baseId?: string })[];
  }

  private async searchVirtualTrips(
    params: { originCity: string; destinationCity: string; date: string; passengers?: number },
    originStopIds: string[],
    destStopIds: string[]
  ): Promise<(TripSearchResult & { _baseId?: string })[]> {
    const serviceDateObj = new Date(params.date);
    const dayOfWeek = serviceDateObj.getUTCDay();
    const dayColumns = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
    const dayCol = dayColumns[dayOfWeek];

    const allBases = await db.select({
      id: tripBases.id,
      patternId: tripBases.patternId,
      code: tripBases.code,
      capacity: tripBases.capacity,
      defaultStopTimes: tripBases.defaultStopTimes,
    })
    .from(tripBases)
    .where(
      and(
        eq(tripBases.active, true),
        isNull(tripBases.deletedAt),
        sql`${tripBases[dayCol]} = true`,
        sql`(${tripBases.validFrom} IS NULL OR ${tripBases.validFrom} <= ${params.date})`,
        sql`(${tripBases.validTo} IS NULL OR ${params.date} <= ${tripBases.validTo})`
      )
    );

    if (allBases.length === 0) return [];

    const exceptions = await db.select({ baseId: scheduleExceptions.baseId })
      .from(scheduleExceptions)
      .where(eq(scheduleExceptions.exceptionDate, params.date));
    const exceptedIds = new Set(exceptions.map(e => e.baseId));
    const bases = allBases.filter(b => !exceptedIds.has(b.id));
    if (bases.length === 0) return [];

    const uniquePatternIds = [...new Set(bases.map(b => b.patternId))];

    const [patterns, patternStopsRows] = await Promise.all([
      db.select().from(tripPatterns).where(inArray(tripPatterns.id, uniquePatternIds)),
      db.query.patternStops.findMany({
        where: and(inArray(patternStops.patternId, uniquePatternIds), isNull(patternStops.deletedAt)),
        orderBy: patternStops.stopSequence,
        with: { stop: true }
      }),
    ]);

    const patternsMap = new Map(patterns.map(p => [p.id, p]));
    const patternStopsMap = new Map<string, typeof patternStopsRows>();
    for (const ps of patternStopsRows) {
      const list = patternStopsMap.get(ps.patternId) || [];
      list.push(ps);
      patternStopsMap.set(ps.patternId, list);
    }

    const allPriceRulesResult = await db.execute(sql`
      SELECT DISTINCT ON (pattern_id) pattern_id, rule
      FROM price_rules
      WHERE pattern_id IN (${sql.join(uniquePatternIds.map(id => sql`${id}`), sql`, `)})
        AND trip_id IS NULL
        AND deleted_at IS NULL
      ORDER BY pattern_id, priority ASC
    `);
    const priceRulesByPattern = new Map<string, any>();
    for (const row of allPriceRulesResult.rows as Record<string, unknown>[]) {
      priceRulesByPattern.set(row.pattern_id as string, row.rule);
    }

    const results: (TripSearchResult & { _baseId?: string })[] = [];

    for (const base of bases) {
      const pattern = patternsMap.get(base.patternId);
      if (!pattern) continue;

      const pStops = patternStopsMap.get(base.patternId) || [];
      const defaultTimes = (base.defaultStopTimes as DefaultStopTime[] | null) || [];

      const hasOrigin = pStops.some(ps => originStopIds.includes(ps.stopId));
      const hasDestAfterOrigin = pStops.some(ps => {
        if (!destStopIds.includes(ps.stopId)) return false;
        const originSeq = pStops.find(o => originStopIds.includes(o.stopId))?.stopSequence ?? Infinity;
        return ps.stopSequence > originSeq;
      });
      if (!hasOrigin || !hasDestAfterOrigin) continue;

      const originPS = pStops.find(ps => originStopIds.includes(ps.stopId));
      const destPSList = pStops.filter(ps => destStopIds.includes(ps.stopId) && ps.stopSequence > (originPS?.stopSequence ?? 0));
      const destPS = destPSList.length > 0 ? destPSList[destPSList.length - 1] : null;
      if (!originPS || !destPS) continue;

      const originTime = defaultTimes.find(t => t.stopSequence === originPS.stopSequence);
      const destTime = defaultTimes.find(t => t.stopSequence === destPS.stopSequence);

      const originDepartUtc = originTime?.departAt ? fromZonedHHMMToUtc(params.date, originTime.departAt, 'Asia/Jakarta') : null;
      const destArriveUtc = destTime?.arriveAt ? fromZonedHHMMToUtc(params.date, destTime.arriveAt, 'Asia/Jakarta') : null;

      if (destArriveUtc && originDepartUtc && destArriveUtc.getTime() <= originDepartUtc.getTime()) {
        destArriveUtc.setDate(destArriveUtc.getDate() + 1);
      }

      let fareQuote = 0;
      const cachedRule = priceRulesByPattern.get(base.patternId);
      if (cachedRule) {
        const ruleData = cachedRule as PriceRuleData | null;
        const basePricePerLeg: number = ruleData?.basePricePerLeg ?? 0;
        const multiplier: number = ruleData?.multiplier ?? 1;
        const pricingMode: string = ruleData?.pricingMode ?? 'per_leg';
        if (pricingMode === 'flat') {
          fareQuote = Math.round(basePricePerLeg * multiplier);
        } else {
          const legCount = Math.max(destPS.stopSequence - originPS.stopSequence, 1);
          fareQuote = Math.round(legCount * basePricePerLeg * multiplier);
        }
      }

      const stopsData: TripStopPointWithCity[] = pStops.map(ps => {
        const t = defaultTimes.find(dt => dt.stopSequence === ps.stopSequence);
        const departUtc = t?.departAt ? fromZonedHHMMToUtc(params.date, t.departAt, 'Asia/Jakarta') : null;
        const arriveUtc = t?.arriveAt ? fromZonedHHMMToUtc(params.date, t.arriveAt, 'Asia/Jakarta') : null;
        return {
          stopId: ps.stopId,
          name: ps.stop?.name || '',
          code: ps.stop?.code || '',
          city: ps.stop?.city || undefined,
          sequence: ps.stopSequence,
          departAt: departUtc?.toISOString() || null,
          arriveAt: arriveUtc?.toISOString() || null,
          canPickup: ps.boardingAllowed !== false,
          canDrop: ps.alightingAllowed !== false,
        };
      });

      results.push({
        _baseId: base.id,
        tripId: `virtual-${base.id}`,
        serviceDate: params.date,
        patternCode: pattern.code || '',
        patternName: pattern.name || '',
        vehicleCode: null,
        vehicleClass: pattern.vehicleClass,
        operatorName: pattern.name || '',
        operatorLogo: null,
        origin: {
          stopId: originPS.stopId,
          name: originPS.stop?.name || '',
          code: originPS.stop?.code || '',
          sequence: originPS.stopSequence,
          departAt: originDepartUtc?.toISOString() || null,
          arriveAt: null,
        },
        destination: {
          stopId: destPS.stopId,
          name: destPS.stop?.name || '',
          code: destPS.stop?.code || '',
          sequence: destPS.stopSequence,
          departAt: null,
          arriveAt: destArriveUtc?.toISOString() || null,
        },
        availableSeats: base.capacity || 14,
        farePerPerson: fareQuote,
        originalFarePerPerson: fareQuote,
        discountPerPerson: 0,
        discountedFarePerPerson: fareQuote,
        appliedPromo: null,
        stops: stopsData,
        isVirtual: true,
      });
    }

    return results;
  }

  private async getPatternFare(patternId: string, originSeq: number, destSeq: number): Promise<number> {
    try {
      const rows = await db.execute(sql`
        SELECT rule FROM price_rules
        WHERE pattern_id = ${patternId}
          AND trip_id IS NULL
          AND deleted_at IS NULL
        ORDER BY priority ASC
        LIMIT 1
      `);
      const rowList = (Array.isArray(rows) ? rows : rows.rows) as Array<{ rule: unknown }>;
      if (rowList.length > 0) {
        const ruleData = rowList[0].rule as PriceRuleData | null;
        const basePricePerLeg: number = ruleData?.basePricePerLeg ?? 0;
        const multiplier: number = ruleData?.multiplier ?? 1;
        const pricingMode: string = ruleData?.pricingMode ?? 'per_leg';
        if (pricingMode === 'flat') return Math.round(basePricePerLeg * multiplier);
        const legCount = Math.max(destSeq - originSeq, 1);
        return Math.round(legCount * basePricePerLeg * multiplier);
      }
    } catch {}
    return 0;
  }

  private async getAvailableSeatsCount(tripId: string, originSeq: number, destSeq: number): Promise<number> {
    const legIndexes: number[] = [];
    for (let i = originSeq; i < destSeq; i++) legIndexes.push(i);

    if (legIndexes.length === 0) return 0;

    const inventory = await db.select()
      .from(seatInventory)
      .where(
        and(
          eq(seatInventory.tripId, tripId),
          inArray(seatInventory.legIndex, legIndexes)
        )
      );

    const seatMap = new Map<string, boolean>();
    for (const row of inventory) {
      if (row.booked || row.holdRef) {
        seatMap.set(row.seatNo, false);
      } else if (!seatMap.has(row.seatNo)) {
        seatMap.set(row.seatNo, true);
      }
    }

    return Array.from(seatMap.values()).filter(Boolean).length;
  }

  private async getBaseFare(tripId: string, originSeq: number, destSeq: number): Promise<number> {
    try {
      const { PricingService } = await import("../pricing/pricing.service");
      const pricingService = new PricingService(this.storage);
      const quote = await pricingService.quoteFare(tripId, originSeq, destSeq);
      return Number(quote.perPassenger);
    } catch {
      return 0;
    }
  }

  async getTripDetail(tripId: string, serviceDate?: string): Promise<TripDetailResponse> {
    let resolvedId = tripId;
    if (tripId.startsWith('virtual-')) {
      const baseId = tripId.replace('virtual-', '');
      if (!serviceDate) {
        throw new Error("serviceDate query parameter is required for virtual trip IDs. Use ?serviceDate=YYYY-MM-DD");
      }
      const existingTrip = await this.storage.getTripByBaseAndDate(baseId, serviceDate);
      if (existingTrip) {
        resolvedId = existingTrip.id;
      } else {
        throw new Error("Virtual trip has not been materialized yet for this date. Book the trip first to trigger materialization.");
      }
    }

    const trip = await this.storage.getTripById(resolvedId);
    if (!trip) throw new Error("Trip not found");

    const [pattern, stopTimes] = await Promise.all([
      this.storage.getTripPatternById(trip.patternId),
      this.storage.getTripStopTimesWithEffectiveFlags(resolvedId)
    ]);

    const stopIdsForDetail = [...new Set(stopTimes.map((st: { stopId: string }) => st.stopId))];
    const allStopsForDetail = await this.storage.getStopsByIds(stopIdsForDetail);
    const stopsDetailMap = new Map(allStopsForDetail.map(s => [s.id, s]));

    const stopsData: TripDetailResponse['stops'] = stopTimes.map((st) => {
        const stop = stopsDetailMap.get(st.stopId);
        return {
          stopId: st.stopId as string,
          name: (stop?.name || st.stopName || '') as string,
          code: (stop?.code || st.stopCode || '') as string,
          city: stop?.city ?? null,
          sequence: st.stopSequence as number,
          arriveAt: st.arriveAt as string | null,
          departAt: st.departAt as string | null,
          boardingAllowed: Boolean(st.effectiveBoardingAllowed),
          alightingAllowed: Boolean(st.effectiveAlightingAllowed)
        };
      }
    );

    const reviewStats = await db.execute(sql`
      SELECT COUNT(*)::int as count, COALESCE(AVG(rating), 0)::numeric(3,1) as avg_rating
      FROM reviews WHERE trip_id = ${resolvedId}
    `);

    const totalSeats = trip.capacity || 0;
    let seatsSold = 0;
    try {
      const soldResult = await db.execute(sql`
        SELECT COUNT(DISTINCT seat_no)::int as sold
        FROM seat_inventory
        WHERE trip_id = ${resolvedId} AND booked = true
      `);
      seatsSold = Number(soldResult.rows[0]?.sold || 0);
    } catch {}

    return {
      tripId: trip.id,
      serviceDate: trip.serviceDate,
      patternCode: pattern?.code,
      patternName: pattern?.name,
      vehicleClass: pattern?.vehicleClass,
      operatorName: pattern?.name,
      operatorLogo: null,
      capacity: trip.capacity,
      status: trip.status,
      seatAvailability: {
        total: totalSeats,
        sold: seatsSold,
        available: totalSeats - seatsSold,
      },
      stops: stopsData,
      reviews: {
        count: Number(reviewStats.rows[0]?.count || 0),
        avgRating: Number(reviewStats.rows[0]?.avg_rating || 0)
      }
    };
  }

  async getSeatmap(tripId: string, originSeq: number, destinationSeq: number): Promise<{ layout: { rows: number | null; cols: number | null; seatMap: unknown }; seatAvailability: Record<string, { available: boolean; held: boolean }> }> {
    const trip = await this.storage.getTripById(tripId);
    if (!trip) throw new Error("Trip not found");

    const layoutId = trip.layoutId;
    if (!layoutId) throw new Error("Trip has no layout");

    const legIndexes: number[] = [];
    for (let i = originSeq; i < destinationSeq; i++) legIndexes.push(i);

    const [layout, inventory] = await Promise.all([
      this.storage.getLayoutById(layoutId),
      this.storage.getSeatInventory(tripId, legIndexes)
    ]);
    if (!layout) throw new Error("Layout not found");

    const seatAvailability: Record<string, { available: boolean; held: boolean }> = {};
    const seatMap = layout.seatMap as Array<{ seat_no: string; [key: string]: unknown }>;

    for (const seat of seatMap) {
      const seatRows = inventory.filter(r => r.seatNo === seat.seat_no);
      const booked = seatRows.some(r => r.booked);
      const held = seatRows.some(r => !!r.holdRef);
      seatAvailability[seat.seat_no] = {
        available: !booked && !held,
        held
      };
    }

    return {
      layout: { rows: layout.rows, cols: layout.cols, seatMap: layout.seatMap },
      seatAvailability
    };
  }

  async materializeTrip(baseId: string, serviceDate: string): Promise<string> {
    const { TripBasesService } = await import("../tripBases/tripBases.service");
    const tripBasesService = new TripBasesService(this.storage);
    return tripBasesService.ensureMaterializedTrip(baseId, serviceDate);
  }

  private async resolveTripId(tripId: string, serviceDate?: string): Promise<string> {
    if (!tripId.startsWith('virtual-')) return tripId;

    const baseId = tripId.replace('virtual-', '');

    const existingTrip = serviceDate
      ? await this.storage.getTripByBaseAndDate(baseId, serviceDate)
      : null;
    if (existingTrip) return existingTrip.id;

    if (!serviceDate) {
      throw new Error("serviceDate is required when booking a virtual trip. Please include serviceDate in the request body.");
    }

    const { TripBasesService } = await import("../tripBases/tripBases.service");
    const tripBasesService = new TripBasesService(this.storage);
    return tripBasesService.ensureMaterializedTrip(baseId, serviceDate);
  }

  async createAppBooking(params: {
    userId: string | null;
    tripId: string;
    originStopId: string;
    destinationStopId: string;
    originSeq: number;
    destinationSeq: number;
    passengers: { fullName: string; phone?: string; idNumber?: string; seatNo: string }[];
    paymentMethod?: 'qr' | 'ewallet' | 'bank';
    serviceDate?: string;
    channel?: 'APP' | 'OTA' | 'WEB';
    salesChannelCode?: string;
    salesChannelName?: string;
    promoCode?: string;
  }): Promise<BookingDetailResponse> {
    const resolvedTripId = await this.resolveTripId(params.tripId, params.serviceDate);

    await validateBoardingAlighting(this.storage, resolvedTripId, params.originSeq, params.destinationSeq);

    const { fareQuote, total: totalAmount, promo: promoResult } = await calculateBookingTotal(
      this.storage, resolvedTripId, params.originSeq, params.destinationSeq,
      params.passengers.length, params.channel, params.promoCode,
      undefined, params.salesChannelCode,
      { autoApplyIfNoCode: true }
    );

    const legIndexes = computeLegIndexes(params.originSeq, params.destinationSeq);
    const seatNos = params.passengers.map(p => p.seatNo);

    const channel = params.channel ?? 'APP';
    // Hold TTL berbeda per channel — OTA user perlu lebih banyak waktu pilih metode bayar
    const HOLD_TTL_MINUTES =
      channel === 'OTA' ? parseInt(process.env.OTA_HOLD_TTL_MINUTES ?? '20') :
      channel === 'WEB' ? parseInt(process.env.WEB_HOLD_TTL_MINUTES ?? '20') :
      parseInt(process.env.APP_HOLD_TTL_MINUTES ?? '15');
    const holdExpiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);

    const snapshots = await fetchBookingSnapshots(this.storage, resolvedTripId, params.originStopId, params.destinationStopId, null, params.originSeq);

    // createdBy semantics:
    //   - APP / WEB (user login): "app:<userId>"
    //   - OTA (service-client): "OTA:<salesChannelCode>" agar log audit informatif.
    //     Fallback "OTA:unknown" kalau Console belum mengirim sales channel.
    const createdBy = params.userId
      ? `app:${params.userId}`
      : channel === 'OTA'
        ? `OTA:${params.salesChannelCode ?? 'unknown'}`
        : 'service-client';

    // Engine-mode: pre-generate the booking UUID so the engine.hold call
    // (which must run BEFORE we open the TT booking tx — the engine runs
    // its own tx and cannot compose with ours) can carry a deterministic
    // idempotency key derived from bookingId+seatNo, and so the hold
    // rows the engine writes can be stitched to this bookingId.
    //
    // On hold success we open the booking tx; on tx failure we compensate
    // by releasing every hold the engine placed for this bookingId.
    const useEngine = isEngineEnabled();
    const { randomUUID } = await import('crypto');
    const pregenBookingId = useEngine ? randomUUID() : null;

    // The min expires_at returned by the engine drives our local
    // pendingExpiresAt so TT's hold-window UI and engine ledger agree.
    let engineExpiresAt: Date = holdExpiresAt;

    if (useEngine) {
      const operatorId = this.engineOperatorId(params.userId, channel, params.salesChannelCode);
      const created = await this.holdsAdapter().holdForBooking({
        bookingId: pregenBookingId!,
        tripId: resolvedTripId,
        seatNos,
        legIndexes,
        operatorId,
        ttlClass: 'short',
      });
      // Use the tightest expires_at the engine returned so TT never
      // claims a longer window than the engine will honour.
      engineExpiresAt = created.reduce(
        (min, c) => (c.expiresAt < min ? c.expiresAt : min),
        created[0]?.expiresAt ?? holdExpiresAt,
      );
    }

    let bookingId: string;
    try {
      bookingId = await db.transaction(async (tx) => {
        if (!useEngine) {
          // Legacy path: engine ledger doesn't exist, so TT performs the
          // atomic seat check + hold write inline. When engine is on,
          // both steps already happened above (engine.hold is atomic).
          await checkSeatsAvailable(tx, resolvedTripId, seatNos, legIndexes);
        }

        const [booking] = await tx.insert(bookings).values({
          ...(pregenBookingId ? { id: pregenBookingId } : {}),
          tripId: resolvedTripId,
          bookingCode: generateBookingCode(),
          originStopId: params.originStopId,
          destinationStopId: params.destinationStopId,
          originSeq: params.originSeq,
          destinationSeq: params.destinationSeq,
          appUserId: params.userId,
          channel,
          status: 'pending',
          pendingExpiresAt: useEngine ? engineExpiresAt : holdExpiresAt,
          totalAmount: totalAmount.toString(),
          discountAmount: (promoResult.discountAmount || 0).toString(),
          promoId: promoResult.promoId ?? null,
          voucherCode: promoResult.voucherCode ?? null,
          ...snapshots,
          createdBy,
          salesChannelCode: channel === 'OTA' ? params.salesChannelCode ?? null : null,
          salesChannelName: channel === 'OTA' ? params.salesChannelName ?? null : null
        }).returning({ id: bookings.id });

        // Persist semua aplikasi promo (auto / manual / stacked)
        if (promoResult.applications && promoResult.applications.length > 0) {
          await tx.insert(bookingPromoApplications).values(
            promoResult.applications.map(a => ({
              bookingId: booking.id,
              promoId: a.promoId,
              promoCode: a.promoCode,
              voucherId: a.voucherId ?? null,
              voucherCode: a.voucherCode ?? null,
              source: a.source,
              discountAmount: a.discountAmount.toString(),
            }))
          );
        }

        await insertPassengerRows(tx, booking.id, params.passengers, fareQuote);
        if (!useEngine) {
          // Engine-mode: hold rows already exist in seat_holds (written
          // by the engine) and booking_id was stitched in by
          // holdForBooking's linking UPDATE. No tx-local hold insert.
          await createSeatHoldsForBooking(tx, resolvedTripId, booking.id, seatNos, legIndexes, params.userId, holdExpiresAt);
        }

        if (params.paymentMethod) {
          const { randomBytes } = await import('crypto');
          const paymentRef = `PAY-${randomBytes(12).toString('hex').toUpperCase()}`;

          await tx.insert(payments).values({
            bookingId: booking.id,
            method: params.paymentMethod,
            amount: totalAmount.toString(),
            status: 'pending',
            providerRef: paymentRef,
            paidAt: null,
          });
        }

        return booking.id;
      });
    } catch (e) {
      // Tx failed after engine already placed holds → compensate.
      if (useEngine && pregenBookingId) {
        try {
          await this.holdsAdapter().releaseForBooking(pregenBookingId, resolvedTripId);
        } catch (relErr) {
          log.error({ err: relErr, op: "appBooking" }, "compensation release after tx failure failed");
        }
      }
      throw e;
    }

    return this.getBookingDetail(bookingId);
  }

  async processPaymentWebhook(providerRef: string, gatewayStatus: 'success' | 'failed'): Promise<WebhookResult> {
    const [payment] = await db.select().from(payments).where(eq(payments.providerRef, providerRef)).limit(1);
    if (!payment) throw new Error("Payment not found");

    // S2-09: replay-safe idempotency. Webhook payment gateway sering re-deliver
    // event yang sama (network retry, manual replay dari dashboard). Untuk
    // event yang sudah diproses, kita harus return 200 + idempotent flag
    // supaya gateway tidak menganggap kita gagal terus dan akhirnya
    // mark integration broken. Kebenaran finansial dijaga oleh status
    // payment sendiri — tidak ada side-effect karena tidak masuk transaction.
    if (payment.status !== 'pending') {
      const replayBooking = await this.storage.getBookingById(payment.bookingId);
      const finalStatus: 'success' | 'failed' = payment.status === 'success' ? 'success' : 'failed';
      return {
        status: finalStatus,
        bookingId: replayBooking?.id ?? payment.bookingId,
        idempotent: true,
      };
    }

    const booking = await this.storage.getBookingById(payment.bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== 'pending') throw new Error("Booking is no longer pending");

    const pax = await this.storage.getPassengers(booking.id);
    const legIndexes: number[] = [];
    for (let i = booking.originSeq; i < booking.destinationSeq; i++) legIndexes.push(i);

    const seatNos = pax.map(p => p.seatNo);
    const useEngine = isEngineEnabled();

    if (gatewayStatus === 'failed') {
      await db.transaction(async (tx) => {
        await tx.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));
        await tx.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, booking.id));

        if (!useEngine) {
          await tx.update(seatInventory)
            .set({ holdRef: null })
            .where(and(
              eq(seatInventory.tripId, booking.tripId),
              inArray(seatInventory.seatNo, seatNos),
              inArray(seatInventory.legIndex, legIndexes)
            ));
          await tx.delete(seatHolds).where(and(
            eq(seatHolds.tripId, booking.tripId),
            inArray(seatHolds.seatNo, seatNos)
          ));
        }
      });
      // Engine mode: release holds AFTER the TT tx commits. On release
      // failure the engine hold will expire at its TTL anyway, so
      // best-effort is acceptable.
      if (useEngine) {
        try {
          await this.holdsAdapter().releaseForBooking(booking.id, booking.tripId);
        } catch (e) {
          log.error({ err: e, op: "webhook.failedPayment" }, "releaseForBooking failed (will expire at TTL)");
        }
      }
      // Realtime: webhook 'failed' membebaskan kursi → refresh seatmap CSO
      for (const seatNo of seatNos) {
        webSocketService.emitInventoryUpdated(booking.tripId, seatNo, legIndexes);
      }
      return { status: 'failed', bookingId: booking.id };
    }

    // Success path. Engine mode: confirm seats in the engine BEFORE we
    // open the TT tx so a tx failure is compensated with cancel-seats
    // (the engine runs its own tx, no composition with ours possible).
    let engineConfirmed: Array<{ seatNo: string; holdRef: string }> = [];
    if (useEngine) {
      const operatorId = this.engineOperatorId(booking.appUserId, booking.channel ?? null, booking.salesChannelCode ?? null);
      engineConfirmed = await this.holdsAdapter().confirmForBooking({
        bookingId: booking.id,
        tripId: booking.tripId,
        seatNos,
        legIndexes,
        operatorId,
      });
    }

    try {
      await db.transaction(async (tx) => {
        if (!useEngine) {
          // Legacy ledger check — only needed when we own seat_inventory.
          const activeHolds = await tx.select().from(seatHolds)
            .where(and(
              eq(seatHolds.bookingId, booking.id),
              gt(seatHolds.expiresAt, new Date())
            ));

          if (activeHolds.length === 0) {
            await tx.update(seatInventory)
              .set({ holdRef: null })
              .where(and(
                eq(seatInventory.tripId, booking.tripId),
                inArray(seatInventory.seatNo, seatNos),
                inArray(seatInventory.legIndex, legIndexes)
              ));
            await tx.delete(seatHolds).where(and(
              eq(seatHolds.tripId, booking.tripId),
              inArray(seatHolds.seatNo, seatNos)
            ));
            await tx.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));
            await tx.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, booking.id));
            throw new Error("Seat holds have expired. Booking cannot be confirmed.");
          }

          const legArr = sql`ARRAY[${sql.join(legIndexes.map(i => sql`${i}::int`), sql`, `)}]`;
          const seatArr = sql`ARRAY[${sql.join(seatNos.map(s => sql`${s}`), sql`, `)}]`;
          const seatRows = await tx.execute(sql`
            SELECT seat_no, booked FROM seat_inventory
            WHERE trip_id = ${booking.tripId}
              AND seat_no = ANY(${seatArr})
              AND leg_index = ANY(${legArr})
            FOR UPDATE
          `);
          const bookedSeat = (seatRows.rows as Record<string, unknown>[]).find(r => r.booked === true);
          if (bookedSeat) {
            await tx.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));
            await tx.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, booking.id));
            await tx.update(seatInventory)
              .set({ holdRef: null })
              .where(and(
                eq(seatInventory.tripId, booking.tripId),
                inArray(seatInventory.seatNo, seatNos),
                inArray(seatInventory.legIndex, legIndexes)
              ));
            await tx.delete(seatHolds).where(and(
              eq(seatHolds.tripId, booking.tripId),
              inArray(seatHolds.seatNo, seatNos)
            ));
            throw new Error(`Seat ${bookedSeat.seat_no} is no longer available. Booking canceled.`);
          }
        }

        // Idempotency guard: hanya satu path (webhook ATAU payBooking) memenangkan
        // transisi pending→confirmed → mencegah double-increment promo usage.
        const [bookingUpdate] = await tx.update(bookings)
          .set({ status: 'confirmed' })
          .where(and(eq(bookings.id, booking.id), eq(bookings.status, 'pending')))
          .returning({ id: bookings.id });
        if (!bookingUpdate) {
          throw new Error('Booking sudah dikonfirmasi atau dibatalkan');
        }

        if (!useEngine) {
          // Engine mode: the engine already set booked=true (and deleted
          // the hold row) on engine.confirm. TT doesn't touch the ledger.
          await tx.update(seatInventory)
            .set({ booked: true, holdRef: null })
            .where(and(
              eq(seatInventory.tripId, booking.tripId),
              inArray(seatInventory.seatNo, seatNos),
              inArray(seatInventory.legIndex, legIndexes)
            ));

          await tx.delete(seatHolds)
            .where(and(
              eq(seatHolds.tripId, booking.tripId),
              inArray(seatHolds.seatNo, seatNos)
            ));
        }

        await tx.update(payments)
          .set({ status: 'success', paidAt: new Date() })
          .where(eq(payments.id, payment.id));

      // Increment usage utk semua promo yang ter-apply ke booking ini.
      const apps = await tx.select().from(bookingPromoApplications)
        .where(eq(bookingPromoApplications.bookingId, booking.id));
      for (const app of apps) {
        const [promoUpdate] = await tx.update(promotions)
          .set({ usageCount: sql`COALESCE(${promotions.usageCount}, 0) + 1` })
          .where(and(
            eq(promotions.id, app.promoId),
            eq(promotions.isActive, true),
            sql`(${promotions.usageLimit} IS NULL OR ${promotions.usageCount} < ${promotions.usageLimit})`
          ))
          .returning({ id: promotions.id });
        if (!promoUpdate) {
          throw new Error('Promo sudah tidak tersedia atau kuota habis');
        }
        if (app.voucherId) {
          const [voucherUpdate] = await tx.update(vouchers).set({
            status: 'used',
            usedAt: new Date(),
            usedByBookingId: booking.id,
          }).where(and(eq(vouchers.id, app.voucherId), eq(vouchers.status, 'active')))
            .returning({ id: vouchers.id });
          if (!voucherUpdate) {
            throw new Error('Voucher sudah digunakan');
          }
        }
        }
      });
    } catch (e) {
      // Engine confirms already succeeded at this point, so seats are
      // booked in the engine ledger — compensate by cancelling them,
      // otherwise TT rolled-back but engine still holds the seats.
      if (useEngine && engineConfirmed.length > 0) {
        try {
          await this.holdsAdapter().compensateConfirms(
            booking.tripId,
            engineConfirmed,
            legIndexes,
            { source: 'processPaymentWebhook', bookingId: booking.id },
          );
        } catch (compErr) {
          log.error({ err: compErr, op: "webhook" }, "compensateConfirms after tx failure failed");
        }
      }
      throw e;
    }

    // Realtime: payment webhook sukses → kursi confirmed, refresh seatmap CSO
    for (const seatNo of seatNos) {
      webSocketService.emitInventoryUpdated(booking.tripId, seatNo, legIndexes);
    }

    return { status: 'success', bookingId: booking.id };
  }

  // Dipanggil Console setelah pembayaran OTA dikonfirmasi di sisi Console.
  // Terminal tidak perlu tahu detail payment gateway — cukup tahu booking ini lunas
  // dari channel OTA. Method dicatat sebagai 'online' karena yang me-manage payment
  // method (qris/va/ewallet/dst) adalah Console; Terminal hanya perlu tahu bahwa
  // booking ini dibayar via kanal online (bukan cash di loket).
  async confirmOtaPayment(bookingId: string, providerRef: string): Promise<{ status: string; bookingId: string }> {
    const booking = await this.storage.getBookingById(bookingId);
    if (!booking) throw new Error("Booking not found");

    if (booking.status === 'confirmed') {
      return { status: 'confirmed', bookingId: booking.id };
    }

    let isGracePeriodRecovery = false;
    if (booking.status === 'cancelled' && booking.channel === 'OTA') {
      const graceWindowMs = 5 * 60 * 1000;
      const expiryTime = booking.pendingExpiresAt ? new Date(booking.pendingExpiresAt).getTime() : 0;
      const cancelledRecently = expiryTime > 0 && (Date.now() - expiryTime) < graceWindowMs;
      if (cancelledRecently) {
        log.info({ bookingId, op: "otaGracePeriod" }, "re-activating recently cancelled OTA booking");
        isGracePeriodRecovery = true;
      } else {
        throw new Error(`Booking cannot be confirmed. Current status: ${booking.status}`);
      }
    } else if (booking.status !== 'pending') {
      throw new Error(`Booking cannot be confirmed. Current status: ${booking.status}`);
    }

    const pax = await this.storage.getPassengers(booking.id);
    const legIndexes: number[] = [];
    for (let i = booking.originSeq; i < booking.destinationSeq; i++) legIndexes.push(i);
    const seatNos = pax.map(p => p.seatNo);

    const expectedStatus = isGracePeriodRecovery ? 'cancelled' : 'pending';
    const useEngine = isEngineEnabled();

    // Grace-period recovery reanimates a 'cancelled' booking. In engine
    // mode its holds have been released (or expired) already, so we
    // re-hold them BEFORE confirming. If re-hold fails (another party
    // grabbed the seat during the grace window), surface a clean error.
    if (useEngine && isGracePeriodRecovery && seatNos.length > 0) {
      const operatorId = this.engineOperatorId(booking.appUserId, booking.channel ?? null, booking.salesChannelCode ?? null);
      try {
        await this.holdsAdapter().holdForBooking({
          bookingId: booking.id,
          tripId: booking.tripId,
          seatNos,
          legIndexes,
          operatorId,
          ttlClass: 'short',
        });
      } catch (e) {
        throw new Error(
          `Grace-period OTA reactivation failed — seat no longer available in engine ledger: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    let engineConfirmed: Array<{ seatNo: string; holdRef: string }> = [];
    if (useEngine && seatNos.length > 0) {
      const operatorId = this.engineOperatorId(booking.appUserId, booking.channel ?? null, booking.salesChannelCode ?? null);
      engineConfirmed = await this.holdsAdapter().confirmForBooking({
        bookingId: booking.id,
        tripId: booking.tripId,
        seatNos,
        legIndexes,
        operatorId,
      });
    }

    try {
      await db.transaction(async (tx) => {
        if (!useEngine && seatNos.length > 0) {
          const legArr = sql`ARRAY[${sql.join(legIndexes.map(i => sql`${i}::int`), sql`, `)}]`;
          const seatArr = sql`ARRAY[${sql.join(seatNos.map(s => sql`${s}`), sql`, `)}]`;
          const seatRows = await tx.execute(sql`
            SELECT seat_no, booked FROM seat_inventory
            WHERE trip_id = ${booking.tripId}
              AND seat_no = ANY(${seatArr})
              AND leg_index = ANY(${legArr})
            FOR UPDATE
          `);
          const alreadyBooked = (seatRows.rows as Record<string, unknown>[]).find(r => r.booked === true);
          if (alreadyBooked) {
            throw new Error(`Cannot confirm: seat ${alreadyBooked.seat_no} is already booked by another passenger`);
          }
        }

        const [updated] = await tx.update(bookings)
          .set({ status: 'confirmed', channel: 'OTA' })
          .where(and(eq(bookings.id, booking.id), eq(bookings.status, expectedStatus)))
          .returning({ id: bookings.id });

        if (!updated) {
          throw new Error(`Booking status changed concurrently. Expected: ${expectedStatus}`);
        }

        if (!useEngine) {
          await tx.update(seatInventory)
            .set({ booked: true, holdRef: null })
            .where(and(
              eq(seatInventory.tripId, booking.tripId),
              inArray(seatInventory.seatNo, seatNos),
              inArray(seatInventory.legIndex, legIndexes)
            ));

          await tx.delete(seatHolds)
            .where(and(
              eq(seatHolds.tripId, booking.tripId),
              inArray(seatHolds.seatNo, seatNos)
            ));
        }

        const { randomBytes } = await import('crypto');
        const paymentRef = providerRef || `OTA-${randomBytes(12).toString('hex').toUpperCase()}`;
        await tx.insert(payments).values({
          bookingId: booking.id,
          method: 'online',
          amount: booking.totalAmount,
          status: 'success',
          providerRef: paymentRef,
          paidAt: new Date(),
        });
      });
    } catch (e) {
      if (useEngine && engineConfirmed.length > 0) {
        try {
          await this.holdsAdapter().compensateConfirms(
            booking.tripId,
            engineConfirmed,
            legIndexes,
            { source: 'confirmOtaPayment', bookingId: booking.id },
          );
        } catch (compErr) {
          log.error({ err: compErr, op: "otaConfirm" }, "compensateConfirms after tx failure failed");
        }
      }
      throw e;
    }

    // Broadcast realtime seatmap update ke semua CSO yang sedang buka trip ini
    // Ini yang bikin seatmap langsung berubah dari kuning (hold) ke hijau/merah (confirmed)
    for (const seatNo of seatNos) {
      webSocketService.emitInventoryUpdated(booking.tripId, seatNo, legIndexes);
    }

    return { status: 'confirmed', bookingId: booking.id };
  }

  async findOtaBookingByCriteria(tripId: string, seatNos: string[]): Promise<BookingDetailResponse | null> {
    const sortedInput = [...seatNos].sort();

    const results = await db
      .select()
      .from(bookings)
      .where(and(
        eq(bookings.tripId, tripId),
        eq(bookings.channel, 'OTA'),
        inArray(bookings.status, ['pending', 'confirmed'])
      ))
      .orderBy(
        sql`CASE WHEN ${bookings.status} = 'pending' THEN 0 ELSE 1 END`,
        desc(bookings.createdAt)
      );

    if (results.length === 0) return null;

    // Batch passenger lookup → group by bookingId, then iterate ranked bookings
    // (pending first, then by createdAt desc) untuk pick first match.
    const allPassengers = await this.storage.getPassengersByBookingIds(
      results.map(b => b.id)
    );
    const seatsByBooking = new Map<string, string[]>();
    for (const p of allPassengers) {
      const arr = seatsByBooking.get(p.bookingId);
      if (arr) arr.push(p.seatNo);
      else seatsByBooking.set(p.bookingId, [p.seatNo]);
    }

    for (const booking of results) {
      const bookingSeats = (seatsByBooking.get(booking.id) ?? []).slice().sort();
      if (sortedInput.length === bookingSeats.length &&
          sortedInput.every((s, i) => s === bookingSeats[i])) {
        return this.getBookingDetail(booking.id);
      }
    }

    return null;
  }

  async getPaymentStatus(bookingId: string, userId: string): Promise<PaymentStatusResponse> {
    const booking = await this.storage.getBookingById(bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.appUserId !== userId) throw new Error("Unauthorized");

    const pmts = await this.storage.getPayments(bookingId);
    const payment = pmts[0];
    if (!payment) throw new Error("No payment found");

    return {
      bookingId: booking.id,
      bookingStatus: booking.status,
      paymentId: payment.id,
      paymentStatus: payment.status,
      method: payment.method,
      amount: payment.amount,
      providerRef: payment.providerRef,
    };
  }

  async getUserBookings(userId: string): Promise<BookingListItem[]> {
    const result = await db.select({
      id: bookings.id,
      tripId: bookings.tripId,
      serviceDate: trips.serviceDate,
      patternCode: tripPatterns.code,
      patternName: tripPatterns.name,
      originStopId: bookings.originStopId,
      destinationStopId: bookings.destinationStopId,
      originSeq: bookings.originSeq,
      destinationSeq: bookings.destinationSeq,
      status: bookings.status,
      totalAmount: bookings.totalAmount,
      discountAmount: bookings.discountAmount,
      channel: bookings.channel,
      pendingExpiresAt: bookings.pendingExpiresAt,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .innerJoin(trips, eq(bookings.tripId, trips.id))
    .innerJoin(tripPatterns, eq(trips.patternId, tripPatterns.id))
    .where(eq(bookings.appUserId, userId))
    .orderBy(desc(bookings.createdAt));

    if (result.length === 0) return [];

    const stopIds = [...new Set(result.flatMap(b => [b.originStopId, b.destinationStopId]))];
    const bookingIds = result.map(b => b.id);

    const pendingBookingIds = result.filter(b => b.status === 'pending').map(b => b.id);
    const [allStops, allPassengers, holdRows] = await Promise.all([
      this.storage.getStopsByIds(stopIds),
      this.storage.getPassengersByBookingIds(bookingIds),
      pendingBookingIds.length > 0
        ? db.select({ bookingId: seatHolds.bookingId, expiresAt: seatHolds.expiresAt })
            .from(seatHolds).where(inArray(seatHolds.bookingId, pendingBookingIds))
        : Promise.resolve([]),
    ]);

    const stopsMap = new Map(allStops.map(s => [s.id, s]));
    const paxCountMap = new Map<string, number>();
    for (const p of allPassengers) {
      paxCountMap.set(p.bookingId, (paxCountMap.get(p.bookingId) || 0) + 1);
    }
    const holdExpiryMap = new Map<string, string | null>();
    for (const h of holdRows) {
      if (h.bookingId && !holdExpiryMap.has(h.bookingId)) {
        holdExpiryMap.set(h.bookingId, h.expiresAt?.toISOString() ?? null);
      }
    }

    return result.map(b => {
      const origin = stopsMap.get(b.originStopId);
      const dest = stopsMap.get(b.destinationStopId);
      return {
        ...b,
        origin: origin ? { name: origin.name, code: origin.code, city: origin.city } : null,
        destination: dest ? { name: dest.name, code: dest.code, city: dest.city } : null,
        passengerCount: paxCountMap.get(b.id) || 0,
        holdExpiresAt: b.status === 'pending'
          ? (holdExpiryMap.get(b.id) || b.pendingExpiresAt?.toISOString() || null)
          : null,
        finalAmount: (Number(b.totalAmount ?? 0) - Number(b.discountAmount ?? 0)).toString(),
      };
    });
  }

  async getBookingDetail(bookingId: string, userId?: string): Promise<BookingDetailResponse> {
    const booking = await this.storage.getBookingById(bookingId);
    if (!booking) throw new Error("Booking not found");
    if (userId && booking.appUserId !== userId) throw new Error("Unauthorized");

    const [pax, pmts, trip, origin, dest] = await Promise.all([
      this.storage.getPassengers(bookingId),
      this.storage.getPayments(bookingId),
      this.storage.getTripById(booking.tripId),
      this.storage.getStopById(booking.originStopId),
      this.storage.getStopById(booking.destinationStopId)
    ]);

    let pattern = null;
    let departAt = null;
    let arriveAt = null;
    if (trip) {
      pattern = await this.storage.getTripPatternById(trip.patternId);
      const stopTimes = await this.storage.getTripStopTimes(booking.tripId);
      const originST = stopTimes.find(st => st.stopSequence === booking.originSeq);
      const destST = stopTimes.find(st => st.stopSequence === booking.destinationSeq);
      departAt = originST?.departAt;
      arriveAt = destST?.arriveAt;
    }

    const pendingPayment = pmts.find(p => p.status === 'pending');
    let holdExpiry: string | null = null;
    if (booking.status === 'pending') {
      const holds = await db.select({ expiresAt: seatHolds.expiresAt })
        .from(seatHolds)
        .where(eq(seatHolds.bookingId, bookingId))
        .limit(1);
      holdExpiry = holds[0]?.expiresAt?.toISOString() || null;
    }

    return {
      id: booking.id,
      bookingCode: booking.bookingCode ?? null,
      tripId: booking.tripId,
      serviceDate: trip?.serviceDate,
      patternCode: pattern?.code,
      patternName: pattern?.name,
      origin: origin ? { stopId: origin.id, name: origin.name, code: origin.code, city: origin.city } : null,
      destination: dest ? { stopId: dest.id, name: dest.name, code: dest.code, city: dest.city } : null,
      departAt: departAt instanceof Date ? departAt.toISOString() : (departAt ? String(departAt) : null),
      arriveAt: arriveAt instanceof Date ? arriveAt.toISOString() : (arriveAt ? String(arriveAt) : null),
      status: booking.status,
      totalAmount: booking.totalAmount,
      channel: booking.channel,
      createdBy: booking.createdBy ?? null,
      salesChannelCode: booking.salesChannelCode ?? null,
      salesChannelName: booking.salesChannelName ?? null,
      holdExpiresAt: holdExpiry,
      qrData: pax.map(p => ({
        passengerId: p.id,
        seatNo: p.seatNo,
        fullName: p.fullName,
        qrToken: `TRN-${booking.id.slice(-8).toUpperCase()}-${p.seatNo}`,
        qrPayload: JSON.stringify({
          bookingId: booking.id,
          passengerId: p.id,
          seatNo: p.seatNo,
          tripId: booking.tripId,
          serviceDate: trip?.serviceDate,
        }),
      })),
      passengers: pax.map(p => ({
        id: p.id,
        fullName: p.fullName,
        phone: p.phone,
        seatNo: p.seatNo,
        fareAmount: p.fareAmount
      })),
      payments: pmts.map(p => ({
        id: p.id,
        method: p.method,
        amount: p.amount,
        status: p.status,
        paidAt: p.paidAt
      })),
      paymentIntent: pendingPayment ? {
        paymentId: pendingPayment.id,
        method: pendingPayment.method,
        amount: pendingPayment.amount,
        status: pendingPayment.status,
        providerRef: pendingPayment.providerRef,
        expiresAt: holdExpiry,
      } : null,
      createdAt: booking.createdAt
    };
  }

  async cancelBooking(bookingId: string, userId: string | null): Promise<void> {
    const booking = await this.storage.getBookingById(bookingId);
    if (!booking) throw new Error("Booking not found");
    if (userId && booking.appUserId !== userId) throw new Error("Unauthorized");
    if (!['pending', 'confirmed'].includes(booking.status!)) {
      throw new Error("Booking cannot be canceled");
    }

    // S2-02: cancellable rules — trip yang sudah berangkat (closed) tidak
    // boleh dibatalkan dari sisi customer. Customer harus minta refund via
    // RefundsService (yang punya alur approval staff). Trip yang batal di
    // level operasional juga ditolak supaya customer tahu kondisinya.
    const trip = await this.storage.getTripById(booking.tripId);
    if (trip) {
      if (trip.status === 'closed') {
        throw new Error('Trip sudah berangkat — gunakan menu refund untuk pengajuan pengembalian dana.');
      }
      if (trip.status === 'cancelled') {
        throw new Error('Trip sudah dibatalkan operator — kompensasi diproses otomatis, tidak perlu cancel manual.');
      }
    }

    const pax = await this.storage.getPassengers(bookingId);
    const seatNos = pax.map(p => p.seatNo);
    const legIndexes = computeLegIndexes(booking.originSeq, booking.destinationSeq);

    // S2-02: capture status awal untuk decide apakah perlu kompensasi
    // engine. Hanya booking yang sudah 'confirmed' yang punya seat ledger
    // terbooking di engine; 'pending' cuma punya hold yang akan expire sendiri.
    const wasConfirmed = booking.status === 'confirmed';
    const useEngine = isEngineEnabled();

    await db.transaction(async (tx) => {
      // CAS guard: hanya satu cancel yang menang (idempotent untuk client retry).
      const [bookingUpdate] = await tx.update(bookings)
        .set({ status: 'cancelled' })
        .where(and(
          eq(bookings.id, bookingId),
          inArray(bookings.status, ['pending', 'confirmed']),
        ))
        .returning({ id: bookings.id });
      if (!bookingUpdate) {
        throw new Error('Booking sudah dibatalkan atau tidak dalam status yang dapat dibatalkan');
      }

      if (!useEngine && seatNos.length > 0) {
        // Legacy-only SQL writes. Engine mode delegates seat ledger
        // updates to the engine via the post-commit release / cancel
        // below (confirmed seats) and natural TTL expiry (pending holds).
        await tx.update(seatInventory)
          .set({ booked: false, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, booking.tripId),
            inArray(seatInventory.seatNo, seatNos),
            inArray(seatInventory.legIndex, legIndexes)
          ));

        await tx.delete(seatHolds).where(and(
          eq(seatHolds.tripId, booking.tripId),
          inArray(seatHolds.seatNo, seatNos),
          eq(seatHolds.bookingId, bookingId)
        ));
      }
    });

    if (useEngine && seatNos.length > 0) {
      if (wasConfirmed) {
        // Confirmed seats live in engine's booked ledger. Use the
        // compensation queue so a transient engine outage doesn't fail
        // the cancel that already committed in TT — scheduler retries.
        try {
          const { enqueueCancelSeats } = await import('@modules/holds/compensationQueue');
          for (const seatNo of seatNos) {
            await enqueueCancelSeats({
              tripId: booking.tripId,
              seatNo,
              legIndexes,
              context: { source: 'cancelBooking', bookingId },
            });
          }
        } catch (e) {
          log.error({ err: e, op: "cancelConfirmed" }, "enqueueCancelSeats after confirmed cancel failed");
        }
      } else {
        // Pending → holds in engine. Release directly so clients see
        // the seat free immediately; falling back to TTL expiry would
        // leave it held for HOLD_TTL_SHORT_SECONDS.
        try {
          await this.holdsAdapter().releaseForBooking(bookingId, booking.tripId);
        } catch (e) {
          log.error({ err: e, op: "cancelPending" }, "releaseForBooking on pending cancel failed (will expire at TTL)");
        }
      }
    }

    // Realtime: kursi yang dibebaskan harus refresh di seatmap CSO
    for (const seatNo of seatNos) {
      webSocketService.emitInventoryUpdated(booking.tripId, seatNo, legIndexes);
    }
  }

  getPaymentMethods() {
    return [
      { code: 'qr', name: 'QRIS', description: 'Pembayaran via QRIS', active: true },
      { code: 'ewallet', name: 'E-Wallet', description: 'Pembayaran via e-wallet (GoPay, OVO, DANA)', active: true },
      { code: 'bank', name: 'Bank Transfer', description: 'Transfer bank (VA)', active: true },
    ];
  }

  async validateVoucher(code: string, purchaseAmount?: number): Promise<{
    valid: boolean;
    code: string;
    discountType: string;
    discountValue: string;
    minPurchase: string | null;
    maxDiscount: string | null;
    calculatedDiscount: number | null;
  }> {
    const voucher = await db.select().from(vouchers)
      .where(and(eq(vouchers.code, code.toUpperCase()), eq(vouchers.status, 'active')))
      .limit(1);

    if (voucher.length === 0) throw new Error("Voucher not found or inactive");

    const v = voucher[0];
    const now = new Date();
    if (v.validFrom && now < v.validFrom) throw new Error("Voucher is not yet valid");
    if (v.validTo && now > v.validTo) throw new Error("Voucher has expired");

    const promo = await db.select().from(promotions)
      .where(eq(promotions.id, v.promoId))
      .limit(1);

    if (promo.length === 0) throw new Error("Associated promotion not found");

    const p = promo[0];
    if (!p.isActive) throw new Error("Associated promotion is inactive");
    if (p.validFrom && now < p.validFrom) throw new Error("Promotion is not yet valid");
    if (p.validTo && now > p.validTo) throw new Error("Promotion has expired");
    if (p.usageLimit && (p.usageCount ?? 0) >= p.usageLimit) throw new Error("Promotion usage limit reached");

    const minPurchase = Number(p.minPurchase ?? 0);
    if (purchaseAmount !== undefined && purchaseAmount < minPurchase) {
      throw new Error(`Minimum purchase amount is ${minPurchase}`);
    }

    let calculatedDiscount: number | null = null;
    if (purchaseAmount !== undefined) {
      const discountVal = Number(p.discountValue);
      if (p.type === 'percentage') {
        calculatedDiscount = Math.round(purchaseAmount * discountVal / 100);
        const maxDisc = p.maxDiscount ? Number(p.maxDiscount) : null;
        if (maxDisc && calculatedDiscount > maxDisc) calculatedDiscount = maxDisc;
      } else {
        calculatedDiscount = discountVal;
      }
    }

    return {
      valid: true,
      code: v.code,
      discountType: p.type,
      discountValue: p.discountValue,
      minPurchase: p.minPurchase,
      maxDiscount: p.maxDiscount,
      calculatedDiscount,
    };
  }

  async payBooking(bookingId: string, paymentMethod: 'qr' | 'ewallet' | 'bank', voucherCode?: string, userId?: string | null): Promise<{
    bookingId: string;
    status: string;
    totalAmount: string;
    discountAmount: string;
    finalAmount: string;
    paymentIntent: {
      paymentId: string;
      providerRef: string;
      method: string;
      amount: string;
    };
  }> {
    const booking = await this.storage.getBookingById(bookingId);
    if (!booking) throw new Error("Booking not found");
    if (userId && booking.appUserId !== userId) throw new Error("Unauthorized");
    if (booking.status !== 'pending') throw new Error("Booking is not in held/pending status");

    if (booking.pendingExpiresAt && new Date() > booking.pendingExpiresAt) {
      throw new Error("Booking hold has expired");
    }

    const activeHolds = await db.select().from(seatHolds)
      .where(and(eq(seatHolds.bookingId, bookingId), gt(seatHolds.expiresAt, new Date())));
    if (activeHolds.length === 0) {
      throw new Error("Seat holds have expired. Booking cannot be paid.");
    }

    let discountAmount = 0;
    let usedPromoId: string | null = null;
    const totalAmount = Number(booking.totalAmount);

    // Stacking-aware: jika user input voucher pada saat bayar, validate ulang
    // dengan memperhitungkan auto-promo yg sudah ter-apply ke booking saat pending.
    // Hasilnya jadi sumber kebenaran utk applications + diskon final.
    type PendingApplication = {
      promoId: string;
      promoCode: string;
      voucherId: string | null;
      voucherCode: string | null;
      source: 'manual' | 'auto';
      discountAmount: number;
    };
    let pendingApplications: PendingApplication[] = [];

    if (voucherCode) {
      const { PromosService } = await import('@modules/promos/promos.service');
      const promosService = new PromosService(this.storage);
      const trip = await this.storage.getTripById(booking.tripId);
      const validation = await promosService.validateAndCalculateDiscount(
        voucherCode,
        totalAmount,
        {
          channel: booking.channel || undefined,
          tripId: booking.tripId,
          patternId: trip?.patternId || undefined,
          outletId: booking.outletId || undefined,
          salesChannelCode: booking.salesChannelCode || undefined,
          departureDate: trip?.serviceDate || undefined,
        }
      );
      if (!validation.valid) {
        throw new Error(validation.error || 'Kode voucher tidak valid');
      }
      discountAmount = validation.discountAmount;
      usedPromoId = validation.promotion?.id ?? null;
      pendingApplications = (validation.applications ?? []).map(a => ({
        promoId: a.promoId,
        promoCode: a.promoCode,
        voucherId: a.voucherId ?? null,
        voucherCode: a.voucherCode ?? null,
        source: a.source,
        discountAmount: a.discountAmount,
      }));
    } else {
      // Tidak ada voucher baru — preserve aplikasi yg sudah dicatat saat createAppBooking
      const existing = await this.storage.getBookingPromoApplications(bookingId);
      pendingApplications = existing.map(e => ({
        promoId: e.promoId,
        promoCode: e.promoCode,
        voucherId: e.voucherId,
        voucherCode: e.voucherCode,
        source: e.source as 'manual' | 'auto',
        discountAmount: Number(e.discountAmount),
      }));
      discountAmount = pendingApplications.reduce((s, a) => s + a.discountAmount, 0);
      // Fallback ke booking.promoId/discountAmount kalau tabel applications kosong (booking lama)
      if (pendingApplications.length === 0 && booking.promoId) {
        usedPromoId = booking.promoId;
        discountAmount = Number(booking.discountAmount || 0);
      } else {
        usedPromoId = pendingApplications.find(a => a.source === 'manual')?.promoId
          ?? pendingApplications[0]?.promoId
          ?? null;
      }
    }

    const finalAmount = Math.max(0, totalAmount - discountAmount);

    const pax = await this.storage.getPassengers(bookingId);
    const seatNos = pax.map(p => p.seatNo);
    const legIndexes = computeLegIndexes(booking.originSeq, booking.destinationSeq);

    const { randomBytes } = await import('crypto');
    const paymentRef = `PAY-${randomBytes(12).toString('hex').toUpperCase()}`;

    let paymentId = '';
    const useEngine = isEngineEnabled();

    // Engine confirm must happen BEFORE we open the TT tx so a tx
    // rollback leaves nothing half-done; the engine runs its own tx.
    let engineConfirmed: Array<{ seatNo: string; holdRef: string }> = [];
    if (useEngine && seatNos.length > 0) {
      const operatorId = this.engineOperatorId(booking.appUserId, booking.channel ?? null, booking.salesChannelCode ?? null);
      engineConfirmed = await this.holdsAdapter().confirmForBooking({
        bookingId: booking.id,
        tripId: booking.tripId,
        seatNos,
        legIndexes,
        operatorId,
      });
    }

    try {
      await db.transaction(async (tx) => {
        if (!useEngine) {
          // Engine-mode: engine.confirm already advanced the booked
          // ledger atomically, so the TT-side pre-flight is redundant.
          const legArr = sql`ARRAY[${sql.join(legIndexes.map(i => sql`${i}::int`), sql`, `)}]`;
          const seatArr = sql`ARRAY[${sql.join(seatNos.map(s => sql`${s}`), sql`, `)}]`;
          const seatRows = await tx.execute(sql`
            SELECT seat_no, booked FROM seat_inventory
            WHERE trip_id = ${booking.tripId}
              AND seat_no = ANY(${seatArr})
              AND leg_index = ANY(${legArr})
            FOR UPDATE
          `);
          const bookedSeat = (seatRows.rows as Record<string, unknown>[]).find(r => r.booked === true);
          if (bookedSeat) {
            throw new Error(`Seat ${bookedSeat.seat_no} is no longer available`);
          }
        }

        const [payment] = await tx.insert(payments).values({
          bookingId: booking.id,
          method: paymentMethod,
          amount: finalAmount.toString(),
          status: 'success',
          providerRef: paymentRef,
          paidAt: new Date(),
        }).returning({ id: payments.id });
        paymentId = payment.id;

        // Status guard: hanya satu path (payBooking ATAU webhook) yang boleh
        // memenangkan transisi pending→confirmed. Mencegah double-increment usage.
        const [bookingUpdate] = await tx.update(bookings).set({
          status: 'confirmed',
          discountAmount: discountAmount.toString(),
          voucherCode: voucherCode?.toUpperCase() || booking.voucherCode || null,
          promoId: usedPromoId,
        }).where(and(eq(bookings.id, bookingId), eq(bookings.status, 'pending')))
          .returning({ id: bookings.id });
        if (!bookingUpdate) {
          throw new Error('Booking sudah dikonfirmasi atau dibatalkan');
        }

        // Sinkronkan applications: hapus yg lama, insert hasil pay-time validation.
        // Jika user tidak input voucher baru, pendingApplications adalah copy dari
        // existing rows → re-insert idempotent.
        if (voucherCode) {
          await tx.delete(bookingPromoApplications).where(eq(bookingPromoApplications.bookingId, bookingId));
          if (pendingApplications.length > 0) {
            await tx.insert(bookingPromoApplications).values(
              pendingApplications.map(a => ({
                bookingId,
                promoId: a.promoId,
                promoCode: a.promoCode,
                voucherId: a.voucherId,
                voucherCode: a.voucherCode,
                source: a.source,
                discountAmount: a.discountAmount.toString(),
              }))
            );
          }
        }

        if (!useEngine) {
          await tx.update(seatInventory)
            .set({ booked: true, holdRef: null })
            .where(and(
              eq(seatInventory.tripId, booking.tripId),
              inArray(seatInventory.seatNo, seatNos),
              inArray(seatInventory.legIndex, legIndexes)
            ));

          await tx.delete(seatHolds)
            .where(and(
              eq(seatHolds.tripId, booking.tripId),
              inArray(seatHolds.seatNo, seatNos)
            ));
        }

        // Increment usage utk SETIAP applied promo dgn guard usageLimit + active.
        // Pola sama dgn bookings.service.ts createBooking utk konsistensi.
        for (const app of pendingApplications) {
          const [promoUpdate] = await tx.update(promotions)
            .set({ usageCount: sql`COALESCE(${promotions.usageCount}, 0) + 1` })
            .where(and(
              eq(promotions.id, app.promoId),
              eq(promotions.isActive, true),
              sql`(${promotions.usageLimit} IS NULL OR ${promotions.usageCount} < ${promotions.usageLimit})`
            ))
            .returning({ id: promotions.id });
          if (!promoUpdate) {
            throw new Error('Promo sudah tidak tersedia atau kuota habis');
          }
          if (app.voucherId) {
            const [voucherUpdate] = await tx.update(vouchers).set({
              status: 'used',
              usedAt: new Date(),
              usedByBookingId: bookingId,
            }).where(and(eq(vouchers.id, app.voucherId), eq(vouchers.status, 'active')))
              .returning({ id: vouchers.id });
            if (!voucherUpdate) {
              throw new Error('Voucher sudah digunakan');
            }
          }
        }
      });
    } catch (e) {
      if (useEngine && engineConfirmed.length > 0) {
        try {
          await this.holdsAdapter().compensateConfirms(
            booking.tripId,
            engineConfirmed,
            legIndexes,
            { source: 'payBooking', bookingId },
          );
        } catch (compErr) {
          log.error({ err: compErr, op: "payBooking" }, "compensateConfirms after tx failure failed");
        }
      }
      throw e;
    }

    // Realtime: kursi sudah dibayar/confirmed, refresh seatmap CSO
    for (const seatNo of seatNos) {
      webSocketService.emitInventoryUpdated(booking.tripId, seatNo, legIndexes);
    }

    return {
      bookingId: booking.id,
      status: 'confirmed',
      totalAmount: totalAmount.toString(),
      discountAmount: discountAmount.toString(),
      finalAmount: finalAmount.toString(),
      paymentIntent: {
        paymentId,
        providerRef: paymentRef,
        method: paymentMethod,
        amount: finalAmount.toString(),
      },
    };
  }

  async listBookings(filters: {
    status?: string;
    date?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: BookingListItem[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 20));

    const conditions = [];
    if (filters.status) {
      conditions.push(eq(bookings.status, filters.status as typeof bookings.status.enumValues[number]));
    }
    if (filters.date) {
      conditions.push(eq(trips.serviceDate, filters.date));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .innerJoin(trips, eq(bookings.tripId, trips.id))
      .where(where);
    const total = countResult[0]?.count ?? 0;

    const result = await db.select({
      id: bookings.id,
      bookingCode: bookings.bookingCode,
      tripId: bookings.tripId,
      serviceDate: trips.serviceDate,
      status: bookings.status,
      totalAmount: bookings.totalAmount,
      discountAmount: bookings.discountAmount,
      voucherCode: bookings.voucherCode,
      channel: bookings.channel,
      pendingExpiresAt: bookings.pendingExpiresAt,
      originStopId: bookings.originStopId,
      destinationStopId: bookings.destinationStopId,
      snapOriginStopName: bookings.snapOriginStopName,
      snapDestinationStopName: bookings.snapDestinationStopName,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .innerJoin(trips, eq(bookings.tripId, trips.id))
    .where(where)
    .orderBy(desc(bookings.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

    const bookingIds = result.map(b => b.id);
    let holdExpiryMap = new Map<string, string | null>();
    if (bookingIds.length > 0) {
      const holds = await db.select({
        bookingId: seatHolds.bookingId,
        expiresAt: seatHolds.expiresAt,
      }).from(seatHolds)
        .where(inArray(seatHolds.bookingId, bookingIds));

      for (const h of holds) {
        if (h.bookingId && !holdExpiryMap.has(h.bookingId)) {
          holdExpiryMap.set(h.bookingId, h.expiresAt?.toISOString() ?? null);
        }
      }
    }

    const data = result.map(b => ({
      ...b,
      holdExpiresAt: b.status === 'pending'
        ? (holdExpiryMap.get(b.id) || b.pendingExpiresAt?.toISOString() || null)
        : null,
      finalAmount: (Number(b.totalAmount ?? 0) - Number(b.discountAmount ?? 0)).toString(),
    }));

    return { data, total, page, limit, hasMore: (page - 1) * limit + data.length < total };
  }

  // T-CON-03: batch fetch — kembalikan ringkasan booking utk N IDs dalam 1
  // round-trip DB (Console reconciler polling per-booking → batch). Skip ID
  // yang tidak ditemukan, tidak melempar error. Caller wajib limit ids.length.
  async getBookingsByIds(ids: string[]): Promise<{ bookings: BookingListItem[] }> {
    if (ids.length === 0) return { bookings: [] };

    const result = await db.select({
      id: bookings.id,
      bookingCode: bookings.bookingCode,
      tripId: bookings.tripId,
      serviceDate: trips.serviceDate,
      status: bookings.status,
      totalAmount: bookings.totalAmount,
      discountAmount: bookings.discountAmount,
      voucherCode: bookings.voucherCode,
      channel: bookings.channel,
      pendingExpiresAt: bookings.pendingExpiresAt,
      originStopId: bookings.originStopId,
      destinationStopId: bookings.destinationStopId,
      snapOriginStopName: bookings.snapOriginStopName,
      snapDestinationStopName: bookings.snapDestinationStopName,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .innerJoin(trips, eq(bookings.tripId, trips.id))
    .where(inArray(bookings.id, ids));

    const foundIds = result.map(b => b.id);
    let holdExpiryMap = new Map<string, string | null>();
    if (foundIds.length > 0) {
      const holds = await db.select({
        bookingId: seatHolds.bookingId,
        expiresAt: seatHolds.expiresAt,
      }).from(seatHolds)
        .where(inArray(seatHolds.bookingId, foundIds));
      for (const h of holds) {
        if (h.bookingId && !holdExpiryMap.has(h.bookingId)) {
          holdExpiryMap.set(h.bookingId, h.expiresAt?.toISOString() ?? null);
        }
      }
    }

    const data = result.map(b => ({
      ...b,
      holdExpiresAt: b.status === 'pending'
        ? (holdExpiryMap.get(b.id) || b.pendingExpiresAt?.toISOString() || null)
        : null,
      finalAmount: (Number(b.totalAmount ?? 0) - Number(b.discountAmount ?? 0)).toString(),
    }));

    return { bookings: data };
  }

  async createReview(data: { userId: string; tripId: string; bookingId?: string; rating: number; comment?: string }): Promise<Review> {
    if (data.rating < 1 || data.rating > 5) throw new Error("Rating must be between 1 and 5");

    const existing = await db.select().from(reviews)
      .where(and(eq(reviews.appUserId, data.userId), eq(reviews.tripId, data.tripId)))
      .limit(1);
    if (existing.length > 0) throw new Error("You already reviewed this trip");

    const [review] = await db.insert(reviews).values({
      appUserId: data.userId,
      tripId: data.tripId,
      bookingId: data.bookingId,
      rating: data.rating,
      comment: data.comment
    }).returning();

    return review;
  }

  async getTripReviews(tripId: string): Promise<TripReviewItem[]> {
    const result = await db.select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      userName: appUsers.name,
      userAvatar: appUsers.avatar
    })
    .from(reviews)
    .innerJoin(appUsers, eq(reviews.appUserId, appUsers.id))
    .where(eq(reviews.tripId, tripId))
    .orderBy(desc(reviews.createdAt));

    return result;
  }

  async trackCargo(waybillNumber: string, trackingSecret?: string | null): Promise<{
    waybillNumber: string;
    status: string | null;
    origin: { name: string; code: string; city: string | null } | null;
    destination: { name: string; code: string; city: string | null } | null;
    serviceDate: string | null | undefined;
    patternName: string | null | undefined;
    senderName: string;
    recipientName: string;
    itemDescription: string | null;
    weightKg: string | null;
    totalAmount: string | null;
    createdAt: Date | null;
  }> {
    const shipment = await this.storage.getCargoShipmentByWaybill(waybillNumber);
    if (!shipment) throw new Error("Shipment not found");

    // S1-06: validasi tracking secret. Constant-time compare via Buffer
    // supaya tidak rawan timing attack. Backfilled rows yang sengaja punya
    // secret kosong tetap di-tolak — operator harus regenerate label.
    const expected = shipment.trackingSecret;
    const provided = (trackingSecret || '').trim();
    if (!expected || !provided) {
      throw new Error("Tracking secret diperlukan");
    }
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length) throw new Error("Tracking secret tidak valid");
    const { timingSafeEqual } = await import("node:crypto");
    if (!timingSafeEqual(a, b)) throw new Error("Tracking secret tidak valid");

    const [origin, dest, trip] = await Promise.all([
      this.storage.getStopById(shipment.originStopId),
      this.storage.getStopById(shipment.destinationStopId),
      this.storage.getTripById(shipment.tripId)
    ]);

    let pattern = null;
    if (trip) {
      pattern = await this.storage.getTripPatternById(trip.patternId);
    }

    return {
      waybillNumber: shipment.waybillNumber,
      status: shipment.status,
      origin: origin ? { name: origin.name, code: origin.code, city: origin.city } : null,
      destination: dest ? { name: dest.name, code: dest.code, city: dest.city } : null,
      serviceDate: trip?.serviceDate,
      patternName: pattern?.name,
      senderName: shipment.senderName,
      recipientName: shipment.recipientName,
      itemDescription: shipment.itemDescription,
      weightKg: shipment.weightKg,
      totalAmount: shipment.totalAmount,
      createdAt: shipment.createdAt
    };
  }

  async createAppCargo(params: {
    userId: string;
    tripId: string;
    originStopId: string;
    destinationStopId: string;
    cargoTypeId?: string;
    senderName: string;
    senderPhone: string;
    recipientName: string;
    recipientPhone: string;
    itemDescription: string;
    quantity: number;
    weightKg?: number;
    notes?: string;
  }): Promise<Record<string, unknown>> {
    const { CargoService } = await import("../cargo/cargo.service");
    const { SYSTEM_CONTEXT } = await import("../rbac/rbac.guard");
    const cargoService = new CargoService(this.storage);

    // Customer-app booking flow: customer punya app-auth sendiri (lihat
    // app.auth.ts), bukan staf RBAC, jadi pakai SYSTEM_CONTEXT secara
    // eksplisit. Otorisasi customer dilakukan di route layer
    // (`requireAppAuth`) sebelum sampai ke method ini.
    const shipment = await cargoService.createShipment({
      tripId: params.tripId,
      originStopId: params.originStopId,
      destinationStopId: params.destinationStopId,
      cargoTypeId: params.cargoTypeId,
      senderName: params.senderName,
      senderPhone: params.senderPhone,
      recipientName: params.recipientName,
      recipientPhone: params.recipientPhone,
      itemDescription: params.itemDescription,
      quantity: params.quantity,
      weightKg: params.weightKg?.toString(),
      totalAmount: "0",
      channel: 'APP',
      createdBy: `app:${params.userId}`,
      notes: params.notes
    }, SYSTEM_CONTEXT);

    return shipment;
  }
}
