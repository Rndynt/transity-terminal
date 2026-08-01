// Pure helpers for the structured Kode Pola / Nama Pola generator (PatternCodeBuilder).
// Kept framework-free and side-effect-free on purpose so the trickiest bit — the
// per-(origin,destination) sequence computation — can be unit tested directly
// under the existing node-environment vitest setup (see tests/patternCode.test.ts),
// without needing a jsdom/React Testing Library harness this repo doesn't have.

export interface MinimalPattern {
  id: string;
  code: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Next available 2-digit sequence for an exact (origin, destination) code pair,
 * i.e. the next number after the highest existing `{origin}-{dest}-NN` among
 * `patterns` (excluding `excludeId`, so the pattern currently being edited never
 * counts against itself). Starts at "01". Direction matters: BLKM-CWLC is a
 * different pair (and a different sequence) than CWLC-BLKM.
 */
export function computeNextPatternSeq(
  originCode: string,
  destCode: string,
  patterns: MinimalPattern[],
  excludeId?: string
): string {
  const prefix = `${originCode}-${destCode}-`;
  const re = new RegExp(`^${escapeRegExp(prefix)}(\\d{2})`);
  let max = 0;
  for (const p of patterns) {
    if (excludeId && p.id === excludeId) continue;
    const m = p.code.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return String(max + 1).padStart(2, '0');
}

/** Assembles the final Kode Pola string: ORIGIN-DEST-SEQ[-SUFFIX]. */
export function buildPatternCode(originCode: string, destCode: string, seq: string, suffix?: string): string {
  const clean = (suffix || '').trim();
  return `${originCode}-${destCode}-${seq}${clean ? `-${clean}` : ''}`;
}

/** Assembles the auto-generated Nama Pola base: "Origin Name - Destination Name". */
export function buildPatternNameBase(originName: string, destName: string): string {
  return `${originName} - ${destName}`;
}
