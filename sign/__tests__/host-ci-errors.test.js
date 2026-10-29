import { describe, expect, it } from 'vitest';
import { classifyHostCliFailure } from '../src/lib/host-ci-errors.js';

describe('classifyHostCliFailure', () => {
  it('maps CI agent bridge errors to actionable headline', () => {
    const { headline, detail } = classifyHostCliFailure({
      exitCode: 1,
      stdout: '',
      stderr: 'Host not in --ci-agent mode. Quit the Host...',
      phase: 'enroll',
    });
    expect(headline).toBe('Host not in --ci-agent mode');
    expect(detail).toContain('open -gj -a');
  });

  it('maps bridge timeouts to host not responding', () => {
    const { headline } = classifyHostCliFailure({
      exitCode: 124,
      stdout: '',
      stderr: 'CLI bridge timed out waiting for Host response after 90s',
      timedOut: true,
      phase: 'status',
    });
    expect(headline).toBe('Host not responding (keychain locked or prompt pending?)');
  });
});
