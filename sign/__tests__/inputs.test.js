import { describe, expect, it } from 'vitest';
import {
  normalizeIdentitySha1,
  parseTtlMinutes,
  normalizeApiBaseUrl,
} from '../src/lib/inputs.js';

describe('normalizeIdentitySha1', () => {
  it('strips colons and spaces and uppercases', () => {
    expect(normalizeIdentitySha1('ab:cd:ef:01:23:45:67:89:0a:bc:de:f0:12:34:56:78:90:ab:cd:ef')).toBe(
      'ABCDEF01234567890ABCDEF01234567890ABCDEF',
    );
    expect(normalizeIdentitySha1('  abcdef01234567890abcdef01234567890abcdef  ')).toBe(
      'ABCDEF01234567890ABCDEF01234567890ABCDEF',
    );
  });

  it('returns undefined for empty input', () => {
    expect(normalizeIdentitySha1('')).toBeUndefined();
    expect(normalizeIdentitySha1(undefined)).toBeUndefined();
  });

  it('throws on invalid thumbprints', () => {
    expect(() => normalizeIdentitySha1('not-hex')).toThrow(/40-character hex/);
    expect(() => normalizeIdentitySha1('ABCDEF01234567890ABCDEF01234567890ABCDE')).toThrow(
      /40-character hex/,
    );
  });
});

describe('parseTtlMinutes', () => {
  it('defaults to 60', () => {
    expect(parseTtlMinutes(undefined)).toBe(60);
    expect(parseTtlMinutes('')).toBe(60);
  });

  it('accepts 5–120', () => {
    expect(parseTtlMinutes('5')).toBe(5);
    expect(parseTtlMinutes('120')).toBe(120);
  });

  it('rejects out of range', () => {
    expect(() => parseTtlMinutes('4')).toThrow(/5 and 120/);
    expect(() => parseTtlMinutes('121')).toThrow(/5 and 120/);
  });
});

describe('normalizeApiBaseUrl', () => {
  it('trims trailing slashes', () => {
    expect(normalizeApiBaseUrl('https://api.liminalkeys.com/')).toBe(
      'https://api.liminalkeys.com',
    );
  });
});
