import { describe, expect, it } from 'vitest';
import { isSelfHostedRunner } from '../src/lib/runner.js';

describe('isSelfHostedRunner', () => {
  it('detects self-hosted', () => {
    expect(isSelfHostedRunner({ RUNNER_ENVIRONMENT: 'self-hosted' })).toBe(true);
  });

  it('treats github-hosted and unset as not self-hosted', () => {
    expect(isSelfHostedRunner({ RUNNER_ENVIRONMENT: 'github-hosted' })).toBe(false);
    expect(isSelfHostedRunner({})).toBe(false);
  });
});
