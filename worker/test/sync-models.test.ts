import { describe, it, expect } from 'vitest';
import {
  normalizeForDedup,
  parseOpenRouterModel,
  PROVIDER_MAP,
  type OpenRouterModel,
} from '../src/cron/sync-models';

describe('sync-models', () => {
  describe('normalizeForDedup', () => {
    it('strips non-alphanumeric characters', () => {
      expect(normalizeForDedup('claude-opus-4-6')).toBe('claudeopus46');
      expect(normalizeForDedup('claude-opus-4.6')).toBe('claudeopus46');
    });

    it('lowercases', () => {
      expect(normalizeForDedup('GPT-5.4')).toBe('gpt54');
    });

    it('makes OpenRouter and manual slugs match', () => {
      // These pairs should normalize to the same string
      expect(normalizeForDedup('claude-opus-4-6')).toBe(normalizeForDedup('claude-opus-4.6'));
      expect(normalizeForDedup('claude-sonnet-4-6')).toBe(normalizeForDedup('claude-sonnet-4.6'));
      expect(normalizeForDedup('claude-sonnet-4-5')).toBe(normalizeForDedup('claude-sonnet-4.5'));
      expect(normalizeForDedup('claude-haiku-4-5')).toBe(normalizeForDedup('claude-haiku-4.5'));
      expect(normalizeForDedup('gpt-5.4')).toBe(normalizeForDedup('gpt-5.4'));
      expect(normalizeForDedup('gemini-2.5-flash')).toBe(normalizeForDedup('gemini-2.5-flash'));
    });
  });

  describe('parseOpenRouterModel', () => {
    it('extracts slug, display_name, and provider from OpenRouter model', () => {
      const model: OpenRouterModel = {
        id: 'anthropic/claude-opus-4.6',
        name: 'Anthropic: Claude Opus 4.6',
      };
      const result = parseOpenRouterModel(model);
      expect(result).toEqual({
        slug: 'claude-opus-4.6',
        display_name: 'Claude Opus 4.6',
        provider: 'Anthropic',
      });
    });

    it('strips provider prefix from display name', () => {
      const model: OpenRouterModel = {
        id: 'openai/gpt-5.4',
        name: 'OpenAI: GPT-5.4',
      };
      const result = parseOpenRouterModel(model);
      expect(result).toEqual({
        slug: 'gpt-5.4',
        display_name: 'GPT-5.4',
        provider: 'OpenAI',
      });
    });

    it('returns null for unknown providers', () => {
      const model: OpenRouterModel = {
        id: 'sao10k/some-obscure-model',
        name: 'Sao10k: Some Obscure Model',
      };
      expect(parseOpenRouterModel(model)).toBeNull();
    });

    it('returns null for :free variants', () => {
      const model: OpenRouterModel = {
        id: 'qwen/qwen3-coder:free',
        name: 'Qwen: Qwen3 Coder 480B A35B (free)',
      };
      expect(parseOpenRouterModel(model)).toBeNull();
    });

    it('returns null for :thinking variants', () => {
      const model: OpenRouterModel = {
        id: 'anthropic/claude-3.7-sonnet:thinking',
        name: 'Anthropic: Claude 3.7 Sonnet (thinking)',
      };
      expect(parseOpenRouterModel(model)).toBeNull();
    });

    it('returns null for :extended variants', () => {
      const model: OpenRouterModel = {
        id: 'openai/gpt-4o:extended',
        name: 'OpenAI: GPT-4o (extended)',
      };
      expect(parseOpenRouterModel(model)).toBeNull();
    });

    it('handles all known providers', () => {
      const cases: Array<{ id: string; name: string; expectedProvider: string }> = [
        { id: 'anthropic/x', name: 'Anthropic: X', expectedProvider: 'Anthropic' },
        { id: 'openai/x', name: 'OpenAI: X', expectedProvider: 'OpenAI' },
        { id: 'google/x', name: 'Google: X', expectedProvider: 'Google' },
        { id: 'x-ai/x', name: 'xAI: X', expectedProvider: 'xAI' },
        { id: 'deepseek/x', name: 'DeepSeek: X', expectedProvider: 'DeepSeek' },
        { id: 'meta-llama/x', name: 'Meta: X', expectedProvider: 'Meta' },
        { id: 'qwen/x', name: 'Qwen: X', expectedProvider: 'Qwen' },
        { id: 'mistralai/x', name: 'Mistral: X', expectedProvider: 'Mistral' },
        { id: 'moonshotai/x', name: 'MoonshotAI: X', expectedProvider: 'Moonshot' },
        { id: 'minimax/x', name: 'MiniMax: X', expectedProvider: 'MiniMax' },
        { id: 'z-ai/x', name: 'Z.ai: X', expectedProvider: 'Zhipu' },
        { id: 'bytedance-seed/x', name: 'ByteDance Seed: X', expectedProvider: 'ByteDance' },
        { id: 'xiaomi/x', name: 'Xiaomi: X', expectedProvider: 'Xiaomi' },
        { id: 'nvidia/x', name: 'NVIDIA: X', expectedProvider: 'NVIDIA' },
        { id: 'stepfun/x', name: 'StepFun: X', expectedProvider: 'StepFun' },
      ];

      for (const { id, name, expectedProvider } of cases) {
        const result = parseOpenRouterModel({ id, name });
        expect(result?.provider, `provider for ${id}`).toBe(expectedProvider);
      }
    });

    it('uses model name as-is when no colon separator', () => {
      const model: OpenRouterModel = {
        id: 'mistralai/mistral-large',
        name: 'Mistral Large',
      };
      const result = parseOpenRouterModel(model);
      expect(result?.display_name).toBe('Mistral Large');
    });
  });

  describe('PROVIDER_MAP', () => {
    it('covers at least 15 providers', () => {
      expect(Object.keys(PROVIDER_MAP).length).toBeGreaterThanOrEqual(15);
    });
  });
});
