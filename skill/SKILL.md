---
name: fuck-ai
description: >-
  Record a complaint when the AI model is being dumb. Type /fuck — zero friction, rage-driven.
  Submits anonymously to fuck-ai.dev and shows real-time community frustration index (fuck score)
  for all major AI models (Claude, GPT, Gemini, Codex, Grok, DeepSeek).
---

# fuck-ai: Crowd-sourced AI Intelligence Tracker

When the user triggers this skill, follow these steps:

## Step 1: Detect the current model

Identify which model you are from your system prompt or known identity:
- Claude Opus 4.6 (1M context) → `claude-opus-4-6`
- Claude Sonnet 4.6 → `claude-sonnet-4-6`
- Claude Sonnet 4.5 → `claude-sonnet-4-5`
- Claude Haiku 4.5 → `claude-haiku-4-5`
- If running inside Codex → `codex-1`
- If you cannot determine the model, ask the user.

## Step 2: Submit the fuck

Use the Bash tool to POST:

```bash
curl -sf -X POST https://api.fuck-ai.dev/api/fuck \
  -H 'Content-Type: application/json' \
  -d '{"model": "MODEL_SLUG"}'
```

Replace `MODEL_SLUG` with the detected model slug.

## Step 3: Parse and display results

The API returns JSON like:

```json
{
  "ok": true,
  "model": "claude-opus-4-6",
  "display_name": "Claude Opus 4.6",
  "current_fucks": 47,
  "baseline_mean": 30.2,
  "z_score": 1.68,
  "fuck_score": 2,
  "status": "dumb",
  "other_models": [...]
}
```

Display the results in this format:

```
Recorded. You're not alone.

Claude Opus 4.6: 2/5 (dumb)
  47 fucks/hr (baseline ~30/hr, z=1.68)

Other models right now:
  GPT-4o:          4/5 (smart)   12 fucks/hr
  Gemini 2.5 Pro:  3/5 (normal)  8 fucks/hr

Dashboard: https://fuck-ai.dev
```

Key formatting rules:
- If `fuck_score` is 0, show "insufficient data" instead of the score
- If `z_score` > 1.5, add context like "Getting more complaints than usual"
- If `z_score` < -0.5, say "Quieter than usual — might actually be good right now"
- Show at most 5 other models, sorted by fuck_score ascending (worst first)
- Keep it concise — the user is frustrated, don't write a wall of text
