import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * Ensures README.md and SKILL.md stay in sync with the model list in schema.sql.
 */
describe('docs model list sync', () => {
  const schema = readFileSync('db/schema.sql', 'utf-8');
  const readme = readFileSync('../README.md', 'utf-8');
  const skill = readFileSync('../skill/SKILL.md', 'utf-8');

  // Extract all slugs from schema INSERT
  const slugs = [...schema.matchAll(/'([a-z0-9][\w.-]+)',\s*'[^']+',\s*'[^']+'/g)]
    .map((m) => m[1]);

  it('schema has at least 40 models', () => {
    expect(slugs.length).toBeGreaterThanOrEqual(40);
  });

  it('README says correct model count', () => {
    expect(readme).toContain(`${slugs.length} models`);
  });

  it('SKILL.md contains all model slugs', () => {
    const missing = slugs.filter((s) => !skill.includes(s));
    expect(missing, `SKILL.md missing: ${missing.join(', ')}`).toEqual([]);
  });
});
