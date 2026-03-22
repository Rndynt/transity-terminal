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

export function requireAnyFlag(...flagIds: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.rbac || !flagIds.some(f => req.rbac!.flags.has(f))) {
      res.status(403).json({ error: "Forbidden", requiredFlags: flagIds });
      return;
    }
    next();
  };
}

export function requireOutletScope() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const outletId = req.rbac?.outletId ?? null;
    req.scopedOutletId = outletId;
    req.outletId = outletId;
    next();
  };
}
