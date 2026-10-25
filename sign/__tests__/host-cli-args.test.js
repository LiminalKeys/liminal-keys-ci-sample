import { describe, expect, it } from 'vitest';
import {
  HOST_CLI_OPTION_FLAGS,
  assertHostCliOptionFlags,
  buildCiEnrollArgs,
  buildCiSignCheckArgs,
  buildCiUnenrollArgs,
  formatCiTtlDuration,
} from '../src/lib/host-cli-args.js';

describe('formatCiTtlDuration', () => {
  it('maps action ttl-minutes to Host CLI --ttl duration', () => {
    expect(formatCiTtlDuration(60)).toBe('60m');
    expect(formatCiTtlDuration(5)).toBe('5m');
  });
});

describe('Host CLI argv builders', () => {
  it('buildCiEnrollArgs uses --ttl not --ttl-minutes', () => {
    const argv = buildCiEnrollArgs({
      tenantId: '11111111-1111-1111-1111-111111111111',
      ttlMinutes: 45,
      apiBaseUrl: 'https://api.liminalkeys.com',
      identitySha1: 'ABCDEF0123456789ABCDEF0123456789ABCDEF01',
      useCiKey: false,
    });
    expect(argv).not.toContain('--ttl-minutes');
    expect(argv).toContain('--ttl');
    expect(argv).toContain('45m');
    expect(argv).toContain('--auth');
    expect(argv).toContain('github-oidc');
    assertHostCliOptionFlags(argv);
  });

  it('buildCiEnrollArgs passes ci-key auth when requested', () => {
    const argv = buildCiEnrollArgs({
      tenantId: '11111111-1111-1111-1111-111111111111',
      ttlMinutes: 90,
      apiBaseUrl: 'https://api.liminalkeys.com',
      useCiKey: true,
    });
    expect(argv).toContain('--auth');
    expect(argv).toContain('ci-key');
    assertHostCliOptionFlags(argv);
  });

  it('buildCiSignCheckArgs only uses documented flags', () => {
    const argv = buildCiSignCheckArgs({
      identitySha1: 'ABCDEF0123456789ABCDEF0123456789ABCDEF01',
      apiBaseUrl: 'https://api.liminalkeys.com',
    });
    expect(argv[0]).toBe('ci');
    expect(argv[1]).toBe('sign-check');
    assertHostCliOptionFlags(argv);
  });

  it('buildCiUnenrollArgs only uses documented flags', () => {
    const argv = buildCiUnenrollArgs({ apiBaseUrl: 'https://api.liminalkeys.com' });
    expect(argv).toEqual(['ci', 'unenroll', '--json', '--api-base-url', 'https://api.liminalkeys.com']);
    assertHostCliOptionFlags(argv);
  });

  it('rejects unknown flags in regression guard', () => {
    expect(() => assertHostCliOptionFlags(['ci', 'enroll', '--ttl-minutes', '60'])).toThrow(
      /--ttl-minutes/,
    );
  });

  it('HOST_CLI_OPTION_FLAGS matches HostCLISupport help surface', () => {
    expect(HOST_CLI_OPTION_FLAGS.has('--ttl')).toBe(true);
    expect(HOST_CLI_OPTION_FLAGS.has('--tenant-id')).toBe(true);
    expect(HOST_CLI_OPTION_FLAGS.has('--ttl-minutes')).toBe(false);
  });
});
