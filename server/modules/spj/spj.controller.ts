import { Request, Response } from "express";
import { SpjService } from "./spj.service";

const spjService = new SpjService();

export class SpjController {
  async getAll(req: Request, res: Response) {
    try {
      const list = await spjService.getAll();
      res.json(list);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const spj = await spjService.getById(req.params.id);
      if (!spj) return res.status(404).json({ error: "SPJ tidak ditemukan" });
      res.json(spj);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async getByTripId(req: Request, res: Response) {
    try {
      const spj = await spjService.getByTripId(req.params.tripId);
      res.json(spj);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { tripId, driverId, vehicleId, notes } = req.body;
      if (!tripId) return res.status(400).json({ error: "tripId wajib diisi" });
      const spj = await spjService.create(tripId, { driverId, vehicleId, notes });
      res.status(201).json(spj);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async issue(req: Request, res: Response) {
    try {
      const spj = await spjService.updateStatus(req.params.id, 'issued');
      res.json(spj);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async settle(req: Request, res: Response) {
    try {
      const spj = await spjService.updateStatus(req.params.id, 'settled');
      res.json(spj);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async updateNotes(req: Request, res: Response) {
    try {
      const spj = await spjService.updateNotes(req.params.id, req.body.notes || '');
      res.json(spj);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      await spjService.delete(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async updateCostLine(req: Request, res: Response) {
    try {
      const line = await spjService.updateCostLine(req.params.id, req.body);
      res.json(line);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async addCostLine(req: Request, res: Response) {
    try {
      const line = await spjService.addCostLine(req.params.spjId, req.body);
      res.status(201).json(line);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async deleteCostLine(req: Request, res: Response) {
    try {
      await spjService.deleteCostLine(req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  }

  async getTripProfit(req: Request, res: Response) {
    try {
      const profit = await spjService.getTripProfit(req.params.tripId);
      res.json(profit);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
}
