import "./style.css";
import { uid, cycleUid } from "./utils.js";
import { loadCycles, saveCycles, loadActiveCycleId, saveActiveCycleId, loadCollapsedCycles, saveCollapsedCycles, loadCollapsedWeeks, loadCollapsedActions, loadLightDefaults, saveLightDefaults } from "./storage.js";
import { initLog, renderLog, toggleWeek, toggleCycle, toggleEntry, toggleActionList } from "./log.js";
import { initStats, renderStats, setStatsMode, getStatsMode } from "./stats.js";
import { registerServiceWorker } from "./sw.js";

// ── State ─────────────────────────────────────────────────────────────────────
let cycles = loadCycles();
let activeCycleId = loadActiveCycleId(cycles);
const collapsedCycles = loadCollapsedCycles();
const collapsedWeeks = loadCollapsedWeeks();
const collapsedActions = loadCollapsedActions();
let editingEntryId = null; // Track if we're editing an entry

initLog(collapsedWeeks, collapsedCycles, collapsedActions);
initStats("active");

// ── Expose globals ────────────────────────────────────────────────────────────
window.toggleWeek = toggleWeek;
window.toggleCycle = toggleCycle;
window.toggleEntry = toggleEntry;
window.toggleActionList = toggleActionList;
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function activeCycle() {
    return cycles.find((c) => c.id === activeCycleId);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function showTab(name) {
    ["log", "add", "stats"].forEach((t) => {
        document.getElementById("section-" + t).classList.toggle("active", t === name);
        document.getElementById("tab-" + t).classList.toggle("active", t === name);
    });
    if (name === "add" && !editingEntryId) {
        ["COP", "H", "GC", "GC2"].forEach((p) =>
            ["fish", "grow", "bloom", "water"].forEach((n) => {
                document.getElementById(p + "-" + n).value = "";
            })
        );
        ["lst", "def", "repot"].forEach((id) => {
            document.getElementById("ck-" + id).checked = false;
        });
        document.querySelectorAll(".lst-plant, .def-plant, .repot-plant").forEach((el) => (el.checked = false));
        document.getElementById("lst-plants").style.display = "none";
        document.getElementById("def-plants").style.display = "none";
        document.getElementById("repot-plants").style.display = "none";
        document.getElementById("new-obs").value = "";
        setDateDefault();
    }
}

// ── Grow age header ───────────────────────────────────────────────────────────
function updateGrowAge() {
    const cycle = activeCycle();
    if (!cycle) return;
    const start = new Date(cycle.startDate);
    const days = Math.floor((new Date() - start) / (24 * 60 * 60 * 1000));
    const week = Math.ceil(days / 7);
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
    document.querySelectorAll(".plant-tab").forEach((el) => el.classList.toggle("active", el.textContent === p));
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

function _saveLightDefaults() {
    saveLightDefaults(document.getElementById("light-lux").value, document.getElementById("light-dist").value);
}

function _loadLightDefaults() {
    const d = loadLightDefaults();
    if (d.lux) document.getElementById("light-lux").value = d.lux;
    if (d.dist) document.getElementById("light-dist").value = d.dist;
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

    const newC = { id: cycleUid(), name, startDate, entries: [] };
    cycles.push(newC);
    activeCycleId = newC.id;

    saveCycles(cycles);
    saveActiveCycleId(activeCycleId);

    updateGrowAge();
    renderAll();
    showTab("log");
};

window.cancelNewCycle = function () {
    document.getElementById("new-cycle-modal").style.display = "none";
};

// ── Stats cycle toggle ────────────────────────────────────────────────────────
function setStatsCycle(id) {
    setStatsMode(id === "all" ? "all" : id);
    renderStats(cycles, activeCycleId);
}

// ── Save entry ────────────────────────────────────────────────────────────────
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

    // Load plants
    ["COP", "H", "GC", "GC2"].forEach((p) => {
        const pdata = entry.plants[p];
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
        const lstMatch = lstAction.match(/\((.*?)\)/);
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
        const defMatch = defAction.match(/\((.*?)\)/);
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

    // Handle light inputs
    if (document.getElementById("ck-light").checked) {
        const lightAction = actions.find((a) => a.startsWith("Light adjusted"));
        const lightMatch = lightAction.match(/\((.*?)\)/);
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

    // Handle Repot plants
    if (document.getElementById("ck-repot").checked) {
        const repotAction = actions.find((a) => a.startsWith("Repot / transplant"));
        const repotMatch = repotAction.match(/\((.*?)\)/);
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
        let label = "Light adjusted";
        if (lux || dist) label += " (" + [lux ? lux + "k lux" : null, dist ? dist + "cm" : null].filter(Boolean).join(", ") + ")";
        actions.push(label);
    }
    if (document.getElementById("ck-repot").checked) {
        const plants = [...document.querySelectorAll(".repot-plant:checked")].map((el) => el.value);
        actions.push("Repot / transplant" + (plants.length ? " (" + plants.join(", ") + ")" : ""));
    }

    const plants = {};
    ["COP", "H", "GC", "GC2"].forEach((p) => {
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

    // Reset form
    ["COP", "H", "GC", "GC2"].forEach((p) =>
        ["fish", "grow", "bloom", "water"].forEach((n) => {
            document.getElementById(p + "-" + n).value = "";
        })
    );
    ["lst", "def", "repot"].forEach((id) => {
        document.getElementById("ck-" + id).checked = false;
    });
    document.querySelectorAll(".lst-plant, .def-plant, .repot-plant").forEach((el) => (el.checked = false));
    document.getElementById("lst-plants").style.display = "none";
    document.getElementById("def-plants").style.display = "none";
    document.getElementById("repot-plants").style.display = "none";
    document.getElementById("ck-light").checked = false;
    document.getElementById("light-inputs").style.display = "none";
    _loadLightDefaults();
    document.getElementById("new-obs").value = "";
    showTab("log");
}

// ── Cancel edit ───────────────────────────────────────────────────────────────
function cancelEdit() {
    editingEntryId = null;
    // Reset form
    ["COP", "H", "GC", "GC2"].forEach((p) =>
        ["fish", "grow", "bloom", "water"].forEach((n) => {
            document.getElementById(p + "-" + n).value = "";
        })
    );
    ["lst", "def", "repot"].forEach((id) => {
        document.getElementById("ck-" + id).checked = false;
    });
    document.querySelectorAll(".lst-plant, .def-plant, .repot-plant").forEach((el) => (el.checked = false));
    document.getElementById("lst-plants").style.display = "none";
    document.getElementById("def-plants").style.display = "none";
    document.getElementById("repot-plants").style.display = "none";
    document.getElementById("ck-light").checked = false;
    document.getElementById("light-inputs").style.display = "none";
    _loadLightDefaults();
    document.getElementById("new-obs").value = "";
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
