import type { RealmioUser } from "@server/modules/auth/realmio";
import type { EffectivePermissions } from "@server/modules/rbac/rbac.service";
import type { AppUserPayload } from "@server/modules/app/app.auth";

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
