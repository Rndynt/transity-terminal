import { Response } from "express";
import { AppService } from "./app.service";
import { AuthenticatedRequest } from "./app.auth";
import { IStorage } from "../../routes";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const searchSchema = z.object({
  originCity: z.string().min(1),
  destinationCity: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  passengers: z.coerce.number().int().min(1).optional()
});

const createBookingSchema = z.object({
  tripId: z.string().uuid(),
  originStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
  originSeq: z.number().int().min(1),
  destinationSeq: z.number().int().min(2),
  passengers: z.array(z.object({
    fullName: z.string().min(1),
    phone: z.string().optional(),
    idNumber: z.string().optional(),
    seatNo: z.string().min(1)
  })).min(1),
  paymentMethod: z.enum(['qr', 'ewallet', 'bank'])
});

const createReviewSchema = z.object({
  tripId: z.string().uuid(),
  bookingId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional()
});

const createCargoSchema = z.object({
  tripId: z.string().uuid(),
  originStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
  cargoTypeId: z.string().uuid().optional(),
  senderName: z.string().min(1),
  senderPhone: z.string().min(1),
  recipientName: z.string().min(1),
  recipientPhone: z.string().min(1),
  itemDescription: z.string().min(1),
  quantity: z.number().int().min(1),
  weightKg: z.number().optional(),
  notes: z.string().optional()
});

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatar: z.string().optional()
});

export class AppController {
  private service: AppService;

  constructor(storage: IStorage) {
    this.service = new AppService(storage);
  }

  async register(req: AuthenticatedRequest, res: Response) {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const result = await this.service.register(parsed.data.email, parsed.data.password, parsed.data.name, parsed.data.phone);
      res.status(201).json(result);
    } catch (e: any) {
      res.status(409).json({ error: e.message });
    }
  }

  async login(req: AuthenticatedRequest, res: Response) {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const result = await this.service.login(parsed.data.email, parsed.data.password);
      res.json(result);
    } catch (e: any) {
      res.status(401).json({ error: e.message });
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await this.service.getProfile(req.appUser!.userId);
      res.json(user);
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response) {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const user = await this.service.updateProfile(req.appUser!.userId, parsed.data);
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await this.service.getProfile(req.appUser!.userId);
      res.json(user);
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  }

  async getCities(_req: AuthenticatedRequest, res: Response) {
    const cities = await this.service.getCities();
    res.json(cities);
  }

  async getOperators(_req: AuthenticatedRequest, res: Response) {
    const operators = await this.service.getOperators();
    res.json(operators);
  }

  async searchTrips(req: AuthenticatedRequest, res: Response) {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    const results = await this.service.searchTrips(parsed.data);
    res.json(results);
  }

  async getTripDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const detail = await this.service.getTripDetail(req.params.id);
      res.json(detail);
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  }

  async getSeatmap(req: AuthenticatedRequest, res: Response) {
    const { originSeq, destinationSeq } = req.query;
    if (!originSeq || !destinationSeq) return res.status(400).json({ error: "originSeq and destinationSeq required" });
    try {
      const seatmap = await this.service.getSeatmap(req.params.id, Number(originSeq), Number(destinationSeq));
      res.json(seatmap);
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  }

  async createBooking(req: AuthenticatedRequest, res: Response) {
    const parsed = createBookingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const result = await this.service.createAppBooking({
        userId: req.appUser!.userId,
        ...parsed.data
      });
      res.status(201).json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async getMyBookings(req: AuthenticatedRequest, res: Response) {
    const bookings = await this.service.getUserBookings(req.appUser!.userId);
    res.json(bookings);
  }

  async getBookingDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const detail = await this.service.getBookingDetail(req.params.id, req.appUser!.userId);
      res.json(detail);
    } catch (e: any) {
      if (e.message === "Unauthorized") {
        res.status(403).json({ error: e.message });
      } else {
        res.status(404).json({ error: e.message });
      }
    }
  }

  async cancelBooking(req: AuthenticatedRequest, res: Response) {
    try {
      await this.service.cancelBooking(req.params.id, req.appUser!.userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async createReview(req: AuthenticatedRequest, res: Response) {
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const review = await this.service.createReview({
        userId: req.appUser!.userId,
        ...parsed.data
      });
      res.status(201).json(review);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async getTripReviews(req: AuthenticatedRequest, res: Response) {
    const reviews = await this.service.getTripReviews(req.params.tripId);
    res.json(reviews);
  }

  async trackCargo(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await this.service.trackCargo(req.params.waybillNumber);
      res.json(result);
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  }

  async createCargo(req: AuthenticatedRequest, res: Response) {
    const parsed = createCargoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    try {
      const result = await this.service.createAppCargo({
        userId: req.appUser!.userId,
        ...parsed.data
      });
      res.status(201).json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }
}
