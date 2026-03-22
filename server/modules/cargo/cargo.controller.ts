import { Request, Response } from "express";
import { CargoService } from "./cargo.service";
import { IStorage } from "../../routes";
import { insertCargoShipmentSchema, insertCargoTypeSchema, insertCargoRateSchema } from "@shared/schema";

export class CargoController {
  private cargoService: CargoService;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.cargoService = new CargoService(storage);
    this.storage = storage;
  }

  async getAll(req: Request, res: Response) {
    const { tripId, status } = req.query;
    const scopedOutlet = req.scopedOutletId ?? req.rbac?.outletId ?? null;
    const outletId = scopedOutlet ?? (req.query.outletId as string | undefined);
    const shipments = await this.cargoService.getAllShipments({
      tripId: tripId as string,
      status: status as string,
      outletId: outletId as string
    });
    res.json(shipments);
  }

  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const shipment = await this.cargoService.getShipmentById(id);
    res.json(shipment);
  }

  async getByWaybill(req: Request, res: Response) {
    const { waybillNumber } = req.params;
    const shipment = await this.cargoService.getShipmentByWaybill(waybillNumber);
    res.json(shipment);
  }

  async create(req: Request, res: Response) {
    const validated = insertCargoShipmentSchema.omit({ waybillNumber: true }).parse(req.body);
    const scopedOutlet = req.scopedOutletId ?? req.rbac?.outletId ?? null;
    if (scopedOutlet) {
      validated.outletId = scopedOutlet;
    }
    const shipment = await this.cargoService.createShipment(validated);
    res.status(201).json(shipment);
  }

  async update(req: Request, res: Response) {
    const { id } = req.params;
    const validated = insertCargoShipmentSchema.partial().parse(req.body);
    const shipment = await this.cargoService.updateShipment(id, validated);
    res.json(shipment);
  }

  async updateStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    try {
      const shipment = await this.cargoService.updateShipmentStatus(id, status);
      res.json(shipment);
    } catch (error: unknown) {
      const err = error as Error;
      if (err.message?.includes('Invalid status') || err.message?.includes('Cannot transition')) {
        return res.status(400).json({ error: err.message });
      }
      throw error;
    }
  }

  async quoteTariff(req: Request, res: Response) {
    const { cargoTypeId, originStopId, destinationStopId, weightKg, tripId } = req.query;
    if (!cargoTypeId || !originStopId || !destinationStopId || !weightKg) {
      return res.status(400).json({ error: 'cargoTypeId, originStopId, destinationStopId, weightKg are required' });
    }
    const result = await this.cargoService.calculateTariff(
      cargoTypeId as string,
      originStopId as string,
      destinationStopId as string,
      parseFloat(weightKg as string),
      tripId as string | undefined
    );
    if (!result) {
      return res.json({ found: false, calculatedAmount: 0 });
    }
    res.json({ found: true, ...result });
  }

  async getCargoTypes(_req: Request, res: Response) {
    const types = await this.storage.getCargoTypes();
    res.json(types);
  }

  async getCargoTypeById(req: Request, res: Response) {
    const { id } = req.params;
    const ct = await this.storage.getCargoTypeById(id);
    if (!ct) return res.status(404).json({ error: 'Cargo type not found' });
    res.json(ct);
  }

  async createCargoType(req: Request, res: Response) {
    const validated = insertCargoTypeSchema.parse(req.body);
    const ct = await this.storage.createCargoType(validated);
    res.status(201).json(ct);
  }

  async updateCargoType(req: Request, res: Response) {
    const { id } = req.params;
    const validated = insertCargoTypeSchema.partial().parse(req.body);
    const ct = await this.storage.updateCargoType(id, validated);
    res.json(ct);
  }

  async deleteCargoType(req: Request, res: Response) {
    const { id } = req.params;
    await this.storage.deleteCargoType(id);
    res.status(204).send();
  }

  async getCargoRates(req: Request, res: Response) {
    const { cargoTypeId } = req.query;
    const rates = await this.storage.getCargoRates(cargoTypeId as string);
    res.json(rates);
  }

  async getCargoRateById(req: Request, res: Response) {
    const { id } = req.params;
    const cr = await this.storage.getCargoRateById(id);
    if (!cr) return res.status(404).json({ error: 'Cargo rate not found' });
    res.json(cr);
  }

  async createCargoRate(req: Request, res: Response) {
    const validated = insertCargoRateSchema.parse(req.body);
    if (validated.scope && validated.scope !== 'global' && !validated.scopeRefId) {
      return res.status(400).json({ message: 'scopeRefId is required when scope is pattern or trip' });
    }
    const cr = await this.storage.createCargoRate(validated);
    res.status(201).json(cr);
  }

  async updateCargoRate(req: Request, res: Response) {
    const { id } = req.params;
    const validated = insertCargoRateSchema.partial().parse(req.body);
    const existing = await this.storage.getCargoRateById(id);
    if (!existing) return res.status(404).json({ error: 'Cargo rate not found' });
    const effectiveScope = validated.scope ?? existing.scope ?? 'global';
    const effectiveRefId = validated.scopeRefId !== undefined ? validated.scopeRefId : existing.scopeRefId;
    if (effectiveScope !== 'global' && !effectiveRefId) {
      return res.status(400).json({ message: 'scopeRefId is required when scope is pattern or trip' });
    }
    const cr = await this.storage.updateCargoRate(id, validated);
    res.json(cr);
  }

  async deleteCargoRate(req: Request, res: Response) {
    const { id } = req.params;
    await this.storage.deleteCargoRate(id);
    res.status(204).send();
  }
}
