import { describe, expect, it } from 'vitest';
import { redactSecrets, safeErrorMessage, containsSecret } from '../src/lib/redaction.js';

describe('redaction', () => {
  const secret = 'lkci_super_secret_value_12345';

  it('redacts known secrets in text', () => {
    const text = `Authorization: Bearer ${secret} done`;
    expect(redactSecrets(text, [secret])).toBe('Authorization: Bearer *** done');
    expect(redactSecrets(text, [secret])).not.toContain(secret);
  });

  it('safeErrorMessage never returns raw secrets', () => {
    const err = new Error(`token ${secret} leaked`);
    expect(safeErrorMessage(err.message, [secret])).not.toContain(secret);
  });

  it('detects accidental secret leakage', () => {
    expect(containsSecret(`value ${secret}`, [secret])).toBe(true);
    expect(containsSecret('clean output', [secret])).toBe(false);
  });
});
