import { describe, expect, it } from 'vitest';
import { buildSpawnOptions } from '../src/lib/exec-json.js';

const HOST_CLI =
  '/Applications/Liminal Keys Virtual Smartcard.app/Contents/Helpers/LiminalKeysHostCLI';

describe('buildSpawnOptions', () => {
  it('keeps executable paths with spaces in the file field (not split like @actions/exec)', () => {
    const { file, args, options } = buildSpawnOptions(
      HOST_CLI,
      ['ci', 'enroll', '--json'],
      { env: { FOO: 'bar' } },
    );

    expect(file).toBe(HOST_CLI);
    expect(file).not.toBe('/Applications/Liminal');
    expect(args).toEqual(['ci', 'enroll', '--json']);
    expect(options.shell).toBe(false);
    expect(options.env).toMatchObject({ FOO: 'bar' });
  });
});
