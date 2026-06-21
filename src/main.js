import "./style.css";
import { uid, cycleUid, fmtDate, fmtTime, escapeHtml, getPlantMeta } from "./utils.js";
import { loadCycles, saveCycles, loadActiveCycleId, saveActiveCycleId, loadCollapsedCycles, saveCollapsedCycles, loadCollapsedWeeks, loadCollapsedObs } from "./storage.js";
import { initLog, renderLog, toggleWeek, toggleCycle, toggleEntry } from "./log.js";
import { initStats, renderStats, setStatsMode, initObsCollapsed, toggleObs } from "./stats.js";
import { registerServiceWorker } from "./sw.js";

let cycles = loadCycles();
let activeCycleId = loadActiveCycleId(cycles);
const collapsedCycles = loadCollapsedCycles();
const collapsedWeeks = loadCollapsedWeeks();
const collapsedObs = loadCollapsedObs();
let editingEntryId = null;
let pendingAddPlantType = "auto";
let pendingRenamePlantType = "auto";
let editingPlantObsIndex = null;
let pendingPlantObs = [];
let selectedPlantObsTab = null;

initLog(collapsedWeeks, collapsedCycles);
initStats("active");
initObsCollapsed(collapsedObs);

window.toggleWeek = toggleWeek;
window.toggleCycle = toggleCycle;
window.toggleEntry = toggleEntry;
window.deleteEntry = deleteEntry;
window.duplicateEntry = duplicateEntry;
window.editEntry = editEntry;
window.cancelEdit = cancelEdit;
window.saveEntry = saveEntry;
window.showTab = showTab;
window.editPlantObs = editPlantObs;
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
window.cancelRenamePlant = cancelRenamePlant;
window.confirmRenamePlant = confirmRenamePlant;
window.deletePlant = deletePlant;
window.selectPlantType = selectPlantType;
window.togglePlantType = togglePlantType;
window.toggleFavourite = toggleFavourite;
window.toggleObs = toggleObs;
window.addPlantObs = addPlantObs;
window.removePlantObs = removePlantObs;
window.exportBackup = exportBackup;
window.importBackup = importBackup;
window.toggleHeaderMenu = toggleHeaderMenu;
window.closeHeaderMenu = closeHeaderMenu;

function toggleHeaderMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById("header-menu");
    const btn = document.getElementById("header-menu-btn");
    const isOpen = menu.classList.toggle("open");
    btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

function closeHeaderMenu() {
    const menu = document.getElementById("header-menu");
    const btn = document.getElementById("header-menu-btn");
    menu.classList.remove("open");
    btn.setAttribute("aria-expanded", "false");
}

document.addEventListener("click", (e) => {
    const menu = document.getElementById("header-menu");
    const btn = document.getElementById("header-menu-btn");
    if (!menu || !menu.classList.contains("open")) return;
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    closeHeaderMenu();
});

(function initDragScroll() {
    const SCROLL_SELECTOR = ".stats-cycle-toggle--scroll, .plant-picker-list--scroll";
    let scroller = null;
    let isDown = false;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    document.addEventListener("mousedown", (e) => {
        scroller = e.target.closest(SCROLL_SELECTOR);
        if (!scroller) return;
        isDown = true;
        moved = false;
        startX = e.pageX;
        startScroll = scroller.scrollLeft;
        scroller.classList.add("dragging");
    });

    window.addEventListener("mousemove", (e) => {
        if (!isDown || !scroller) return;
        const dx = e.pageX - startX;
        if (Math.abs(dx) > 4) moved = true;
        scroller.scrollLeft = startScroll - dx;
    });

    function endDrag() {
        if (scroller) scroller.classList.remove("dragging");
        isDown = false;
        scroller = null;
    }
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("mouseleave", endDrag);

    document.addEventListener(
        "click",
        (e) => {
            const target = e.target.closest(SCROLL_SELECTOR);
            if (target && moved) {
                e.preventDefault();
                e.stopPropagation();
            }
            moved = false;
        },
        true
    );
})();

const PLANT_NAME_RE = /^[A-Za-z0-9 _-]+$/;

function activeCycle() {
    return cycles.find((c) => c.id === activeCycleId);
}

function cyclePlants() {
    return activeCycle()?.plants || [];
}

function resetPlantNotesDraft(seed) {
    pendingPlantObs = Array.isArray(seed) ? [...seed] : [];
    selectedPlantObsTab = null;
    editingPlantObsIndex = null;
    const plantObsInput = document.getElementById("plant-obs-input");
    if (plantObsInput) plantObsInput.value = "";
    renderPlantObsList();
}

function syncHeaderActions() {
    const btn = document.getElementById("header-add-plants-btn");
    if (!btn) return;
    btn.style.display = cycles.length === 0 ? "none" : "";
}

function renderAddForm() {
    const plants = cyclePlants();
    const cycle = activeCycle();

    const sortedPlants =
        plants.length === 0
            ? []
            : [...plants].sort((a, b) => {
                  const aFav = isFavourite(cycle, a) ? 0 : 1;
                  const bFav = isFavourite(cycle, b) ? 0 : 1;
                  return aFav - bFav;
              });

    syncHeaderActions();

    const nutrientList = document.getElementById("nutrient-plants-list");
    const nutrientInputs = document.getElementById("nutrient-inputs");
    if (nutrientList) {
        nutrientList.innerHTML = "";
        if (cycles.length === 0) {
            if (nutrientInputs) nutrientInputs.style.display = "none";
            const empty = document.createElement("div");
            empty.style.cssText = "font-size: 12px; color: var(--muted); padding: 4px 0";
            empty.innerHTML = 'No grow cycles yet. Tap <span onclick="newCycle()" style="color:var(--green);cursor:pointer;text-decoration:underline">+ New Cycle</span> to start one.';
            nutrientList.appendChild(empty);
        } else if (plants.length === 0) {
            if (nutrientInputs) nutrientInputs.style.display = "none";
            const empty = document.createElement("div");
            empty.style.cssText = "font-size: 12px; color: var(--muted); padding: 4px 0";
            empty.innerHTML = 'No plants yet. Tap <span onclick="openPlantManager()" style="color:var(--green);cursor:pointer;text-decoration:underline">+ Plants</span> to add some.';
            nutrientList.appendChild(empty);
        } else {
            if (nutrientInputs) nutrientInputs.style.display = "block";

            const PLANT_LIST_SCROLL_THRESHOLD = 0;
            nutrientList.classList.toggle("plant-picker-list--scroll", sortedPlants.length + 1 > PLANT_LIST_SCROLL_THRESHOLD);

            const allWrap = document.createElement("label");
            allWrap.className = "plant-picker-opt plant-picker-opt-all";
            const allCb = document.createElement("input");
            allCb.type = "checkbox";
            allCb.className = "nutrient-plant-all";
            allCb.onchange = () => {
                const individual = nutrientList.querySelectorAll(".nutrient-plant");
                individual.forEach((cb) => {
                    cb.checked = allCb.checked;
                });
            };
            allWrap.appendChild(allCb);
            allWrap.appendChild(document.createTextNode("All plants"));
            nutrientList.appendChild(allWrap);

            sortedPlants.forEach((p) => {
                const label = document.createElement("label");
                label.className = "plant-picker-opt";
                const cb = document.createElement("input");
                cb.type = "checkbox";
                cb.className = "nutrient-plant";
                cb.value = p;
                cb.onchange = updateNutrientAllToggle;
                label.appendChild(cb);
                label.appendChild(document.createTextNode(p));
                if (isFavourite(cycle, p)) {
                    const starWrap = document.createElement("span");
                    starWrap.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:11px;height:11px;fill:var(--amber);stroke:var(--amber);flex-shrink:0;vertical-align:-1px" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
                    label.appendChild(starWrap.firstChild);
                }
                nutrientList.appendChild(label);
            });
        }
    }

    ["lst", "def", "repot"].forEach((action) => {
        const picker = document.getElementById(action + "-plants");
        const list = picker.querySelector(".plant-picker-list");
        if (!list) return;
        list.innerHTML = "";
        if (plants.length === 0) {
            list.innerHTML = '<div style="font-size: 12px; color: var(--muted)">No plants available.</div>';
            return;
        }
        const allWrap = document.createElement("label");
        allWrap.className = "plant-picker-opt plant-picker-opt-all";
        const allCb = document.createElement("input");
        allCb.type = "checkbox";
        allCb.className = `${action}-plant-all`;
        allCb.onchange = () => {
            const individual = list.querySelectorAll(`.${action}-plant`);
            individual.forEach((cb) => {
                cb.checked = allCb.checked;
                cb.disabled = allCb.checked;
            });
        };
        allWrap.appendChild(allCb);
        allWrap.appendChild(document.createTextNode("All plants"));
        list.appendChild(allWrap);

        sortedPlants.forEach((p) => {
            const label = document.createElement("label");
            label.className = "plant-picker-opt";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.className = `${action}-plant`;
            cb.value = p;
            label.appendChild(cb);
            label.appendChild(document.createTextNode(p));
            if (isFavourite(cycle, p)) {
                const starWrap = document.createElement("span");
                starWrap.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:11px;height:11px;fill:var(--amber);stroke:var(--amber);flex-shrink:0;vertical-align:-1px" stroke-width="2" stroke-linecap="round" stroke-linejoin:round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
                label.appendChild(starWrap.firstChild);
            }
            list.appendChild(label);
        });
    });

    populatePlantObsTabs();
    renderPlantObsList();
}

function populatePlantObsTabs() {
    const tabs = document.getElementById("plant-obs-tabs");
    if (!tabs) return;
    const cycle = activeCycle();
    const plants = cyclePlants();
    if (plants.length === 0) {
        tabs.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 2px">No plants yet — add some via the Plants modal.</div>';
        const input = document.getElementById("plant-obs-input");
        const addBtn = document.querySelector(".plant-obs-add-btn");
        if (input) input.disabled = true;
        if (addBtn) addBtn.disabled = true;
        return;
    }
    const input = document.getElementById("plant-obs-input");
    const addBtn = document.querySelector(".plant-obs-add-btn");
    if (input) input.disabled = false;
    if (addBtn) addBtn.disabled = false;

    const sortedPlants = [...plants].sort((a, b) => (isFavourite(cycle, a) ? 0 : 1) - (isFavourite(cycle, b) ? 0 : 1));
    const tagged = new Set(pendingPlantObs.map((o) => o.plant));

    tabs.innerHTML = sortedPlants
        .map((p) => {
            const used = tagged.has(p);
            const cls = "plant-obs-tab" + (used ? " used" : "");
            const starSvg = isFavourite(cycle, p) ? `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:11px;height:11px;fill:var(--amber);stroke:var(--amber);flex-shrink:0;margin-right:4px;vertical-align:-1px" stroke-width="2" stroke-linecap="round" stroke-linejoin:round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>` : "";
            return `<button type="button" class="${cls}" data-plant="${escapeHtml(p)}"${used ? " disabled" : ""}>${starSvg}${escapeHtml(p)}</button>`;
        })
        .join("");

    selectedPlantObsTab = null;

    tabs.querySelectorAll(".plant-obs-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            if (tab.disabled) return;
            selectedPlantObsTab = tab.dataset.plant;
            editingPlantObsIndex = null;
            document.querySelectorAll(".plant-obs-item").forEach((el) => el.classList.remove("editing"));
            tabs.querySelectorAll(".plant-obs-tab").forEach((t) => t.classList.toggle("active", t.dataset.plant === selectedPlantObsTab));
            const inp = document.getElementById("plant-obs-input");
            if (inp) inp.focus();
        });
    });
}

function renderPlantObsList() {
    const list = document.getElementById("plant-obs-list");
    if (!list) return;
    if (pendingPlantObs.length === 0) {
        list.innerHTML = "";
    } else {
        list.innerHTML = pendingPlantObs
            .map(
                (o, i) => `
        <div class="plant-obs-item${editingPlantObsIndex === i ? " editing" : ""}">
            <div class="plant-obs-item-header">
                <span class="plant-obs-item-name">${escapeHtml(o.plant)}</span>
                <div>
                    <button class="plant-obs-item-edit" type="button" onclick="editPlantObs(${i})" title="Edit note" aria-label="Edit note for ${escapeHtml(o.plant)}">
                        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" style="width:18px;height:18px"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 7.5l3 3M4 20v-3.5L15.293 5.207a1 1 0 011.414 0l2.086 2.086a1 1 0 010 1.414L7.5 20H4z"></path></svg>
                    </button>
                    <button class="plant-obs-item-remove" type="button" onclick="removePlantObs(${i})" title="Remove note" aria-label="Remove note for ${escapeHtml(o.plant)}">×</button>
                </div>
            </div>
            <div class="plant-obs-item-text">${escapeHtml(o.text)}</div>
        </div>`
            )
            .join("");
    }
    populatePlantObsTabs();
}

function addPlantObs() {
    const inputEl = document.getElementById("plant-obs-input");
    if (!inputEl) return;
    const plant = selectedPlantObsTab;
    const text = inputEl.value.trim();
    if (!plant) {
        const tabs = document.getElementById("plant-obs-tabs");
        if (tabs) tabs.focus();
        if (tabs) {
            tabs.classList.add("plant-obs-tabs-shake");
            setTimeout(() => tabs.classList.remove("plant-obs-tabs-shake"), 350);
        }
        return;
    }
    if (!text) {
        inputEl.focus();
        return;
    }
    if (editingPlantObsIndex !== null) {
        pendingPlantObs[editingPlantObsIndex].text = text;
        editingPlantObsIndex = null;
    } else {
        const existingIdx = pendingPlantObs.findIndex((o) => o.plant === plant);
        if (existingIdx >= 0) {
            if (!confirm(`"${plant}" already has a note for this entry. Replace it?`)) return;
            pendingPlantObs[existingIdx].text = text;
        } else {
            pendingPlantObs.push({ plant, text });
        }
    }
    inputEl.value = "";
    selectedPlantObsTab = null;
    renderPlantObsList();
    inputEl.focus();
}

function removePlantObs(index) {
    const obs = pendingPlantObs[index];
    if (!obs) return;
    if (!confirm(`Remove note for "${obs.plant}"?`)) return;
    pendingPlantObs.splice(index, 1);
    if (editingPlantObsIndex !== null) {
        if (editingPlantObsIndex === index) editingPlantObsIndex = null;
        else if (editingPlantObsIndex > index) editingPlantObsIndex -= 1;
    }
    renderPlantObsList();
    const inputEl = document.getElementById("plant-obs-input");
    if (inputEl) inputEl.focus();
}

function editPlantObs(index) {
    const obs = pendingPlantObs[index];
    if (!obs) return;
    editingPlantObsIndex = index;
    selectedPlantObsTab = obs.plant;
    const input = document.getElementById("plant-obs-input");
    if (input) {
        input.value = obs.text;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }
    const tabs = document.getElementById("plant-obs-tabs");
    if (tabs) {
        tabs.querySelectorAll(".plant-obs-tab").forEach((t) => t.classList.toggle("active", t.dataset.plant === obs.plant));
    }
    document.querySelectorAll(".plant-obs-item").forEach((el, i) => el.classList.toggle("editing", i === index));
}

function showTab(name, resetScroll = false) {
    const current = ["log", "add", "stats"].find((t) => document.getElementById("section-" + t).classList.contains("active"));
    if (current === "add" && name !== "add" && !editingEntryId) {
        resetAddForm();
    }

    ["log", "add", "stats"].forEach((t) => {
        document.getElementById("section-" + t).classList.toggle("active", t === name);
        document.getElementById("tab-" + t).classList.toggle("active", t === name);
    });
    if (name === "add" && !editingEntryId) {
        resetAddForm();
        setDateDefault();
    }
    if (resetScroll) {
        const content = document.getElementById("content");
        if (content) content.scrollTop = 0;
        window.scrollTo(0, 0);
    }
}

function resetAddForm() {
    document.querySelectorAll(".nutrient-plant, .nutrient-plant-all").forEach((el) => (el.checked = false));
    ["fish", "grow", "bloom", "water"].forEach((n) => {
        const el = document.getElementById("nutrient-" + n);
        if (el) el.value = "";
    });
    ["fish", "grow", "bloom"].forEach((n) => {
        const concEl = document.getElementById("nutrient-" + n + "-conc");
        if (concEl) concEl.value = "";
    });

    ["lst", "def", "repot"].forEach((id) => {
        const el = document.getElementById("ck-" + id);
        if (el) el.checked = false;
    });
    document.querySelectorAll(".lst-plant, .def-plant, .repot-plant").forEach((el) => {
        el.checked = false;
        el.disabled = false;
    });
    document.querySelectorAll(".lst-plant-all, .def-plant-all, .repot-plant-all").forEach((el) => (el.checked = false));
    document.getElementById("lst-plants").style.display = "none";
    document.getElementById("def-plants").style.display = "none";
    document.getElementById("repot-plants").style.display = "none";
    document.getElementById("ck-light").checked = false;
    document.getElementById("light-inputs").style.display = "none";
    _loadLightDefaults();
    document.getElementById("new-obs").value = "";
    resetPlantNotesDraft();
    setDateDefault();
}

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

function setDateDefault() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    document.getElementById("new-dt").value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function switchPlant(p) {
    document.querySelectorAll(".plant-tab").forEach((el) => el.classList.toggle("active", (el.dataset.plant || el.textContent) === p));
    document.querySelectorAll(".plant-panel").forEach((el) => el.classList.toggle("active", el.id === "panel-" + p));
}

function togglePlantPicker(action) {
    const checked = document.getElementById("ck-" + action).checked;
    document.getElementById(action + "-plants").style.display = checked ? "block" : "none";
}

function toggleLightInputs() {
    document.getElementById("light-inputs").style.display = document.getElementById("ck-light").checked ? "block" : "none";
}

function getCycleLightDefaults() {
    const cycle = activeCycle();
    if (!cycle) return {};
    return cycle.lightDefaults || {};
}

function updateNutrientAllToggle() {
    const allCb = document.querySelector(".nutrient-plant-all");
    if (!allCb) return;
    const individual = document.querySelectorAll(".nutrient-plant");
    if (individual.length === 0) {
        allCb.checked = false;
        return;
    }
    allCb.checked = [...individual].every((cb) => cb.checked);
}

function updateLightStatus() {
    const d = getCycleLightDefaults();
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

        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;
        if (startMins < endMins) {
            isOn = nowMins >= startMins && nowMins < endMins;
        } else {
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
    const cycle = activeCycle();
    if (!cycle) return;
    cycle.lightDefaults = {
        lux: document.getElementById("light-lux").value,
        dist: document.getElementById("light-dist").value,
        start: document.getElementById("light-start").value,
        end: document.getElementById("light-end").value,
    };
    saveCycles(cycles);
    updateLightStatus();
}

function _loadLightDefaults() {
    const d = getCycleLightDefaults();
    document.getElementById("light-lux").value = d.lux || "";
    document.getElementById("light-dist").value = d.dist || "";
    document.getElementById("light-start").value = d.start || "";
    document.getElementById("light-end").value = d.end || "";
}

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
        const meta = cycle.plantTypes?.[p] || { type: "photo" };
        const type = typeof meta === "string" ? meta : meta.type;
        const badgeClass = type === "auto" ? "plant-type-badge auto" : "plant-type-badge photo";
        const badgeLabel = type === "auto" ? "AUTO" : "PHOTO";
        const row = document.createElement("div");
        row.className = "plant-manage-row";
        row.innerHTML = `
            <div class="plant-manage-name">${escapeHtml(p)}</div>
            <div class="plant-manage-actions">
                <span class="${badgeClass}" onclick="togglePlantType(${i})" title="Click to toggle type">${badgeLabel}</span>
                <button class="settings-btn edit-btn" onclick="renamePlant(${i})" aria-label="Rename ${escapeHtml(p)}" title="Rename"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px;" fill="none"><path stroke="var(--blue)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 7.5l3 3M4 20v-3.5L15.293 5.207a1 1 0 011.414 0l2.086 2.086a1 1 0 010 1.414L7.5 20H4z"></path></svg></button>
                <button class="settings-btn delete-btn" onclick="deletePlant(${i})" aria-label="Delete ${escapeHtml(p)}" title="Delete"><svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--red);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button>
                <button class="settings-btn favourite-btn ${isFavourite(cycle, p) ? "is-favourite" : ""}" onclick="toggleFavourite(${i})" aria-label="${isFavourite(cycle, p) ? "Unfavourite" : "Favourite"} ${escapeHtml(p)}" title="${isFavourite(cycle, p) ? "Unfavourite" : "Favourite"}"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:18px;height:18px;${isFavourite(cycle, p) ? "fill:var(--amber);stroke:var(--amber)" : "fill:none;stroke:var(--muted)"}" stroke-width="2" stroke-linecap="round" stroke-linejoin:round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></button>
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
    const current = getPlantMeta(cycle, name).type;
    if (!cycle.plantTypes[name] || typeof cycle.plantTypes[name] !== "object") {
        cycle.plantTypes[name] = { type: current, repottedAt: cycle.startDate };
    }
    cycle.plantTypes[name].type = current === "auto" ? "photo" : "auto";
    saveCycles(cycles);
    renderPlantList();
}

function toggleFavourite(index) {
    const cycle = activeCycle();
    if (!cycle) return;
    const name = cycle.plants[index];
    if (!Array.isArray(cycle.favourites)) cycle.favourites = [];
    const idx = cycle.favourites.indexOf(name);
    if (idx >= 0) {
        cycle.favourites.splice(idx, 1);
    } else {
        cycle.favourites.push(name);
    }
    saveCycles(cycles);
    renderPlantList();
    renderAddForm();
    renderStats(cycles, activeCycleId);
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
    const rawType = (cycle.plantTypes || {})[oldName];
    const existingType = (typeof rawType === "object" ? rawType?.type : rawType) || "auto";
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

    if (!newNameRaw) {
        alert("Plant name can't be empty.");
        return;
    }

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
        delete cycle.plantTypes[oldName];
        cycles.forEach((c) => {
            if (c.id !== cycle.id) return; // only migrate entries in the cycle the plant belongs to
            c.entries.forEach((e) => {
                if (e.plants && e.plants[oldName]) {
                    e.plants[newName] = e.plants[oldName];
                    delete e.plants[oldName];
                }
                if (Array.isArray(e.actions)) {
                    e.actions = e.actions.map((a) => {
                        const m = a.match(/^(.*?)\s*\((.*?)\)\s*$/);
                        if (!m) return a;
                        const prefix = m[1];
                        const items = m[2].split(", ").map((p) => (p === oldName ? newName : p));
                        return `${prefix} (${items.join(", ")})`;
                    });
                }
                if (e.plantObs && typeof e.plantObs === "object" && e.plantObs[oldName]) {
                    e.plantObs[newName] = e.plantObs[oldName];
                    delete e.plantObs[oldName];
                }
            });
        });
    }

    cycle.plantTypes[newName] = {
        type: newType,
        repottedAt: cycle.plantTypes[newName]?.repottedAt || cycle.startDate,
    };

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

function isFavourite(cycle, name) {
    return Array.isArray(cycle.favourites) && cycle.favourites.includes(name);
}

window.openPlantDetail = function (name) {
    const cycle = activeCycle();
    if (!cycle || !cycle.plants.includes(name)) {
        const found = cycles.find((c) => c.plants && c.plants.includes(name));
        if (!found) return;
        return renderPlantDetailModal(found, name);
    }
    renderPlantDetailModal(cycle, name);
};

function renderPlantDetailModal(cycle, name) {
    const meta = getPlantMeta(cycle, name);
    const type = meta.type;
    const typeLabel = type === "auto" ? "AUTO" : "PHOTO";
    const typeBadgeClass = type === "auto" ? "plant-type-badge auto" : "plant-type-badge photo";

    const t = { fish: 0, grow: 0, bloom: 0, water: 0, fishConc: null, growConc: null, bloomConc: null, fishConcDate: null, growConcDate: null, bloomConcDate: null };
    let lastFeed = null;
    let lastWater = null;
    let lastLst = null;
    let lastDefoliate = null;
    let feedCount = 0;
    let waterCount = 0;
    let lstCount = 0;
    let defoliateCount = 0;
    const plantObsItems = [];
    cycle.entries.forEach((e) => {
        const pd = e.plants?.[name];
        if (pd) {
            t.fish += pd.fish || 0;
            t.grow += pd.grow || 0;
            t.bloom += pd.bloom || 0;
            t.water += pd.water || 0;
            // Track the most recent non-zero concentration per nutrient,
            // along with the date it was logged. Water has no concentration.
            ["fish", "grow", "bloom"].forEach((n) => {
                const concKey = n + "Conc";
                if (pd[concKey]) {
                    const dateKey = concKey + "Date";
                    if (!t[dateKey] || new Date(e.dt) > new Date(t[dateKey])) {
                        t[concKey] = pd[concKey];
                        t[dateKey] = e.dt;
                    }
                }
            });
            const isFeed = pd.fish || pd.grow || pd.bloom;
            const isWater = pd.water;
            if (isFeed) {
                feedCount++;
                if (!lastFeed || new Date(e.dt) > new Date(lastFeed)) lastFeed = e.dt;
            }
            if (isWater) {
                waterCount++;
                if (!lastWater || new Date(e.dt) > new Date(lastWater)) lastWater = e.dt;
            }
        }
        if (e.plantObs && e.plantObs[name] && e.plantObs[name].trim()) {
            plantObsItems.push({ dt: e.dt, text: e.plantObs[name] });
        }
        (e.actions || []).forEach((a) => {
            const m = a.match(/^(LST|Defoliate)\s*(?:\(([^)]*)\))?\s*$/);
            if (!m) return;
            const kind = m[1];
            const items = m[2]
                ? m[2]
                      .split(", ")
                      .map((s) => s.trim())
                      .filter(Boolean)
                : [];
            if (items.length > 0 && !items.includes(name)) return;
            const entryDt = new Date(e.dt);
            if (kind === "LST") {
                lstCount++;
                if (!lastLst || entryDt > new Date(lastLst)) lastLst = e.dt;
            } else {
                defoliateCount++;
                if (!lastDefoliate || entryDt > new Date(lastDefoliate)) lastDefoliate = e.dt;
            }
        });
    });

    plantObsItems.sort((a, b) => new Date(b.dt) - new Date(a.dt));

    // For each nutrient, count how many feed entries used the same value as
    // the latest logged concentration (distinct from the cycle-wide cup total).
    const concFeedCount = { fish: 0, grow: 0, bloom: 0 };
    ["fish", "grow", "bloom"].forEach((n) => {
        const concKey = n + "Conc";
        const latest = t[concKey];
        if (latest == null) return;
        cycle.entries.forEach((e) => {
            const pd = e.plants?.[name];
            if (pd && pd[concKey] === latest) concFeedCount[n]++;
        });
    });

    const repottedAt = meta.repottedAt || cycle.startDate;
    const repottedDate = repottedAt ? new Date(repottedAt) : new Date(cycle.startDate);
    const ageDays = Math.max(0, Math.floor((new Date() - repottedDate) / (24 * 60 * 60 * 1000)));
    const ageWeeks = Math.max(1, Math.ceil(ageDays / 7));

    const nameEl = document.getElementById("plant-detail-name");
    nameEl.innerHTML = "";
    if (isFavourite(cycle, name)) {
        const starWrap = document.createElement("span");
        starWrap.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:14px;height:14px;fill:var(--amber);stroke:var(--amber);flex-shrink:0;margin-right:6px" stroke-width="2" stroke-linecap="round" stroke-linejoin:round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        nameEl.appendChild(starWrap.firstChild);
    }
    nameEl.appendChild(document.createTextNode(name));

    const typeEl = document.getElementById("plant-detail-type");
    typeEl.className = typeBadgeClass;
    typeEl.textContent = typeLabel;

    const now = new Date();
    const relStr = (s) => {
        const then = new Date(s);
        const diffMs = now - then;
        const future = diffMs < 0;
        const absMs = Math.abs(diffMs);
        const mins = Math.round(absMs / 60000);
        const hrs = Math.round(absMs / 3600000);
        const days = Math.floor(absMs / 86400000);
        let rel;
        if (mins < 1) rel = "just now";
        else if (mins < 60) rel = `${mins} min${mins === 1 ? "" : "s"} ago`;
        else if (hrs < 24) rel = `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
        else if (days < 30) rel = `${days} day${days === 1 ? "" : "s"} ago`;
        else {
            const months = Math.floor(days / 30);
            rel = future ? `in ${months} mo` : `${months} mo ago`;
        }
        if (future) {
            const flipped = rel.replace(/^in /, "").replace(/ ago$/, "");
            return `in ${flipped}`;
        }
        return rel;
    };
    const fmtStamp = (s, withRelative = false) => {
        if (!s) return "—";
        const abs = fmtDate(s);
        if (!withRelative) return abs;
        return `<span class="plant-detail-rel">${relStr(s)}</span> ${abs}`;
    };

    const repottedFmt = repottedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    // Each nutrient gets its own labelled block: latest concentration, the
    // date it's been in effect since (with the same relative-duration
    // styling used by Last fed / Last watered below), how many feeds used
    // that exact concentration, and the running cup total for the cycle.
    const nutrientBlock = (label, nutrientClass, qty, concVal, concDate, feedsAtConc) => `
        <div class="plant-detail-nutrient-block">
            <div class="plant-detail-nutrient-name ${nutrientClass}">${label}</div>
            <div class="plant-detail-row">
                <div class="plant-detail-label">Latest concentration</div>
                <div class="plant-detail-value">${concVal != null ? concVal + " ml/l" : "—"}</div>
            </div>
            <div class="plant-detail-row">
                <div class="plant-detail-label">Date</div>
                <div class="plant-detail-value">${concDate ? `<span class="plant-detail-rel">${relStr(concDate)}</span> since ${fmtDate(concDate)}` : "—"}</div>
            </div>
            <div class="plant-detail-row">
                <div class="plant-detail-label">Concentration total</div>
                <div class="plant-detail-value">${feedsAtConc} feed${feedsAtConc === 1 ? "" : "s"}</div>
            </div>
            <div class="plant-detail-row">
                <div class="plant-detail-label">Cycle total</div>
                <div class="plant-detail-value ${nutrientClass}">${qty.toFixed(1)} cup${qty === 1 ? "" : "s"}</div>
            </div>
        </div>`;

    const notesHtml =
        plantObsItems.length === 0
            ? '<div class="plant-detail-empty">No plant-specific notes yet.</div>'
            : plantObsItems
                  .map(
                      (o) => `
        <div class="plant-detail-obs">
            <div class="plant-detail-obs-date">${fmtStamp(o.dt)}</div>
            <div class="plant-detail-obs-text">${escapeHtml(o.text)}</div>
        </div>`
                  )
                  .join("");

    const statsHtml = `
        <div class="plant-detail-row">
            <div class="plant-detail-label">Type</div>
            <div class="plant-detail-value">${typeLabel}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Repotted</div>
            <div class="plant-detail-value">${repottedFmt}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Age (since repot)</div>
            <div class="plant-detail-value"><span class="plant-detail-rel">${ageWeeks} week${ageWeeks === 1 ? "" : "s"}</span> ${ageDays} day${ageDays === 1 ? "" : "s"}</div>
        </div>
        <div class="plant-detail-divider"></div>
        <div class="plant-detail-section-label">Cumulative nutrients &amp; water</div>
        ${nutrientBlock("Fish", "nutrient--fish", t.fish, t.fishConc, t.fishConcDate, concFeedCount.fish)}
        ${nutrientBlock("Grow", "nutrient--grow", t.grow, t.growConc, t.growConcDate, concFeedCount.grow)}
        ${nutrientBlock("Bloom", "nutrient--bloom", t.bloom, t.bloomConc, t.bloomConcDate, concFeedCount.bloom)}
        <div class="plant-detail-row">
            <div class="plant-detail-label">Total water</div>
            <div class="plant-detail-value nutrient--water">${t.water.toFixed(1)} cup${t.water === 1 ? "" : "s"}</div>
        </div>
                <div class="plant-detail-divider"></div>
        <div class="plant-detail-section-label">Activity</div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Feed sessions</div>
            <div class="plant-detail-value">${feedCount}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Water sessions</div>
            <div class="plant-detail-value">${waterCount}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times LST'd</div>
            <div class="plant-detail-value">${lstCount}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times defoliated</div>
            <div class="plant-detail-value">${defoliateCount}</div>
        </div>
        <div class="plant-detail-divider"></div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Last fed</div>
            <div class="plant-detail-value">${fmtStamp(lastFeed, true)}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Last watered</div>
            <div class="plant-detail-value">${fmtStamp(lastWater, true)}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Last LST'd</div>
            <div class="plant-detail-value">${fmtStamp(lastLst, true)}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Last defoliated</div>
            <div class="plant-detail-value">${fmtStamp(lastDefoliate, true)}</div>
        </div>
        <div class="plant-detail-divider"></div>
        <div class="plant-detail-section-label">Notes</div>
        ${notesHtml}
    `;

    document.getElementById("plant-detail-stats").innerHTML = statsHtml;
    document.getElementById("plant-detail-modal").style.display = "flex";
}

window.closePlantDetail = function () {
    document.getElementById("plant-detail-modal").style.display = "none";
};

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

    const newC = { id: cycleUid(), name, startDate, plants: [], plantTypes: {}, entries: [], lightDefaults: {} };
    cycles.push(newC);

    activeCycleId = newC.id;

    saveCycles(cycles);
    saveActiveCycleId(activeCycleId);

    updateGrowAge();
    renderAddForm();
    renderAll();
    syncHeaderActions();
    resetAddForm();
    setDateDefault();
    updateLightStatus();
    showTab("log", true);
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

function setStatsCycle(id) {
    setStatsMode(id === "all" ? "all" : id);
    renderStats(cycles, activeCycleId);
}

function editEntry(id) {
    let entry = null;
    let entryCycle = null;
    for (let c of cycles) {
        entry = c.entries.find((e) => e.id === id);
        if (entry) {
            entryCycle = c;
            break;
        }
    }
    if (!entry) return;

    if (entryCycle && entryCycle.id !== activeCycleId) {
        activeCycleId = entryCycle.id;
        saveActiveCycleId(activeCycleId);
        updateGrowAge();
        renderAddForm();
    }

    editingEntryId = id;

    document.getElementById("new-dt").value = entry.dt;

    const currentPlants = new Set(cyclePlants());
    const plantsWithData = Object.entries(entry.plants || {}).filter(([p, d]) => currentPlants.has(p) && d && (d.fish || d.grow || d.bloom || d.water || d.fishConc || d.growConc || d.bloomConc));

    document.querySelectorAll(".nutrient-plant").forEach((cb) => {
        cb.checked = plantsWithData.some(([p]) => p === cb.value);
    });
    updateNutrientAllToggle();

    let commonVals = null;
    let allSame = plantsWithData.length > 0;
    for (const [, d] of plantsWithData) {
        const vals = {
            fish: d.fish || 0,
            grow: d.grow || 0,
            bloom: d.bloom || 0,
            water: d.water || 0,
            fishConc: d.fishConc || 0,
            growConc: d.growConc || 0,
            bloomConc: d.bloomConc || 0,
        };
        if (!commonVals) {
            commonVals = vals;
        } else if (vals.fish !== commonVals.fish || vals.grow !== commonVals.grow || vals.bloom !== commonVals.bloom || vals.water !== commonVals.water || vals.fishConc !== commonVals.fishConc || vals.growConc !== commonVals.growConc || vals.bloomConc !== commonVals.bloomConc) {
            allSame = false;
            break;
        }
    }

    ["fish", "grow", "bloom", "water"].forEach((n) => {
        const el = document.getElementById("nutrient-" + n);
        if (el) el.value = allSame && commonVals ? commonVals[n] || "" : "";
    });
    ["fish", "grow", "bloom"].forEach((n) => {
        const concEl = document.getElementById("nutrient-" + n + "-conc");
        if (concEl) concEl.value = allSame && commonVals ? commonVals[n + "Conc"] || "" : "";
    });

    const actions = entry.actions || [];
    document.getElementById("ck-lst").checked = actions.some((a) => a.startsWith("LST"));
    document.getElementById("ck-def").checked = actions.some((a) => a.startsWith("Defoliate"));
    document.getElementById("ck-light").checked = actions.some((a) => a.startsWith("Light adjusted"));
    document.getElementById("ck-repot").checked = actions.some((a) => a.startsWith("Repot / transplant"));

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
        const allCb = document.querySelector(`.lst-plant-all`);
        const individual = document.querySelectorAll(`.lst-plant`);
        if (allCb && individual.length && [...individual].every((cb) => cb.checked)) {
            allCb.checked = true;
            individual.forEach((cb) => (cb.disabled = true));
        }
    } else {
        document.getElementById("lst-plants").style.display = "none";
    }

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

    document.getElementById("new-obs").value = entry.obs || "";

    const cyclePlantSet = new Set(cyclePlants());
    const staged = [];
    cyclePlants().forEach((p) => {
        const text = entry.plantObs?.[p];
        if (text && text.trim()) staged.push({ plant: p, text });
    });
    if (entry.plantObs && typeof entry.plantObs === "object") {
        Object.entries(entry.plantObs).forEach(([p, text]) => {
            if (!cyclePlantSet.has(p) && text && text.trim()) {
                staged.push({ plant: p, text });
            }
        });
    }
    resetPlantNotesDraft(staged);

    showTab("add");
}

function saveEntry() {
    const dt = document.getElementById("new-dt").value;
    if (!dt) {
        alert("Set a date and time.");
        return;
    }

    const cycle = activeCycle();

    const totalPlantCount = cyclePlants().length;
    const actions = [];
    if (document.getElementById("ck-lst").checked) {
        const plants = [...document.querySelectorAll(".lst-plant:checked")].map((el) => el.value);
        const label = plants.length === totalPlantCount ? "All plants" : plants.join(", ");
        actions.push("LST" + (label ? " (" + label + ")" : ""));
    }
    if (document.getElementById("ck-def").checked) {
        const plants = [...document.querySelectorAll(".def-plant:checked")].map((el) => el.value);
        const label = plants.length === totalPlantCount ? "All plants" : plants.join(", ");
        actions.push("Defoliate" + (label ? " (" + label + ")" : ""));
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
        const repottedPlants = [...document.querySelectorAll(".repot-plant:checked")].map((el) => el.value);
        const label = repottedPlants.length === totalPlantCount ? "All plants" : repottedPlants.join(", ");
        actions.push("Repot / transplant" + (label ? " (" + label + ")" : ""));

        const repotDate = dt.slice(0, 10);
        repottedPlants.forEach((name) => {
            if (!cycle.plantTypes[name] || typeof cycle.plantTypes[name] !== "object") {
                cycle.plantTypes[name] = { type: "auto", repottedAt: repotDate };
            } else {
                cycle.plantTypes[name].repottedAt = repotDate;
            }
        });
    }

    const plants = {};
    const selectedNutrientPlants = [...document.querySelectorAll(".nutrient-plant:checked")].map((el) => el.value);
    const fish = parseFloat(document.getElementById("nutrient-fish").value) || 0;
    const grow = parseFloat(document.getElementById("nutrient-grow").value) || 0;
    const bloom = parseFloat(document.getElementById("nutrient-bloom").value) || 0;
    const water = parseFloat(document.getElementById("nutrient-water").value) || 0;
    const fishConc = parseFloat(document.getElementById("nutrient-fish-conc").value) || 0;
    const growConc = parseFloat(document.getElementById("nutrient-grow-conc").value) || 0;
    const bloomConc = parseFloat(document.getElementById("nutrient-bloom-conc").value) || 0;
    if (fish || grow || bloom || water || fishConc || growConc || bloomConc) {
        selectedNutrientPlants.forEach((p) => {
            plants[p] = {};
            if (fish) plants[p].fish = fish;
            if (grow) plants[p].grow = grow;
            if (bloom) plants[p].bloom = bloom;
            if (water) plants[p].water = water;
            if (fishConc) plants[p].fishConc = fishConc;
            if (growConc) plants[p].growConc = growConc;
            if (bloomConc) plants[p].bloomConc = bloomConc;
        });
    }

    const validPlants = new Set(cyclePlants());
    const plantObs = {};
    pendingPlantObs.forEach((o) => {
        if (o.plant && validPlants.has(o.plant) && o.text && o.text.trim()) {
            plantObs[o.plant] = o.text.trim();
        }
    });

    const obs = document.getElementById("new-obs").value.trim();

    if (editingEntryId) {
        const entry = cycle.entries.find((e) => e.id === editingEntryId);
        if (entry) {
            entry.dt = dt;
            entry.plants = plants;
            entry.actions = actions;
            entry.obs = obs || undefined;
            entry.plantObs = Object.keys(plantObs).length ? plantObs : {};
        } else {
            alert("Couldn't find the entry to update. Please try editing it again.");
            return;
        }
        editingEntryId = null;
    } else {
        cycle.entries.unshift({
            id: uid(),
            dt,
            plants,
            actions,
            obs: obs || undefined,
            plantObs: Object.keys(plantObs).length ? plantObs : {},
        });
    }

    saveCycles(cycles);
    renderAll();

    resetAddForm();
    showTab("log", true);
}

function cancelEdit() {
    editingEntryId = null;
    resetAddForm();
    setDateDefault();
    showTab("log", true);
}

function duplicateEntry(id) {
    for (const cycle of cycles) {
        const entry = cycle.entries.find((e) => e.id === id);
        if (entry) {
            const copy = JSON.parse(JSON.stringify(entry));
            copy.id = uid();

            cycle.entries.unshift(copy);
            saveCycles(cycles);
            renderAll();
            return;
        }
    }
}

function deleteEntry(id) {
    if (!confirm("Delete this entry?")) return;
    cycles.forEach((c) => {
        c.entries = c.entries.filter((e) => e.id !== id);
    });
    saveCycles(cycles);
    renderAll();
}

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

function exportBackup() {
    const data = JSON.stringify(cycles, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `rootine-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) throw new Error("Invalid format");
            if (!confirm(`Import ${imported.length} cycle(s)? This will replace all current data.`)) return;
            localStorage.setItem("grow_cycles", JSON.stringify(imported));
            localStorage.setItem("grow_version", "6"); // keep in sync with storage.js STORAGE_VERSION
            location.reload();
        } catch {
            alert("Invalid backup file.");
        }
    };
    reader.readAsText(file);
    event.target.value = "";
}

function renderAll() {
    renderLog(cycles, activeCycleId);
    renderStats(cycles, activeCycleId);
    refreshOpenPlantDetail();
}

function refreshOpenPlantDetail() {
    const modal = document.getElementById("plant-detail-modal");
    if (!modal || modal.style.display === "none") return;
    const name = document.getElementById("plant-detail-name").textContent;
    if (!name) return;
    const cycle = cycles.find((c) => c.plants && c.plants.includes(name));
    if (cycle) renderPlantDetailModal(cycle, name);
}

updateGrowAge();
updateLightStatus();
setDateDefault();
_loadLightDefaults();
renderAddForm();
try {
    renderAll();
} catch (err) {
    console.error("Initial render failed:", err);
}
registerServiceWorker();
