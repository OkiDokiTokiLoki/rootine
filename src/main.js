// In main.js

import "./style.css";
import { uid, cycleUid, fmtDate, fmtTime, escapeHtml, getPlantMeta, getNutrientColor, NUTRIENT_PALETTE, fmtQty } from "./utils.js";
import { loadCycles, saveCycles, loadActiveCycleId, saveActiveCycleId, loadCollapsedCycles, saveCollapsedCycles, loadCollapsedWeeks, loadCollapsedObs, isValidCyclesShape } from "./storage.js";
import { initLog, renderLog, toggleWeek, toggleCycle, toggleEntry } from "./log.js";
import { initStats, renderStats, setStatsMode, initObsCollapsed, toggleObs } from "./stats.js";
import { on, closeHeaderMenu } from "./actions.js";
import { icon } from "./icons.js";
import { registerServiceWorker } from "./sw.js";

let cycles = loadCycles();
let activeCycleId = loadActiveCycleId(cycles);
const collapsedCycles = loadCollapsedCycles();
const collapsedWeeks = loadCollapsedWeeks();
const collapsedObs = loadCollapsedObs();
let nutrientDrafts = {};
let nutrientActiveTab = "__ALL__";

// All form-state that's "pending" — i.e. mid-entry and not yet persisted
// — lives on one object. resetAddForm() resets it wholesale, cancelEdit
// and the cycle-switch path in editEntry() reset just the bits they
// own (currently: nothing outside the Add form), and the modal-bound
// modal._plantIndex / modal._oldName slots stay on the DOM nodes
// because they belong to a different scope (one modal, one key) and
// aren't reset by leaving the Add tab.
//
// editEntry() reads from it before resetting so re-opening the form
// while editing restores the prior plant-obs drafts; this matches the
// previous behavior where pendingPlantObs and selectedPlantObsTab
// persisted across showTab("add") → showTab("log") → editEntry again.
const draftState = {
    editingEntryId: null,
    pendingAddPlantType: "auto",
    pendingRenamePlantType: "auto",
    pendingPlantObs: [],
    selectedPlantObsTab: null,
    editingPlantObsIndex: null,
};

function resetDraft() {
    draftState.editingEntryId = null;
    draftState.pendingAddPlantType = "auto";
    draftState.pendingRenamePlantType = "auto";
    draftState.pendingPlantObs = [];
    draftState.selectedPlantObsTab = null;
    draftState.editingPlantObsIndex = null;
}

initLog(collapsedWeeks, collapsedCycles);
initStats("active");
initObsCollapsed(collapsedObs);

function toggleHeaderMenu() {
    const menu = document.getElementById("header-menu");
    const btn = document.getElementById("header-menu-btn");
    const isOpen = menu.classList.toggle("open");
    btn.classList.toggle("is-open", isOpen);
    btn.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

document.addEventListener("click", (e) => {
    const menu = document.getElementById("header-menu");
    const btn = document.getElementById("header-menu-btn");
    if (!menu || !menu.classList.contains("open")) return;
    if (menu.contains(e.target) || btn.contains(e.target)) return;
    closeHeaderMenu();
});

(function initDragScroll() {
    const SCROLL_SELECTOR = ".stats-cycle-toggle--scroll, .plant-picker-list--scroll, .nutrient-plant-tabs";
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

function readNutrientInputs() {
    const out = { nutrients: {}, concentrations: {}, water: null };
    const rowsContainer = document.getElementById("nutrient-rows");
    if (rowsContainer) {
        rowsContainer.querySelectorAll("input[data-nutrient]").forEach((el) => {
            const name = el.dataset.nutrient;
            const field = el.dataset.field;
            const raw = el.value;
            if (raw.trim() === "") {
                if (el.dataset.previewHadValue === "1") {
                    if (field === "amount") out.nutrients[name] = null;
                    else out.concentrations[name] = null;
                }
                return;
            }
            const n = parseFloat(raw);
            if (!isNaN(n)) {
                if (field === "amount") out.nutrients[name] = n;
                else out.concentrations[name] = n;
            }
        });
    }

    const waterEl = document.getElementById("nutrient-water");
    if (waterEl) {
        const raw = waterEl.value;
        if (raw.trim() === "") {
            if (waterEl.dataset.previewHadValue === "1") out.water = null;
        } else {
            const n = parseFloat(raw);
            if (!isNaN(n)) out.water = n;
        }
    }

    return out;
}

function writeNutrientInputs(data) {
    const d = data || {};
    const nutrients = d.nutrients || {};
    const concentrations = d.concentrations || {};

    const rowsContainer = document.getElementById("nutrient-rows");
    if (rowsContainer) {
        rowsContainer.querySelectorAll("input[data-nutrient]").forEach((el) => {
            const name = el.dataset.nutrient;
            const field = el.dataset.field;
            const v = field === "amount" ? nutrients[name] : concentrations[name];
            const hasValue = v != null && v !== "";
            el.value = hasValue ? String(v) : "";
            if (hasValue) {
                el.dataset.previewHadValue = "1";
            } else {
                delete el.dataset.previewHadValue;
            }
        });
    }

    const waterEl = document.getElementById("nutrient-water");
    if (waterEl) {
        const v = d.water;
        const hasValue = v != null && v !== "";
        waterEl.value = hasValue ? String(v) : "";
        if (hasValue) {
            waterEl.dataset.previewHadValue = "1";
        } else {
            delete waterEl.dataset.previewHadValue;
        }
    }
}

function mergeDrafts(base, overlay) {
    const result = { nutrients: {}, concentrations: {}, water: null };
    const apply = (src) => {
        if (!src) return;
        Object.entries(src.nutrients || {}).forEach(([k, v]) => {
            if (v != null) result.nutrients[k] = v;
        });
        Object.entries(src.concentrations || {}).forEach(([k, v]) => {
            if (v != null) result.concentrations[k] = v;
        });
        if (src.water != null) result.water = src.water;
    };
    apply(base);
    apply(overlay);

    const clean = {};
    if (Object.keys(result.nutrients).length > 0) clean.nutrients = result.nutrients;
    if (Object.keys(result.concentrations).length > 0) clean.concentrations = result.concentrations;
    if (result.water != null) clean.water = result.water;
    return clean;
}

function setNutrientTab(tab) {
    const outgoing = readNutrientInputs();
    const hasValues = (outgoing.nutrients && Object.keys(outgoing.nutrients).length > 0) || (outgoing.concentrations && Object.keys(outgoing.concentrations).length > 0) || outgoing.water != null;
    if (hasValues) {
        nutrientDrafts[nutrientActiveTab] = mergeDrafts(nutrientDrafts[nutrientActiveTab], outgoing);
    }

    nutrientActiveTab = tab;

    const allDraft = nutrientDrafts["__ALL__"] || {};
    const tabDraft = nutrientDrafts[tab] || {};
    const preview = mergeDrafts(allDraft, tabDraft);

    writeNutrientInputs(preview);

    document.querySelectorAll("#nutrient-plant-tabs .nutrient-tab").forEach((el) => {
        el.classList.toggle("active", el.dataset.tab === tab);
    });
}

function activeCycle() {
    return cycles.find((c) => c.id === activeCycleId);
}

function cyclePlants() {
    return activeCycle()?.plants || [];
}

function cycleNutrients() {
    const cycle = activeCycle();
    if (!cycle) return [];
    if (!Array.isArray(cycle.nutrients)) cycle.nutrients = [];
    return cycle.nutrients;
}

function resetPlantNotesDraft(seed) {
    draftState.pendingPlantObs = Array.isArray(seed) ? [...seed] : [];
    draftState.selectedPlantObsTab = null;
    draftState.editingPlantObsIndex = null;
    const plantObsInput = document.getElementById("plant-obs-input");
    if (plantObsInput) plantObsInput.value = "";
    renderPlantObsList();
}

function syncHeaderActions() {
    const btn = document.getElementById("header-add-plants-btn");
    if (!btn) return;
    btn.style.display = cycles.length === 0 ? "none" : "";
}

function renderNutrientFormRows() {
    const rowsContainer = document.getElementById("nutrient-rows");
    if (!rowsContainer) return;
    rowsContainer.innerHTML = "";
    const cycle = activeCycle();
    const nutrients = cycleNutrients();

    if (nutrients.length === 0) {
        const empty = document.createElement("div");
        empty.className = "nutrient-empty";
        empty.innerHTML = 'No nutrients yet. Add some via the <span data-action="openNutrientManager" style="color:var(--green);cursor:pointer;text-decoration:underline">Nutrient Manager</span>.';
        rowsContainer.appendChild(empty);
        return;
    }

    nutrients.forEach((n) => {
        const color = getNutrientColor(cycle, n.name);
        const row = document.createElement("div");
        row.className = "form-row";
        row.innerHTML = `
            <label class="form-label nutrient-field-label--${color}">${escapeHtml(n.name)}</label>
            <div class="nutrient-input-group">
                <input class="form-input" type="number" min="0" step="0.5" placeholder="cups" data-nutrient="${escapeHtml(n.name)}" data-field="amount" />
                <input class="form-input form-input--conc" type="number" min="0" step="1" placeholder="ml/l" data-nutrient="${escapeHtml(n.name)}" data-field="conc" title="Concentration (ml/l)" />
            </div>
        `;
        rowsContainer.appendChild(row);
    });
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

    const nutrientTabs = document.getElementById("nutrient-plant-tabs");
    if (nutrientTabs) {
        nutrientTabs.innerHTML = "";
        if (cycles.length === 0) {
            const empty = document.createElement("div");
            empty.className = "nutrient-empty";
            empty.innerHTML = 'No grow cycles yet. Tap <span data-action="newCycle" style="color:var(--green);cursor:pointer;text-decoration:underline">+ New Cycle</span> to start one.';
            nutrientTabs.appendChild(empty);
        } else if (sortedPlants.length === 0) {
            const empty = document.createElement("div");
            empty.className = "nutrient-empty";
            empty.innerHTML = 'No plants yet. Tap <span data-action="openPlantManager" style="color:var(--green);cursor:pointer;text-decoration:underline">+ Plants</span> to add some.';
            nutrientTabs.appendChild(empty);
        } else {
            const allTab = document.createElement("button");
            allTab.type = "button";
            allTab.className = "nutrient-tab";
            allTab.dataset.tab = "__ALL__";
            allTab.textContent = "All";
            nutrientTabs.appendChild(allTab);

            sortedPlants.forEach((p) => {
                const tab = document.createElement("button");
                tab.type = "button";
                tab.className = "nutrient-tab";
                tab.dataset.tab = p;
                if (isFavourite(cycle, p)) {
                    const star = document.createElement("span");
                    star.innerHTML = icon.star({ size: 10, marginRight: 4, verticalAlign: -1 });
                    tab.appendChild(star.firstChild);
                }
                tab.appendChild(document.createTextNode(p));
                nutrientTabs.appendChild(tab);
            });

            nutrientTabs.querySelectorAll(".nutrient-tab").forEach((tab) => {
                tab.addEventListener("click", () => setNutrientTab(tab.dataset.tab));
            });

            if (nutrientActiveTab !== "__ALL__" && !sortedPlants.includes(nutrientActiveTab)) {
                delete nutrientDrafts[nutrientActiveTab];
                nutrientActiveTab = "__ALL__";
            }
            Object.keys(nutrientDrafts).forEach((k) => {
                if (k !== "__ALL__" && !sortedPlants.includes(k)) {
                    delete nutrientDrafts[k];
                }
            });

            const validNutrients = new Set((cycle?.nutrients || []).map((n) => n.name));
            Object.values(nutrientDrafts).forEach((draft) => {
                if (draft.nutrients) {
                    Object.keys(draft.nutrients).forEach((k) => {
                        if (!validNutrients.has(k)) delete draft.nutrients[k];
                    });
                }
                if (draft.concentrations) {
                    Object.keys(draft.concentrations).forEach((k) => {
                        if (!validNutrients.has(k)) delete draft.concentrations[k];
                    });
                }
            });
        }
    }

    renderNutrientFormRows();

    if (sortedPlants.length > 0) {
        const allDraft = nutrientDrafts["__ALL__"] || {};
        const tabDraft = nutrientDrafts[nutrientActiveTab] || {};
        writeNutrientInputs(mergeDrafts(allDraft, tabDraft));
        if (nutrientTabs) {
            nutrientTabs.querySelectorAll(".nutrient-tab").forEach((el) => {
                el.classList.toggle("active", el.dataset.tab === nutrientActiveTab);
            });
        }
    } else {
        writeNutrientInputs({});
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
                starWrap.innerHTML = icon.star({ size: 11, marginRight: 0, verticalAlign: -1 });
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
    const tagged = new Set(draftState.pendingPlantObs.map((o) => o.plant));

    tabs.innerHTML = sortedPlants
        .map((p) => {
            const used = tagged.has(p);
            const cls = "plant-obs-tab" + (used ? " used" : "");
            const starSvg = isFavourite(cycle, p) ? icon.star({ size: 11, marginRight: 4, verticalAlign: -1 }) : "";
            return `<button type="button" class="${cls}" data-plant="${escapeHtml(p)}"${used ? " disabled" : ""}>${starSvg}${escapeHtml(p)}</button>`;
        })
        .join("");

    draftState.selectedPlantObsTab = null;

    tabs.querySelectorAll(".plant-obs-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            if (tab.disabled) return;
            draftState.selectedPlantObsTab = tab.dataset.plant;
            draftState.editingPlantObsIndex = null;
            document.querySelectorAll(".plant-obs-item").forEach((el) => el.classList.remove("editing"));
            tabs.querySelectorAll(".plant-obs-tab").forEach((t) => t.classList.toggle("active", t.dataset.plant === draftState.selectedPlantObsTab));
            const inp = document.getElementById("plant-obs-input");
            if (inp) inp.focus();
        });
    });
}

function renderPlantObsList() {
    const list = document.getElementById("plant-obs-list");
    if (!list) return;
    if (draftState.pendingPlantObs.length === 0) {
        list.innerHTML = "";
    } else {
        list.innerHTML = draftState.pendingPlantObs
            .map(
                (o, i) => `
        <div class="plant-obs-item${draftState.editingPlantObsIndex === i ? " editing" : ""}">
            <div class="plant-obs-item-header">
                <span class="plant-obs-item-name">${escapeHtml(o.plant)}</span>
                <div>
                    <button class="plant-obs-item-edit" type="button" data-action="editPlantObs" data-index="${i}" title="Edit note" aria-label="Edit note for ${escapeHtml(o.plant)}">
                        ${icon.edit()}
                    </button>
                    <button class="plant-obs-item-remove" type="button" data-action="removePlantObs" data-index="${i}" title="Remove note" aria-label="Remove note for ${escapeHtml(o.plant)}">
                        ${icon.trash()}
                    </button>
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
    const plant = draftState.selectedPlantObsTab;
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
    if (draftState.editingPlantObsIndex !== null) {
        draftState.pendingPlantObs[draftState.editingPlantObsIndex].text = text;
        draftState.editingPlantObsIndex = null;
    } else {
        const existingIdx = draftState.pendingPlantObs.findIndex((o) => o.plant === plant);
        if (existingIdx >= 0) {
            if (!confirm(`"${plant}" already has a note for this entry. Replace it?`)) return;
            draftState.pendingPlantObs[existingIdx].text = text;
        } else {
            draftState.pendingPlantObs.push({ plant, text });
        }
    }
    inputEl.value = "";
    draftState.selectedPlantObsTab = null;
    renderPlantObsList();
    inputEl.focus();
}

function removePlantObs(index) {
    const obs = draftState.pendingPlantObs[index];
    if (!obs) return;
    if (!confirm(`Remove note for "${obs.plant}"?`)) return;
    draftState.pendingPlantObs.splice(index, 1);
    if (draftState.editingPlantObsIndex !== null) {
        if (draftState.editingPlantObsIndex === index) draftState.editingPlantObsIndex = null;
        else if (draftState.editingPlantObsIndex > index) draftState.editingPlantObsIndex -= 1;
    }
    renderPlantObsList();
    const inputEl = document.getElementById("plant-obs-input");
    if (inputEl) inputEl.focus();
}

function editPlantObs(index) {
    const obs = draftState.pendingPlantObs[index];
    if (!obs) return;
    draftState.editingPlantObsIndex = index;
    draftState.selectedPlantObsTab = obs.plant;
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
    if (current === "add" && name !== "add" && !draftState.editingEntryId) {
        resetAddForm();
    }

    ["log", "add", "stats"].forEach((t) => {
        document.getElementById("section-" + t).classList.toggle("active", t === name);
        document.getElementById("tab-" + t).classList.toggle("active", t === name);
    });
    if (name === "add" && !draftState.editingEntryId) {
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
    nutrientDrafts = {};
    nutrientActiveTab = "__ALL__";

    const rowsContainer = document.getElementById("nutrient-rows");
    if (rowsContainer) {
        rowsContainer.querySelectorAll("input[data-nutrient]").forEach((el) => {
            el.value = "";
            delete el.dataset.previewHadValue;
        });
    }

    const waterEl = document.getElementById("nutrient-water");
    if (waterEl) {
        waterEl.value = "";
        delete waterEl.dataset.previewHadValue;
    }

    if (document.querySelector("#nutrient-plant-tabs .nutrient-tab")) {
        document.querySelectorAll("#nutrient-plant-tabs .nutrient-tab").forEach((el) => {
            el.classList.toggle("active", el.dataset.tab === "__ALL__");
        });
    }

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

function togglePlantPicker(pick) {
    const checked = document.getElementById("ck-" + pick).checked;
    document.getElementById(pick + "-plants").style.display = checked ? "block" : "none";
}

function toggleLightInputs() {
    document.getElementById("light-inputs").style.display = document.getElementById("ck-light").checked ? "block" : "none";
}

function getCycleLightDefaults() {
    const cycle = activeCycle();
    if (!cycle) return {};
    return cycle.lightDefaults || {};
}

function parseLightAction(action) {
    if (!action || action.type !== "light") return null;
    return {
        lux: action.lux || null,
        dist: action.dist || null,
        start: action.start || null,
        end: action.end || null,
    };
}

function latestLoggedLight(cycle) {
    if (!cycle) return null;
    const sorted = [...(cycle.entries || [])].sort((a, b) => new Date(b.dt) - new Date(a.dt));
    for (const e of sorted) {
        const action = (e.actions || []).find((a) => a && a.type === "light");
        if (action) return { parsed: parseLightAction(action), dt: e.dt };
    }
    return null;
}

function updateLightStatus() {
    const cycle = activeCycle();
    const el = document.getElementById("light-status-text");
    const bulb = document.getElementById("light-status-bulb");
    if (!el) return;

    const latest = latestLoggedLight(cycle);
    const defaults = getCycleLightDefaults();
    let lux = null,
        dist = null,
        start = null,
        end = null;
    if (latest) {
        lux = latest.parsed.lux ?? defaults.lux ?? null;
        dist = latest.parsed.dist ?? defaults.dist ?? null;
        start = latest.parsed.start ?? defaults.start ?? null;
        end = latest.parsed.end ?? defaults.end ?? null;
    } else {
        lux = defaults.lux || null;
        dist = defaults.dist || null;
        start = defaults.start || null;
        end = defaults.end || null;
    }

    let isOn = false;
    const parts = [];
    if (lux) parts.push(lux + "K");
    if (start && end) {
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
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
        parts.push(fmt(start) + "–" + fmt(end) + " (" + onH + "/" + offH + ")");
    }

    const nextText = parts.length ? parts.join("·") : "no active schedule";
    if (el.textContent !== nextText) el.textContent = nextText;
    if (bulb) {
        const nextStroke = isOn ? "var(--amber)" : "var(--muted)";
        if (bulb.style.fill !== nextStroke) bulb.style.fill = nextStroke;
    }
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
    persist();
}

function _loadLightDefaults() {
    const d = getCycleLightDefaults();
    document.getElementById("light-lux").value = d.lux || "";
    document.getElementById("light-dist").value = d.dist || "";
    document.getElementById("light-start").value = d.start || "";
    document.getElementById("light-end").value = d.end || "";
}

// ===== Plant manager =====

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
        const type = getPlantMeta(cycle, p).type;
        const badgeClass = type === "auto" ? "plant-type-badge auto" : "plant-type-badge photo";
        const badgeLabel = type === "auto" ? "AUTO" : "PHOTO";
        const row = document.createElement("div");
        row.className = "plant-manage-row";
        row.innerHTML = `
            <div class="plant-manage-name">${escapeHtml(p)}</div>
            <div class="plant-manage-actions">
                <span class="${badgeClass}" data-action="togglePlantType" data-index="${i}" title="Click to toggle type">${badgeLabel}</span>
                <button class="settings-btn blue-btn" data-action="renamePlant" data-index="${i}" aria-label="Rename ${escapeHtml(p)}" title="Rename">${icon.editStroke()}</button>
                <button class="settings-btn red-btn" data-action="deletePlant" data-index="${i}" aria-label="Delete ${escapeHtml(p)}" title="Delete">${icon.trashStroke()}</button>
                <button class="settings-btn favourite-btn ${isFavourite(cycle, p) ? "is-favourite" : ""}" data-action="toggleFavourite" data-index="${i}" aria-label="${isFavourite(cycle, p) ? "Unfavourite" : "Favourite"} ${escapeHtml(p)}" title="${isFavourite(cycle, p) ? "Unfavourite" : "Favourite"}">${icon.star({ size: 18, filled: isFavourite(cycle, p) })}</button>
            </div>
        `;
        list.appendChild(row);
    });
}

function openAddPlant() {
    document.getElementById("new-plant-name").value = "";
    draftState.pendingAddPlantType = "auto";
    selectPlantType("add", "auto");
    document.getElementById("add-plant-modal").style.display = "flex";
    setTimeout(() => document.getElementById("new-plant-name").focus(), 50);
}

function selectPlantType(scope, type) {
    if (scope === "add") {
        draftState.pendingAddPlantType = type;
    } else {
        draftState.pendingRenamePlantType = type;
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
    persist();
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
    persist();
    renderPlantList();
    renderAddForm();
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
    cycle.plantTypes[name] = draftState.pendingAddPlantType;
    persist();
    document.getElementById("add-plant-modal").style.display = "none";
    renderPlantList();
    renderAddForm();
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
    draftState.pendingRenamePlantType = existingType;
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
    const newType = draftState.pendingRenamePlantType;

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
            if (c.id !== cycle.id) return;
            c.entries.forEach((e) => {
                if (e.plants && e.plants[oldName]) {
                    e.plants[newName] = e.plants[oldName];
                    delete e.plants[oldName];
                }
                if (Array.isArray(e.actions)) {
                    // Walk structured actions and swap the name in each
                    // plant list. No more regex on prose — a "light"
                    // action is left alone since it never names plants.
                    e.actions = e.actions.map((a) => {
                        if (a && (a.type === "lst" || a.type === "def" || a.type === "repot") && Array.isArray(a.plants)) {
                            return { ...a, plants: a.plants.map((p) => (p === oldName ? newName : p)) };
                        }
                        return a;
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

    persist();
    modal.style.display = "none";
    renderPlantList();
    renderAddForm();
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
    persist();
    renderPlantList();
    renderAddForm();
}

function isFavourite(cycle, name) {
    return Array.isArray(cycle.favourites) && cycle.favourites.includes(name);
}

// ===== Nutrient manager =====

function openNutrientManager() {
    renderNutrientList();
    document.getElementById("nutrient-manage-modal").style.display = "flex";
}

function closeNutrientManager() {
    document.getElementById("nutrient-manage-modal").style.display = "none";
}

function renderNutrientList() {
    const cycle = activeCycle();
    const list = document.getElementById("nutrient-list");
    if (!list) return;
    if (!cycle) {
        list.innerHTML = '<div class="plant-empty">No active cycle. Start a new cycle from the header menu first.</div>';
        return;
    }
    const nutrients = cycleNutrients();
    if (nutrients.length === 0) {
        list.innerHTML = '<div class="plant-empty">No nutrients yet. Add some to start logging feeds.</div>';
        return;
    }
    list.innerHTML = "";
    nutrients.forEach((n, i) => {
        const color = getNutrientColor(cycle, n.name);
        const row = document.createElement("div");
        row.className = "plant-manage-row";
        row.innerHTML = `
            <div class="plant-manage-name">
                <span class="nutrient-swatch nutrient-swatch--${color}"></span>
                <span>${escapeHtml(n.name)}</span>
                ${n.defaultConcentration != null ? `<span class="nutrient-default-hint" title="Starting dilution">${escapeHtml(String(n.defaultConcentration))} ml/l</span>` : ""}

            </div>
            <div class="plant-manage-actions">
                <button class="settings-btn blue-btn" data-action="renameNutrient" data-index="${i}" title="Rename ${escapeHtml(n.name)}" aria-label="Rename ${escapeHtml(n.name)}">
                    ${icon.edit()}
                </button>
                <button class="settings-btn red-btn" data-action="deleteNutrient" data-index="${i}" title="Delete ${escapeHtml(n.name)}" aria-label="Delete ${escapeHtml(n.name)}">
                    ${icon.trash()}
                </button>
                <button class="settings-btn amber-btn" data-action="editNutrientDefault" data-index="${i}" title="Set starting dilution for ${escapeHtml(n.name)}" aria-label="Set default concentration for ${escapeHtml(n.name)}">
                    ${icon.waterDropLine()}
                </button>
            </div>
        `;
        list.appendChild(row);
    });
}

function openAddNutrient() {
    document.getElementById("new-nutrient-name").value = "";
    document.getElementById("new-nutrient-conc").value = "";
    document.getElementById("add-nutrient-modal").style.display = "flex";
    setTimeout(() => document.getElementById("new-nutrient-name").focus(), 50);
}

function confirmAddNutrient() {
    const name = document.getElementById("new-nutrient-name").value.trim();
    const concRaw = document.getElementById("new-nutrient-conc").value.trim();
    if (!name) {
        alert("Enter a nutrient name.");
        return;
    }
    let defaultConcentration = null;
    if (concRaw !== "") {
        const n = parseFloat(concRaw);
        if (isNaN(n) || n < 0) {
            alert("Concentration must be a non-negative number.");
            return;
        }
        defaultConcentration = n;
    }
    if (!PLANT_NAME_RE.test(name)) {
        alert("Nutrient name can only contain letters, numbers, spaces, dashes, and underscores.");
        return;
    }
    const cycle = activeCycle();
    if (!cycle) {
        alert("No active cycle.");
        return;
    }
    const nutrients = cycleNutrients();
    if (nutrients.some((n) => n.name === name)) {
        alert("A nutrient with that name already exists.");
        return;
    }
    nutrients.push({ name, defaultConcentration });
    persist();
    document.getElementById("add-nutrient-modal").style.display = "none";
    renderNutrientList();
    renderAddForm();
}

function cancelAddNutrient() {
    document.getElementById("add-nutrient-modal").style.display = "none";
}

function renameNutrient(index) {
    const cycle = activeCycle();
    if (!cycle) return;
    const nutrients = cycleNutrients();
    const oldName = nutrients[index].name;
    document.getElementById("rename-nutrient-input").value = oldName;
    const modal = document.getElementById("rename-nutrient-modal");
    modal.style.display = "flex";
    modal._nutrientIndex = index;
    modal._oldName = oldName;
    setTimeout(() => {
        const el = document.getElementById("rename-nutrient-input");
        el.focus();
        el.select();
    }, 50);
}

function confirmRenameNutrient() {
    const modal = document.getElementById("rename-nutrient-modal");
    const newName = document.getElementById("rename-nutrient-input").value.trim();
    const index = modal._nutrientIndex;
    const oldName = modal._oldName;
    const cycle = activeCycle();
    if (!cycle) return;
    const nutrients = cycleNutrients();

    if (!newName) {
        alert("Nutrient name can't be empty.");
        return;
    }
    if (newName === oldName) {
        modal.style.display = "none";
        return;
    }
    if (!PLANT_NAME_RE.test(newName)) {
        alert("Nutrient name can only contain letters, numbers, spaces, dashes, and underscores.");
        return;
    }
    if (nutrients.some((n) => n.name === newName)) {
        alert("A nutrient with that name already exists.");
        return;
    }

    nutrients[index].name = newName;

    cycle.entries.forEach((e) => {
        Object.values(e.plants || {}).forEach((pd) => {
            if (pd.nutrients && pd.nutrients[oldName] != null) {
                pd.nutrients[newName] = pd.nutrients[oldName];
                delete pd.nutrients[oldName];
            }
            if (pd.concentrations && pd.concentrations[oldName] != null) {
                pd.concentrations[newName] = pd.concentrations[oldName];
                delete pd.concentrations[oldName];
            }
        });
    });

    if (nutrientDrafts[oldName]) {
        nutrientDrafts[newName] = nutrientDrafts[oldName];
        delete nutrientDrafts[oldName];
    }

    persist();
    modal.style.display = "none";
    renderNutrientList();
    renderAddForm();
}

function cancelRenameNutrient() {
    document.getElementById("rename-nutrient-modal").style.display = "none";
}

function deleteNutrient(index) {
    const cycle = activeCycle();
    if (!cycle) return;
    const nutrients = cycleNutrients();
    const name = nutrients[index].name;
    if (!confirm(`Remove nutrient "${name}"? Existing entries that reference it keep their data, but it will no longer appear in the Add form or stats.`)) return;
    nutrients.splice(index, 1);

    Object.values(nutrientDrafts).forEach((draft) => {
        if (draft.nutrients) delete draft.nutrients[name];
        if (draft.concentrations) delete draft.concentrations[name];
    });

    persist();
    renderNutrientList();
    renderAddForm();
}

function editNutrientDefault(index) {
    const cycle = activeCycle();
    if (!cycle) return;
    const nutrients = cycleNutrients();
    const n = nutrients[index];
    if (!n) return;
    document.getElementById("edit-nutrient-default-name").textContent = n.name;
    const input = document.getElementById("edit-nutrient-default-input");
    input.value = n.defaultConcentration != null ? String(n.defaultConcentration) : "";
    const modal = document.getElementById("edit-nutrient-default-modal");
    modal.style.display = "flex";
    modal._nutrientIndex = index;
    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
}

function confirmEditNutrientDefault() {
    const modal = document.getElementById("edit-nutrient-default-modal");
    const cycle = activeCycle();
    if (!cycle) return;
    const nutrients = cycleNutrients();
    const n = nutrients[modal._nutrientIndex];
    if (!n) {
        modal.style.display = "none";
        return;
    }
    const raw = document.getElementById("edit-nutrient-default-input").value.trim();
    if (raw === "") {
        n.defaultConcentration = null;
    } else {
        const v = parseFloat(raw);
        if (isNaN(v) || v < 0) {
            alert("Concentration must be a non-negative number.");
            return;
        }
        n.defaultConcentration = v;
    }
    persist();
    modal.style.display = "none";
    renderNutrientList();
    renderAddForm();
}

function cancelEditNutrientDefault() {
    document.getElementById("edit-nutrient-default-modal").style.display = "none";
}

// ===== Plant detail =====

function openPlantDetail(name) {
    const cycle = activeCycle();
    if (!cycle || !cycle.plants.includes(name)) {
        const found = cycles.find((c) => c.plants && c.plants.includes(name));
        if (!found) return;
        return renderPlantDetailModal(found, name);
    }
    renderPlantDetailModal(cycle, name);
}

function renderPlantDetailModal(cycle, name) {
    const meta = getPlantMeta(cycle, name);
    const type = meta.type;
    const typeLabel = type === "auto" ? "AUTO" : "PHOTO";
    const typeBadgeClass = type === "auto" ? "plant-type-badge auto" : "plant-type-badge photo";

    const cycleNutrientList = cycle.nutrients || [];

    const t = { nutrients: {}, concentrations: {}, concDate: {}, water: 0 };
    let lastFeed = null;
    let lastWater = null;
    let lastLst = null;
    let lastDefoliate = null;
    let feedCount = 0;
    let waterCount = 0;
    let lstCount = 0;
    let defoliateCount = 0;
    let weeklyFeeds = 0;
    let weeklyWaters = 0;
    let weeklyLst = 0;
    let weeklyDefoliate = 0;
    let weeklyEntries = 0;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const plantObsItems = [];
    cycle.entries.forEach((e) => {
        if (new Date(e.dt).getTime() >= sevenDaysAgo) weeklyEntries++;
        const pd = e.plants?.[name];
        if (pd) {
            Object.entries(pd.nutrients || {}).forEach(([n, v]) => {
                t.nutrients[n] = (t.nutrients[n] || 0) + (v || 0);
            });
            Object.entries(pd.concentrations || {}).forEach(([n, v]) => {
                if (!v) return;
                if (!t.concDate[n] || new Date(e.dt) > new Date(t.concDate[n])) {
                    t.concentrations[n] = v;
                    t.concDate[n] = e.dt;
                }
            });
            t.water += pd.water || 0;

            const isFeed = pd.nutrients && Object.values(pd.nutrients).some((v) => v && v > 0);
            const isWater = pd.water;
            if (isFeed) {
                feedCount++;
                if (!lastFeed || new Date(e.dt) > new Date(lastFeed)) lastFeed = e.dt;
                if (new Date(e.dt).getTime() >= sevenDaysAgo) weeklyFeeds++;
            }
            if (isWater) {
                waterCount++;
                if (!lastWater || new Date(e.dt) > new Date(lastWater)) lastWater = e.dt;
                if (new Date(e.dt).getTime() >= sevenDaysAgo) weeklyWaters++;
            }
        }
        if (e.plantObs && e.plantObs[name] && e.plantObs[name].trim()) {
            plantObsItems.push({ dt: e.dt, text: e.plantObs[name] });
        }
        // Structured actions: no regex parsing, just type + plants array.
        // An empty plants array still counts as "applied to this plant",
        // matching the legacy "All plants" semantic.
        (e.actions || []).forEach((a) => {
            if (!a || (a.type !== "lst" && a.type !== "def")) return;
            const items = a.plants || [];
            if (items.length > 0 && !items.includes(name)) return;
            const entryDt = new Date(e.dt);
            if (a.type === "lst") {
                lstCount++;
                if (!lastLst || entryDt > new Date(lastLst)) lastLst = e.dt;
                if (entryDt.getTime() >= sevenDaysAgo) weeklyLst++;
            } else {
                defoliateCount++;
                if (!lastDefoliate || entryDt > new Date(lastDefoliate)) lastDefoliate = e.dt;
                if (entryDt.getTime() >= sevenDaysAgo) weeklyDefoliate++;
            }
        });
    });

    plantObsItems.sort((a, b) => new Date(b.dt) - new Date(a.dt));

    const concFeedCount = {};
    cycleNutrientList.forEach((n) => {
        const defaultConc = n.defaultConcentration ?? null;
        let activeConc = defaultConc;
        let count = 0;
        const sorted = [...cycle.entries].sort((a, b) => new Date(a.dt) - new Date(b.dt));
        for (const e of sorted) {
            const pd = e.plants?.[name];
            if (!pd) continue;
            const amount = pd.nutrients?.[n.name];
            const hasFeed = amount && amount > 0;
            const entryConc = pd.concentrations?.[n.name] ?? null;
            if (entryConc != null && entryConc !== activeConc) {
                activeConc = entryConc;
                count = 0;
            }
            if (hasFeed && entryConc != null && entryConc === activeConc) {
                count++;
            }
        }
        concFeedCount[n.name] = count;
    });

    const repottedAt = meta.repottedAt || cycle.startDate;
    const repottedDate = repottedAt ? new Date(repottedAt) : new Date(cycle.startDate);
    const ageDays = Math.max(0, Math.floor((new Date() - repottedDate) / (24 * 60 * 60 * 1000)));
    const ageWeeks = Math.max(1, Math.ceil(ageDays / 7));

    const nameEl = document.getElementById("plant-detail-name");
    nameEl.innerHTML = "";
    if (isFavourite(cycle, name)) {
        const starWrap = document.createElement("span");
        starWrap.innerHTML = icon.star({ size: 14, marginRight: 6 });
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

    const nutrientBlock = (label, nutrientClass, qty, concVal, concDate, feedsAtConc, isDefault) => `
        <div class="plant-detail-nutrient-block">
            <div class="plant-detail-nutrient-name ${nutrientClass}">${escapeHtml(label)}</div>
            <div class="plant-detail-row">
                <div class="plant-detail-label">Active dilution</div>
                <div class="plant-detail-value">${concVal != null ? concVal + " ml/l" : "—"}</div>
            </div>
            <div class="plant-detail-row">
                <div class="plant-detail-label">Used for</div>
                <div class="plant-detail-value">${feedsAtConc} feed${feedsAtConc === 1 ? "" : "s"}</div>
            </div>
            <div class="plant-detail-row">
                <div class="plant-detail-label">Date</div>
                <div class="plant-detail-value">${concDate ? `<span class="plant-detail-rel">${relStr(concDate)}</span> since ${fmtDate(concDate)}` : isDefault ? `<span class="plant-detail-rel">since cycle start</span>` : "—"}</div>
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

    const nutrientBlocks = cycleNutrientList
        .map((n) => {
            const color = getNutrientColor(cycle, n.name);
            const qty = t.nutrients[n.name] || 0;
            const conc = t.concentrations[n.name];
            const concDate = t.concDate[n.name];
            const isDefault = conc == null && n.defaultConcentration != null;
            const effectiveConc = conc != null ? conc : (n.defaultConcentration ?? null);
            const effectiveDate = concDate || (isDefault ? cycle.startDate : null);
            const count = concFeedCount[n.name] || 0;
            return nutrientBlock(n.name, `nutrient--${color}`, qty, effectiveConc, effectiveDate, count, isDefault);
        })
        .join("");

    const nutrientsSection =
        cycleNutrientList.length > 0
            ? `
           <div class="plant-detail-row">
               <div class="plant-detail-label">Total water</div>
               <div class="plant-detail-value nutrient--water">${t.water.toFixed(1)} cup${t.water === 1 ? "" : "s"}</div>
           </div>
           ${nutrientBlocks}`
            : `<div class="plant-detail-row">
               <div class="plant-detail-label">Total water</div>
               <div class="plant-detail-value nutrient--water">${t.water.toFixed(1)} cup${t.water === 1 ? "" : "s"}</div>
           </div>
           <div class="plant-detail-empty">No nutrients configured for this cycle. Add some via the Nutrient Manager to track per-nutrient stats.</div>`;

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
        ${nutrientsSection}
        <div class="plant-detail-divider"></div>
        <div class="plant-detail-section-label">Recount</div>
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
        <div class="plant-detail-section-label">Last 7 days</div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times fed</div>
            <div class="plant-detail-value${weeklyFeeds === 0 ? " plant-detail-value--muted" : ""}">${weeklyFeeds}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times watered</div>
            <div class="plant-detail-value${weeklyWaters === 0 ? " plant-detail-value--muted" : ""}">${weeklyWaters}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times LST'd</div>
            <div class="plant-detail-value${weeklyLst === 0 ? " plant-detail-value--muted" : ""}">${weeklyLst}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times defoliated</div>
            <div class="plant-detail-value${weeklyDefoliate === 0 ? " plant-detail-value--muted" : ""}">${weeklyDefoliate}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Log entries</div>
            <div class="plant-detail-value${weeklyEntries === 0 ? " plant-detail-value--muted" : ""}">${weeklyEntries}</div>
        </div>
        <div class="plant-detail-divider"></div>
        <div class="plant-detail-section-label">Cycle recap</div>
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
        <div class="plant-detail-section-label">Notes</div>
        ${notesHtml}
    `;

    document.getElementById("plant-detail-stats").innerHTML = statsHtml;
    document.getElementById("plant-detail-modal").style.display = "flex";
}

function closePlantDetail() {
    document.getElementById("plant-detail-modal").style.display = "none";
}

// ===== Cycles =====

function newCycle() {
    const defaultName = `Grow #${cycles.length + 1}`;
    document.getElementById("new-cycle-input").value = defaultName;
    document.getElementById("new-cycle-modal").style.display = "flex";
    document.getElementById("new-cycle-input").select();
}

function confirmNewCycle() {
    const name = document.getElementById("new-cycle-input").value.trim() || `Grow #${cycles.length + 1}`;
    document.getElementById("new-cycle-modal").style.display = "none";

    cycles.forEach((c) => collapsedCycles.add(c.id));
    saveCollapsedCycles(collapsedCycles);

    const today = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const startDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    const newC = { id: cycleUid(), name, startDate, plants: [], plantTypes: {}, entries: [], lightDefaults: {}, nutrients: [] };
    cycles.push(newC);

    activeCycleId = newC.id;

    persist();
    saveActiveCycleId(activeCycleId);

    updateGrowAge();
    renderAddForm();
    syncHeaderActions();
    resetAddForm();
    setDateDefault();
    showTab("log", true);
}

function cancelNewCycle() {
    document.getElementById("new-cycle-modal").style.display = "none";
}

function editCycleName(id, currentName) {
    const modal = document.getElementById("rename-cycle-modal");
    const input = document.getElementById("rename-cycle-input");
    input.value = currentName;
    modal.style.display = "flex";
    input.focus();
    modal._cycleId = id;
    modal._currentName = currentName;
}

function cancelRenameCycle() {
    document.getElementById("rename-cycle-modal").style.display = "none";
}

function confirmRenameCycle() {
    const modal = document.getElementById("rename-cycle-modal");
    const name = document.getElementById("rename-cycle-input").value.trim();
    if (!name) {
        alert("Cycle name can't be empty.");
        return;
    }
    if (name === modal._currentName) {
        modal.style.display = "none";
        return;
    }
    const cycle = cycles.find((c) => c.id === modal._cycleId);
    if (cycle) {
        cycle.name = name;
        persist();
    }
    modal.style.display = "none";
}

function setStatsCycle(id) {
    setStatsMode(id === "all" ? "all" : id);
    renderStats(cycles, activeCycleId);
}

// Restore checkboxes for an action that tags a set of plants (LST,
// Defoliate, Repot). An empty plant list (legacy "All plants") means
// "every plant was selected at save time" — we treat that as all
// checkboxes ticked, matching the original behavior. `autoCheckAll`
// preserves the (slightly asymmetric) original behavior where only LST
// re-checks the "All plants" master checkbox when every individual is
// ticked; Defoliate and Repot leave it unchecked.
function restorePlants(action, itemSelector, allSelector, autoCheckAll) {
    if (!action || !Array.isArray(action.plants)) return;
    const allCb = document.querySelector(allSelector);
    const individual = document.querySelectorAll(itemSelector);
    if (action.plants.length === 0) {
        individual.forEach((cb) => (cb.checked = true));
    } else {
        const selected = new Set(action.plants);
        individual.forEach((cb) => {
            if (selected.has(cb.value)) cb.checked = true;
        });
    }
    if (autoCheckAll && allCb && individual.length > 0 && [...individual].every((cb) => cb.checked)) {
        allCb.checked = true;
        individual.forEach((cb) => (cb.disabled = true));
    }
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
        updateLightStatus();
    }

    draftState.editingEntryId = id;

    document.getElementById("new-dt").value = entry.dt;

    nutrientDrafts = {};
    Object.entries(entry.plants || {}).forEach(([name, data]) => {
        nutrientDrafts[name] = { ...data };
    });
    nutrientActiveTab = "__ALL__";
    writeNutrientInputs({});
    document.querySelectorAll("#nutrient-plant-tabs .nutrient-tab").forEach((el) => {
        el.classList.toggle("active", el.dataset.tab === "__ALL__");
    });

    const actions = entry.actions || [];
    document.getElementById("ck-lst").checked = actions.some((a) => a && a.type === "lst");
    document.getElementById("ck-def").checked = actions.some((a) => a && a.type === "def");
    document.getElementById("ck-light").checked = actions.some((a) => a && a.type === "light");
    document.getElementById("ck-repot").checked = actions.some((a) => a && a.type === "repot");

    if (document.getElementById("ck-lst").checked) {
        restorePlants(
            actions.find((a) => a.type === "lst"),
            ".lst-plant",
            ".lst-plant-all",
            true
        );
        document.getElementById("lst-plants").style.display = "block";
    } else {
        document.getElementById("lst-plants").style.display = "none";
    }

    if (document.getElementById("ck-def").checked) {
        restorePlants(
            actions.find((a) => a.type === "def"),
            ".def-plant",
            ".def-plant-all",
            false
        );
        document.getElementById("def-plants").style.display = "block";
    } else {
        document.getElementById("def-plants").style.display = "none";
    }

    if (document.getElementById("ck-repot").checked) {
        restorePlants(
            actions.find((a) => a.type === "repot"),
            ".repot-plant",
            ".repot-plant-all",
            false
        );
        document.getElementById("repot-plants").style.display = "block";
    } else {
        document.getElementById("repot-plants").style.display = "none";
    }

    if (document.getElementById("ck-light").checked) {
        const lightAction = actions.find((a) => a.type === "light");
        if (lightAction) {
            document.getElementById("light-lux").value = lightAction.lux || "";
            document.getElementById("light-dist").value = lightAction.dist || "";
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
    const sortedPlants = [...cyclePlants()].sort((a, b) => {
        const aFav = isFavourite(cycle, a) ? 0 : 1;
        const bFav = isFavourite(cycle, b) ? 0 : 1;
        return aFav - bFav;
    });

    // Build actions as structured objects. formatAction (in utils.js)
    // is the only place that turns these back into display strings.
    const actions = [];
    if (document.getElementById("ck-lst").checked) {
        const plants = [...document.querySelectorAll(".lst-plant:checked")].map((el) => el.value);
        actions.push({ type: "lst", plants });
    }
    if (document.getElementById("ck-def").checked) {
        const plants = [...document.querySelectorAll(".def-plant:checked")].map((el) => el.value);
        actions.push({ type: "def", plants });
    }
    if (document.getElementById("ck-light").checked) {
        const lux = document.getElementById("light-lux").value;
        const dist = document.getElementById("light-dist").value;
        const start = document.getElementById("light-start").value;
        const end = document.getElementById("light-end").value;
        actions.push({ type: "light", lux, dist, start, end });
    }
    if (document.getElementById("ck-repot").checked) {
        const repottedPlants = [...document.querySelectorAll(".repot-plant:checked")].map((el) => el.value);
        actions.push({ type: "repot", plants: repottedPlants });

        const repotDate = dt.slice(0, 10);
        repottedPlants.forEach((name) => {
            if (!cycle.plantTypes[name] || typeof cycle.plantTypes[name] !== "object") {
                cycle.plantTypes[name] = { type: "auto", repottedAt: repotDate };
            } else {
                cycle.plantTypes[name].repottedAt = repotDate;
            }
        });
    }

    const currentDraft = readNutrientInputs();
    const hasCurrentDraft = (currentDraft.nutrients && Object.keys(currentDraft.nutrients).length > 0) || (currentDraft.concentrations && Object.keys(currentDraft.concentrations).length > 0) || currentDraft.water != null;
    if (hasCurrentDraft) {
        nutrientDrafts[nutrientActiveTab] = mergeDrafts(nutrientDrafts[nutrientActiveTab], currentDraft);
    }

    const plants = {};
    const allDraft = nutrientDrafts["__ALL__"] || {};

    sortedPlants.forEach((p) => {
        const tabDraft = nutrientDrafts[p] || {};
        const data = {};

        const mergedNutrients = {};
        Object.entries(allDraft.nutrients || {}).forEach(([k, v]) => {
            if (v != null) mergedNutrients[k] = v;
        });
        Object.entries(tabDraft.nutrients || {}).forEach(([k, v]) => {
            if (v != null) mergedNutrients[k] = v;
        });
        if (Object.keys(mergedNutrients).length > 0) data.nutrients = mergedNutrients;

        const mergedConcs = {};
        Object.entries(allDraft.concentrations || {}).forEach(([k, v]) => {
            if (v != null) mergedConcs[k] = v;
        });
        Object.entries(tabDraft.concentrations || {}).forEach(([k, v]) => {
            if (v != null) mergedConcs[k] = v;
        });
        if (Object.keys(mergedConcs).length > 0) data.concentrations = mergedConcs;

        const water = tabDraft.water != null ? tabDraft.water : allDraft.water;
        if (water != null && water !== "") data.water = water;

        if (Object.keys(data).length > 0) plants[p] = data;
    });

    const validPlants = new Set(cyclePlants());
    const plantObs = {};
    draftState.pendingPlantObs.forEach((o) => {
        if (o.plant && validPlants.has(o.plant) && o.text && o.text.trim()) {
            plantObs[o.plant] = o.text.trim();
        }
    });

    const obs = document.getElementById("new-obs").value.trim();

    if (draftState.editingEntryId) {
        const entry = cycle.entries.find((e) => e.id === draftState.editingEntryId);
        if (!entry) {
            alert("This entry was deleted from another tab or session. Saving as a new entry.");
            resetDraft();
        } else {
            entry.dt = dt;
            entry.plants = plants;
            entry.actions = actions;
            entry.obs = obs || undefined;
            entry.plantObs = Object.keys(plantObs).length ? plantObs : {};
            resetDraft();
        }
    }

    if (!draftState.editingEntryId) {
        cycle.entries.unshift({
            id: uid(),
            dt,
            plants,
            actions,
            obs: obs || undefined,
            plantObs: Object.keys(plantObs).length ? plantObs : {},
        });
    }

    persist();
    resetAddForm();
    showTab("log", true);
}

function cancelEdit() {
    resetDraft();
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
            persist();
            return;
        }
    }
}

function deleteEntry(id) {
    if (!confirm("Delete this entry?")) return;
    cycles.forEach((c) => {
        c.entries = c.entries.filter((e) => e.id !== id);
    });
    persist();
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
    persist();
    updateGrowAge();
    renderAddForm();
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
        const raw = e.target.result;
        let imported;
        try {
            imported = JSON.parse(raw);
        } catch {
            alert("Invalid backup file.");
            event.target.value = "";
            return;
        }
        if (!isValidCyclesShape(imported)) {
            alert("Invalid backup file.");
            event.target.value = "";
            return;
        }
        if (!confirm(`Import ${imported.length} cycle(s)? This will replace all current data.`)) {
            event.target.value = "";
            return;
        }
        try {
            localStorage.setItem("grow_cycles", JSON.stringify(imported));
        } catch (err) {
            // localStorage throws QuotaExceededError when the payload
            // exceeds the per-origin cap (typically ~5 MB). The user's
            // existing data is untouched, but they have no feedback —
            // alert so they know to free up space or split the backup.
            const sizeMB = (raw.length / (1024 * 1024)).toFixed(2);
            alert(`Couldn't write backup to storage (${err.name || "error"}).\n\n` + `Backup size: ${sizeMB} MB. Your browser's localStorage is full.\n\n` + `Try clearing site data, removing old cycles, or splitting the backup into smaller pieces.`);
            event.target.value = "";
            return;
        }
        localStorage.removeItem("grow_version");
        location.reload();
    };
    reader.readAsText(file);
}

function triggerImport() {
    document.getElementById("import-backup-input").click();
}

function renderAll() {
    renderLog(cycles, activeCycleId);
    renderStats(cycles, activeCycleId);
    refreshOpenPlantDetail();
    updateLightStatus();
}

function persist() {
    saveCycles(cycles);
    renderAll();
}

function refreshOpenPlantDetail() {
    const modal = document.getElementById("plant-detail-modal");
    if (!modal || modal.style.display === "none") return;
    const name = document.getElementById("plant-detail-name").textContent;
    if (!name) return;
    const cycle = cycles.find((c) => c.plants && c.plants.includes(name));
    if (cycle) renderPlantDetailModal(cycle, name);
}

// ===== Action handlers (event delegation) =====
// Each one used to be window.X = X so inline onclick="X(...)" in templates
// could reach it. With data-action + a single document listener (in
// actions.js), those exports aren't needed. User-controlled strings (cycle
// names, plant names) reach handlers via data-id only — never via an HTML
// attribute that was built by string interpolation.

on("toggleWeek", "click", (el) => toggleWeek(el.dataset.id, Number(el.dataset.week)));
on("toggleCycle", "click", (el) => toggleCycle(el.dataset.id));
on("toggleEntry", "click", (el) => toggleEntry(el.dataset.id));
on("editEntry", "click", (el) => editEntry(el.dataset.id));
on("deleteEntry", "click", (el) => deleteEntry(el.dataset.id));
on("duplicateEntry", "click", (el) => duplicateEntry(el.dataset.id));
on("setStatsCycle", "click", (el) => setStatsCycle(el.dataset.id));

on("editCycleName", "click", (el) => {
    const cycle = cycles.find((c) => c.id === el.dataset.id);
    if (cycle) editCycleName(cycle.id, cycle.name);
});
on("deleteCycle", "click", (el) => deleteCycle(el.dataset.id));

on("togglePlantType", "click", (el) => togglePlantType(Number(el.dataset.index)));
on("renamePlant", "click", (el) => renamePlant(Number(el.dataset.index)));
on("deletePlant", "click", (el) => deletePlant(Number(el.dataset.index)));
on("toggleFavourite", "click", (el) => toggleFavourite(Number(el.dataset.index)));

on("renameNutrient", "click", (el) => renameNutrient(Number(el.dataset.index)));
on("deleteNutrient", "click", (el) => deleteNutrient(Number(el.dataset.index)));
on("editNutrientDefault", "click", (el) => editNutrientDefault(Number(el.dataset.index)));

on("editPlantObs", "click", (el) => editPlantObs(Number(el.dataset.index)));
on("removePlantObs", "click", (el) => removePlantObs(Number(el.dataset.index)));

on("addPlantObs", "click", () => addPlantObs());
on("saveEntry", "click", () => saveEntry());
on("cancelEdit", "click", () => cancelEdit());
on("togglePlantPicker", "change", (el) => togglePlantPicker(el.dataset.pick));
on("toggleLightInputs", "change", () => toggleLightInputs());
on("saveLightDefaults", "input", () => _saveLightDefaults());

on("showTab", "click", (el) => showTab(el.dataset.id));
on("toggleObs", "click", () => toggleObs());

on("newCycle", "click", () => newCycle());
on("openPlantManager", "click", () => openPlantManager());
on("openNutrientManager", "click", () => openNutrientManager());
on("exportBackup", "click", () => exportBackup());
on("importBackup", "change", (_el, e) => importBackup(e));
on("triggerImport", "click", () => triggerImport());

on("confirmNewCycle", "click", () => confirmNewCycle());
on("cancelNewCycle", "click", () => cancelNewCycle());
on("confirmRenameCycle", "click", () => confirmRenameCycle());
on("cancelRenameCycle", "click", () => cancelRenameCycle());
on("confirmAddPlant", "click", () => confirmAddPlant());
on("cancelAddPlant", "click", () => cancelAddPlant());
on("confirmRenamePlant", "click", () => confirmRenamePlant());
on("cancelRenamePlant", "click", () => cancelRenamePlant());
on("closePlantManager", "click", () => closePlantManager());
on("closeNutrientManager", "click", () => closeNutrientManager());
on("openAddPlant", "click", () => openAddPlant());
on("closePlantDetail", "click", () => closePlantDetail());
on("confirmAddNutrient", "click", () => confirmAddNutrient());
on("cancelAddNutrient", "click", () => cancelAddNutrient());
on("confirmRenameNutrient", "click", () => confirmRenameNutrient());
on("cancelRenameNutrient", "click", () => cancelRenameNutrient());
on("confirmEditNutrientDefault", "click", () => confirmEditNutrientDefault());
on("cancelEditNutrientDefault", "click", () => cancelEditNutrientDefault());

on("selectPlantType", "click", (el) => selectPlantType(el.dataset.scope, el.dataset.type));
on("openPlantDetail", "click", (el) => openPlantDetail(el.dataset.id));

on("toggleHeaderMenu", "click", () => toggleHeaderMenu());

updateGrowAge();
setDateDefault();
_loadLightDefaults();
renderAddForm();
setInterval(updateLightStatus, 60 * 1000);
window.addEventListener("focus", updateLightStatus);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateLightStatus();
});
try {
    renderAll();
} catch (err) {
    console.error("Initial render failed:", err);
}
registerServiceWorker();
