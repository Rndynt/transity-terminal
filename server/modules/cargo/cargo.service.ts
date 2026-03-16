import { IStorage } from "../../routes";
import { InsertCargoShipment, CargoShipment } from "@shared/schema";

const VALID_STATUSES = ['pending', 'in_transit', 'arrived', 'delivered', 'canceled'] as const;
type CargoStatus = typeof VALID_STATUSES[number];

const ALLOWED_TRANSITIONS: Record<CargoStatus, CargoStatus[]> = {
  pending: ['in_transit', 'canceled'],
  in_transit: ['arrived', 'canceled'],
  arrived: ['delivered'],
  delivered: [],
  canceled: []
};

export class CargoService {
  constructor(private storage: IStorage) {}

  generateWaybillNumber(): string {
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = String(Math.floor(10000 + Math.random() * 90000));
    return `TRN-${datePart}-${randomPart}`;
  }

  async getAllShipments(filters?: { tripId?: string; status?: string; outletId?: string }): Promise<CargoShipment[]> {
    return await this.storage.getCargoShipments(filters);
  }

  async getShipmentById(id: string): Promise<CargoShipment> {
    const shipment = await this.storage.getCargoShipmentById(id);
    if (!shipment) throw new Error(`Cargo shipment with id ${id} not found`);
    return shipment;
  }

  async getShipmentByWaybill(waybillNumber: string): Promise<CargoShipment> {
    const shipment = await this.storage.getCargoShipmentByWaybill(waybillNumber);
    if (!shipment) throw new Error(`Cargo shipment with waybill ${waybillNumber} not found`);
    return shipment;
  }

  async createShipment(data: Omit<InsertCargoShipment, 'waybillNumber'>): Promise<CargoShipment> {
    const maxRetries = 5;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const waybillNumber = this.generateWaybillNumber();
      try {
        return await this.storage.createCargoShipment({ ...data, waybillNumber });
      } catch (error: any) {
        if (error?.code === '23505' && error?.constraint?.includes('waybill')) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('Failed to generate unique waybill number after multiple attempts');
  }

  async updateShipment(id: string, data: Partial<InsertCargoShipment>): Promise<CargoShipment> {
    await this.getShipmentById(id);
    return await this.storage.updateCargoShipment(id, data);
  }

  async updateShipmentStatus(id: string, newStatus: string): Promise<CargoShipment> {
    if (!VALID_STATUSES.includes(newStatus as CargoStatus)) {
      throw new Error(`Invalid status: ${newStatus}. Valid: ${VALID_STATUSES.join(', ')}`);
    }

    const shipment = await this.getShipmentById(id);
    const currentStatus = (shipment.status || 'pending') as CargoStatus;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(newStatus as CargoStatus)) {
      throw new Error(`Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowed.join(', ') || 'none'}`);
    }

    const updates: Partial<InsertCargoShipment> = { status: newStatus as any };
    if (newStatus === 'delivered') {
      updates.paidAt = new Date();
    }
    return await this.storage.updateCargoShipment(id, updates);
  }
}
