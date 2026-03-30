#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const API = 'https://api.fuck-ai.dev';
const SKILL_DIR = path.join(os.homedir(), '.claude', 'skills', 'fuck-ai');
const SKILL_SRC = path.resolve(__dirname, 'SKILL.md');

const arg = process.argv[2];

// `npx fuck-ai <model>` — submit a fuck from CLI directly (works for any model/tool)
if (arg && arg !== 'install') {
  submitFuck(arg);
} else {
  install();
}

function install() {
  fs.mkdirSync(SKILL_DIR, { recursive: true });
  const dest = path.join(SKILL_DIR, 'SKILL.md');
  fs.copyFileSync(SKILL_SRC, dest);

  console.log(`
  \x1b[1m\x1b[31mfuck-ai\x1b[0m installed.

  Skill file: ${dest}

  \x1b[1mUsage in Claude Code:\x1b[0m
    /fuck       — record a complaint for the current model

  \x1b[1mUsage in ANY terminal (for Codex, Gemini, Cursor, etc.):\x1b[0m
    npx fuck-ai claude-opus-4-6
    npx fuck-ai gpt-4.1
    npx fuck-ai gemini-2.5-pro
    npx fuck-ai codex-1

  \x1b[1mDashboard:\x1b[0m https://fuck-ai.dev

  \x1b[2mTo uninstall: rm -rf ${SKILL_DIR}\x1b[0m
`);
}

function submitFuck(model) {
  const data = JSON.stringify({ model });
  const url = new URL(`${API}/api/fuck`);

  const req = https.request({
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
  }, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
      try {
        const r = JSON.parse(body);
        if (!r.ok) {
          console.error(`Error: ${r.error || 'unknown'}`);
          process.exit(1);
        }

        console.log(`\n  \x1b[31mRecorded.\x1b[0m You're not alone.\n`);

        const score = r.fuck_score > 0 ? `${r.fuck_score}/5 (${r.status})` : 'insufficient data';
        console.log(`  ${r.display_name}: ${score}`);
        console.log(`  ${r.current_fucks} fucks/hr (baseline ~${r.baseline_mean}/hr, z=${r.z_score})\n`);

        const others = r.other_models.filter(m => m.current_fucks > 0).slice(0, 5);
        if (others.length > 0) {
          console.log('  Other models right now:');
          for (const m of others) {
            const s = m.fuck_score > 0 ? `${m.fuck_score}/5 (${m.status})` : 'no data';
            console.log(`    ${m.display_name.padEnd(20)} ${s.padEnd(15)} ${m.current_fucks} fucks/hr`);
          }
          console.log('');
        }

        console.log('  Dashboard: https://fuck-ai.dev\n');
      } catch (e) {
        console.error('Failed to parse response:', body);
      }
    });
  });

  req.on('error', (e) => console.error(`Request failed: ${e.message}`));
  req.write(data);
  req.end();
}
