import './style.css';
import { uid, cycleUid } from './utils.js';
import {
  loadCycles, saveCycles,
  loadActiveCycleId, saveActiveCycleId,
  loadCollapsedCycles, saveCollapsedCycles,
  loadCollapsedWeeks,
  loadLightDefaults, saveLightDefaults,
} from './storage.js';
import { initLog, renderLog, toggleWeek, toggleCycle, toggleEntry } from './log.js';
import { initStats, renderStats, setStatsMode, getStatsMode } from './stats.js';
import { registerServiceWorker } from './sw.js';

// ── State ─────────────────────────────────────────────────────────────────────
let cycles         = loadCycles();
let activeCycleId  = loadActiveCycleId(cycles);
const collapsedCycles = loadCollapsedCycles();
const collapsedWeeks  = loadCollapsedWeeks();

initLog(collapsedWeeks, collapsedCycles);
initStats('active');

// ── Expose globals ────────────────────────────────────────────────────────────
window.toggleWeek    = toggleWeek;
window.toggleCycle   = toggleCycle;
window.toggleEntry   = toggleEntry;
window.deleteEntry   = deleteEntry;
window.saveEntry     = saveEntry;
window.showTab       = showTab;
window.switchPlant   = switchPlant;
window.togglePlantPicker = togglePlantPicker;
window.toggleLightInputs = toggleLightInputs;
window.saveLightDefaults = _saveLightDefaults;
window.setStatsCycle = setStatsCycle;
window.newCycle      = newCycle;

// ── Helpers ───────────────────────────────────────────────────────────────────
function activeCycle() {
  return cycles.find(c => c.id === activeCycleId);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function showTab(name) {
  ['log', 'add', 'stats'].forEach(t => {
    document.getElementById('section-' + t).classList.toggle('active', t === name);
    document.getElementById('tab-' + t).classList.toggle('active', t === name);
  });
}

// ── Grow age header ───────────────────────────────────────────────────────────
function updateGrowAge() {
  const cycle = activeCycle();
  if (!cycle) return;
  const start = new Date(cycle.startDate);
  const days  = Math.floor((new Date() - start) / (24 * 60 * 60 * 1000));
  const week  = Math.ceil(days / 7);
  document.getElementById('grow-age').textContent = `${cycle.name} · Day ${days} · Week ${week}`;
}

// ── Date default ──────────────────────────────────────────────────────────────
function setDateDefault() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('new-dt').value =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ── Plant tabs ────────────────────────────────────────────────────────────────
function switchPlant(p) {
  document.querySelectorAll('.plant-tab').forEach(el => el.classList.toggle('active', el.textContent === p));
  document.querySelectorAll('.plant-panel').forEach(el => el.classList.toggle('active', el.id === 'panel-' + p));
}

// ── Actions helpers ───────────────────────────────────────────────────────────
function togglePlantPicker(action) {
  const checked = document.getElementById('ck-' + action).checked;
  document.getElementById(action + '-plants').style.display = checked ? 'block' : 'none';
}

function toggleLightInputs() {
  document.getElementById('light-inputs').style.display =
    document.getElementById('ck-light').checked ? 'block' : 'none';
}

function _saveLightDefaults() {
  saveLightDefaults(
    document.getElementById('light-lux').value,
    document.getElementById('light-dist').value,
  );
}

function _loadLightDefaults() {
  const d = loadLightDefaults();
  if (d.lux)  document.getElementById('light-lux').value  = d.lux;
  if (d.dist) document.getElementById('light-dist').value = d.dist;
}

// ── New cycle modal ───────────────────────────────────────────────────────────
function newCycle() {
  const defaultName = `Grow #${cycles.length + 1}`;
  document.getElementById('new-cycle-input').value = defaultName;
  document.getElementById('new-cycle-modal').style.display = 'flex';
  document.getElementById('new-cycle-input').select();
}

window.confirmNewCycle = function() {
  const name = document.getElementById('new-cycle-input').value.trim() || `Grow #${cycles.length + 1}`;
  document.getElementById('new-cycle-modal').style.display = 'none';

  cycles.forEach(c => collapsedCycles.add(c.id));
  saveCollapsedCycles(collapsedCycles);

  const today = new Date();
  const pad = n => String(n).padStart(2, '0');
  const startDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const newC = { id: cycleUid(), name, startDate, entries: [] };
  cycles.push(newC);
  activeCycleId = newC.id;

  saveCycles(cycles);
  saveActiveCycleId(activeCycleId);

  updateGrowAge();
  renderAll();
  showTab('log');
};

window.cancelNewCycle = function() {
  document.getElementById('new-cycle-modal').style.display = 'none';
};

// ── Stats cycle toggle ────────────────────────────────────────────────────────
function setStatsCycle(id) {
  setStatsMode(id === 'all' ? 'all' : id);
  renderStats(cycles, activeCycleId);
}

// ── Save entry ────────────────────────────────────────────────────────────────
function saveEntry() {
  const dt = document.getElementById('new-dt').value;
  if (!dt) { alert('Set a date and time.'); return; }

  const actions = [];
  if (document.getElementById('ck-lst').checked) {
    const plants = [...document.querySelectorAll('.lst-plant:checked')].map(el => el.value);
    actions.push('LST' + (plants.length ? ' (' + plants.join(', ') + ')' : ''));
  }
  if (document.getElementById('ck-def').checked) {
    const plants = [...document.querySelectorAll('.def-plant:checked')].map(el => el.value);
    actions.push('Defoliate' + (plants.length ? ' (' + plants.join(', ') + ')' : ''));
  }
  if (document.getElementById('ck-top').checked)    actions.push('Top / FIM');
  if (document.getElementById('ck-sticky').checked) actions.push('Sticky traps');
  if (document.getElementById('ck-light').checked) {
    const lux  = document.getElementById('light-lux').value;
    const dist = document.getElementById('light-dist').value;
    let label = 'Light adjusted';
    if (lux || dist) label += ' (' + [lux ? lux + 'k lux' : null, dist ? dist + 'cm' : null].filter(Boolean).join(', ') + ')';
    actions.push(label);
  }
  if (document.getElementById('ck-repot').checked) actions.push('Repot / transplant');

  const plants = {};
  ['COP', 'H', 'GC', 'GC2'].forEach(p => {
    const fish  = parseFloat(document.getElementById(p + '-fish').value)  || 0;
    const grow  = parseFloat(document.getElementById(p + '-grow').value)  || 0;
    const bloom = parseFloat(document.getElementById(p + '-bloom').value) || 0;
    const water = parseFloat(document.getElementById(p + '-water').value) || 0;
    if (fish || grow || bloom || water) {
      plants[p] = {};
      if (fish)  plants[p].fish  = fish;
      if (grow)  plants[p].grow  = grow;
      if (bloom) plants[p].bloom = bloom;
      if (water) plants[p].water = water;
    }
  });

  const obs = document.getElementById('new-obs').value.trim();
  const cycle = activeCycle();
  cycle.entries.unshift({ id: uid(), dt, plants, actions, obs: obs || undefined });
  saveCycles(cycles);
  renderAll();

  // Reset form
  ['COP', 'H', 'GC', 'GC2'].forEach(p =>
    ['fish', 'grow', 'bloom', 'water'].forEach(n => { document.getElementById(p + '-' + n).value = ''; })
  );
  ['lst', 'def', 'top', 'sticky', 'repot'].forEach(id => { document.getElementById('ck-' + id).checked = false; });
  document.querySelectorAll('.lst-plant, .def-plant').forEach(el => (el.checked = false));
  document.getElementById('lst-plants').style.display = 'none';
  document.getElementById('def-plants').style.display = 'none';
  document.getElementById('ck-light').checked = false;
  document.getElementById('light-inputs').style.display = 'none';
  _loadLightDefaults();
  document.getElementById('new-obs').value = '';
  showTab('log');
}

// ── Delete entry ──────────────────────────────────────────────────────────────
function deleteEntry(id) {
  if (!confirm('Delete this entry?')) return;
  cycles.forEach(c => { c.entries = c.entries.filter(e => e.id !== id); });
  saveCycles(cycles);
  renderAll();
}

// ── Render all ────────────────────────────────────────────────────────────────
function renderAll() {
  renderLog(cycles, activeCycleId);
  renderStats(cycles, activeCycleId);
}

// ── Init ──────────────────────────────────────────────────────────────────────
updateGrowAge();
setDateDefault();
_loadLightDefaults();
renderAll();
registerServiceWorker();
