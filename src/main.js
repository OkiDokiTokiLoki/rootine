import "./style.css";
import { uid, cycleUid } from "./utils.js";
import { loadCycles, saveCycles, loadActiveCycleId, saveActiveCycleId, loadCollapsedCycles, saveCollapsedCycles, loadCollapsedWeeks, loadLightDefaults, saveLightDefaults } from "./storage.js";
import { initLog, renderLog, toggleWeek, toggleCycle, toggleEntry } from "./log.js";
import { initStats, renderStats, setStatsMode, getStatsMode } from "./stats.js";
import { registerServiceWorker } from "./sw.js";

// ── State ─────────────────────────────────────────────────────────────────────
let cycles = loadCycles();
let activeCycleId = loadActiveCycleId(cycles);
const collapsedCycles = loadCollapsedCycles();
const collapsedWeeks = loadCollapsedWeeks();
let editingEntryId = null;
let pendingAddPlantType = "auto";
let pendingRenamePlantType = "auto";

try {
    localStorage.removeItem("light_defaults");
} catch (e) {}

initLog(collapsedWeeks, collapsedCycles);
initStats("active");

// ── Expose globals ────────────────────────────────────────────────────────────
window.toggleWeek = toggleWeek;
window.toggleCycle = toggleCycle;
window.toggleEntry = toggleEntry;
window.deleteEntry = deleteEntry;
window.editEntry = editEntry;
window.cancelEdit = cancelEdit;
window.saveEntry = saveEntry;
window.showTab = showTab;
window.switchPlant = switchPlant;
window.togglePlantPicker = togglePlantPicker;
window.toggleLightInputs = toggleLightInputs;
window.saveLightDefaults = _saveLightDefaults;
window.setStatsCycle = setStatsCycle;
window.newCycle = newCycle;
window.deleteCycle = deleteCycle;
window.openPlantManager = openPlantManager;
window.closePlantManager = closePlantManager;
window.openAddPlant = openAddPlant;
window.confirmAddPlant = confirmAddPlant;
window.renamePlant = renamePlant;
window.cancelAddPlant = cancelAddPlant;
window.confirmAddPlant = confirmAddPlant;
window.cancelRenamePlant = cancelRenamePlant;
window.confirmRenamePlant = confirmRenamePlant;
window.deletePlant = deletePlant;
window.selectPlantType = selectPlantType;
window.togglePlantType = togglePlantType;

// ── Constants ─────────────────────────────────────────────────────────────────
const PLANT_NAME_RE = /^[A-Za-z0-9 _-]+$/;

// ── Helpers ───────────────────────────────────────────────────────────────────
function activeCycle() {
    return cycles.find((c) => c.id === activeCycleId);
}

function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function cyclePlants() {
    return activeCycle()?.plants || [];
}

// ── Render add form (dynamic plants) ─────────────────────────────────────────
function renderAddForm() {
    const plants = cyclePlants();

    // Plant tabs
    const tabsContainer = document.getElementById("plant-tabs");
    tabsContainer.innerHTML = "";
    if (plants.length === 0) {
        const empty = document.createElement("div");
        empty.style.cssText = "padding: 14px; color: var(--muted); font-size: 13px; text-align: center; background: var(--surface2); border: 0.5px dashed var(--border2); border-radius: 10px;";
        empty.textContent = 'No plants yet for this grow cycle yet. Tap "Plants" above to add some.';
        tabsContainer.appendChild(empty);
    } else {
        plants.forEach((p, i) => {
            const tab = document.createElement("div");
            tab.className = "plant-tab" + (i === 0 ? " active" : "");
            tab.textContent = p;
            tab.dataset.plant = p;
            tab.onclick = () => switchPlant(p);
            tabsContainer.appendChild(tab);
        });
    }

    // Plant panels
    const panelsContainer = document.getElementById("plant-panels");
    panelsContainer.innerHTML = "";
    plants.forEach((p, i) => {
        const panel = document.createElement("div");
        panel.className = "plant-panel" + (i === 0 ? " active" : "");
        panel.id = "panel-" + p;
        panel.innerHTML = `
            <div class="form-row"><label class="form-label">Fish (cups)</label><input class="form-input" type="number" min="0" step="0.5" placeholder="0" id="${p}-fish" /></div>
            <div class="form-row"><label class="form-label">Grow (cups)</label><input class="form-input" type="number" min="0" step="0.5" placeholder="0" id="${p}-grow" /></div>
            <div class="form-row"><label class="form-label">Bloom (cups)</label><input class="form-input" type="number" min="0" step="0.5" placeholder="0" id="${p}-bloom" /></div>
            <div class="form-row"><label class="form-label">Water (cups)</label><input class="form-input" type="number" min="0" step="0.5" placeholder="0" id="${p}-water" /></div>
        `;
        panelsContainer.appendChild(panel);
    });

    // Plant pickers (LST, Defoliate, Repot)
    ["lst", "def", "repot"].forEach((action) => {
        const picker = document.getElementById(action + "-plants");
        const list = picker.querySelector(".plant-picker-list");
        if (!list) return;
        list.innerHTML = "";
        if (plants.length === 0) {
            list.innerHTML = '<div style="font-size: 12px; color: var(--muted)">No plants available.</div>';
            return;
        }
        plants.forEach((p) => {
            const label = document.createElement("label");
            label.className = "plant-picker-opt";
            label.innerHTML = `<input type="checkbox" class="${action}-plant" value="${escapeHtml(p)}" /> ${escapeHtml(p)}`;
            list.appendChild(label);
        });
    });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function showTab(name) {
    ["log", "add", "stats"].forEach((t) => {
        document.getElementById("section-" + t).classList.toggle("active", t === name);
        document.getElementById("tab-" + t).classList.toggle("active", t === name);
    });
    if (name === "add" && !editingEntryId) {
        resetAddForm();
        setDateDefault();
    }
}

function resetAddForm() {
    const plants = cyclePlants();
    plants.forEach((p) =>
        ["fish", "grow", "bloom", "water"].forEach((n) => {
            const el = document.getElementById(p + "-" + n);
            if (el) el.value = "";
        })
    );
    ["lst", "def", "repot"].forEach((id) => {
        const el = document.getElementById("ck-" + id);
        if (el) el.checked = false;
    });
    document.querySelectorAll(".lst-plant, .def-plant, .repot-plant").forEach((el) => (el.checked = false));
    document.getElementById("lst-plants").style.display = "none";
    document.getElementById("def-plants").style.display = "none";
    document.getElementById("repot-plants").style.display = "none";
    document.getElementById("ck-light").checked = false;
    document.getElementById("light-inputs").style.display = "none";
    _loadLightDefaults();
    document.getElementById("new-obs").value = "";
}

// ── Grow age header ───────────────────────────────────────────────────────────
function updateGrowAge() {
    const cycle = activeCycle();
    if (!cycle) {
        document.getElementById("grow-age").textContent = "";
        return;
    }
    const start = new Date(cycle.startDate);
    const days = Math.floor((new Date() - start) / (24 * 60 * 60 * 1000));
    const week = Math.max(1, Math.ceil(days / 7));
    document.getElementById("grow-age").textContent = `${cycle.name} · Day ${days} · Week ${week}`;
}

// ── Date default ──────────────────────────────────────────────────────────────
function setDateDefault() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    document.getElementById("new-dt").value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// ── Plant tabs ────────────────────────────────────────────────────────────────
function switchPlant(p) {
    document.querySelectorAll(".plant-tab").forEach((el) => el.classList.toggle("active", (el.dataset.plant || el.textContent) === p));
    document.querySelectorAll(".plant-panel").forEach((el) => el.classList.toggle("active", el.id === "panel-" + p));
}

// ── Actions helpers ───────────────────────────────────────────────────────────
function togglePlantPicker(action) {
    const checked = document.getElementById("ck-" + action).checked;
    document.getElementById(action + "-plants").style.display = checked ? "block" : "none";
}

function toggleLightInputs() {
    document.getElementById("light-inputs").style.display = document.getElementById("ck-light").checked ? "block" : "none";
}

function updateLightStatus() {
    const d = loadLightDefaults(activeCycleId);
    const el = document.getElementById("light-status-text");
    const bulb = document.getElementById("light-status-bulb");
    if (!el) return;

    let isOn = false;
    const parts = [];
    if (d.lux) parts.push(d.lux + "K");
    if (d.start && d.end) {
        const [sh, sm] = d.start.split(":").map(Number);
        const [eh, em] = d.end.split(":").map(Number);
        let onMins = eh * 60 + em - (sh * 60 + sm);
        if (onMins < 0) onMins += 24 * 60;
        const onH = Math.round(onMins / 60);
        const offH = 24 - onH;

        // Check if lights are currently on
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        if (startMins < endMins) {
            isOn = nowMins >= startMins && nowMins < endMins;
        } else {
            // Wraps midnight
            isOn = nowMins >= startMins || nowMins < endMins;
        }

        const fmt = (t) => {
            const [h, m] = t.split(":");
            const hr = parseInt(h);
            const ampm = hr >= 12 ? "PM" : "AM";
            const h12 = hr % 12 || 12;
            return h12 + (m !== "00" ? ":" + m : "") + ampm;
        };
        parts.push(fmt(d.start) + "–" + fmt(d.end) + " (" + onH + "/" + offH + ")");
    }

    if (bulb) bulb.style.stroke = isOn ? "var(--amber)" : "var(--muted)";

    el.textContent = parts.length ? parts.join("·") : "no active schedule";
}

function _saveLightDefaults() {
    saveLightDefaults(activeCycleId, document.getElementById("light-lux").value, document.getElementById("light-dist").value, document.getElementById("light-start").value, document.getElementById("light-end").value);
    updateLightStatus();
}

function _loadLightDefaults() {
    const d = loadLightDefaults(activeCycleId);
    if (d.lux) document.getElementById("light-lux").value = d.lux;
    if (d.dist) document.getElementById("light-dist").value = d.dist;
    if (d.start) document.getElementById("light-start").value = d.start;
    if (d.end) document.getElementById("light-end").value = d.end;
}

// ── Plant management ──────────────────────────────────────────────────────────
function openPlantManager() {
    renderPlantList();
    document.getElementById("plant-manage-modal").style.display = "flex";
}

function closePlantManager() {
    document.getElementById("plant-manage-modal").style.display = "none";
}

function renderPlantList() {
    const cycle = activeCycle();
    const list = document.getElementById("plant-list");
    if (!cycle) {
        list.innerHTML = '<div class="plant-empty">No active cycle.</div>';
        return;
    }
    const plants = cycle.plants || [];
    if (plants.length === 0) {
        list.innerHTML = '<div class="plant-empty">No plants yet. Add some to start logging.</div>';
        return;
    }
    list.innerHTML = "";
    plants.forEach((p, i) => {
        const type = (cycle.plantTypes || {})[p] || "photo";
        const badgeClass = type === "auto" ? "plant-type-badge auto" : "plant-type-badge photo";
        const badgeLabel = type === "auto" ? "AUTO" : "PHOTO";
        const row = document.createElement("div");
        row.className = "plant-manage-row";
        row.innerHTML = `
            <div class="plant-manage-name">${escapeHtml(p)}</div>
            <div class="plant-manage-actions">
                <span class="${badgeClass}" onclick="togglePlantType(${i})" title="Click to toggle type">${badgeLabel}</span>
                <button class="settings-btn edit-btn" onclick="renamePlant(${i})" aria-label="Rename ${escapeHtml(p)}" title="Rename"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none"><path stroke="var(--blue)" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.08" d="M13.5 7.5l3 3M4 20v-3.5L15.293 5.207a1 1 0 011.414 0l2.086 2.086a1 1 0 010 1.414L7.5 20H4z"></path></svg></button>
                <button class="settings-btn delete-btn" onclick="deletePlant(${i})" aria-label="Delete ${escapeHtml(p)}" title="Delete"><svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:var(--red);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
            </div>
        `;
        list.appendChild(row);
    });
}

function openAddPlant() {
    document.getElementById("new-plant-name").value = "";
    pendingAddPlantType = "auto";
    selectPlantType("add", "auto");
    document.getElementById("add-plant-modal").style.display = "flex";
    setTimeout(() => document.getElementById("new-plant-name").focus(), 50);
}

function selectPlantType(scope, type) {
    if (scope === "add") {
        pendingAddPlantType = type;
    } else {
        pendingRenamePlantType = type;
    }
    const sel = scope === "add" ? "#add-plant-type-toggle" : "#rename-plant-type-toggle";
    document.querySelectorAll(sel + " .type-toggle-opt").forEach((el) => {
        el.classList.toggle("active", el.dataset.type === type);
    });
}

function togglePlantType(index) {
    const cycle = activeCycle();
    if (!cycle) return;
    if (!cycle.plantTypes || typeof cycle.plantTypes !== "object") cycle.plantTypes = {};
    const name = cycle.plants[index];
    const current = cycle.plantTypes[name] || "photo";
    cycle.plantTypes[name] = current === "auto" ? "photo" : "auto";
    saveCycles(cycles);
    renderPlantList();
}

function confirmAddPlant() {
    const name = document.getElementById("new-plant-name").value.trim();
    if (!name) {
        alert("Enter a plant name.");
        return;
    }
    if (!PLANT_NAME_RE.test(name)) {
        alert("Plant name can only contain letters, numbers, spaces, dashes, and underscores.");
        return;
    }
    const cycle = activeCycle();
    if (!cycle) {
        alert("No active cycle.");
        return;
    }
    if (!Array.isArray(cycle.plants)) cycle.plants = [];
    if (cycle.plants.includes(name)) {
        alert("A plant with that name already exists.");
        return;
    }
    cycle.plants.push(name);
    if (!cycle.plantTypes || typeof cycle.plantTypes !== "object") cycle.plantTypes = {};
    cycle.plantTypes[name] = pendingAddPlantType;
    saveCycles(cycles);
    document.getElementById("add-plant-modal").style.display = "none";
    renderPlantList();
    renderAddForm();
    renderAll();
}

function cancelAddPlant() {
    document.getElementById("add-plant-modal").style.display = "none";
}

function renamePlant(index) {
    const cycle = activeCycle();
    if (!cycle) return;
    const oldName = cycle.plants[index];
    const existingType = (cycle.plantTypes || {})[oldName] || "auto";
    document.getElementById("rename-plant-input").value = oldName;
    pendingRenamePlantType = existingType;
    selectPlantType("rename", existingType);
    const modal = document.getElementById("rename-plant-modal");
    modal.style.display = "flex";
    modal._plantIndex = index;
    modal._oldName = oldName;
    setTimeout(() => {
        const el = document.getElementById("rename-plant-input");
        el.focus();
        el.select();
    }, 50);
}

function confirmRenamePlant() {
    const modal = document.getElementById("rename-plant-modal");
    const cycle = activeCycle();
    if (!cycle) return;
    const newNameRaw = document.getElementById("rename-plant-input").value.trim();
    const index = modal._plantIndex;
    const oldName = modal._oldName;
    const newType = pendingRenamePlantType;

    // The user can confirm to change: name only, type only, or both.
    // Only short-circuit if the trimmed name is empty.
    if (!newNameRaw) {
        alert("Plant name can't be empty.");
        return;
    }

    // Make sure plantTypes exists; every plant should be in it (auto or photo).
    if (!cycle.plantTypes || typeof cycle.plantTypes !== "object") cycle.plantTypes = {};

    // Decide the final name. If the user didn't change it, keep the old name.
    const newName = newNameRaw === oldName ? oldName : newNameRaw;

    if (newName !== oldName) {
        if (!PLANT_NAME_RE.test(newName)) {
            alert("Plant name can only contain letters, numbers, spaces, dashes, and underscores.");
            return;
        }
        if (cycle.plants.includes(newName)) {
            alert("A plant with that name already exists.");
            return;
        }
        cycle.plants[index] = newName;
        // Migrate the type key to the new name.
        delete cycle.plantTypes[oldName];
        // Migrate existing entry data so history stays consistent.
        cycle.entries.forEach((e) => {
            if (e.plants && e.plants[oldName]) {
                e.plants[newName] = e.plants[oldName];
                delete e.plants[oldName];
            }
            // Update action strings of the form "LST (COP, H)" → "LST (Plant1, H)".
            if (Array.isArray(e.actions)) {
                e.actions = e.actions.map((a) => {
                    const m = a.match(/^(.*?)\s*\((.*?)\)\s*$/);
                    if (!m) return a;
                    const prefix = m[1];
                    const items = m[2].split(", ").map((p) => (p === oldName ? newName : p));
                    return `${prefix} (${items.join(", ")})`;
                });
            }
        });
    }

    // Always persist the type — even if the name didn't change, the toggle
    // selection needs to be saved.
    cycle.plantTypes[newName] = newType;

    saveCycles(cycles);
    modal.style.display = "none";
    renderPlantList();
    renderAddForm();
    renderAll();
}

function cancelRenamePlant() {
    document.getElementById("rename-plant-modal").style.display = "none";
}

function deletePlant(index) {
    const cycle = activeCycle();
    if (!cycle) return;
    const name = cycle.plants[index];
    if (!confirm(`Remove plant "${name}"? It will disappear from the Add form. Existing entries that reference it keep their data.`)) return;
    cycle.plants.splice(index, 1);
    if (cycle.plantTypes) delete cycle.plantTypes[name];
    saveCycles(cycles);
    renderPlantList();
    renderAddForm();
    renderAll();
}

// ── New cycle modal ───────────────────────────────────────────────────────────
function newCycle() {
    const defaultName = `Grow #${cycles.length + 1}`;
    document.getElementById("new-cycle-input").value = defaultName;
    document.getElementById("new-cycle-modal").style.display = "flex";
    document.getElementById("new-cycle-input").select();
}

window.confirmNewCycle = function () {
    const name = document.getElementById("new-cycle-input").value.trim() || `Grow #${cycles.length + 1}`;
    document.getElementById("new-cycle-modal").style.display = "none";

    cycles.forEach((c) => collapsedCycles.add(c.id));
    saveCollapsedCycles(collapsedCycles);

    const today = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const startDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    // New cycles start with no plants — the user adds them via the Plants modal.
    const newC = { id: cycleUid(), name, startDate, plants: [], plantTypes: {}, entries: [] };
    cycles.push(newC);
    activeCycleId = newC.id;

    saveCycles(cycles);
    saveActiveCycleId(activeCycleId);

    updateGrowAge();
    renderAddForm();
    renderAll();
    resetAddForm();
    setDateDefault();
    updateLightStatus();
    showTab("log");
};

window.cancelNewCycle = function () {
    document.getElementById("new-cycle-modal").style.display = "none";
};

window.editCycleName = function (id, currentName) {
    const modal = document.getElementById("rename-cycle-modal");
    const input = document.getElementById("rename-cycle-input");
    input.value = currentName;
    modal.style.display = "flex";
    input.focus();
    modal._cycleId = id;
    modal._currentName = currentName;
};

window.cancelRenameCycle = function () {
    document.getElementById("rename-cycle-modal").style.display = "none";
};

window.confirmRenameCycle = function () {
    const modal = document.getElementById("rename-cycle-modal");
    const name = document.getElementById("rename-cycle-input").value.trim();
    if (!name || name === modal._currentName) {
        modal.style.display = "none";
        return;
    }
    const cycle = cycles.find((c) => c.id === modal._cycleId);
    if (cycle) {
        cycle.name = name;
        saveCycles(cycles);
        renderLog(cycles, activeCycleId);
    }
    modal.style.display = "none";
};

// ── Stats cycle toggle ────────────────────────────────────────────────────────
function setStatsCycle(id) {
    setStatsMode(id === "all" ? "all" : id);
    renderStats(cycles, activeCycleId);
}

// ── Edit entry ────────────────────────────────────────────────────────────────
function editEntry(id) {
    let entry = null;
    for (let c of cycles) {
        entry = c.entries.find((e) => e.id === id);
        if (entry) break;
    }
    if (!entry) return;

    editingEntryId = id;

    // Load date/time
    document.getElementById("new-dt").value = entry.dt;

    // Load plants — only those that exist on the current cycle.
    const plants = cyclePlants();
    plants.forEach((p) => {
        const pdata = entry.plants && entry.plants[p];
        if (pdata) {
            if (pdata.fish) document.getElementById(p + "-fish").value = pdata.fish;
            if (pdata.grow) document.getElementById(p + "-grow").value = pdata.grow;
            if (pdata.bloom) document.getElementById(p + "-bloom").value = pdata.bloom;
            if (pdata.water) document.getElementById(p + "-water").value = pdata.water;
        }
    });

    // Load actions
    const actions = entry.actions || [];
    document.getElementById("ck-lst").checked = actions.some((a) => a.startsWith("LST"));
    document.getElementById("ck-def").checked = actions.some((a) => a.startsWith("Defoliate"));
    document.getElementById("ck-light").checked = actions.some((a) => a.startsWith("Light adjusted"));
    document.getElementById("ck-repot").checked = actions.some((a) => a.startsWith("Repot / transplant"));

    // Handle LST plants
    if (document.getElementById("ck-lst").checked) {
        const lstAction = actions.find((a) => a.startsWith("LST"));
        const lstMatch = lstAction && lstAction.match(/\((.*?)\)/);
        if (lstMatch) {
            lstMatch[1].split(", ").forEach((p) => {
                const el = document.querySelector(`.lst-plant[value="${p.trim()}"]`);
                if (el) el.checked = true;
            });
        }
        document.getElementById("lst-plants").style.display = "block";
    } else {
        document.getElementById("lst-plants").style.display = "none";
    }

    // Handle Defoliate plants
    if (document.getElementById("ck-def").checked) {
        const defAction = actions.find((a) => a.startsWith("Defoliate"));
        const defMatch = defAction && defAction.match(/\((.*?)\)/);
        if (defMatch) {
            defMatch[1].split(", ").forEach((p) => {
                const el = document.querySelector(`.def-plant[value="${p.trim()}"]`);
                if (el) el.checked = true;
            });
        }
        document.getElementById("def-plants").style.display = "block";
    } else {
        document.getElementById("def-plants").style.display = "none";
    }

    // Handle Repot plants
    if (document.getElementById("ck-repot").checked) {
        const repotAction = actions.find((a) => a.startsWith("Repot / transplant"));
        const repotMatch = repotAction && repotAction.match(/\((.*?)\)/);
        if (repotMatch) {
            repotMatch[1].split(", ").forEach((p) => {
                const el = document.querySelector(`.repot-plant[value="${p.trim()}"]`);
                if (el) el.checked = true;
            });
        }
        document.getElementById("repot-plants").style.display = "block";
    } else {
        document.getElementById("repot-plants").style.display = "none";
    }

    // Handle light inputs
    if (document.getElementById("ck-light").checked) {
        const lightAction = actions.find((a) => a.startsWith("Light adjusted"));
        const lightMatch = lightAction && lightAction.match(/\((.*?)\)/);
        if (lightMatch) {
            const parts = lightMatch[1].split(", ");
            parts.forEach((part) => {
                if (part.includes("lux")) {
                    document.getElementById("light-lux").value = part.replace("k lux", "");
                } else if (part.includes("cm")) {
                    document.getElementById("light-dist").value = part.replace("cm", "");
                }
            });
        }
        document.getElementById("light-inputs").style.display = "block";
    } else {
        document.getElementById("light-inputs").style.display = "none";
    }

    // Load observations
    document.getElementById("new-obs").value = entry.obs || "";

    showTab("add");
}

// ── Save entry ────────────────────────────────────────────────────────────────
function saveEntry() {
    const dt = document.getElementById("new-dt").value;
    if (!dt) {
        alert("Set a date and time.");
        return;
    }

    const actions = [];
    if (document.getElementById("ck-lst").checked) {
        const plants = [...document.querySelectorAll(".lst-plant:checked")].map((el) => el.value);
        actions.push("LST" + (plants.length ? " (" + plants.join(", ") + ")" : ""));
    }
    if (document.getElementById("ck-def").checked) {
        const plants = [...document.querySelectorAll(".def-plant:checked")].map((el) => el.value);
        actions.push("Defoliate" + (plants.length ? " (" + plants.join(", ") + ")" : ""));
    }
    if (document.getElementById("ck-light").checked) {
        const lux = document.getElementById("light-lux").value;
        const dist = document.getElementById("light-dist").value;
        const start = document.getElementById("light-start").value;
        const end = document.getElementById("light-end").value;
        let label = "Light adjusted";
        const parts = [lux ? lux + "k lux" : null, dist ? dist + "cm" : null, start && end ? start + "–" + end : null].filter(Boolean);
        if (parts.length) label += " (" + parts.join(", ") + ")";
        actions.push(label);
    }
    if (document.getElementById("ck-repot").checked) {
        const plants = [...document.querySelectorAll(".repot-plant:checked")].map((el) => el.value);
        actions.push("Repot / transplant" + (plants.length ? " (" + plants.join(", ") + ")" : ""));
    }

    const plants = {};
    cyclePlants().forEach((p) => {
        const fish = parseFloat(document.getElementById(p + "-fish").value) || 0;
        const grow = parseFloat(document.getElementById(p + "-grow").value) || 0;
        const bloom = parseFloat(document.getElementById(p + "-bloom").value) || 0;
        const water = parseFloat(document.getElementById(p + "-water").value) || 0;
        if (fish || grow || bloom || water) {
            plants[p] = {};
            if (fish) plants[p].fish = fish;
            if (grow) plants[p].grow = grow;
            if (bloom) plants[p].bloom = bloom;
            if (water) plants[p].water = water;
        }
    });

    const obs = document.getElementById("new-obs").value.trim();
    const cycle = activeCycle();

    if (editingEntryId) {
        // Update existing entry
        const entry = cycle.entries.find((e) => e.id === editingEntryId);
        if (entry) {
            entry.dt = dt;
            entry.plants = plants;
            entry.actions = actions;
            entry.obs = obs || undefined;
        }
        editingEntryId = null;
    } else {
        // Create new entry
        cycle.entries.unshift({ id: uid(), dt, plants, actions, obs: obs || undefined });
    }

    saveCycles(cycles);
    renderAll();

    resetAddForm();
    showTab("log");
}

// ── Cancel edit ───────────────────────────────────────────────────────────────
function cancelEdit() {
    editingEntryId = null;
    resetAddForm();
    setDateDefault();
    showTab("log");
}

// ── Delete entry ──────────────────────────────────────────────────────────────
function deleteEntry(id) {
    if (!confirm("Delete this entry?")) return;
    cycles.forEach((c) => {
        c.entries = c.entries.filter((e) => e.id !== id);
    });
    saveCycles(cycles);
    renderAll();
}

// ── Delete cycle ──────────────────────────────────────────────────────────────
function deleteCycle(id) {
    const cycle = cycles.find((c) => c.id === id);
    if (!cycle) return;
    if (!confirm(`Delete "${cycle.name}" and all its entries? This cannot be undone.`)) return;
    cycles = cycles.filter((c) => c.id !== id);
    if (activeCycleId === id) {
        activeCycleId = cycles.length ? cycles[cycles.length - 1].id : null;
        saveActiveCycleId(activeCycleId);
    }
    saveCycles(cycles);
    updateGrowAge();
    renderAddForm();
    renderAll();
}

// ── Render all ────────────────────────────────────────────────────────────────
function renderAll() {
    renderLog(cycles, activeCycleId);
    renderStats(cycles, activeCycleId);
}

// localStorage.removeItem("collapsed_actions");

// ── Init ──────────────────────────────────────────────────────────────────────
updateGrowAge();
updateLightStatus();
setDateDefault();
_loadLightDefaults();
renderAddForm();
renderAll();
registerServiceWorker();
