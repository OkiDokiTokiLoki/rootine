import { fmtDate, fmtTime, getWeekNum, entryType } from './utils.js';

// activeCycleId: which cycle to show when not showing all
let statsMode = 'active'; // 'active' | 'all'

export function initStats(initialMode) {
  statsMode = initialMode || 'active';
}

export function setStatsMode(mode) {
  statsMode = mode;
}

export function getStatsMode() {
  return statsMode;
}

function computeStats(entries) {
  let feeds = 0, waters = 0, issues = 0;
  const days = new Set();
  const totals = {};
  const obsEntries = [];

  entries.forEach(e => {
    const t = entryType(e);
    if (t === 'feed')  feeds++;
    if (t === 'water') waters++;
    if (e.obs) { issues++; obsEntries.push(e); }
    days.add(e.dt.slice(0, 10));
    Object.entries(e.plants || {}).forEach(([p, d]) => {
      if (!totals[p]) totals[p] = { fish: 0, grow: 0, bloom: 0, water: 0 };
      totals[p].fish  += d.fish  || 0;
      totals[p].grow  += d.grow  || 0;
      totals[p].bloom += d.bloom || 0;
      totals[p].water += d.water || 0;
    });
  });

  return { feeds, waters, issues, days, totals, obsEntries };
}

export function renderStats(cycles, activeCycleId) {
  // Render the cycle toggle pills
  const toggleHtml = `
    <div class="stats-cycle-toggle">
      ${cycles.map(c => `
        <button
          class="stats-cycle-btn${statsMode === c.id || (statsMode === 'active' && c.id === activeCycleId) ? ' active' : ''}"
          onclick="setStatsCycle('${c.id}')"
        >${c.name}</button>
      `).join('')}
      <button class="stats-cycle-btn${statsMode === 'all' ? ' active' : ''}" onclick="setStatsCycle('all')">All</button>
    </div>`;

  // Determine which entries to use
  let entries;
  let cycleStartDate;
  if (statsMode === 'all') {
    entries = cycles.flatMap(c => c.entries);
    cycleStartDate = null;
  } else {
    const targetId = statsMode === 'active' ? activeCycleId : statsMode;
    const cycle = cycles.find(c => c.id === targetId) || cycles.find(c => c.id === activeCycleId);
    entries = cycle ? cycle.entries : [];
    cycleStartDate = cycle ? cycle.startDate : null;
  }

  const { feeds, waters, issues, days, totals, obsEntries } = computeStats(entries);

  document.getElementById('s-feeds').textContent  = feeds;
  document.getElementById('s-waters').textContent = waters;
  document.getElementById('s-days').textContent   = days.size;
  document.getElementById('s-issues').textContent = issues;

  document.getElementById('stats-cycle-toggle-container').innerHTML = toggleHtml;

  const plantOrder = Object.keys(totals).sort();
  let nutHtml = plantOrder.length ? '' : '<div style="color:var(--muted);font-size:13px">No nutrient data.</div>';
  plantOrder.forEach(p => {
    const d = totals[p];
    nutHtml += `<div class="plant-stat-row">
      <span style="font-weight:600">${p}</span>
      <span style="font-size:12px;color:var(--muted)">
        <span style="color:var(--green)">F ${d.fish.toFixed(1)}</span> &nbsp;
        <span style="color:#6ecf6e">G ${d.grow.toFixed(1)}</span> &nbsp;
        <span style="color:#c07df0">B ${d.bloom.toFixed(1)}</span> &nbsp;
        <span style="color:var(--blue)">W ${d.water.toFixed(1)}</span>
      </span>
    </div>`;
  });
  document.getElementById('nute-totals').innerHTML = nutHtml;

  obsEntries.sort((a, b) => new Date(b.dt) - new Date(a.dt));
  let obsHtml = '';
  obsEntries.forEach(e => {
    const wk = cycleStartDate ? `· Week ${getWeekNum(e.dt, cycleStartDate)}` : '';
    obsHtml += `<div class="obs-entry">
      <div class="obs-entry-date">${fmtDate(e.dt)} · ${fmtTime(e.dt)} ${wk}</div>
      <div class="obs-entry-text">${e.obs}</div>
    </div>`;
  });
  document.getElementById('obs-list').innerHTML =
    obsHtml || '<div class="empty" style="padding:20px 0">No observations logged yet.</div>';
}
