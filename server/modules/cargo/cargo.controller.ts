import { Request, Response } from "express";
import { CargoService } from "./cargo.service";
import { IStorage } from "../../routes";
import { insertCargoShipmentSchema } from "@shared/schema";

export class CargoController {
  private cargoService: CargoService;

  constructor(storage: IStorage) {
    this.cargoService = new CargoService(storage);
  }

  async getAll(req: Request, res: Response) {
    const { tripId, status, outletId } = req.query;
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
    } catch (error: any) {
      if (error.message?.includes('Invalid status') || error.message?.includes('Cannot transition')) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }
  }
}
