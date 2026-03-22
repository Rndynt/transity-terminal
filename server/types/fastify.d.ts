import type { RealmioUser } from "../modules/auth/realmio";
import type { EffectivePermissions } from "../modules/rbac/rbac.service";
import type { AppUserPayload } from "../modules/app/app.auth";

declare module "fastify" {
  interface FastifyRequest {
    user?: RealmioUser;
    rbac?: EffectivePermissions;
    scopedOutletId?: string | null;
    outletId?: string | null;
    appUser?: AppUserPayload;
    rawBody?: Buffer;
  }
}
