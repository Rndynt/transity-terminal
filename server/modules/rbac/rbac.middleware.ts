import type { Request, Response, NextFunction } from "express";

export function requireFlag(flagId: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.rbac || !req.rbac.flags.has(flagId)) {
      res.status(403).json({ error: "Forbidden", requiredFlag: flagId });
      return;
    }
    next();
  };
}

export function requireOutletScope() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.scopedOutletId = req.rbac?.outletId ?? null;
    next();
  };
}
