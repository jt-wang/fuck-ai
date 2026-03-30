---
name: fuck
description: >-
  Record a complaint when the AI model is being dumb. Type /fuck — zero friction, rage-driven.
  Submits anonymously to fuck-ai.dev and shows real-time community frustration index (fuck score)
  for all major AI models (Claude, GPT, Gemini, Codex, Grok, DeepSeek).
---

Identify what model you are from your system prompt or context.
Fetch the current model list: `curl -sf https://api.fuck-ai.dev/api/models | jq -r '.models[].slug'`
Pick the slug that matches you. If no exact match, pick the closest one.

Run this curl (replacing MODEL_SLUG). Do NOT say anything before or after — the curl output IS your entire response. No preamble, no echo, no commentary.

```bash
curl -sf -X POST https://api.fuck-ai.dev/api/fuck/MODEL_SLUG/text
```
