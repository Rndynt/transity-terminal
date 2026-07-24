import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { db } from "@server/db";
import { eq, and } from "drizzle-orm";
import { requireFlag, requireAnyFlag } from "./rbac.middleware";
import { createRealmioUser } from "@modules/auth/realmio";
import { staffMembers, users, drivers } from "@shared/schema";

export function registerAdminRoutes(app: FastifyInstance) {
  app.get('/api/admin/roles', { preHandler: [requireAnyFlag('admin.flags.manage', 'admin.staff.manage')] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const { roles } = await import('../../../shared/schema');
    const allRoles = await db.select().from(roles);
    reply.send(allRoles);
  });

  app.get('/api/admin/flags', { preHandler: [requireFlag('admin.flags.manage')] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const { featureFlags } = await import('../../../shared/schema');
    const allFlags = await db.select().from(featureFlags);
    reply.send(allFlags);
  });

  app.get('/api/admin/role-flags', { preHandler: [requireFlag('admin.flags.manage')] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const { roleFlags } = await import('../../../shared/schema');
    const matrix = await db.select().from(roleFlags);
    reply.send(matrix);
  });

  app.put('/api/admin/role-flags/:roleId/:flagId', { preHandler: [requireFlag('admin.flags.manage')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { roleFlags } = await import('../../../shared/schema');
    const { roleId, flagId } = req.params as { roleId: string; flagId: string };
    const { enabled } = req.body as { enabled: boolean };

    const existing = await db.select().from(roleFlags).where(and(eq(roleFlags.roleId, roleId), eq(roleFlags.flagId, flagId)));
    if (existing.length > 0) {
      const [updated] = await db.update(roleFlags).set({ enabled }).where(and(eq(roleFlags.roleId, roleId), eq(roleFlags.flagId, flagId))).returning();
      reply.send(updated);
    } else {
      const [created] = await db.insert(roleFlags).values({ roleId, flagId, enabled }).returning();
      reply.send(created);
    }
  });

  app.get('/api/admin/staff', { preHandler: [requireFlag('admin.staff.manage')] }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const rows = await db
      .select({
        id:        staffMembers.id,
        userId:    staffMembers.userId,
        roleId:    staffMembers.roleId,
        outletId:  staffMembers.outletId,
        isActive:  staffMembers.isActive,
        createdAt: staffMembers.createdAt,
        name:      users.name,
        email:     users.email,
        driverId:  drivers.id,
        driverName: drivers.name,
      })
      .from(staffMembers)
      .leftJoin(users, eq(staffMembers.userId, users.id))
      .leftJoin(drivers, eq(drivers.userId, staffMembers.userId));

    reply.send(rows);
  });

  app.post('/api/admin/staff', { preHandler: [requireFlag('admin.staff.manage')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { name, email, password, roleId, outletId, isActive, driverId } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      roleId?: string;
      outletId?: string | null;
      isActive?: boolean;
      driverId?: string;
    };

    if (!name || !email || !password || !roleId) {
      return reply.code(400).send({ message: 'name, email, password, dan roleId wajib diisi' });
    }

    if (driverId) {
      const [targetDriver] = await db.select({ userId: drivers.userId }).from(drivers).where(eq(drivers.id, driverId));
      if (!targetDriver) return reply.code(400).send({ message: 'Driver tidak ditemukan' });
      if (targetDriver.userId) return reply.code(409).send({ message: 'Driver ini sudah tertaut ke user lain' });
    }

    let realmioUser: { userId: string; email: string; name: string };
    try {
      realmioUser = await createRealmioUser(name, email, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal membuat akun di sistem autentikasi';
      return reply.code(422).send({ message });
    }

    const now = new Date();
    await db
      .insert(users)
      .values({
        id:        realmioUser.userId,
        email:     realmioUser.email,
        name:      realmioUser.name,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { name: realmioUser.name, email: realmioUser.email, updatedAt: now },
      });

    const [created] = await db
      .insert(staffMembers)
      .values({
        userId:   realmioUser.userId,
        roleId,
        outletId: outletId || null,
        isActive: isActive !== false,
      })
      .returning();

    if (driverId) {
      try {
        await db.update(drivers).set({ userId: realmioUser.userId }).where(eq(drivers.id, driverId));
      } catch (err: any) {
        if (err?.code === '23505') {
          return reply.code(201).send({
            ...created,
            name:  realmioUser.name,
            email: realmioUser.email,
            driverLinkError: 'Driver ini sudah tertaut ke user lain',
          });
        }
        throw err;
      }
    }

    reply.code(201).send({
      ...created,
      name:  realmioUser.name,
      email: realmioUser.email,
    });
  });

  app.put('/api/admin/staff/:id', { preHandler: [requireFlag('admin.staff.manage')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const { roleId, outletId, isActive, driverId } = req.body as {
      roleId?: string;
      outletId?: string | null;
      isActive?: boolean;
      driverId?: string | null;
    };
    const updates: Partial<typeof staffMembers.$inferInsert> = {};
    if (roleId !== undefined) updates.roleId = roleId;
    if (outletId !== undefined) updates.outletId = outletId || null;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db
      .update(staffMembers)
      .set(updates)
      .where(eq(staffMembers.id, id))
      .returning();

    if (!updated) return reply.code(404).send({ message: 'Staff member not found' });

    if (driverId !== undefined) {
      if (driverId === null) {
        await db.update(drivers).set({ userId: null }).where(eq(drivers.userId, updated.userId));
      } else {
        const [targetDriver] = await db.select({ userId: drivers.userId }).from(drivers).where(eq(drivers.id, driverId));
        if (!targetDriver) return reply.code(400).send({ message: 'Driver tidak ditemukan' });
        if (targetDriver.userId && targetDriver.userId !== updated.userId) {
          return reply.code(409).send({ message: 'Driver ini sudah tertaut ke user lain' });
        }
        // A user maps to at most one driver: clear any other driver currently pointing at this user.
        await db.update(drivers).set({ userId: null }).where(eq(drivers.userId, updated.userId));
        try {
          await db.update(drivers).set({ userId: updated.userId }).where(eq(drivers.id, driverId));
        } catch (err: any) {
          if (err?.code === '23505') {
            return reply.code(409).send({ message: 'Driver ini sudah tertaut ke user lain' });
          }
          throw err;
        }
      }
    }

    const user = await db.select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, updated.userId))
      .limit(1);

    reply.send({ ...updated, name: user[0]?.name ?? null, email: user[0]?.email ?? null });
  });

  app.delete('/api/admin/staff/:id', { preHandler: [requireFlag('admin.staff.manage')] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    await db.delete(staffMembers).where(eq(staffMembers.id, id));
    reply.code(204).send();
  });
}
