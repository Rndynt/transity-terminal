import { db } from "@server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("[backfill-promo-conditions] Starting...");

  const rows = await db.execute(sql`
    SELECT id, scope, scope_ref_id, applicable_channels
    FROM promotions
  `);

  let inserted = 0;
  let skipped = 0;

  for (const r of rows.rows as Array<{
    id: string;
    scope: string | null;
    scope_ref_id: string | null;
    applicable_channels: string[] | null;
  }>) {
    const conditions: { type: string; values: string[] }[] = [];

    if (r.scope && r.scope !== 'global' && r.scope_ref_id) {
      let refIds: string[] = [];
      try {
        const parsed = JSON.parse(r.scope_ref_id);
        refIds = Array.isArray(parsed) ? parsed.filter(Boolean) : [r.scope_ref_id];
      } catch {
        refIds = [r.scope_ref_id];
      }
      if (refIds.length > 0) {
        const typeMap: Record<string, string> = {
          pattern: 'route',
          trip: 'trip',
          outlet: 'outlet',
        };
        const t = typeMap[r.scope];
        if (t) conditions.push({ type: t, values: refIds });
      }
    }

    if (r.applicable_channels && r.applicable_channels.length > 0) {
      conditions.push({ type: 'channel', values: r.applicable_channels });
    }

    if (conditions.length === 0) {
      skipped++;
      continue;
    }

    await db.transaction(async (tx) => {
      await tx.execute(sql`DELETE FROM promotion_conditions WHERE promo_id = ${r.id}`);
      for (const c of conditions) {
        await tx.execute(sql`
          INSERT INTO promotion_conditions (promo_id, type, values)
          VALUES (${r.id}, ${c.type}, ${JSON.stringify(c.values)}::jsonb)
        `);
        inserted++;
      }
    });
  }

  console.log(`[backfill-promo-conditions] Done. Inserted ${inserted} conditions across ${rows.rows.length - skipped} promos. Skipped ${skipped} (global / empty).`);
  process.exit(0);
}

main().catch((e) => {
  console.error("[backfill-promo-conditions] Failed:", e);
  process.exit(1);
});
