import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('post step', () => {
  it('never fails the job (warnings only)', () => {
    const src = readFileSync(path.join(import.meta.dirname, '../src/post.js'), 'utf8');
    expect(src).not.toMatch(/setFailed/);
    expect(src).toMatch(/catch \(err\)/);
    expect(src).toMatch(/core\.warning/);
  });

  it('runs post hook only outside vitest', () => {
    const src = readFileSync(path.join(import.meta.dirname, '../src/post.js'), 'utf8');
    expect(src).toMatch(/process\.env\.VITEST/);
  });
});
