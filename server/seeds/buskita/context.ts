export interface SeedContext {
  stops: Record<string, any>;
  outlets: any[];
  layouts: Record<string, any>;
  vehicles: Record<string, any>;
  patterns: Record<string, any>;
  tripBases: any[];
  validFrom: string;
  validTo: string;
  channelAll: Record<string, boolean>;
}

export function createSeedContext(): SeedContext {
  const currentYear = new Date().getFullYear();
  return {
    stops: {},
    outlets: [],
    layouts: {},
    vehicles: {},
    patterns: {},
    tripBases: [],
    validFrom: `${currentYear}-01-01`,
    validTo: `${currentYear + 1}-12-31`,
    channelAll: { CSO: true, WEB: true, APP: true, OTA: false },
  };
}
