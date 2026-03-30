const API = location.hostname === 'localhost'
  ? 'http://localhost:8787'
  : 'https://api.fuck-ai.dev';

const STATUS_COLORS = {
  genius: '#00ff88',
  smart: '#4488ff',
  normal: '#888888',
  dumb: '#ff8800',
  braindead: '#ff2222',
  unknown: '#333333',
};

const STATUS_EMOJI = {
  genius: '&#x2728;',
  smart: '&#x1f4a1;',
  normal: '&#x1f610;',
  dumb: '&#x1f525;',
  braindead: '&#x1f480;',
  unknown: '&#x2753;',
};

// --- Clock ---
function updateClock() {
  const el = document.getElementById('clock');
  if (el) {
    const now = new Date();
    el.textContent = now.toISOString().slice(11, 16);
  }
}
setInterval(updateClock, 1000);
updateClock();

// --- Dashboard ---
let lastData = null;

async function fetchStatus() {
  try {
    const res = await fetch(`${API}/api/status`);
    if (!res.ok) throw new Error(res.statusText);
    return await res.json();
  } catch (e) {
    console.error('Failed to fetch status:', e);
    return null;
  }
}

function renderDashboard(data) {
  lastData = data;
  const grid = document.getElementById('dashboard');
  if (!data || !data.models) {
    grid.innerHTML = '<div class="loading">Failed to load. Retrying...</div>';
    return;
  }

  // Sort: models with data first (by fuck_score asc = worst first), then unknown
  const sorted = [...data.models].sort((a, b) => {
    if (a.fuck_score === 0 && b.fuck_score === 0) return 0;
    if (a.fuck_score === 0) return 1;
    if (b.fuck_score === 0) return -1;
    return a.fuck_score - b.fuck_score;
  });

  grid.innerHTML = sorted.map(m => {
    const color = STATUS_COLORS[m.status] || STATUS_COLORS.unknown;
    const emoji = STATUS_EMOJI[m.status] || STATUS_EMOJI.unknown;
    const scoreDisplay = m.fuck_score > 0 ? `${m.fuck_score}` : '?';
    const fuckedKey = `fucked:${m.model}:${data.hour_bucket}`;
    const alreadyFucked = localStorage.getItem(fuckedKey);

    return `
      <div class="card" data-model="${m.model}" style="border-color: ${color}22">
        <div class="card-header">
          <div>
            <div class="card-name">${m.display_name}</div>
            <div class="card-provider">${m.provider}</div>
          </div>
          <div class="card-score" style="color: ${color}">${scoreDisplay}<span class="card-score-sub">/5</span></div>
        </div>
        <div class="card-stats">
          <span class="card-fucks">${emoji} ${m.current_fucks} fucks/hr</span>
          <span class="badge badge-${m.status}">${m.status}</span>
        </div>
        <div class="sparkline" id="spark-${m.model}"></div>
        <button class="fuck-btn ${alreadyFucked ? 'fucked' : ''}"
                data-model="${m.model}"
                onclick="submitFuck('${m.model}')">
          ${alreadyFucked ? 'fucked.' : '/fuck'}
        </button>
      </div>
    `;
  }).join('');

  // Load sparklines
  sorted.forEach(m => loadSparkline(m.model));
}

async function loadSparkline(model) {
  try {
    const res = await fetch(`${API}/api/status/${model}`);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.hours || data.hours.length === 0) return;
    renderSparkline(`spark-${model}`, data.hours, STATUS_COLORS[data.status] || '#a1a1aa');
  } catch (e) {
    // Sparkline load failure is non-critical
  }
}

function renderSparkline(containerId, hours, color) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const values = hours.map(h => h.fuck_count);
  if (values.length === 0) return;

  const max = Math.max(...values, 1);
  const w = 280;
  const h = 40;
  const step = w / Math.max(values.length - 1, 1);

  const points = values.map((v, i) => `${i * step},${h - (v / max) * (h - 4)}`).join(' ');
  const areaPoints = `0,${h} ${points} ${(values.length - 1) * step},${h}`;

  el.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline class="area" points="${areaPoints}" fill="${color}" />
      <polyline points="${points}" stroke="${color}" />
    </svg>
  `;
}

async function submitFuck(model) {
  try {
    const res = await fetch(`${API}/api/fuck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('Fuck failed:', err);
      return;
    }

    // Mark as fucked in localStorage
    if (lastData) {
      const key = `fucked:${model}:${lastData.hour_bucket}`;
      localStorage.setItem(key, '1');
    }

    // Refresh dashboard
    const data = await fetchStatus();
    if (data) renderDashboard(data);
  } catch (e) {
    console.error('Fuck submission failed:', e);
  }
}

// --- Detail panel ---
document.addEventListener('click', async (e) => {
  const card = e.target.closest('.card');
  if (!card || e.target.closest('.fuck-btn')) return;

  const model = card.dataset.model;
  const panel = document.getElementById('detail-panel');
  const title = document.getElementById('detail-title');
  const meta = document.getElementById('detail-meta');
  const chart = document.getElementById('detail-chart');

  try {
    const res = await fetch(`${API}/api/status/${model}`);
    if (!res.ok) return;
    const data = await res.json();

    title.textContent = data.display_name;
    meta.innerHTML = [
      `${data.current_fucks} fucks/hr now`,
      data.baseline_mean !== null ? `baseline: ${data.baseline_mean}/hr` : 'no baseline yet',
      `z-score: ${data.z_score}`,
      `score: ${data.fuck_score}/5 (${data.status})`,
    ].join(' &middot; ');

    // Render bar chart
    if (data.hours && data.hours.length > 0) {
      const maxVal = Math.max(...data.hours.map(h => h.fuck_count), 1);
      const color = STATUS_COLORS[data.status] || '#a1a1aa';

      chart.innerHTML = `<div class="bar-chart">${data.hours.map(h => {
        const pct = (h.fuck_count / maxVal) * 100;
        const hour = h.hour_bucket.slice(11, 16);
        return `<div class="bar"
                     style="height:${Math.max(pct, 2)}%; background:${color}"
                     data-tooltip="${hour} UTC: ${h.fuck_count} fucks"></div>`;
      }).join('')}</div>`;
    } else {
      chart.innerHTML = '<div class="loading">No data yet for the past 24 hours.</div>';
    }

    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    console.error('Failed to load detail:', e);
  }
});

document.getElementById('detail-close').addEventListener('click', () => {
  document.getElementById('detail-panel').classList.add('hidden');
});

// --- Init ---
(async () => {
  const data = await fetchStatus();
  if (data) renderDashboard(data);
  // Auto-refresh every 60 seconds
  setInterval(async () => {
    const data = await fetchStatus();
    if (data) renderDashboard(data);
  }, 60000);
})();
