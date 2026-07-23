import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAudio } from '../src/audio/sfx.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Coilbreak audio path', () => {
  it('createAudio exposes play() cues used by the game loop', () => {
    const a = createAudio();
    expect(typeof a.beep).toBe('function');
    expect(typeof a.play).toBe('function');
    expect(typeof a.ensure).toBe('function');
    // soft-fail without AudioContext — must not throw
    expect(() => a.play('kill')).not.toThrow();
    expect(() => a.play('hit')).not.toThrow();
    expect(() => a.play('fire')).not.toThrow();
    expect(() => a.play('coil')).not.toThrow();
  });

  it('main.js invokes audio.play from the real frame loop', () => {
    const src = readFileSync(join(ROOT, 'src/main.js'), 'utf8');
    expect(src).toMatch(/createAudio/);
    expect(src).toMatch(/audio\.play\(['"]kill['"]\)/);
    expect(src).toMatch(/audio\.play\(['"]hit['"]\)/);
    expect(src).toMatch(/audio\.play\(['"]fire['"]\)/);
  });
});
