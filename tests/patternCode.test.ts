import { describe, it, expect } from 'vitest';
import { computeNextPatternSeq, buildPatternCode, buildPatternNameBase } from '@/lib/patternCode';

describe('computeNextPatternSeq', () => {
  it('starts at 01 when no existing pattern shares the pair', () => {
    expect(computeNextPatternSeq('CWLC', 'BLKM', [])).toBe('01');
  });

  it('increments based on the highest existing seq for the exact pair', () => {
    const patterns = [
      { id: '1', code: 'CWLC-BLKM-01' },
      { id: '2', code: 'CWLC-BLKM-02' },
    ];
    expect(computeNextPatternSeq('CWLC', 'BLKM', patterns)).toBe('03');
  });

  it('is unaffected by gaps and only looks at the max, not the count', () => {
    const patterns = [
      { id: '1', code: 'CWLC-BLKM-01' },
      { id: '2', code: 'CWLC-BLKM-05' },
    ];
    expect(computeNextPatternSeq('CWLC', 'BLKM', patterns)).toBe('06');
  });

  it('ignores patterns for a different origin/destination pair', () => {
    const patterns = [{ id: '1', code: 'JKT-BDG-05' }];
    expect(computeNextPatternSeq('CWLC', 'BLKM', patterns)).toBe('01');
  });

  it('treats the reversed direction as an independent sequence', () => {
    const patterns = [{ id: '1', code: 'CWLC-BLKM-01' }];
    expect(computeNextPatternSeq('BLKM', 'CWLC', patterns)).toBe('01');
  });

  it('excludes the pattern currently being edited', () => {
    const patterns = [
      { id: '1', code: 'CWLC-BLKM-01' },
      { id: '2', code: 'CWLC-BLKM-02' },
    ];
    expect(computeNextPatternSeq('CWLC', 'BLKM', patterns, '2')).toBe('02');
  });

  it('still matches codes that carry a free suffix beyond the seq', () => {
    const patterns = [{ id: '1', code: 'CWLC-BLKM-01-REG' }];
    expect(computeNextPatternSeq('CWLC', 'BLKM', patterns)).toBe('02');
  });

  it('does not false-match a pair whose codes are a prefix of another stop code', () => {
    // CWL vs CWLC must not collide
    const patterns = [{ id: '1', code: 'CWLC-BLKM-01' }];
    expect(computeNextPatternSeq('CWL', 'BLKM', patterns)).toBe('01');
  });
});

describe('buildPatternCode', () => {
  it('builds a plain code without a suffix', () => {
    expect(buildPatternCode('CWLC', 'BLKM', '01')).toBe('CWLC-BLKM-01');
  });

  it('appends a trimmed suffix with a single leading dash', () => {
    expect(buildPatternCode('CWLC', 'BLKM', '01', 'REG')).toBe('CWLC-BLKM-01-REG');
  });

  it('ignores a blank/whitespace-only suffix', () => {
    expect(buildPatternCode('CWLC', 'BLKM', '01', '   ')).toBe('CWLC-BLKM-01');
  });
});

describe('buildPatternNameBase', () => {
  it('joins origin and destination names with " - "', () => {
    expect(buildPatternNameBase('Halte Citywalk Lippo Cikarang', 'Blok M (Jl. Palatehan II)'))
      .toBe('Halte Citywalk Lippo Cikarang - Blok M (Jl. Palatehan II)');
  });
});
