# fuck-ai

**Is your AI model being dumb right now? The crowd knows.**

Real-time crowd-sourced frustration index for AI models. Type `/fuck` when your AI is being stupid. We do the math.

**Website:** [fuck-ai.dev](https://fuck-ai.dev)

## How it works

One input: `/fuck`. No ratings, no surveys.

The crowd's frustration IS the data. We derive a 1-5 intelligence score using two proven methods:

### Layer 1: Self-referencing baseline ([Downdetector method](https://downdetector.com/methodology/))

For each model, we maintain an EWMA (Exponentially Weighted Moving Average) baseline over 8-12 weeks of historical data, bucketed by (model, day_of_week, hour_of_day). When the current fuck rate deviates significantly from the baseline (measured by z-score), the model is flagged.

```
z_score = (current_fucks - baseline_mean) / baseline_std
```

### Layer 2: Cross-model comparison ([FDA PRR method](https://en.wikipedia.org/wiki/Proportional_reporting_ratio))

Adapted from pharmacovigilance disproportionality analysis. We compare each model's share of total complaints against its historical expected share. This enables cross-model comparison without knowing absolute user counts.

```
disproportionality = current_share / expected_share
```

### Combined score

```
fuck_score = 0.6 * z_score_component + 0.4 * prr_component  →  1-5
```

| Score | Status | Meaning |
|-------|--------|---------|
| 5 | genius | Unusually quiet — model is doing great |
| 4 | smart | Below average complaints |
| 3 | normal | Typical complaint level |
| 2 | dumb | Elevated complaints |
| 1 | braindead | Anomalous complaint spike |

## Install

```bash
npx fk-ai
```

This installs the `/fuck` skill into Claude Code.

### Usage

```
/fuck              — Record a complaint for the current model
npx fk-ai <model>  — Submit from terminal (any tool, not just Claude Code)
```

The skill auto-detects which model you're using and shows:
- Your fuck was recorded
- Community consensus: is it just you, or is everyone mad?
- Other models' status: maybe it's time to switch

### Statusline

Add to `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/skills/fuck-ai/statusline.sh"
  }
}
```

Shows: `🔥 2/5 47f/hr` — current model's fuck score at a glance.

## Architecture

```
┌────────────────┐
│  /fuck skill   │──POST /api/fuck──┐
│ (Claude Code)  │                  │
└────────────────┘                  ▼
                          ┌──────────────────┐      ┌────────────┐
                          │ Cloudflare Worker │◄─────│ fuck-ai.dev│
                          │  Hono + D1 + KV  │      │ (CF Pages) │
                          └──────┬───────────┘      └────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
               D1 (fucks)  D1 (baselines)  KV (rate limit)
                    ▲
                    │
              Cron (hourly)     Cron (weekly)
              update baselines  sync models from OpenRouter
```

### API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/fuck` | Submit a fuck `{"model": "claude-opus-4-6"}` |
| POST | `/api/fuck/:model/text` | Submit a fuck with free-text rant |
| GET | `/api/status` | Current hour status for all models |
| GET | `/api/status/:model` | 24-hour detail for one model |
| GET | `/api/models` | List of tracked models |

### Privacy

- IPs are SHA-256 hashed immediately — raw IPs are never stored
- One fuck per model per hour per IP (deduplication)
- Rate limited: 30 fucks/hour/IP
- Fully open source — inspect everything

## Supported models

30 models across 10 providers. New models are auto-synced weekly from [OpenRouter](https://openrouter.ai/) rankings (add-only — models are never removed).

| Provider | Models |
|----------|--------|
| Anthropic | Claude Opus 4.6, Sonnet 4.6, Sonnet 4.5, Haiku 4.5 |
| OpenAI | GPT-5.4, GPT-5.4 Mini, GPT-4.1, GPT-4.1 Mini, GPT-4o, o3, o3 Pro, o4-mini, Codex Mini |
| Google | Gemini 3.1 Pro, Gemini 3 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash |
| xAI | Grok 3, Grok 4, Grok Code Fast 1 |
| DeepSeek | DeepSeek R1, DeepSeek V3 |
| Meta | Llama 4 Maverick, Llama 4 Scout |
| Qwen | Qwen 3.5, Qwen3 Coder |
| Mistral | Codestral, Mistral Large |
| Moonshot | Kimi K2.5 |
| MiniMax | MiniMax M2.5 |

## Deploy your own

Everything runs on Cloudflare's free tier.

```bash
# 1. Clone
git clone https://github.com/jt-wang/fuck-ai && cd fuck-ai

# 2. Create D1 database
cd worker
npx wrangler d1 create fuck-ai-db
# Copy the database_id into wrangler.toml

# 3. Create KV namespace
npx wrangler kv namespace create RATE_LIMIT
# Copy the id into wrangler.toml

# 4. Initialize database
npx wrangler d1 execute fuck-ai-db --file=db/schema.sql --remote

# 5. Deploy worker
npx wrangler deploy

# 6. Deploy website
cd ..
npx wrangler pages deploy web/out/ --project-name fuck-ai

# 7. Set up custom domain in Cloudflare dashboard
```

## Development

```bash
# Install deps
cd worker && npm install

# Run tests
npx vitest run

# Local dev server
npx wrangler d1 execute fuck-ai-db --file=db/schema.sql --local
npx wrangler dev --local
```

## License

MIT
