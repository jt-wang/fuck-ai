import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

/**
 * Validates that schema.sql contains all expected frontier models.
 * This test acts as a guard against missing popular models.
 */
describe('model list completeness', () => {
  const schema = readFileSync('db/schema.sql', 'utf-8');

  const expectedModels = [
    // Anthropic
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-sonnet-4-5',
    'claude-haiku-4-5',
    // OpenAI - GPT
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
    'gpt-5.4-pro',
    'gpt-4.1',
    'gpt-4.1-mini',
    'gpt-4o',
    // OpenAI - Codex
    'gpt-5.3-codex',
    'gpt-5.2-codex',
    'gpt-5.1-codex',
    'codex-mini',
    // OpenAI - reasoning
    'o3',
    'o3-pro',
    'o4-mini',
    // Google
    'gemini-3.1-pro',
    'gemini-3-flash',
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    // xAI
    'grok-4',
    'grok-4-fast',
    'grok-4.20-beta',
    'grok-3',
    'grok-code-fast-1',
    // DeepSeek
    'deepseek-r1',
    'deepseek-v3',
    'deepseek-v3.2',
    // Meta
    'llama-4-maverick',
    'llama-4-scout',
    // Qwen
    'qwen-3.5',
    'qwen-3-coder',
    'qwen3-coder-next',
    // Mistral
    'codestral',
    'mistral-large',
    'devstral',
    // Moonshot / MiniMax
    'kimi-k2.5',
    'minimax-m2.5',
  ];

  for (const slug of expectedModels) {
    it(`includes ${slug}`, () => {
      expect(schema).toContain(`'${slug}'`);
    });
  }

  it('has at least 40 models', () => {
    const matches = schema.match(/INSERT OR IGNORE INTO models[\s\S]*?;/);
    expect(matches).not.toBeNull();
    const count = (matches![0].match(/\('/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(40);
  });
});
