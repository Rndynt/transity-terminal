import { Request, Response } from "express";
import { DriversService } from "./drivers.service";
import { IStorage } from "../../routes";
import { insertDriverSchema } from "@shared/schema";

export class DriversController {
  private service: DriversService;

  constructor(storage: IStorage) {
    this.service = new DriversService(storage);
  }

  async getAll(req: Request, res: Response) {
    const drivers = await this.service.getAllDrivers();
    res.json(drivers);
  }

  async getById(req: Request, res: Response) {
    const driver = await this.service.getDriverById(req.params.id);
    res.json(driver);
  }

  async create(req: Request, res: Response) {
    const data = insertDriverSchema.parse(req.body);
    const driver = await this.service.createDriver(data);
    res.status(201).json(driver);
  }

  async update(req: Request, res: Response) {
    const data = insertDriverSchema.partial().parse(req.body);
    const driver = await this.service.updateDriver(req.params.id, data);
    res.json(driver);
  }

  async delete(req: Request, res: Response) {
    await this.service.deleteDriver(req.params.id);
    res.status(204).send();
  }
}
