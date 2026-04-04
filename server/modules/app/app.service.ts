import { db } from "@server/db";
import { 
  appUsers, reviews, bookings, payments, trips, tripPatterns, 
  tripStopTimes, stops, patternStops, vehicles, cargoShipments, cargoTypes,
  seatInventory, tripLegs, seatHolds, tripBases, scheduleExceptions,
  operatorSettings,
  type AppUser, type InsertAppUser, type Review, type InsertReview
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte, inArray, gt, isNull } from "drizzle-orm";
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
} from "../bookings/booking.helpers";

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
  farePerPerson: number;
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
}

export class AppService {
  constructor(private storage: IStorage) {}

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
    const data = all.slice(offset, offset + limit);

    return { data, total, page, limit, hasMore: offset + data.length < total };
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

    const enriched = await Promise.all(result.map(async (trip) => {
      const stopTimes = await db.select({
        stopId: tripStopTimes.stopId,
        stopSequence: tripStopTimes.stopSequence,
        arriveAt: tripStopTimes.arriveAt,
        departAt: tripStopTimes.departAt,
        stopName: stops.name,
        stopCode: stops.code,
        stopCity: stops.city,
      })
      .from(tripStopTimes)
      .innerJoin(stops, eq(tripStopTimes.stopId, stops.id))
      .where(eq(tripStopTimes.tripId, trip.tripId))
      .orderBy(tripStopTimes.stopSequence);

      const originST = stopTimes.find(st => originStopIds.includes(st.stopId));
      const destSTList = stopTimes.filter(st => destStopIds.includes(st.stopId) && st.stopSequence > (originST?.stopSequence ?? 0));
      const destST = destSTList.length > 0 ? destSTList[destSTList.length - 1] : null;

      if (!originST || !destST) return null;

      const [availableSeats, fareQuote] = await Promise.all([
        this.getAvailableSeatsCount(trip.tripId, originST.stopSequence, destST.stopSequence),
        this.getBaseFare(trip.tripId, originST.stopSequence, destST.stopSequence)
      ]);

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
        stops: stopTimes.map(st => ({
          stopId: st.stopId,
          name: st.stopName,
          code: st.stopCode,
          city: st.stopCity,
          sequence: st.stopSequence,
          arriveAt: st.arriveAt,
          departAt: st.departAt
        }))
      };
    }));

    return enriched.filter((t) => t !== null) as (TripSearchResult & { _baseId?: string })[];
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

    const results: (TripSearchResult & { _baseId?: string })[] = [];

    for (const base of bases) {
      const pattern = patternsMap.get(base.patternId);
      if (!pattern) continue;

      const pStops = patternStopsMap.get(base.patternId) || [];
      const defaultTimes = (base.defaultStopTimes as any[]) || [];

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

      const originTime = defaultTimes.find((t: any) => t.stopSequence === originPS.stopSequence);
      const destTime = defaultTimes.find((t: any) => t.stopSequence === destPS.stopSequence);

      const originDepartUtc = originTime?.departAt ? fromZonedHHMMToUtc(params.date, originTime.departAt, 'Asia/Jakarta') : null;
      const destArriveUtc = destTime?.arriveAt ? fromZonedHHMMToUtc(params.date, destTime.arriveAt, 'Asia/Jakarta') : null;

      if (destArriveUtc && originDepartUtc && destArriveUtc.getTime() <= originDepartUtc.getTime()) {
        destArriveUtc.setDate(destArriveUtc.getDate() + 1);
      }

      const fareQuote = await this.getPatternFare(base.patternId, originPS.stopSequence, destPS.stopSequence);

      const stopsData: TripStopPointWithCity[] = pStops.map(ps => {
        const t = defaultTimes.find((dt: any) => dt.stopSequence === ps.stopSequence);
        const departUtc = t?.departAt ? fromZonedHHMMToUtc(params.date, t.departAt, 'Asia/Jakarta') : null;
        const arriveUtc = t?.arriveAt ? fromZonedHHMMToUtc(params.date, t.arriveAt, 'Asia/Jakarta') : null;
        return {
          stopId: ps.stopId,
          name: (ps as any).stop?.name || '',
          code: (ps as any).stop?.code || '',
          city: (ps as any).stop?.city || undefined,
          sequence: ps.stopSequence,
          departAt: departUtc?.toISOString() || null,
          arriveAt: arriveUtc?.toISOString() || null,
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
          name: (originPS as any).stop?.name || '',
          code: (originPS as any).stop?.code || '',
          sequence: originPS.stopSequence,
          departAt: originDepartUtc?.toISOString() || null,
          arriveAt: null,
        },
        destination: {
          stopId: destPS.stopId,
          name: (destPS as any).stop?.name || '',
          code: (destPS as any).stop?.code || '',
          sequence: destPS.stopSequence,
          departAt: null,
          arriveAt: destArriveUtc?.toISOString() || null,
        },
        availableSeats: base.capacity || 14,
        farePerPerson: fareQuote,
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
      const result = Array.isArray(rows) ? rows : (rows as any).rows || [];
      if (result.length > 0) {
        const ruleData = result[0].rule as any;
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

    const stopsData: TripDetailResponse['stops'] = await Promise.all(
      stopTimes.map(async (st: { stopId: string; stopName?: string; stopCode?: string; stopSequence: number; arriveAt: string | null; departAt: string | null; effectiveBoardingAllowed: boolean; effectiveAlightingAllowed: boolean }) => {
        const stop = await this.storage.getStopById(st.stopId);
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
      })
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
    paymentMethod: 'qr' | 'ewallet' | 'bank';
    serviceDate?: string;
  }): Promise<BookingDetailResponse> {
    const resolvedTripId = await this.resolveTripId(params.tripId, params.serviceDate);

    await validateBoardingAlighting(this.storage, resolvedTripId, params.originSeq, params.destinationSeq);

    const { fareQuote, total: totalAmount } = await calculateBookingTotal(
      this.storage, resolvedTripId, params.originSeq, params.destinationSeq,
      params.passengers.length
    );

    const legIndexes = computeLegIndexes(params.originSeq, params.destinationSeq);
    const seatNos = params.passengers.map(p => p.seatNo);

    const HOLD_TTL_MINUTES = 15;
    const holdExpiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);

    const snapshots = await fetchBookingSnapshots(this.storage, resolvedTripId, params.originStopId, params.destinationStopId, null, params.originSeq);

    const bookingId = await db.transaction(async (tx) => {
      await checkSeatsAvailable(tx, resolvedTripId, seatNos, legIndexes);

      const [booking] = await tx.insert(bookings).values({
        tripId: resolvedTripId,
        bookingCode: generateBookingCode(),
        originStopId: params.originStopId,
        destinationStopId: params.destinationStopId,
        originSeq: params.originSeq,
        destinationSeq: params.destinationSeq,
        appUserId: params.userId,
        channel: 'APP',
        status: 'pending',
        pendingExpiresAt: holdExpiresAt,
        totalAmount: totalAmount.toString(),
        discountAmount: '0',
        ...snapshots,
        createdBy: params.userId ? `app:${params.userId}` : 'service-client'
      }).returning({ id: bookings.id });

      await insertPassengerRows(tx, booking.id, params.passengers, fareQuote);
      await createSeatHoldsForBooking(tx, resolvedTripId, booking.id, seatNos, legIndexes, params.userId, holdExpiresAt);

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

      return booking.id;
    });

    return this.getBookingDetail(bookingId);
  }

  async processPaymentWebhook(providerRef: string, gatewayStatus: 'success' | 'failed'): Promise<WebhookResult> {
    const [payment] = await db.select().from(payments).where(eq(payments.providerRef, providerRef)).limit(1);
    if (!payment) throw new Error("Payment not found");
    if (payment.status !== 'pending') throw new Error("Payment already processed");

    const booking = await this.storage.getBookingById(payment.bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== 'pending') throw new Error("Booking is no longer pending");

    const pax = await this.storage.getPassengers(booking.id);
    const legIndexes: number[] = [];
    for (let i = booking.originSeq; i < booking.destinationSeq; i++) legIndexes.push(i);

    if (gatewayStatus === 'failed') {
      await db.transaction(async (tx) => {
        await tx.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));
        await tx.update(bookings).set({ status: 'canceled' }).where(eq(bookings.id, booking.id));

        for (const p of pax) {
          await tx.update(seatInventory)
            .set({ holdRef: null })
            .where(and(
              eq(seatInventory.tripId, booking.tripId),
              eq(seatInventory.seatNo, p.seatNo),
              inArray(seatInventory.legIndex, legIndexes)
            ));
          await tx.delete(seatHolds).where(and(
            eq(seatHolds.tripId, booking.tripId),
            eq(seatHolds.seatNo, p.seatNo)
          ));
        }
      });
      return { status: 'failed', bookingId: booking.id };
    }

    await db.transaction(async (tx) => {
      const activeHolds = await tx.select().from(seatHolds)
        .where(and(
          eq(seatHolds.bookingId, booking.id),
          gt(seatHolds.expiresAt, new Date())
        ));

      if (activeHolds.length === 0) {
        for (const p of pax) {
          await tx.update(seatInventory)
            .set({ holdRef: null })
            .where(and(
              eq(seatInventory.tripId, booking.tripId),
              eq(seatInventory.seatNo, p.seatNo),
              inArray(seatInventory.legIndex, legIndexes)
            ));
          await tx.delete(seatHolds).where(and(
            eq(seatHolds.tripId, booking.tripId),
            eq(seatHolds.seatNo, p.seatNo)
          ));
        }
        await tx.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));
        await tx.update(bookings).set({ status: 'canceled' }).where(eq(bookings.id, booking.id));
        throw new Error("Seat holds have expired. Booking cannot be confirmed.");
      }

      for (const p of pax) {
        const seatRows = await tx.execute(sql`
          SELECT seat_no, booked FROM seat_inventory
          WHERE trip_id = ${booking.tripId}
            AND seat_no = ${p.seatNo}
            AND leg_index = ANY(${legIndexes})
          FOR UPDATE
        `);
        const alreadyBooked = seatRows.rows.some((r: Record<string, unknown>) => r.booked === true);
        if (alreadyBooked) {
          await tx.update(payments).set({ status: 'failed' }).where(eq(payments.id, payment.id));
          await tx.update(bookings).set({ status: 'canceled' }).where(eq(bookings.id, booking.id));
          for (const px of pax) {
            await tx.update(seatInventory)
              .set({ holdRef: null })
              .where(and(
                eq(seatInventory.tripId, booking.tripId),
                eq(seatInventory.seatNo, px.seatNo),
                inArray(seatInventory.legIndex, legIndexes)
              ));
            await tx.delete(seatHolds).where(and(
              eq(seatHolds.tripId, booking.tripId),
              eq(seatHolds.seatNo, px.seatNo)
            ));
          }
          throw new Error(`Seat ${p.seatNo} is no longer available. Booking canceled.`);
        }
      }

      await tx.update(bookings)
        .set({ status: 'confirmed' })
        .where(eq(bookings.id, booking.id));

      for (const p of pax) {
        await tx.update(seatInventory)
          .set({ booked: true, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, booking.tripId),
            eq(seatInventory.seatNo, p.seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ));

        await tx.delete(seatHolds)
          .where(and(
            eq(seatHolds.tripId, booking.tripId),
            eq(seatHolds.seatNo, p.seatNo)
          ));
      }

      await tx.update(payments)
        .set({ status: 'success', paidAt: new Date() })
        .where(eq(payments.id, payment.id));
    });

    return { status: 'success', bookingId: booking.id };
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

  async getUserBookings(userId: string): Promise<UserBookingSummary[]> {
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
      channel: bookings.channel,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .innerJoin(trips, eq(bookings.tripId, trips.id))
    .innerJoin(tripPatterns, eq(trips.patternId, tripPatterns.id))
    .where(eq(bookings.appUserId, userId))
    .orderBy(desc(bookings.createdAt));

    const enriched = await Promise.all(result.map(async (b) => {
      const [origin, dest, pax] = await Promise.all([
        this.storage.getStopById(b.originStopId),
        this.storage.getStopById(b.destinationStopId),
        this.storage.getPassengers(b.id)
      ]);
      return {
        ...b,
        origin: origin ? { name: origin.name, code: origin.code, city: origin.city } : null,
        destination: dest ? { name: dest.name, code: dest.code, city: dest.city } : null,
        passengerCount: pax.length
      };
    }));

    return enriched;
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
      tripId: booking.tripId,
      serviceDate: trip?.serviceDate,
      patternCode: pattern?.code,
      patternName: pattern?.name,
      origin: origin ? { stopId: origin.id, name: origin.name, code: origin.code, city: origin.city } : null,
      destination: dest ? { stopId: dest.id, name: dest.name, code: dest.code, city: dest.city } : null,
      departAt: departAt ? String(departAt) : null,
      arriveAt: arriveAt ? String(arriveAt) : null,
      status: booking.status,
      totalAmount: booking.totalAmount,
      channel: booking.channel,
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

  async cancelBooking(bookingId: string, userId: string): Promise<void> {
    const booking = await this.storage.getBookingById(bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.appUserId !== userId) throw new Error("Unauthorized");
    if (!['pending', 'confirmed'].includes(booking.status!)) {
      throw new Error("Booking cannot be canceled");
    }

    const pax = await this.storage.getPassengers(bookingId);
    const legIndexes: number[] = [];
    for (let i = booking.originSeq; i < booking.destinationSeq; i++) legIndexes.push(i);

    await db.transaction(async (tx) => {
      for (const p of pax) {
        await tx.update(seatInventory)
          .set({ booked: false, holdRef: null })
          .where(and(
            eq(seatInventory.tripId, booking.tripId),
            eq(seatInventory.seatNo, p.seatNo),
            inArray(seatInventory.legIndex, legIndexes)
          ));

        await tx.delete(seatHolds).where(and(
          eq(seatHolds.tripId, booking.tripId),
          eq(seatHolds.seatNo, p.seatNo),
          eq(seatHolds.bookingId, bookingId)
        ));
      }

      await tx.update(bookings)
        .set({ status: 'canceled' })
        .where(eq(bookings.id, bookingId));
    });
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

  async trackCargo(waybillNumber: string): Promise<{
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
    const cargoService = new CargoService(this.storage);

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
    });

    return shipment;
  }
}
