import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Guards against the mojibake corruption that hit public/locales: UTF-8 text
// decoded as latin1/cp1252 shows up as lead chars (U+00C2..U+00F4) followed by
// continuation-range chars or cp1252 punctuation specials.
const LOCALES_DIR = fileURLToPath(
  new URL('../public/locales', import.meta.url)
);

const CONT_CLASS =
  '[\\u0080-\\u00bf\\u0192\\u201a\\u201e\\u2026\\u2020\\u2021\\u02c6\\u2030\\u0160\\u2039\\u0152\\u017d\\u2018\\u2019\\u201c\\u201d\\u2022\\u2013\\u2014\\u02dc\\u2122\\u0161\\u203a\\u0153\\u017e\\u0178\\u20ac]';
const MOJIBAKE_RE = new RegExp(`[\\u00c2-\\u00f4]${CONT_CLASS}`);
const C1_RE = /[\u0080-\u009f]/;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const files = walk(LOCALES_DIR).filter((f) => f.endsWith('.json'));

describe('locale files', () => {
  it('found locale files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s is valid UTF-8 JSON without BOM or mojibake', (file) => {
    const buf = readFileSync(file);
    expect(buf[0]).not.toBe(0xef); // no UTF-8 BOM
    const text = buf.toString('utf8');
    expect(text).not.toContain('�');
    expect(text).not.toMatch(C1_RE);
    expect(text).not.toMatch(MOJIBAKE_RE);
    expect(() => JSON.parse(text)).not.toThrow();
  });
});
