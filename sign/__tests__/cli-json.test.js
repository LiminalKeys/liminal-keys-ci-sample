import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CliJsonParseError,
  parseLastJsonObject,
  pickEnrollFields,
  parseSignCheckReport,
  summarizeUnenrollPayload,
  tryPickDeviceId,
} from '../src/lib/cli-json.js';

const enrollFixture = JSON.parse(
  readFileSync(path.join(import.meta.dirname, 'fixtures/ci-enroll-result.json'), 'utf8'),
);

describe('pickEnrollFields (CiEnrollCLIResult)', () => {
  it('maps deviceId + identities[].sha1 from Host CLI enroll JSON', () => {
    const fields = pickEnrollFields(enrollFixture);
    expect(fields.deviceId).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(fields.signingSha1).toBe('ABCDEF01234567890ABCDEF01234567890ABCDEF');
    expect(fields.expiresAt).toBe('2026-10-25T14:08:00Z');
  });

  it('prefers identity-sha1 input when listed in identities', () => {
    const fields = pickEnrollFields(enrollFixture, {
      preferredIdentitySha1: 'ABCDEF01234567890ABCDEF01234567890ABCDEF',
    });
    expect(fields.signingSha1).toBe('ABCDEF01234567890ABCDEF01234567890ABCDEF');
  });

  it('accepts legacy top-level signingSha1 alias', () => {
    const fields = pickEnrollFields({
      deviceId: 'x',
      signing_sha1: 'abcdef0123456789abcdef0123456789abcdef01',
    });
    expect(fields.signingSha1).toBe('ABCDEF0123456789ABCDEF0123456789ABCDEF01');
  });

  it('throws CliJsonParseError with top-level keys only (no values)', () => {
    try {
      pickEnrollFields({ ok: true, tenantId: 't' });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(CliJsonParseError);
      expect(err.topLevelKeys.sort()).toEqual(['ok', 'tenantId']);
      expect(err.message).not.toContain('11111111');
    }
  });

  it('tryPickDeviceId extracts device id for post cleanup hints', () => {
    expect(tryPickDeviceId(enrollFixture)).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
  });
});

describe('parseSignCheckReport (HostDoctorReport)', () => {
  it('reads ok and checks array', () => {
    const report = parseSignCheckReport({
      ok: true,
      checks: [{ name: 'export-smartcard', status: 'PASS', message: 'ok' }],
    });
    expect(report.ok).toBe(true);
    expect(report.checks).toHaveLength(1);
  });
});

describe('summarizeUnenrollPayload (CiEnrollCLIResult)', () => {
  it('uses ok when present', () => {
    expect(summarizeUnenrollPayload({ ok: true })).toBe('ok');
  });
});

describe('parseLastJsonObject', () => {
  it('parses trailing JSON line from CLI stdout', () => {
    const payload = parseLastJsonObject('info line\n{"ok":true,"deviceId":"d"}\n');
    expect(payload.ok).toBe(true);
  });
});
