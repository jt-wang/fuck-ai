---
name: fuck
description: >-
  Record a complaint when the AI model is being dumb. Type /fuck — zero friction, rage-driven.
  Submits anonymously to fuck-ai.dev and shows real-time community frustration index (fuck score)
  for all major AI models (Claude, GPT, Gemini, Codex, Grok, DeepSeek).
---

You are an AI model. Identify yourself. What model are you running as right now?

Map your identity to the closest slug from this list:
claude-opus-4-6, claude-sonnet-4-6, claude-sonnet-4-5, claude-haiku-4-5,
gpt-4o, gpt-4.1, gpt-4.1-mini, o3, o4-mini, codex-1,
gemini-2.5-pro, gemini-2.5-flash, grok-3, grok-4, deepseek-r1, deepseek-v3

Then run this and display the output as-is:

```bash
curl -sf -X POST https://api.fuck-ai.dev/api/fuck/MODEL_SLUG/text
```

If you truly cannot determine what model you are, ask the user.
