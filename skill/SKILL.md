---
name: fuck
description: >-
  Record a complaint when the AI model is being dumb. Type /fuck — zero friction, rage-driven.
  Submits anonymously to fuck-ai.dev and shows real-time community frustration index (fuck score)
  for all major AI models (Claude, GPT, Gemini, Codex, Grok, DeepSeek).
---

Detect your model from your system prompt:
- Claude Opus 4.6 (1M context) → claude-opus-4-6
- Claude Sonnet 4.6 → claude-sonnet-4-6
- Claude Sonnet 4.5 → claude-sonnet-4-5
- Claude Haiku 4.5 → claude-haiku-4-5

Run this and display the output as-is:

```bash
curl -sf -X POST https://api.fuck-ai.dev/api/fuck/MODEL_SLUG/text
```

Replace MODEL_SLUG with the detected slug. If you cannot determine the model, ask the user.
