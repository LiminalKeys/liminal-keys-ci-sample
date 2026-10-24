import { describe, expect, it } from 'vitest';
import { validateOidcOrCiKey } from '../src/lib/auth.js';

describe('validateOidcOrCiKey', () => {
  it('requires id-token permissions when ci-key is empty', () => {
    expect(
      validateOidcOrCiKey({ ciKey: '', hasIdTokenRequestUrl: false }),
    ).toMatch(/permissions: id-token: write/);
  });

  it('allows OIDC when request URL is present', () => {
    expect(
      validateOidcOrCiKey({ ciKey: '', hasIdTokenRequestUrl: true }),
    ).toBeUndefined();
  });

  it('allows CI key without OIDC', () => {
    expect(
      validateOidcOrCiKey({ ciKey: 'lkci_test', hasIdTokenRequestUrl: false }),
    ).toBeUndefined();
  });
});
