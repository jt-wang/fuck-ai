-- fuck-ai database schema

-- Raw fuck events (deduplicated: 1 per IP per model per hour)
CREATE TABLE IF NOT EXISTS fucks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    hour_bucket TEXT NOT NULL,        -- '2026-03-30T14:00:00Z'
    day_of_week INTEGER NOT NULL,     -- 0=Sunday, 6=Saturday
    hour_of_day INTEGER NOT NULL,     -- 0-23 UTC
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fucks_dedup ON fucks (ip_hash, model, hour_bucket);
CREATE INDEX IF NOT EXISTS idx_fucks_model_hour ON fucks (model, hour_bucket);
CREATE INDEX IF NOT EXISTS idx_fucks_hour_bucket ON fucks (hour_bucket);

-- Precomputed baselines (updated hourly by cron)
-- Layer 1: Per-model EWMA baseline for (day_of_week, hour_of_day)
CREATE TABLE IF NOT EXISTS baselines (
    model TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,     -- 0-6
    hour_of_day INTEGER NOT NULL,     -- 0-23
    ewma_mean REAL NOT NULL DEFAULT 0,
    ewma_std REAL NOT NULL DEFAULT 1,
    sample_count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (model, day_of_week, hour_of_day)
);

-- Layer 2: Per-model expected complaint share (PRR baseline)
CREATE TABLE IF NOT EXISTS model_shares (
    model TEXT NOT NULL PRIMARY KEY,
    expected_share REAL NOT NULL DEFAULT 0,  -- historical fraction of total fucks
    total_fucks INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);

-- Known models
CREATE TABLE IF NOT EXISTS models (
    slug TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO models (slug, display_name, provider, sort_order) VALUES
    -- Anthropic
    ('claude-opus-4-6', 'Claude Opus 4.6', 'Anthropic', 1),
    ('claude-sonnet-4-6', 'Claude Sonnet 4.6', 'Anthropic', 2),
    ('claude-sonnet-4-5', 'Claude Sonnet 4.5', 'Anthropic', 3),
    ('claude-haiku-4-5', 'Claude Haiku 4.5', 'Anthropic', 4),
    -- OpenAI
    ('gpt-5.4', 'GPT-5.4', 'OpenAI', 10),
    ('gpt-5.4-mini', 'GPT-5.4 Mini', 'OpenAI', 11),
    ('gpt-4.1', 'GPT-4.1', 'OpenAI', 12),
    ('gpt-4.1-mini', 'GPT-4.1 Mini', 'OpenAI', 13),
    ('gpt-4o', 'GPT-4o', 'OpenAI', 14),
    ('o3', 'o3', 'OpenAI', 15),
    ('o3-pro', 'o3 Pro', 'OpenAI', 16),
    ('o4-mini', 'o4-mini', 'OpenAI', 17),
    ('codex-mini', 'Codex Mini', 'OpenAI', 18),
    -- Google
    ('gemini-3.1-pro', 'Gemini 3.1 Pro', 'Google', 20),
    ('gemini-3-flash', 'Gemini 3 Flash', 'Google', 21),
    ('gemini-2.5-pro', 'Gemini 2.5 Pro', 'Google', 22),
    ('gemini-2.5-flash', 'Gemini 2.5 Flash', 'Google', 23),
    -- xAI
    ('grok-4', 'Grok 4', 'xAI', 30),
    ('grok-3', 'Grok 3', 'xAI', 31),
    ('grok-code-fast-1', 'Grok Code Fast 1', 'xAI', 32),
    -- DeepSeek
    ('deepseek-r1', 'DeepSeek R1', 'DeepSeek', 40),
    ('deepseek-v3', 'DeepSeek V3', 'DeepSeek', 41),
    -- Meta
    ('llama-4-maverick', 'Llama 4 Maverick', 'Meta', 50),
    ('llama-4-scout', 'Llama 4 Scout', 'Meta', 51),
    -- Qwen
    ('qwen-3.5', 'Qwen 3.5', 'Qwen', 60),
    ('qwen-3-coder', 'Qwen3 Coder', 'Qwen', 61),
    -- Mistral
    ('codestral', 'Codestral', 'Mistral', 70),
    ('mistral-large', 'Mistral Large', 'Mistral', 71),
    -- Kimi / MiniMax
    ('kimi-k2.5', 'Kimi K2.5', 'Moonshot', 80),
    ('minimax-m2.5', 'MiniMax M2.5', 'MiniMax', 81);
