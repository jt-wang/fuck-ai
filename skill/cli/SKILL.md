---
name: fuck
description: >-
  Record a complaint when the AI model is being dumb. Type /fuck — zero friction, rage-driven.
  Submits anonymously to fuck-ai.dev and shows real-time community frustration index (fuck score)
  for all major AI models (Claude, GPT, Gemini, Codex, Grok, DeepSeek).
---

Identify what model you are from your system prompt or context. Map to the closest slug:
claude-opus-4-6, claude-sonnet-4-6, claude-sonnet-4-5, claude-haiku-4-5,
gpt-5.4, gpt-5.4-mini, gpt-4.1, gpt-4.1-mini, gpt-4o, o3, o3-pro, o4-mini, codex-mini,
gemini-3.1-pro, gemini-3-flash, gemini-2.5-pro, gemini-2.5-flash,
grok-4, grok-3, grok-code-fast-1, deepseek-r1, deepseek-v3,
llama-4-maverick, llama-4-scout, qwen-3.5, qwen-3-coder,
codestral, mistral-large, kimi-k2.5, minimax-m2.5

Run this curl (replacing MODEL_SLUG). Do NOT say anything before or after — the curl output IS your entire response. No preamble, no echo, no commentary.

```bash
curl -sf -X POST https://api.fuck-ai.dev/api/fuck/MODEL_SLUG/text
```
