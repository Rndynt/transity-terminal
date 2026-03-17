import { db } from "../../db";
import { 
  appUsers, reviews, bookings, passengers, payments, trips, tripPatterns, 
  tripStopTimes, stops, patternStops, vehicles, cargoShipments, cargoTypes,
  seatInventory, tripLegs, seatHolds,
  type AppUser, type InsertAppUser, type Review, type InsertReview
} from "@shared/schema";
import { eq, and, desc, sql, gte, lte, inArray, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signToken, type AppUserPayload } from "./app.auth";
import { IStorage } from "../../routes";

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
    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.avatar !== undefined) updates.avatar = data.avatar;

    const [user] = await db.update(appUsers).set(updates).where(eq(appUsers.id, userId)).returning();
    if (!user) throw new Error("User not found");
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  async getCities(): Promise<{ city: string; stopCount: number }[]> {
    const result = await db.execute(sql`
      SELECT city, COUNT(*)::int as stop_count
      FROM stops
      WHERE city IS NOT NULL AND city != ''
      GROUP BY city
      ORDER BY city
    `);
    return result.rows.map((r: any) => ({ city: r.city, stopCount: r.stop_count }));
  }

  async searchTrips(params: {
    originCity: string;
    destinationCity: string;
    date: string;
    passengers?: number;
  }): Promise<any[]> {
    const originStops = await db.select({ id: stops.id, name: stops.name, code: stops.code })
      .from(stops)
      .where(eq(stops.city, params.originCity));

    const destStops = await db.select({ id: stops.id, name: stops.name, code: stops.code })
      .from(stops)
      .where(eq(stops.city, params.destinationCity));

    if (originStops.length === 0 || destStops.length === 0) return [];

    const originStopIds = originStops.map(s => s.id);
    const destStopIds = destStops.map(s => s.id);

    const result = await db.select({
      tripId: trips.id,
      serviceDate: trips.serviceDate,
      patternId: trips.patternId,
      patternCode: tripPatterns.code,
      patternName: tripPatterns.name,
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
      })
      .from(tripStopTimes)
      .innerJoin(stops, eq(tripStopTimes.stopId, stops.id))
      .where(eq(tripStopTimes.tripId, trip.tripId))
      .orderBy(tripStopTimes.stopSequence);

      const originST = stopTimes.find(st => originStopIds.includes(st.stopId));
      const destST = stopTimes.find(st => destStopIds.includes(st.stopId) && st.stopSequence > (originST?.stopSequence ?? 0));

      if (!originST || !destST) return null;

      const availableSeats = await this.getAvailableSeatsCount(trip.tripId, originST.stopSequence, destST.stopSequence);

      const fareQuote = await this.getBaseFare(trip.tripId, originST.stopSequence, destST.stopSequence);

      return {
        tripId: trip.tripId,
        serviceDate: trip.serviceDate,
        patternCode: trip.patternCode,
        patternName: trip.patternName,
        vehicleCode: trip.vehicleCode,
        origin: { stopId: originST.stopId, name: originST.stopName, code: originST.stopCode, sequence: originST.stopSequence, departAt: originST.departAt },
        destination: { stopId: destST.stopId, name: destST.stopName, code: destST.stopCode, sequence: destST.stopSequence, arriveAt: destST.arriveAt },
        availableSeats,
        farePerPerson: fareQuote,
        stops: stopTimes.map(st => ({
          stopId: st.stopId,
          name: st.stopName,
          code: st.stopCode,
          sequence: st.stopSequence,
          arriveAt: st.arriveAt,
          departAt: st.departAt
        }))
      };
    }));

    return enriched.filter(Boolean);
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

  async getTripDetail(tripId: string): Promise<any> {
    const trip = await this.storage.getTripById(tripId);
    if (!trip) throw new Error("Trip not found");

    const [pattern, stopTimes] = await Promise.all([
      this.storage.getTripPatternById(trip.patternId),
      this.storage.getTripStopTimesWithEffectiveFlags(tripId)
    ]);

    const stopsData = await Promise.all(
      stopTimes.map(async (st: any) => {
        const stop = await this.storage.getStopById(st.stopId);
        return {
          stopId: st.stopId,
          name: stop?.name || st.stopName,
          code: stop?.code || st.stopCode,
          city: stop?.city,
          sequence: st.stopSequence,
          arriveAt: st.arriveAt,
          departAt: st.departAt,
          boardingAllowed: st.effectiveBoardingAllowed,
          alightingAllowed: st.effectiveAlightingAllowed
        };
      })
    );

    const reviewStats = await db.execute(sql`
      SELECT COUNT(*)::int as count, COALESCE(AVG(rating), 0)::numeric(3,1) as avg_rating
      FROM reviews WHERE trip_id = ${tripId}
    `);

    return {
      tripId: trip.id,
      serviceDate: trip.serviceDate,
      patternCode: pattern?.code,
      patternName: pattern?.name,
      capacity: trip.capacity,
      status: trip.status,
      stops: stopsData,
      reviews: {
        count: reviewStats.rows[0]?.count || 0,
        avgRating: Number(reviewStats.rows[0]?.avg_rating || 0)
      }
    };
  }

  async getSeatmap(tripId: string, originSeq: number, destinationSeq: number): Promise<any> {
    const trip = await this.storage.getTripById(tripId);
    if (!trip) throw new Error("Trip not found");

    const layoutId = trip.layoutId;
    if (!layoutId) throw new Error("Trip has no layout");

    const layout = await this.storage.getLayoutById(layoutId);
    if (!layout) throw new Error("Layout not found");

    const legIndexes: number[] = [];
    for (let i = originSeq; i < destinationSeq; i++) legIndexes.push(i);

    const inventory = await this.storage.getSeatInventory(tripId, legIndexes);

    const seatAvailability: Record<string, { available: boolean; held: boolean }> = {};
    const seatMap = layout.seatMap as any[];

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

  async createAppBooking(params: {
    userId: string;
    tripId: string;
    originStopId: string;
    destinationStopId: string;
    originSeq: number;
    destinationSeq: number;
    passengers: { fullName: string; phone?: string; idNumber?: string; seatNo: string }[];
    paymentMethod: 'qr' | 'ewallet' | 'bank';
  }): Promise<any> {
    const { PricingService } = await import("../pricing/pricing.service");
    const pricingService = new PricingService(this.storage);
    const fareQuote = await pricingService.quoteFare(params.tripId, params.originSeq, params.destinationSeq);

    const totalAmount = Number(fareQuote.total) * params.passengers.length;

    const legIndexes: number[] = [];
    for (let i = params.originSeq; i < params.destinationSeq; i++) legIndexes.push(i);

    for (const pax of params.passengers) {
      const inv = await db.select().from(seatInventory).where(
        and(
          eq(seatInventory.tripId, params.tripId),
          eq(seatInventory.seatNo, pax.seatNo),
          inArray(seatInventory.legIndex, legIndexes)
        )
      );
      const booked = inv.some(r => r.booked);
      if (booked) throw new Error(`Seat ${pax.seatNo} is already booked`);
    }

    const booking = await this.storage.createBooking({
      tripId: params.tripId,
      originStopId: params.originStopId,
      destinationStopId: params.destinationStopId,
      originSeq: params.originSeq,
      destinationSeq: params.destinationSeq,
      appUserId: params.userId,
      channel: 'APP',
      status: 'confirmed',
      totalAmount: totalAmount.toString(),
      createdBy: `app:${params.userId}`
    });

    for (const pax of params.passengers) {
      await this.storage.createPassenger({
        bookingId: booking.id,
        fullName: pax.fullName,
        phone: pax.phone,
        idNumber: pax.idNumber,
        seatNo: pax.seatNo,
        fareAmount: fareQuote.perPassenger.toString(),
        fareBreakdown: fareQuote.breakdown
      });

      await db.update(seatInventory)
        .set({ booked: true, holdRef: null })
        .where(and(
          eq(seatInventory.tripId, params.tripId),
          eq(seatInventory.seatNo, pax.seatNo),
          inArray(seatInventory.legIndex, legIndexes)
        ));

      await db.delete(seatHolds)
        .where(and(
          eq(seatHolds.tripId, params.tripId),
          eq(seatHolds.seatNo, pax.seatNo)
        ));
    }

    await this.storage.createPayment({
      bookingId: booking.id,
      method: params.paymentMethod,
      amount: totalAmount.toString(),
      status: 'pending'
    });

    return this.getBookingDetail(booking.id);
  }

  async getUserBookings(userId: string): Promise<any[]> {
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

  async getBookingDetail(bookingId: string, userId?: string): Promise<any> {
    const booking = await this.storage.getBookingById(bookingId);
    if (!booking) throw new Error("Booking not found");
    if (userId && booking.appUserId && booking.appUserId !== userId) throw new Error("Unauthorized");

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

    return {
      id: booking.id,
      tripId: booking.tripId,
      serviceDate: trip?.serviceDate,
      patternCode: pattern?.code,
      patternName: pattern?.name,
      origin: origin ? { stopId: origin.id, name: origin.name, code: origin.code, city: origin.city } : null,
      destination: dest ? { stopId: dest.id, name: dest.name, code: dest.code, city: dest.city } : null,
      departAt,
      arriveAt,
      status: booking.status,
      totalAmount: booking.totalAmount,
      channel: booking.channel,
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

    for (const p of pax) {
      await db.update(seatInventory)
        .set({ booked: false, holdRef: null })
        .where(and(
          eq(seatInventory.tripId, booking.tripId),
          eq(seatInventory.seatNo, p.seatNo),
          inArray(seatInventory.legIndex, legIndexes)
        ));
    }

    await this.storage.updateBooking(bookingId, { status: 'canceled' });
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

  async getTripReviews(tripId: string): Promise<any[]> {
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

  async trackCargo(waybillNumber: string): Promise<any> {
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
  }): Promise<any> {
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
