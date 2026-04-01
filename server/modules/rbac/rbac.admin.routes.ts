import type { FastifyInstance } from "fastify";
import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import { requireFlag, requireAnyFlag } from "./rbac.middleware";
import { createRealmioUser } from "../auth/realmio";
import { staffMembers, users } from "../../../shared/schema";

export function registerAdminRoutes(app: FastifyInstance) {
  app.get('/api/admin/roles', { preHandler: [requireAnyFlag('admin.flags.manage', 'admin.staff.manage')] }, async (_req: any, reply: any) => {
    const { roles } = await import('../../../shared/schema');
    const allRoles = await db.select().from(roles);
    reply.send(allRoles);
  });

  app.get('/api/admin/flags', { preHandler: [requireFlag('admin.flags.manage')] }, async (_req: any, reply: any) => {
    const { featureFlags } = await import('../../../shared/schema');
    const allFlags = await db.select().from(featureFlags);
    reply.send(allFlags);
  });

  app.get('/api/admin/role-flags', { preHandler: [requireFlag('admin.flags.manage')] }, async (_req: any, reply: any) => {
    const { roleFlags } = await import('../../../shared/schema');
    const matrix = await db.select().from(roleFlags);
    reply.send(matrix);
  });

  app.put('/api/admin/role-flags/:roleId/:flagId', { preHandler: [requireFlag('admin.flags.manage')] }, async (req: any, reply: any) => {
    const { roleFlags } = await import('../../../shared/schema');
    const { roleId, flagId } = req.params;
    const { enabled } = req.body;

    const existing = await db.select().from(roleFlags).where(and(eq(roleFlags.roleId, roleId), eq(roleFlags.flagId, flagId)));
    if (existing.length > 0) {
      const [updated] = await db.update(roleFlags).set({ enabled }).where(and(eq(roleFlags.roleId, roleId), eq(roleFlags.flagId, flagId))).returning();
      reply.send(updated);
    } else {
      const [created] = await db.insert(roleFlags).values({ roleId, flagId, enabled }).returning();
      reply.send(created);
    }
  });

  app.get('/api/admin/staff', { preHandler: [requireFlag('admin.staff.manage')] }, async (_req: any, reply: any) => {
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
      })
      .from(staffMembers)
      .leftJoin(users, eq(staffMembers.userId, users.id));

    reply.send(rows);
  });

  app.post('/api/admin/staff', { preHandler: [requireFlag('admin.staff.manage')] }, async (req: any, reply: any) => {
    const { name, email, password, roleId, outletId, isActive } = req.body;

    if (!name || !email || !password || !roleId) {
      return reply.code(400).send({ message: 'name, email, password, dan roleId wajib diisi' });
    }

    let realmioUser: { userId: string; email: string; name: string };
    try {
      realmioUser = await createRealmioUser(name, email, password);
    } catch (err: any) {
      return reply.code(422).send({ message: err.message || 'Gagal membuat akun di sistem autentikasi' });
    }

    await db
      .insert(users)
      .values({
        id:    realmioUser.userId,
        email: realmioUser.email,
        name:  realmioUser.name,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: { name: realmioUser.name, email: realmioUser.email },
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

    reply.code(201).send({
      ...created,
      name:  realmioUser.name,
      email: realmioUser.email,
    });
  });

  app.put('/api/admin/staff/:id', { preHandler: [requireFlag('admin.staff.manage')] }, async (req: any, reply: any) => {
    const id = req.params.id;
    const { roleId, outletId, isActive } = req.body;
    const updates: any = {};
    if (roleId !== undefined) updates.roleId = roleId;
    if (outletId !== undefined) updates.outletId = outletId || null;
    if (isActive !== undefined) updates.isActive = isActive;

    const [updated] = await db
      .update(staffMembers)
      .set(updates)
      .where(eq(staffMembers.id, id))
      .returning();

    if (!updated) return reply.code(404).send({ message: 'Staff member not found' });

    const user = await db.select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, updated.userId))
      .limit(1);

    reply.send({ ...updated, name: user[0]?.name ?? null, email: user[0]?.email ?? null });
  });

  app.delete('/api/admin/staff/:id', { preHandler: [requireFlag('admin.staff.manage')] }, async (req: any, reply: any) => {
    await db.delete(staffMembers).where(eq(staffMembers.id, req.params.id));
    reply.code(204).send();
  });
}
