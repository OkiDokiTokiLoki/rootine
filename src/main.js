import "./style.css";
import { uid, cycleUid, fmtDate, fmtTime, escapeHtml, getPlantMeta, getNutrientColor, NUTRIENT_PALETTE, fmtQty, cycleStageBadge } from "./utils.js";
import { loadCycles, saveCycles, loadActiveCycleId, saveActiveCycleId, loadCollapsedCycles, saveCollapsedCycles, loadCollapsedWeeks, loadCollapsedObs, isValidCyclesShape } from "./storage.js";
import { initLog, renderLog, toggleWeek, toggleCycle, toggleEntry } from "./log.js";
import { initStats, renderStats, setStatsMode, initObsCollapsed, toggleObs } from "./stats.js";
import { on, closeHeaderMenu } from "./actions.js";
import { icon } from "./icons.js";
import { registerServiceWorker } from "./sw.js";
import { PLANT_TYPE, ACTION_TYPE, STATS_MODE, NUTRIENT_TAB_ALL, STORAGE_KEY, STORAGE_VERSION_KEY, CYCLE_STAGE, CYCLE_STAGE_LABEL } from "./constants.js";
let cycles = loadCycles(),
    activeCycleId = loadActiveCycleId(cycles);

const PICKER_ACTIONS = [ACTION_TYPE.LST, ACTION_TYPE.DEF, ACTION_TYPE.REPOT, ACTION_TYPE.FLUSH].map((t) => {
        const e = document.getElementById(`ck-${t}`),
            n = document.getElementById(`${t}-plants`),
            a = n?.querySelector(".plant-picker-list");
        if (!e || !n || !a) throw new Error(`Missing DOM for picker action "${t}"`);
        return { id: t, checkbox: e, pickerWrap: n, pickerList: a, items: () => a.querySelectorAll(`.${t}-plant`), allCheckbox: () => a.querySelector(`.${t}-plant-all`), checked: () => [...a.querySelectorAll(`.${t}-plant:checked`)].map((t) => t.value) };
    }),
    collapsedCycles = loadCollapsedCycles(),
    collapsedWeeks = loadCollapsedWeeks(),
    collapsedObs = loadCollapsedObs();
let nutrientDrafts = {},
    nutrientActiveTab = NUTRIENT_TAB_ALL;
let yieldDrafts = {};
const draftState = { editingEntryId: null, pendingAddPlantType: PLANT_TYPE.AUTO, pendingRenamePlantType: PLANT_TYPE.AUTO, pendingPlantObs: [], selectedPlantObsTab: null, editingPlantObsIndex: null, orphanedEdits: {} };
function resetDraft() {
    ((draftState.editingEntryId = null), (draftState.pendingAddPlantType = PLANT_TYPE.AUTO), (draftState.pendingRenamePlantType = PLANT_TYPE.AUTO), (draftState.pendingPlantObs = []), (draftState.selectedPlantObsTab = null), (draftState.editingPlantObsIndex = null));
}
function showModal(id) {
    document.getElementById(id)?.classList.add("modal-overlay--visible");
}
function hideModal(id) {
    document.getElementById(id)?.classList.remove("modal-overlay--visible");
}
function toggleHeaderMenu() {
    const t = document.getElementById("header-menu"),
        e = document.getElementById("header-menu-btn"),
        n = t.classList.toggle("open");
    (e.classList.toggle("is-open", n), e.setAttribute("aria-expanded", n ? "true" : "false"));
}
(initLog(collapsedWeeks, collapsedCycles),
    initStats(STATS_MODE.ACTIVE),
    initObsCollapsed(collapsedObs),
    document.addEventListener("click", (t) => {
        const e = document.getElementById("header-menu"),
            n = document.getElementById("header-menu-btn");
        e && e.classList.contains("open") && (e.contains(t.target) || n.contains(t.target) || closeHeaderMenu());
    }),
    (function () {
        const t = ".stats-cycle-toggle--scroll, .plant-picker-list--scroll, .nutrient-plant-tabs";
        let e = null,
            n = !1,
            a = 0,
            l = 0,
            i = !1;
        function s() {
            (e && e.classList.remove("dragging"), (n = !1), (e = null));
        }
        (document.addEventListener("mousedown", (s) => {
            ((e = s.target.closest(t)), e && ((n = !0), (i = !1), (a = s.pageX), (l = e.scrollLeft), e.classList.add("dragging")));
        }),
            window.addEventListener("mousemove", (t) => {
                if (!n || !e) return;
                const s = t.pageX - a;
                (Math.abs(s) > 4 && (i = !0), (e.scrollLeft = l - s));
            }),
            window.addEventListener("mouseup", s),
            window.addEventListener("mouseleave", s),
            document.addEventListener(
                "click",
                (e) => {
                    (e.target.closest(t) && i && (e.preventDefault(), e.stopPropagation()), (i = !1));
                },
                !0
            ));
    })());
const PLANT_NAME_RE = /^[A-Za-z0-9 _-]+$/;
function readNutrientInputs() {
    const t = { nutrients: {}, concentrations: {}, water: null },
        e = document.getElementById("nutrient-rows");
    e &&
        e.querySelectorAll("input[data-nutrient]").forEach((e) => {
            const n = e.dataset.nutrient,
                a = e.dataset.field,
                l = e.value;
            if ("" === l.trim()) return void ("1" === e.dataset.previewHadValue && ("amount" === a ? (t.nutrients[n] = null) : (t.concentrations[n] = null)));
            const i = parseFloat(l);
            isNaN(i) || ("amount" === a ? (t.nutrients[n] = i) : (t.concentrations[n] = i));
        });
    const n = document.getElementById("nutrient-water");
    if (n) {
        const e = n.value;
        if ("" === e.trim()) "1" === n.dataset.previewHadValue && (t.water = null);
        else {
            const n = parseFloat(e);
            isNaN(n) || (t.water = n);
        }
    }
    return t;
}
function writeNutrientInputs(t) {
    const e = t || {},
        n = e.nutrients || {},
        a = e.concentrations || {},
        l = document.getElementById("nutrient-rows");
    l &&
        l.querySelectorAll("input[data-nutrient]").forEach((t) => {
            const e = t.dataset.nutrient,
                l = "amount" === t.dataset.field ? n[e] : a[e],
                i = null != l && "" !== l;
            ((t.value = i ? String(l) : ""), i ? (t.dataset.previewHadValue = "1") : delete t.dataset.previewHadValue);
        });
    const i = document.getElementById("nutrient-water");
    if (i) {
        const t = e.water,
            n = null != t && "" !== t;
        ((i.value = n ? String(t) : ""), n ? (i.dataset.previewHadValue = "1") : delete i.dataset.previewHadValue);
    }
}
function readYieldInputs() {
    const out = {};
    document.querySelectorAll("input[data-yield]").forEach((el) => {
        const plant = el.dataset.yield;
        const raw = el.value.trim();
        if (raw === "") {
            if (el.dataset.previewHadValue === "1") out[plant] = null;
        } else {
            const n = parseFloat(raw);
            if (!isNaN(n)) out[plant] = n;
        }
    });
    return out;
}

function writeYieldInputs(snap) {
    const draft = snap || yieldDrafts[NUTRIENT_TAB_ALL] || {};
    document.querySelectorAll("input[data-yield]").forEach((el) => {
        const plant = el.dataset.yield;
        const v = draft[plant];
        const has = v != null && v !== "" && !isNaN(v);
        el.value = has ? String(v) : "";
        if (has) el.dataset.previewHadValue = "1";
        else delete el.dataset.previewHadValue;
    });
}

function renderYieldFormRows() {
    const t = document.getElementById("yield-rows");
    if (!t) return;
    t.innerHTML = "";
    const plants = cyclePlants();
    if (plants.length === 0) return;
    plants.forEach((name) => {
        const row = document.createElement("div");
        row.className = "form-row";
        row.innerHTML = `
            <label class="form-label">${escapeHtml(name)}</label>
            <input class="form-input yield-input" type="number" min="0" step="0.1" placeholder="grams" data-yield="${escapeHtml(name)}" />
        `;
        t.appendChild(row);
    });
    writeYieldInputs();
}
function snapshotEditForm() {
    return {
        cycleId: activeCycleId,
        dt: document.getElementById("new-dt").value,
        nutrientDrafts: JSON.parse(JSON.stringify(nutrientDrafts)),
        yieldDrafts: JSON.parse(JSON.stringify(yieldDrafts)),
        nutrientActiveTab,
        light: {
            checked: document.getElementById("ck-light").checked,
            lux: document.getElementById("light-lux").value,
            dist: document.getElementById("light-dist").value,
            start: document.getElementById("light-start").value,
            end: document.getElementById("light-end").value,
        },
        pickers: PICKER_ACTIONS.map((p) => ({
            id: p.id,
            checked: p.checkbox.checked,
            plants: p.checked(),
            allChecked: !!(p.allCheckbox() && p.allCheckbox().checked),
        })),
        obs: document.getElementById("new-obs").value,
        pendingPlantObs: draftState.pendingPlantObs.map((o) => ({ ...o })),
        selectedPlantObsTab: draftState.selectedPlantObsTab,
        editingPlantObsIndex: draftState.editingPlantObsIndex,
    };
}
function restoreEditForm(snap) {
    ((document.getElementById("new-dt").value = snap.dt || ""),
        (nutrientDrafts = snap.nutrientDrafts || {}),
        (nutrientActiveTab = snap.nutrientActiveTab || NUTRIENT_TAB_ALL),
        document.querySelectorAll("#nutrient-plant-tabs .nutrient-tab").forEach((t) => {
            t.classList.toggle("active", t.dataset.tab === nutrientActiveTab);
        }),
        writeNutrientInputs(mergeDrafts(nutrientDrafts[NUTRIENT_TAB_ALL] || {}, nutrientDrafts[nutrientActiveTab] || {})));
    const light = snap.light || {};
    ((document.getElementById("ck-light").checked = !!light.checked), (document.getElementById("light-lux").value = light.lux || ""), (document.getElementById("light-dist").value = light.dist || ""), (document.getElementById("light-start").value = light.start || ""), (document.getElementById("light-end").value = light.end || ""), (document.getElementById("light-inputs").style.display = light.checked ? "block" : "none"));
    const pickerMap = new Map((snap.pickers || []).map((p) => [p.id, p]));
    PICKER_ACTIONS.forEach((p) => {
        const found = pickerMap.get(p.id);
        (p.items().forEach((cb) => {
            cb.disabled = false;
            cb.checked = false;
        }),
            p.allCheckbox() && (p.allCheckbox().checked = false),
            (p.checkbox.checked = !!(found && found.checked)),
            (p.pickerWrap.style.display = found && found.checked ? "block" : "none"));
        if (!found || !found.checked) return;
        if (found.allChecked) {
            (p.items().forEach((cb) => {
                cb.checked = true;
                cb.disabled = true;
            }),
                p.allCheckbox() && (p.allCheckbox().checked = true));
        } else {
            found.plants.forEach((plantName) => {
                p.items().forEach((cb) => {
                    cb.value === plantName && (cb.checked = true);
                });
            });
            if (p.allCheckbox() && p.items().length > 0 && [...p.items()].every((cb) => cb.checked) && ACTION_TYPE.LST === p.id) {
                ((p.allCheckbox().checked = true),
                    p.items().forEach((cb) => {
                        cb.disabled = true;
                    }));
            }
        }
    });
    ((document.getElementById("new-obs").value = snap.obs || ""), (draftState.pendingPlantObs = (snap.pendingPlantObs || []).map((o) => ({ ...o }))), (draftState.selectedPlantObsTab = snap.selectedPlantObsTab || null), (draftState.editingPlantObsIndex = snap.editingPlantObsIndex ?? null), renderPlantObsList());

    yieldDrafts = snap.yieldDrafts || {};
    const yieldSection = document.getElementById("yield-section");
    if (yieldSection) {
        yieldSection.style.display = cycleShowsYield(activeCycle()) ? "" : "none";
    }
    if (cycleShowsYield(activeCycle())) {
        renderYieldFormRows();
    }
}
function mergeDrafts(t, e) {
    const n = { nutrients: {}, concentrations: {}, water: null },
        a = (t) => {
            t &&
                (Object.entries(t.nutrients || {}).forEach(([t, e]) => {
                    null != e && (n.nutrients[t] = e);
                }),
                Object.entries(t.concentrations || {}).forEach(([t, e]) => {
                    null != e && (n.concentrations[t] = e);
                }),
                null != t.water && (n.water = t.water));
        };
    (a(t), a(e));
    const l = {};
    return (Object.keys(n.nutrients).length > 0 && (l.nutrients = n.nutrients), Object.keys(n.concentrations).length > 0 && (l.concentrations = n.concentrations), null != n.water && (l.water = n.water), l);
}
function setNutrientTab(t) {
    const e = readNutrientInputs();
    (((e.nutrients && Object.keys(e.nutrients).length > 0) || (e.concentrations && Object.keys(e.concentrations).length > 0) || null != e.water) && (nutrientDrafts[nutrientActiveTab] = mergeDrafts(nutrientDrafts[nutrientActiveTab], e)),
        (nutrientActiveTab = t),
        writeNutrientInputs(mergeDrafts(nutrientDrafts[NUTRIENT_TAB_ALL] || {}, nutrientDrafts[t] || {})),
        document.querySelectorAll("#nutrient-plant-tabs .nutrient-tab").forEach((e) => {
            e.classList.toggle("active", e.dataset.tab === t);
        }));
}
function activeCycle() {
    return cycles.find((t) => t.id === activeCycleId);
}
function cyclePlants() {
    return activeCycle()?.plants || [];
}
function cycleNutrients() {
    const t = activeCycle();
    return t ? (Array.isArray(t.nutrients) || (t.nutrients = []), t.nutrients) : [];
}
function cycleShowsYield(cycle) {
    const stage = cycle?.stage || CYCLE_STAGE.GROW;
    return stage === CYCLE_STAGE.HARVEST || stage === CYCLE_STAGE.COMPLETE;
}
function resetPlantNotesDraft(t) {
    ((draftState.pendingPlantObs = Array.isArray(t) ? [...t] : []), (draftState.selectedPlantObsTab = null), (draftState.editingPlantObsIndex = null));
    const e = document.getElementById("plant-obs-input");
    (e && (e.value = ""), renderPlantObsList());
}
function syncHeaderActions() {
    const t = document.getElementById("header-add-plants-btn");
    t && (t.style.display = 0 === cycles.length ? "none" : "");
}
function renderNutrientFormRows() {
    const t = document.getElementById("nutrient-rows");
    if (!t) return;
    t.innerHTML = "";
    const e = activeCycle(),
        n = cycleNutrients();
    if (0 === n.length) {
        const e = document.createElement("div");
        return ((e.className = "nutrient-empty"), (e.innerHTML = 'No nutrients yet. Add some via the <span data-action="openNutrientManager" style="color:var(--green);cursor:pointer;text-decoration:underline">Nutrient Manager</span>.'), void t.appendChild(e));
    }
    n.forEach((n) => {
        const a = getNutrientColor(e, n.name),
            l = document.createElement("div");
        ((l.className = "form-row"),
            (l.innerHTML = `
            <label class="form-label nutrient-field-label--${a}">${escapeHtml(n.name)}</label>
            <div class="nutrient-input-group">
                <input class="form-input" type="number" min="0" step="0.5" placeholder="cups" data-nutrient="${escapeHtml(n.name)}" data-field="amount" />
                <input class="form-input form-input--conc" type="number" min="0" step="1" placeholder="ml/l" data-nutrient="${escapeHtml(n.name)}" data-field="conc" title="Concentration (ml/l)" />
            </div>
        `),
            t.appendChild(l));
    });
}
function renderAddForm() {
    const t = cyclePlants(),
        e = activeCycle(),
        n = 0 === t.length ? [] : [...t].sort((t, n) => (isFavourite(e, t) ? 0 : 1) - (isFavourite(e, n) ? 0 : 1));
    syncHeaderActions();

    const yieldSection = document.getElementById("yield-section");
    if (yieldSection) {
        yieldSection.style.display = cycleShowsYield(e) ? "" : "none";
        if (cycleShowsYield(e)) {
            const live = new Set(t);
            Object.keys(yieldDrafts).forEach((k) => live.has(k) || delete yieldDrafts[k]);
        }
    }

    const a = document.getElementById("nutrient-plant-tabs");
    if (a)
        if (((a.innerHTML = ""), 0 === cycles.length)) {
            const t = document.createElement("div");
            ((t.className = "nutrient-empty"), (t.innerHTML = 'No grow cycles yet. Tap <span data-action="newCycle" style="color:var(--green);cursor:pointer;text-decoration:underline">+ New Cycle</span> to start one.'), a.appendChild(t));
        } else if (0 === n.length) {
            const t = document.createElement("div");
            ((t.className = "nutrient-empty"), (t.innerHTML = 'No plants yet. Tap <span data-action="openPlantManager" style="color:var(--green);cursor:pointer;text-decoration:underline">+ Plants</span> to add some.'), a.appendChild(t));
        } else {
            const t = document.createElement("button");
            ((t.type = "button"),
                (t.className = "nutrient-tab"),
                (t.dataset.tab = NUTRIENT_TAB_ALL),
                (t.textContent = "All"),
                a.appendChild(t),
                n.forEach((t) => {
                    const n = document.createElement("button");
                    if (((n.type = "button"), (n.className = "nutrient-tab"), (n.dataset.tab = t), isFavourite(e, t))) {
                        const t = document.createElement("span");
                        ((t.innerHTML = icon.star({ size: 10, marginRight: 4, verticalAlign: -1 })), n.appendChild(t.firstChild));
                    }
                    (n.appendChild(document.createTextNode(t)), a.appendChild(n));
                }),
                a.querySelectorAll(".nutrient-tab").forEach((t) => {
                    t.addEventListener("click", () => setNutrientTab(t.dataset.tab));
                }),
                NUTRIENT_TAB_ALL === nutrientActiveTab || n.includes(nutrientActiveTab) || (delete nutrientDrafts[nutrientActiveTab], (nutrientActiveTab = NUTRIENT_TAB_ALL)),
                Object.keys(nutrientDrafts).forEach((t) => {
                    NUTRIENT_TAB_ALL === t || n.includes(t) || delete nutrientDrafts[t];
                }));
            const l = new Set((e?.nutrients || []).map((t) => t.name));
            Object.values(nutrientDrafts).forEach((t) => {
                (t.nutrients &&
                    Object.keys(t.nutrients).forEach((e) => {
                        l.has(e) || delete t.nutrients[e];
                    }),
                    t.concentrations &&
                        Object.keys(t.concentrations).forEach((e) => {
                            l.has(e) || delete t.concentrations[e];
                        }));
            });
        }
    (renderNutrientFormRows(),
        n.length > 0
            ? (writeNutrientInputs(mergeDrafts(nutrientDrafts[NUTRIENT_TAB_ALL] || {}, nutrientDrafts[nutrientActiveTab] || {})),
              a &&
                  a.querySelectorAll(".nutrient-tab").forEach((t) => {
                      t.classList.toggle("active", t.dataset.tab === nutrientActiveTab);
                  }))
            : writeNutrientInputs({}),
        PICKER_ACTIONS.forEach((a) => {
            const { id: l, pickerList: i, items: s } = a;
            if (((i.innerHTML = ""), 0 === t.length)) return void (i.innerHTML = '<div style="font-size: 12px; color: var(--muted)">No plants available.</div>');
            const d = document.createElement("label");
            d.className = "plant-picker-opt plant-picker-opt-all";
            const c = document.createElement("input");
            ((c.type = "checkbox"),
                (c.className = `${l}-plant-all`),
                (c.onchange = () => {
                    s().forEach((t) => {
                        ((t.checked = c.checked), (t.disabled = c.checked));
                    });
                }),
                d.appendChild(c),
                d.appendChild(document.createTextNode("All plants")),
                i.appendChild(d),
                n.forEach((t) => {
                    const n = document.createElement("label");
                    n.className = "plant-picker-opt";
                    const a = document.createElement("input");
                    if (((a.type = "checkbox"), (a.className = `${l}-plant`), (a.value = t), n.appendChild(a), n.appendChild(document.createTextNode(t)), isFavourite(e, t))) {
                        const t = document.createElement("span");
                        ((t.innerHTML = icon.star({ size: 11, marginRight: 0, verticalAlign: -1 })), n.appendChild(t.firstChild));
                    }
                    i.appendChild(n);
                }));
        }),
        populatePlantObsTabs(),
        renderPlantObsList());

    if (cycleShowsYield(e)) {
        renderYieldFormRows();
    }
}
function populatePlantObsTabs() {
    const t = document.getElementById("plant-obs-tabs");
    if (!t) return;
    const e = activeCycle(),
        n = cyclePlants();
    if (0 === n.length) {
        t.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 2px">No plants yet — add some via the Plants modal.</div>';
        const e = document.getElementById("plant-obs-input"),
            n = document.querySelector(".plant-obs-add-btn");
        return (e && (e.disabled = !0), void (n && (n.disabled = !0)));
    }
    const a = document.getElementById("plant-obs-input"),
        l = document.querySelector(".plant-obs-add-btn");
    (a && (a.disabled = !1), l && (l.disabled = !1));
    const i = [...n].sort((t, n) => (isFavourite(e, t) ? 0 : 1) - (isFavourite(e, n) ? 0 : 1)),
        s = new Set(draftState.pendingPlantObs.map((t) => t.plant));
    ((t.innerHTML = i
        .map((t) => {
            const n = s.has(t),
                a = "plant-obs-tab" + (n ? " used" : ""),
                l = isFavourite(e, t) ? icon.star({ size: 11, marginRight: 4, verticalAlign: -1 }) : "";
            return `<button type="button" class="${a}" data-plant="${escapeHtml(t)}"${n ? " disabled" : ""}>${l}${escapeHtml(t)}</button>`;
        })
        .join("")),
        (draftState.selectedPlantObsTab = null),
        t.querySelectorAll(".plant-obs-tab").forEach((e) => {
            e.addEventListener("click", () => {
                if (e.disabled) return;
                ((draftState.selectedPlantObsTab = e.dataset.plant), (draftState.editingPlantObsIndex = null), document.querySelectorAll(".plant-obs-item").forEach((t) => t.classList.remove("editing")), t.querySelectorAll(".plant-obs-tab").forEach((t) => t.classList.toggle("active", t.dataset.plant === draftState.selectedPlantObsTab)));
                const n = document.getElementById("plant-obs-input");
                n && n.focus();
            });
        }));
}
function renderPlantObsList() {
    const t = document.getElementById("plant-obs-list");
    t &&
        (0 === draftState.pendingPlantObs.length
            ? (t.innerHTML = "")
            : (t.innerHTML = draftState.pendingPlantObs
                  .map(
                      (t, e) => `
        <div class="plant-obs-item${draftState.editingPlantObsIndex === e ? " editing" : ""}">
            <div class="plant-obs-item-header">
                <span class="plant-obs-item-name">${escapeHtml(t.plant)}</span>
                <div>
                    <button class="plant-obs-item-edit" type="button" data-action="editPlantObs" data-index="${e}" title="Edit note" aria-label="Edit note for ${escapeHtml(t.plant)}">
                        ${icon.edit()}
                    </button>
                    <button class="plant-obs-item-remove" type="button" data-action="removePlantObs" data-index="${e}" title="Remove note" aria-label="Remove note for ${escapeHtml(t.plant)}">
                        ${icon.trash()}
                    </button>
                </div>
            </div>
            <div class="plant-obs-item-text">${escapeHtml(t.text)}</div>
        </div>`
                  )
                  .join("")),
        populatePlantObsTabs());
}
function addPlantObs() {
    const t = document.getElementById("plant-obs-input");
    if (!t) return;
    const e = draftState.selectedPlantObsTab,
        n = t.value.trim();
    if (!e) {
        const t = document.getElementById("plant-obs-tabs");
        return (t && t.focus(), void (t && (t.classList.add("plant-obs-tabs-shake"), setTimeout(() => t.classList.remove("plant-obs-tabs-shake"), 350))));
    }
    if (n) {
        if (null !== draftState.editingPlantObsIndex) ((draftState.pendingPlantObs[draftState.editingPlantObsIndex].text = n), (draftState.editingPlantObsIndex = null));
        else {
            const t = draftState.pendingPlantObs.findIndex((t) => t.plant === e);
            if (t >= 0) {
                if (!confirm(`"${e}" already has a note for this entry. Replace it?`)) return;
                draftState.pendingPlantObs[t].text = n;
            } else draftState.pendingPlantObs.push({ plant: e, text: n });
        }
        ((t.value = ""), (draftState.selectedPlantObsTab = null), renderPlantObsList(), t.focus());
    } else t.focus();
}
function removePlantObs(t) {
    const e = draftState.pendingPlantObs[t];
    if (!e) return;
    if (!confirm(`Remove note for "${e.plant}"?`)) return;
    (draftState.pendingPlantObs.splice(t, 1), null !== draftState.editingPlantObsIndex && (draftState.editingPlantObsIndex === t ? (draftState.editingPlantObsIndex = null) : draftState.editingPlantObsIndex > t && (draftState.editingPlantObsIndex -= 1)), renderPlantObsList());
    const n = document.getElementById("plant-obs-input");
    n && n.focus();
}
function editPlantObs(t) {
    const e = draftState.pendingPlantObs[t];
    if (!e) return;
    ((draftState.editingPlantObsIndex = t), (draftState.selectedPlantObsTab = e.plant));
    const n = document.getElementById("plant-obs-input");
    n && ((n.value = e.text), n.focus(), n.setSelectionRange(n.value.length, n.value.length));
    const a = document.getElementById("plant-obs-tabs");
    (a && a.querySelectorAll(".plant-obs-tab").forEach((t) => t.classList.toggle("active", t.dataset.plant === e.plant)), document.querySelectorAll(".plant-obs-item").forEach((e, n) => e.classList.toggle("editing", n === t)));
}
function showTab(t, e = !1) {
    if (
        ("add" !== ["log", "add", "stats"].find((t) => document.getElementById("section-" + t).classList.contains("active")) || "add" === t || draftState.editingEntryId || resetAddForm(),
        ["log", "add", "stats"].forEach((e) => {
            (document.getElementById("section-" + e).classList.toggle("active", e === t), document.getElementById("tab-" + e).classList.toggle("active", e === t));
        }),
        "add" !== t || draftState.editingEntryId || (resetAddForm(), setDateDefault()),
        e)
    ) {
        const t = document.getElementById("content");
        (t && (t.scrollTop = 0), window.scrollTo(0, 0));
    }
}
function resetAddForm() {
    ((yieldDrafts = {}), (nutrientDrafts = {}), (nutrientActiveTab = NUTRIENT_TAB_ALL));
    const t = document.getElementById("nutrient-rows");
    t &&
        t.querySelectorAll("input[data-nutrient]").forEach((t) => {
            ((t.value = ""), delete t.dataset.previewHadValue);
        });
    const yieldRows = document.getElementById("yield-rows");
    yieldRows &&
        yieldRows.querySelectorAll("input[data-yield]").forEach((t) => {
            ((t.value = ""), delete t.dataset.previewHadValue);
        });
    const e = document.getElementById("nutrient-water");
    (e && ((e.value = ""), delete e.dataset.previewHadValue),
        document.querySelector("#nutrient-plant-tabs .nutrient-tab") &&
            document.querySelectorAll("#nutrient-plant-tabs .nutrient-tab").forEach((t) => {
                t.classList.toggle("active", NUTRIENT_TAB_ALL === t.dataset.tab);
            }),
        PICKER_ACTIONS.forEach((t) => {
            ((t.checkbox.checked = !1),
                (t.pickerWrap.style.display = "none"),
                t.items().forEach((t) => {
                    ((t.checked = !1), (t.disabled = !1));
                }));
            const e = t.allCheckbox();
            e && (e.checked = !1);
        }),
        (document.getElementById("ck-light").checked = !1),
        (document.getElementById("light-inputs").style.display = "none"),
        _loadLightDefaults(),
        (document.getElementById("new-obs").value = ""),
        resetPlantNotesDraft(),
        setDateDefault());
}
function updateGrowAge() {
    const t = activeCycle();
    if (!t) return void (document.getElementById("grow-age").textContent = "");
    const e = new Date(t.startDate),
        n = Math.floor((new Date() - e) / 864e5),
        a = Math.max(1, Math.ceil(n / 7));
    document.getElementById("grow-age").textContent = `${t.name} · Day ${n} · Week ${a}`;
}
function setDateDefault() {
    const t = new Date(),
        e = (t) => String(t).padStart(2, "0");
    document.getElementById("new-dt").value = `${t.getFullYear()}-${e(t.getMonth() + 1)}-${e(t.getDate())}T${e(t.getHours())}:${e(t.getMinutes())}`;
}
function togglePlantPicker(t) {
    const e = PICKER_ACTIONS.find((e) => e.id === t);
    e && (e.pickerWrap.style.display = e.checkbox.checked ? "block" : "none");
}
function toggleLightInputs() {
    document.getElementById("light-inputs").style.display = document.getElementById("ck-light").checked ? "block" : "none";
}
function getCycleLightDefaults() {
    const t = activeCycle();
    return (t && t.lightDefaults) || {};
}
function parseLightAction(t) {
    return t && ACTION_TYPE.LIGHT === t.type ? { lux: t.lux || null, dist: t.dist || null, start: t.start || null, end: t.end || null } : null;
}
function latestLoggedLight(t) {
    if (!t) return null;
    const e = [...(t.entries || [])].sort((t, e) => new Date(e.dt) - new Date(t.dt));
    for (const t of e) {
        const e = (t.actions || []).find((t) => t && ACTION_TYPE.LIGHT === t.type);
        if (e) return { parsed: parseLightAction(e), dt: t.dt };
    }
    return null;
}
function updateLightStatus() {
    const t = activeCycle(),
        e = document.getElementById("light-status-text"),
        n = document.getElementById("light-status-bulb");
    if (!e) return;
    const a = latestLoggedLight(t),
        l = getCycleLightDefaults();
    let i = null,
        s = null,
        d = null,
        c = null;
    a ? ((i = a.parsed.lux ?? l.lux ?? null), (s = a.parsed.dist ?? l.dist ?? null), (d = a.parsed.start ?? l.start ?? null), (c = a.parsed.end ?? l.end ?? null)) : ((i = l.lux || null), (s = l.dist || null), (d = l.start || null), (c = l.end || null));
    let o = !1;
    const r = [];
    if ((i && r.push(i + "K"), d && c)) {
        const [t, e] = d.split(":").map(Number),
            [n, a] = c.split(":").map(Number);
        let l = 60 * n + a - (60 * t + e);
        l < 0 && (l += 1440);
        const i = Math.round(l / 60),
            s = 24 - i,
            u = new Date(),
            p = 60 * u.getHours() + u.getMinutes(),
            m = 60 * t + e,
            y = 60 * n + a;
        o = m < y ? p >= m && p < y : p >= m || p < y;
        const f = (t) => {
            const [e, n] = t.split(":"),
                a = parseInt(e);
            return (a % 12 || 12) + ("00" !== n ? ":" + n : "") + (a >= 12 ? "PM" : "AM");
        };
        r.push(f(d) + "–" + f(c) + " (" + i + "/" + s + ")");
    }
    const u = r.length ? r.join("·") : "no active schedule";
    if ((e.textContent !== u && (e.textContent = u), n)) {
        const t = o ? "var(--amber)" : "var(--muted)";
        n.style.fill !== t && (n.style.fill = t);
    }
}
let lightStatusTimer = null;
function clearLightStatusTimer() {
    null !== lightStatusTimer && (clearTimeout(lightStatusTimer), (lightStatusTimer = null));
}
function scheduleNextLightCheck() {
    if ((clearLightStatusTimer(), document.hidden)) return;
    const t = new Date(),
        e = 1e3 * (60 - t.getSeconds()) - t.getMilliseconds();
    lightStatusTimer = setTimeout(() => {
        ((lightStatusTimer = null), updateLightStatus(), scheduleNextLightCheck());
    }, e);
}
function _saveLightDefaults() {
    const t = activeCycle();
    t && ((t.lightDefaults = { lux: document.getElementById("light-lux").value, dist: document.getElementById("light-dist").value, start: document.getElementById("light-start").value, end: document.getElementById("light-end").value }), persist(), invalidateModal(), updateLightStatus());
}
function _loadLightDefaults() {
    const t = getCycleLightDefaults();
    ((document.getElementById("light-lux").value = t.lux || ""), (document.getElementById("light-dist").value = t.dist || ""), (document.getElementById("light-start").value = t.start || ""), (document.getElementById("light-end").value = t.end || ""));
}
function openPlantManager() {
    (renderPlantList(), showModal("plant-manage-modal"));
}
function closePlantManager() {
    hideModal("plant-manage-modal");
}
function renderPlantList() {
    const t = activeCycle(),
        e = document.getElementById("plant-list");
    if (!t) return void (e.innerHTML = '<div class="plant-empty">No active cycle.</div>');
    const n = t.plants || [];
    0 !== n.length
        ? ((e.innerHTML = ""),
          n.forEach((n, a) => {
              const l = getPlantMeta(t, n).type,
                  i = PLANT_TYPE.AUTO === l ? "plant-type-badge auto" : "plant-type-badge photo",
                  s = PLANT_TYPE.AUTO === l ? "AUTO" : "PHOTO",
                  d = document.createElement("div");
              ((d.className = "plant-manage-row"),
                  (d.innerHTML = `
            <div class="plant-manage-name">${escapeHtml(n)}</div>
            <div class="plant-manage-actions">
                <span class="${i}" data-action="togglePlantType" data-index="${a}" title="Click to toggle type">${s}</span>
                <button class="settings-btn blue-btn" data-action="renamePlant" data-index="${a}" aria-label="Rename ${escapeHtml(n)}" title="Rename">${icon.editStroke()}</button>
                <button class="settings-btn red-btn" data-action="deletePlant" data-index="${a}" aria-label="Delete ${escapeHtml(n)}" title="Delete">${icon.trashStroke()}</button>
                <button class="settings-btn favourite-btn ${isFavourite(t, n) ? "is-favourite" : ""}" data-action="toggleFavourite" data-index="${a}" aria-label="${isFavourite(t, n) ? "Unfavourite" : "Favourite"} ${escapeHtml(n)}" title="${isFavourite(t, n) ? "Unfavourite" : "Favourite"}">${icon.star({ size: 18, filled: isFavourite(t, n) })}</button>
            </div>
        `),
                  e.appendChild(d));
          }))
        : (e.innerHTML = '<div class="plant-empty">No plants yet. Add some to start logging.</div>');
}
function openAddPlant() {
    ((document.getElementById("new-plant-name").value = ""), (draftState.pendingAddPlantType = PLANT_TYPE.AUTO), selectPlantType("add", PLANT_TYPE.AUTO), showModal("add-plant-modal"), setTimeout(() => document.getElementById("new-plant-name").focus(), 50));
}
function selectPlantType(t, e) {
    "add" === t ? (draftState.pendingAddPlantType = e) : (draftState.pendingRenamePlantType = e);
    const n = "add" === t ? "#add-plant-type-toggle" : "#rename-plant-type-toggle";
    document.querySelectorAll(n + " .type-toggle-opt").forEach((t) => {
        t.classList.toggle("active", t.dataset.type === e);
    });
}
function togglePlantType(t) {
    const e = activeCycle();
    if (!e) return;
    (e.plantTypes && "object" == typeof e.plantTypes) || (e.plantTypes = {});
    const n = e.plants[t],
        a = getPlantMeta(e, n).type;
    ((e.plantTypes[n] && "object" == typeof e.plantTypes[n]) || (e.plantTypes[n] = { type: a, repottedAt: e.startDate, flushedAt: null }), (e.plantTypes[n].type = PLANT_TYPE.AUTO === a ? PLANT_TYPE.PHOTO : PLANT_TYPE.AUTO), persist(), renderPlantList(), invalidateStats(), invalidateModal());
}
function toggleFavourite(t) {
    const e = activeCycle();
    if (!e) return;
    const n = e.plants[t];
    Array.isArray(e.favourites) || (e.favourites = []);
    const a = e.favourites.indexOf(n);
    (a >= 0 ? e.favourites.splice(a, 1) : e.favourites.push(n), persist(), renderPlantList(), renderAddForm(), invalidateStats());
}
function confirmAddPlant() {
    const t = document.getElementById("new-plant-name").value.trim();
    if (!t) return void alert("Enter a plant name.");
    if (!PLANT_NAME_RE.test(t)) return void alert("Plant name can only contain letters, numbers, spaces, dashes, and underscores.");
    const e = activeCycle();
    e ? (Array.isArray(e.plants) || (e.plants = []), e.plants.includes(t) ? alert("A plant with that name already exists.") : (e.plants.push(t), (e.plantTypes && "object" == typeof e.plantTypes) || (e.plantTypes = {}), (e.plantTypes[t] = draftState.pendingAddPlantType), persist(), hideModal("add-plant-modal"), renderPlantList(), renderAddForm(), invalidateStats())) : alert("No active cycle.");
}
function cancelAddPlant() {
    hideModal("add-plant-modal");
}
function renamePlant(t) {
    const e = activeCycle();
    if (!e) return;
    const n = e.plants[t],
        a = (e.plantTypes || {})[n],
        l = ("object" == typeof a ? a?.type : a) || PLANT_TYPE.AUTO;
    ((document.getElementById("rename-plant-input").value = n), (draftState.pendingRenamePlantType = l), selectPlantType("rename", l));
    const i = document.getElementById("rename-plant-modal");
    (showModal("rename-plant-modal"),
        (i._plantIndex = t),
        (i._oldName = n),
        setTimeout(() => {
            const t = document.getElementById("rename-plant-input");
            (t.focus(), t.select());
        }, 50));
}
function confirmRenamePlant() {
    const t = document.getElementById("rename-plant-modal"),
        e = activeCycle();
    if (!e) return;
    const n = document.getElementById("rename-plant-input").value.trim(),
        a = t._plantIndex,
        l = t._oldName,
        i = draftState.pendingRenamePlantType;
    if (!n) return void alert("Plant name can't be empty.");
    const s = n === l ? l : n;
    if (s !== l) {
        if (!PLANT_NAME_RE.test(s)) return void alert("Plant name can only contain letters, numbers, spaces, dashes, and underscores.");
        if (e.plants.includes(s)) return void alert("A plant with that name already exists.");
        ((e.plants[a] = s),
            delete e.plantTypes[l],
            nutrientDrafts[l] && !nutrientDrafts[s] && (nutrientDrafts[s] = nutrientDrafts[l]),
            delete nutrientDrafts[l],
            yieldDrafts[l] != null && !yieldDrafts[s] && (yieldDrafts[s] = yieldDrafts[l]),
            delete yieldDrafts[l],
            nutrientActiveTab === l && (nutrientActiveTab = s),
            Array.isArray(e.favourites) || (e.favourites = []),
            e.favourites.indexOf(l) >= 0 && (e.favourites[e.favourites.indexOf(l)] = s),
            cycles.forEach((t) => {
                t.id === e.id &&
                    t.entries.forEach((t) => {
                        (t.plants && t.plants[l] && ((t.plants[s] = t.plants[l]), delete t.plants[l]), Array.isArray(t.actions) && (t.actions = t.actions.map((t) => (t && (ACTION_TYPE.LST === t.type || ACTION_TYPE.DEF === t.type || ACTION_TYPE.REPOT === t.type || ACTION_TYPE.FLUSH === t.type) && Array.isArray(t.plants) ? { ...t, plants: t.plants.map((t) => (t === l ? s : t)) } : t))), t.plantObs && "object" == typeof t.plantObs && t.plantObs[l] && ((t.plantObs[s] = t.plantObs[l]), delete t.plantObs[l]));
                    });
            }));
    }
    ((e.plantTypes[s] = { type: i, repottedAt: e.plantTypes[s]?.repottedAt || e.startDate, flushedAt: e.plantTypes[s]?.flushedAt || null }), persist(), hideModal("rename-plant-modal"), renderPlantList(), renderAddForm(), invalidateLog(), invalidateStats(), invalidateModal());
}
function cancelRenamePlant() {
    hideModal("rename-plant-modal");
}
function deletePlant(t) {
    const e = activeCycle();
    if (!e) return;
    const n = e.plants[t];
    confirm(`Remove plant "${n}"? It will disappear from the Add form. Existing entries that reference it keep their data.`) && (e.plants.splice(t, 1), e.plantTypes && delete e.plantTypes[n], persist(), renderPlantList(), renderAddForm(), invalidateStats());
}
function isFavourite(t, e) {
    return Array.isArray(t.favourites) && t.favourites.includes(e);
}
function openNutrientManager() {
    (renderNutrientList(), showModal("nutrient-manage-modal"));
}
function closeNutrientManager() {
    hideModal("nutrient-manage-modal");
}
function openCycleManager() {
    renderCycleList();
    showModal("cycle-manage-modal");
}
function closeCycleManager() {
    hideModal("cycle-manage-modal");
}
function newCycleFromManager() {
    newCycle();
}
function renderCycleList() {
    const list = document.getElementById("cycle-list");
    if (!list) return;
    if (cycles.length === 0) {
        list.innerHTML = '<div class="plant-empty">No cycles yet. Start one to begin logging.</div>';
        return;
    }
    const sorted = [...cycles].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    list.innerHTML = "";
    sorted.forEach((cycle) => {
        const stage = cycle.stage || CYCLE_STAGE.GROW;
        const startDate = new Date(cycle.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const plantCount = (cycle.plants || []).length;
        const stageBadge = cycleStageBadge(stage);
        const nextStage = stage === CYCLE_STAGE.HARVEST ? CYCLE_STAGE.COMPLETE : stage === CYCLE_STAGE.COMPLETE ? CYCLE_STAGE.GROW : CYCLE_STAGE.HARVEST;
        let nextBtnClass;
        if (stage === CYCLE_STAGE.HARVEST) nextBtnClass = "complete-tag";
        else if (stage === CYCLE_STAGE.COMPLETE) nextBtnClass = "green-btn";
        else nextBtnClass = "amber-btn";
        const nextBtnTitle = `Advance to ${CYCLE_STAGE_LABEL[nextStage]}`;
        const row = document.createElement("div");
        row.className = "cycle-manage-row";
        row.innerHTML = `
            <div class="cycle-manage-info">
                <div class="cycle-manage-name">
                    <span>${escapeHtml(cycle.name)}</span>
                    ${stageBadge}
                </div>
                <div class="cycle-manage-meta">
                    Started ${startDate} · ${plantCount} plant${plantCount === 1 ? "" : "s"}
                </div>
            </div>
            <div class="plant-manage-actions">
                <button class="settings-btn ${nextBtnClass}" data-action="advanceCycleStage" data-id="${escapeHtml(cycle.id)}" title="${nextBtnTitle}">${icon.arrowUp()}</button>
                <button class="settings-btn blue-btn" data-action="editCycleName" data-id="${escapeHtml(cycle.id)}" title="Rename">${icon.edit()}</button>
                <button class="settings-btn red-btn" data-action="deleteCycle" data-id="${escapeHtml(cycle.id)}" title="Delete">${icon.trash()}</button>
            </div>`;
        list.appendChild(row);
    });
}
function advanceCycleStage(id) {
    const cycle = cycles.find((c) => c.id === id);
    if (!cycle) return;
    const current = cycle.stage || CYCLE_STAGE.GROW;
    if (current === CYCLE_STAGE.GROW) cycle.stage = CYCLE_STAGE.HARVEST;
    else if (current === CYCLE_STAGE.HARVEST) cycle.stage = CYCLE_STAGE.COMPLETE;
    else cycle.stage = CYCLE_STAGE.GROW;
    persist();
    invalidateLog();
    invalidateStats();
    refreshOpenCycleManager();
    renderAddForm();
}
function refreshOpenCycleManager() {
    const modal = document.getElementById("cycle-manage-modal");
    if (modal && modal.classList.contains("modal-overlay--visible")) renderCycleList();
}
function renderNutrientList() {
    const t = activeCycle(),
        e = document.getElementById("nutrient-list");
    if (!e) return;
    if (!t) return void (e.innerHTML = '<div class="plant-empty">No active cycle. Start a new cycle from the header menu first.</div>');
    const n = cycleNutrients();
    0 !== n.length
        ? ((e.innerHTML = ""),
          n.forEach((n, a) => {
              const l = getNutrientColor(t, n.name),
                  i = document.createElement("div");
              ((i.className = "plant-manage-row"),
                  (i.innerHTML = `
            <div class="plant-manage-name">
                <span class="nutrient-swatch nutrient-swatch--${l}"></span>
                <span>${escapeHtml(n.name)}</span>
                ${null != n.defaultConcentration ? `<span class="nutrient-default-hint" title="Starting dilution">${n.defaultConcentration} ml/l</span>` : ""}
            </div>
            <div class="plant-manage-actions">
                <button class="settings-btn blue-btn" data-action="renameNutrient" data-index="${a}" title="Rename ${escapeHtml(n.name)}" aria-label="Rename ${escapeHtml(n.name)}">
                    ${icon.edit()}
                </button>
                <button class="settings-btn red-btn" data-action="deleteNutrient" data-index="${a}" title="Delete ${escapeHtml(n.name)}" aria-label="Delete ${escapeHtml(n.name)}">
                    ${icon.trash()}
                </button>
                <button class="settings-btn amber-btn" data-action="editNutrientDefault" data-index="${a}" title="Set starting dilution for ${escapeHtml(n.name)}" aria-label="Set default concentration for ${escapeHtml(n.name)}">
                    ${icon.waterDropLine()}
                </button>
            </div>
        `),
                  e.appendChild(i));
          }))
        : (e.innerHTML = '<div class="plant-empty">No nutrients yet. Add some to start logging feeds.</div>');
}
function openAddNutrient() {
    ((document.getElementById("new-nutrient-name").value = ""), (document.getElementById("new-nutrient-conc").value = ""), showModal("add-nutrient-modal"), setTimeout(() => document.getElementById("new-nutrient-name").focus(), 50));
}
function confirmAddNutrient() {
    const t = document.getElementById("new-nutrient-name").value.trim(),
        e = document.getElementById("new-nutrient-conc").value.trim();
    if (!t) return void alert("Enter a nutrient name.");
    let n = null;
    if ("" !== e) {
        const t = parseFloat(e);
        if (isNaN(t) || t < 0) return void alert("Concentration must be a non-negative number.");
        n = t;
    }
    if (!PLANT_NAME_RE.test(t)) return void alert("Nutrient name can only contain letters, numbers, spaces, dashes, and underscores.");
    if (!activeCycle()) return void alert("No active cycle.");
    const a = cycleNutrients();
    a.some((e) => e.name === t) ? alert("A nutrient with that name already exists.") : (a.push({ name: t, defaultConcentration: n }), persist(), hideModal("add-nutrient-modal"), renderNutrientList(), renderAddForm());
}
function cancelAddNutrient() {
    hideModal("add-nutrient-modal");
}
function renameNutrient(t) {
    if (!activeCycle()) return;
    const e = cycleNutrients()[t].name;
    document.getElementById("rename-nutrient-input").value = e;
    const n = document.getElementById("rename-nutrient-modal");
    (showModal("rename-nutrient-modal"),
        (n._nutrientIndex = t),
        (n._oldName = e),
        setTimeout(() => {
            const t = document.getElementById("rename-nutrient-input");
            (t.focus(), t.select());
        }, 50));
}
function confirmRenameNutrient() {
    const t = document.getElementById("rename-nutrient-modal"),
        e = document.getElementById("rename-nutrient-input").value.trim(),
        n = t._nutrientIndex,
        a = t._oldName,
        l = activeCycle();
    if (!l) return;
    const i = cycleNutrients();
    e
        ? e !== a
            ? PLANT_NAME_RE.test(e)
                ? i.some((t) => t.name === e)
                    ? alert("A nutrient with that name already exists.")
                    : ((i[n].name = e),
                      l.entries.forEach((t) => {
                          Object.values(t.plants || {}).forEach((t) => {
                              (t.nutrients && null != t.nutrients[a] && ((t.nutrients[e] = t.nutrients[a]), delete t.nutrients[a]), t.concentrations && null != t.concentrations[a] && ((t.concentrations[e] = t.concentrations[a]), delete t.concentrations[a]));
                          });
                      }),
                      nutrientDrafts[a] && ((nutrientDrafts[e] = nutrientDrafts[a]), delete nutrientDrafts[a]),
                      persist(),
                      hideModal("rename-nutrient-modal"),
                      renderNutrientList(),
                      renderAddForm(),
                      invalidateLog(),
                      invalidateStats(),
                      invalidateModal())
                : alert("Nutrient name can only contain letters, numbers, spaces, dashes, and underscores.")
            : hideModal("rename-nutrient-modal")
        : alert("Nutrient name can't be empty.");
}
function cancelRenameNutrient() {
    hideModal("rename-nutrient-modal");
}
function deleteNutrient(t) {
    if (!activeCycle()) return;
    const e = cycleNutrients(),
        n = e[t].name;
    confirm(`Remove nutrient "${n}"? Existing entries that reference it keep their data, but it will no longer appear in the Add form or stats.`) &&
        (e.splice(t, 1),
        Object.values(nutrientDrafts).forEach((t) => {
            (t.nutrients && delete t.nutrients[n], t.concentrations && delete t.concentrations[n]);
        }),
        persist(),
        renderNutrientList(),
        renderAddForm(),
        invalidateLog(),
        invalidateStats());
}
function editNutrientDefault(t) {
    if (!activeCycle()) return;
    const e = cycleNutrients()[t];
    if (!e) return;
    document.getElementById("edit-nutrient-default-name").textContent = e.name;
    const n = document.getElementById("edit-nutrient-default-input");
    n.value = null != e.defaultConcentration ? String(e.defaultConcentration) : "";
    const a = document.getElementById("edit-nutrient-default-modal");
    (showModal("edit-nutrient-default-modal"),
        (a._nutrientIndex = t),
        setTimeout(() => {
            (n.focus(), n.select());
        }, 50));
}
function confirmEditNutrientDefault() {
    const t = document.getElementById("edit-nutrient-default-modal");
    if (!activeCycle()) return;
    const e = cycleNutrients()[t._nutrientIndex];
    if (!e) return void hideModal("edit-nutrient-default-modal");
    const n = document.getElementById("edit-nutrient-default-input").value.trim();
    if ("" === n) e.defaultConcentration = null;
    else {
        const t = parseFloat(n);
        if (isNaN(t) || t < 0) return void alert("Concentration must be a non-negative number.");
        e.defaultConcentration = t;
    }
    (persist(), hideModal("edit-nutrient-default-modal"), renderNutrientList(), renderAddForm(), invalidateModal());
}
function cancelEditNutrientDefault() {
    hideModal("edit-nutrient-default-modal");
}
function openPlantDetail(t) {
    const e = activeCycle();
    if (!e || !e.plants.includes(t)) {
        const e = cycles.find((e) => e.plants && e.plants.includes(t));
        if (!e) return;
        return renderPlantDetailModal(e, t);
    }
    renderPlantDetailModal(e, t);
}
function computePlantDetail(t, e) {
    const n = getPlantMeta(t, e),
        a = t.nutrients || [],
        l = Date.now() - 6048e5,
        i = { nutrients: Object.fromEntries(a.map((t) => [t.name, { totalCups: 0, activeMlPerL: null, activeSinceDt: null, _runningMlPerL: t.defaultConcentration ?? null }])), totalWaterCups: 0, totalYieldGrams: 0, lastFeedDt: null, lastWaterDt: null, lastLstDt: null, lastDefDt: null, lastFlushDt: null, firstFlushDt: null, feedCount: 0, waterCount: 0, lstCount: 0, defCount: 0, flushCount: 0, feedCountLast7d: 0, waterCountLast7d: 0, lstCountLast7d: 0, defCountLast7d: 0, flushCountLast7d: 0, logCountLast7d: 0, notes: [], lstActions: [], defActions: [], flushActions: [] };
    for (const n of t.entries || []) {
        const t = new Date(n.dt),
            a = t.getTime() >= l;
        a && i.logCountLast7d++;
        const s = n.plants?.[e],
            d = n.plantObs?.[e];
        if ((d && d.trim() && i.notes.push({ dt: n.dt, text: d }), s)) {
            for (const [t, e] of Object.entries(s.nutrients || {})) {
                const n = i.nutrients[t];
                n && (n.totalCups += e || 0);
            }
            for (const [e, a] of Object.entries(s.concentrations || {})) {
                const l = i.nutrients[e];
                l && (null == l.activeSinceDt || t > new Date(l.activeSinceDt)) && ((l.activeMlPerL = a), (l.activeSinceDt = n.dt), (l._runningMlPerL = a));
            }
            const e = s.water || 0;
            (e && ((i.totalWaterCups += e), i.waterCount++, a && i.waterCountLast7d++, (!i.lastWaterDt || t > new Date(i.lastWaterDt)) && (i.lastWaterDt = n.dt)), Object.values(s.nutrients || {}).some((t) => t && t > 0) && (i.feedCount++, a && i.feedCountLast7d++, (!i.lastFeedDt || t > new Date(i.lastFeedDt)) && (i.lastFeedDt = n.dt)));
        }
        for (const t of n.actions || []) t && (ACTION_TYPE.LST === t.type ? (t.plants && 0 !== t.plants.length && !t.plants.includes(e)) || (i.lstCount++, a && i.lstCountLast7d++, i.lstActions.push(n.dt)) : ACTION_TYPE.DEF === t.type ? (t.plants && 0 !== t.plants.length && !t.plants.includes(e)) || (i.defCount++, a && i.defCountLast7d++, i.defActions.push(n.dt)) : ACTION_TYPE.FLUSH === t.type && ((t.plants && 0 !== t.plants.length && !t.plants.includes(e)) || (i.flushCount++, a && i.flushCountLast7d++, i.flushActions.push(n.dt))));
    }
    for (const t of i.lstActions) (!i.lastLstDt || new Date(t) > new Date(i.lastLstDt)) && (i.lastLstDt = t);
    for (const t of i.defActions) (!i.lastDefDt || new Date(t) > new Date(i.lastDefDt)) && (i.lastDefDt = t);
    for (const t of i.flushActions) {
        if (!i.lastFlushDt || new Date(t) > new Date(i.lastFlushDt)) i.lastFlushDt = t;
        if (!i.firstFlushDt || new Date(t) < new Date(i.firstFlushDt)) i.firstFlushDt = t;
    }
    (delete i.lstActions, delete i.defActions, delete i.flushActions, i.notes.sort((t, e) => new Date(e.dt) - new Date(t.dt)));
    const s = [...(t.entries || [])].sort((t, e) => new Date(t.dt) - new Date(e.dt));
    for (const [t, n] of Object.entries(i.nutrients)) {
        let a = 0;
        for (const l of s) {
            const i = l.plants?.[e];
            if (!i) continue;
            const s = i.nutrients?.[t],
                d = i.concentrations?.[t] ?? null;
            (null != d && d !== n._runningMlPerL && ((n._runningMlPerL = d), (a = 0)), s && s > 0 && null != d && d === n._runningMlPerL && a++);
        }
        ((n.feedsAtCurrent = a), delete n._runningMlPerL);
    }
    const d = n.repottedAt || t.startDate,
        c = Math.max(0, new Date() - new Date(d));
    return ((i.repottedAt = d), (i.flushedAt = n.flushedAt), (i.daysSinceRepot = Math.floor(c / 864e5)), (i.weeksSinceRepot = Math.max(1, Math.ceil(i.daysSinceRepot / 7))), i);
}
function renderPlantDetailModal(t, e) {
    const n = getPlantMeta(t, e).type,
        a = PLANT_TYPE.AUTO === n ? "AUTO" : "PHOTO",
        l = PLANT_TYPE.AUTO === n ? "plant-type-badge auto" : "plant-type-badge photo",
        i = t.nutrients || [],
        s = computePlantDetail(t, e),
        d = document.getElementById("plant-detail-name");
    if (((d.innerHTML = ""), isFavourite(t, e))) {
        const t = document.createElement("span");
        ((t.innerHTML = icon.star({ size: 14, marginRight: 6 })), d.appendChild(t.firstChild));
    }
    d.appendChild(document.createTextNode(e));
    const c = document.getElementById("plant-detail-type");
    ((c.className = l), (c.textContent = a));
    const o = new Date(),
        r = (t) => {
            const e = o - new Date(t),
                n = e >= 0,
                a = Math.abs(e),
                l = Math.round(a / 6e4),
                i = Math.round(a / 36e5),
                s = Math.floor(a / 864e5);
            let d;
            return ((d = l < 1 ? "just now" : l < 60 ? `${l} min${1 === l ? "" : "s"} ago` : i < 24 ? `${i} hour${1 === i ? "" : "s"} ago` : s < 30 ? `${s} day${1 === s ? "" : "s"} ago` : `${Math.floor(s / 30)} mo${n ? " ago" : ""}`), n ? d : `in ${d.replace(/^in /, "").replace(/ ago$/, "")}`);
        },
        u = (t, e = !1) => {
            if (!t) return "—";
            const n = fmtDate(t);
            return e ? `<span class="plant-detail-rel">${r(t)}</span> ${n}` : n;
        },
        p = new Date(s.repottedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        flushDate = s.flushedAt ? new Date(s.flushedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—",
        m =
            0 === s.notes.length
                ? '<div class="plant-detail-empty">No plant-specific notes yet.</div>'
                : s.notes
                      .map(
                          (t) => `
        <div class="plant-detail-obs">
            <div class="plant-detail-obs-date">${u(t.dt)}</div>
            <div class="plant-detail-obs-text">${escapeHtml(t.text)}</div>
        </div>`
                      )
                      .join(""),
        y = i
            .map((e) => {
                const n = s.nutrients[e.name] || { totalCups: 0, activeMlPerL: null, activeSinceDt: null, feedsAtCurrent: 0 },
                    a = `nutrient--${getNutrientColor(t, e.name)}`,
                    l = null == n.activeMlPerL && null != e.defaultConcentration,
                    i = n.activeSinceDt || (l ? t.startDate : null),
                    d = i ? `<span class="plant-detail-rel">${r(i)}</span> since ${fmtDate(i)}` : l ? '<span class="plant-detail-rel">since cycle start</span>' : "—";
                return `
        <div class="plant-detail-nutrient-block">
            <div class="plant-detail-nutrient-name ${a}">${escapeHtml(e.name)}</div>
            <div class="plant-detail-row">
                <div class="plant-detail-label">Active dilution</div>
                <div class="plant-detail-value">${null != n.activeMlPerL ? n.activeMlPerL + " ml/l" : "—"}</div>
            </div>
            <div class="plant-detail-row">
                <div class="plant-detail-label">Used for</div>
                <div class="plant-detail-value">${n.feedsAtCurrent} feed${1 === n.feedsAtCurrent ? "" : "s"}</div>
            </div>
            <div class="plant-detail-row">
                <div class="plant-detail-label">Date</div>
                <div class="plant-detail-value">${d}</div>
            </div>
            <div class="plant-detail-row">
                <div class="plant-detail-label">Cycle total</div>
                <div class="plant-detail-value ${a}">${n.totalCups.toFixed(1)} cup${1 === n.totalCups ? "" : "s"}</div>
            </div>
        </div>`;
            })
            .join(""),
        f = (t) => (0 === t ? " plant-detail-value--muted" : ""),
        g = `
        <div class="plant-detail-row">
            <div class="plant-detail-label">Type</div>
            <div class="plant-detail-value">${a}</div>
        </div>
                ${
                    cycleShowsYield(t)
                        ? `
        <div class="plant-detail-row">
            <div class="plant-detail-label">Yield</div>
            <div class="plant-detail-value nutrient--amber">${s.totalYieldGrams.toFixed(1)} g</div>
        </div>`
                        : ""
                }
        <div class="plant-detail-row">
            <div class="plant-detail-label">Repotted</div>
            <div class="plant-detail-value">${p}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Flushed</div>
            <div class="plant-detail-value">${u(s.firstFlushDt, !0)}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Age (since repot)</div>
            <div class="plant-detail-value"><span class="plant-detail-rel">${s.weeksSinceRepot} week${1 === s.weeksSinceRepot ? "" : "s"}</span> ${s.daysSinceRepot} day${1 === s.daysSinceRepot ? "" : "s"}</div>
        </div>
        <div class="plant-detail-divider"></div>
        <div class="plant-detail-section-label">Cumulative nutrients &amp; water</div>
        ${
            i.length > 0
                ? `
           <div class="plant-detail-row">
               <div class="plant-detail-label">Total water</div>
               <div class="plant-detail-value nutrient--water">${s.totalWaterCups.toFixed(1)} cup${1 === s.totalWaterCups ? "" : "s"}</div>
           </div>
           ${y}`
                : `<div class="plant-detail-row">
               <div class="plant-detail-label">Total water</div>
               <div class="plant-detail-value nutrient--water">${s.totalWaterCups.toFixed(1)} cup${1 === s.totalWaterCups ? "" : "s"}</div>
           </div>
           <div class="plant-detail-empty">No nutrients configured for this cycle. Add some via the Nutrient Manager to track per-nutrient stats.</div>`
        }
        <div class="plant-detail-divider"></div>
        <div class="plant-detail-section-label">Recount</div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Last fed</div>
            <div class="plant-detail-value">${u(s.lastFeedDt, !0)}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Last watered</div>
            <div class="plant-detail-value">${u(s.lastWaterDt, !0)}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Last LST'd</div>
            <div class="plant-detail-value">${u(s.lastLstDt, !0)}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Last defoliated</div>
            <div class="plant-detail-value">${u(s.lastDefDt, !0)}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Last flushed</div>
            <div class="plant-detail-value">${u(s.lastFlushDt, !0)}</div>
        </div>
        <div class="plant-detail-divider"></div>
        <div class="plant-detail-section-label">Last 7 days</div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times fed</div>
            <div class="plant-detail-value${f(s.feedCountLast7d)}">${s.feedCountLast7d}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times watered</div>
            <div class="plant-detail-value${f(s.waterCountLast7d)}">${s.waterCountLast7d}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times LST'd</div>
            <div class="plant-detail-value${f(s.lstCountLast7d)}">${s.lstCountLast7d}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times defoliated</div>
            <div class="plant-detail-value${f(s.defCountLast7d)}">${s.defCountLast7d}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times flushed</div>
            <div class="plant-detail-value${f(s.flushCountLast7d)}">${s.flushCountLast7d}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Log entries</div>
            <div class="plant-detail-value${f(s.logCountLast7d)}">${s.logCountLast7d}</div>
        </div>
        <div class="plant-detail-divider"></div>
        <div class="plant-detail-section-label">Cycle recap</div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Feed sessions</div>
            <div class="plant-detail-value">${s.feedCount}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Water sessions</div>
            <div class="plant-detail-value">${s.waterCount}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times LST'd</div>
            <div class="plant-detail-value">${s.lstCount}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times defoliated</div>
            <div class="plant-detail-value">${s.defCount}</div>
        </div>
        <div class="plant-detail-row">
            <div class="plant-detail-label">Times flushed</div>
            <div class="plant-detail-value">${s.flushCount}</div>
        </div>
        <div class="plant-detail-divider"></div>
        <div class="plant-detail-section-label">Notes</div>
        ${m}
    `;
    ((document.getElementById("plant-detail-stats").innerHTML = g), showModal("plant-detail-modal"));
}
function closePlantDetail() {
    hideModal("plant-detail-modal");
}
function newCycle() {
    const t = `Grow #${cycles.length + 1}`;
    ((document.getElementById("new-cycle-input").value = t), showModal("new-cycle-modal"), document.getElementById("new-cycle-input").select());
}
function confirmNewCycle() {
    const t = document.getElementById("new-cycle-input").value.trim() || `Grow #${cycles.length + 1}`;
    (hideModal("new-cycle-modal"), cycles.forEach((t) => collapsedCycles.add(t.id)), saveCollapsedCycles(collapsedCycles));
    const e = new Date(),
        n = (t) => String(t).padStart(2, "0"),
        a = `${e.getFullYear()}-${n(e.getMonth() + 1)}-${n(e.getDate())}`,
        l = { id: cycleUid(), name: t, startDate: a, plants: [], plantTypes: {}, entries: [], lightDefaults: {}, nutrients: [], stage: CYCLE_STAGE.GROW };
    (cycles.push(l), (activeCycleId = l.id), persist(), saveActiveCycleId(activeCycleId), updateGrowAge(), renderAddForm(), syncHeaderActions(), resetAddForm(), setDateDefault(), showTab("log", !0), invalidateLog(), invalidateStats(), hideModal("cycle-manage-modal"));
}
function cancelNewCycle() {
    hideModal("new-cycle-modal");
}
function editCycleName(t, e) {
    const n = document.getElementById("rename-cycle-modal"),
        a = document.getElementById("rename-cycle-input");
    ((a.value = e), showModal("rename-cycle-modal"), a.focus(), (n._cycleId = t), (n._currentName = e));
}
function cancelRenameCycle() {
    hideModal("rename-cycle-modal");
}
function confirmRenameCycle() {
    const t = document.getElementById("rename-cycle-modal"),
        e = document.getElementById("rename-cycle-input").value.trim();
    if (!e) return void alert("Cycle name can't be empty.");
    if (e === t._currentName) return void hideModal("rename-cycle-modal");
    const n = cycles.find((e) => e.id === t._cycleId);
    (n && ((n.name = e), persist(), invalidateLog(), invalidateStats(), refreshOpenCycleManager()), hideModal("rename-cycle-modal"));
}
function setStatsCycle(t) {
    (setStatsMode(STATS_MODE.ALL === t ? STATS_MODE.ALL : t), renderStats(cycles, activeCycleId));
}
function restorePlants(t, e, n, a) {
    if (!t || !Array.isArray(t.plants)) return;
    const l = document.querySelector(n),
        i = document.querySelectorAll(e);
    if (0 === t.plants.length) i.forEach((t) => (t.checked = !0));
    else {
        const e = new Set(t.plants);
        i.forEach((t) => {
            e.has(t.value) && (t.checked = !0);
        });
    }
    a && l && i.length > 0 && [...i].every((t) => t.checked) && ((l.checked = !0), i.forEach((t) => (t.disabled = !0)));
}
function editEntry(t) {
    let e = null,
        n = null;
    for (let a of cycles)
        if (((e = a.entries.find((e) => e.id === t)), e)) {
            n = a;
            break;
        }

    const orphaned = draftState.orphanedEdits[t];
    if (!e && !orphaned) return;

    const targetCycle = n || (orphaned && cycles.find((c) => c.id === orphaned.cycleId)) || activeCycle();

    (targetCycle && targetCycle.id !== activeCycleId && ((activeCycleId = targetCycle.id), saveActiveCycleId(activeCycleId), updateGrowAge(), renderAddForm(), updateLightStatus()), (draftState.editingEntryId = t));

    if (orphaned) {
        restoreEditForm(orphaned);
    } else {
        ((document.getElementById("new-dt").value = e.dt),
            (nutrientDrafts = {}),
            Object.entries(e.plants || {}).forEach(([t, e]) => {
                nutrientDrafts[t] = { ...e };
            }),
            (nutrientActiveTab = NUTRIENT_TAB_ALL),
            (yieldDrafts = {}),
            Object.entries(e.plants || {}).forEach(([t, e]) => {
                if (e.yieldGrams != null) yieldDrafts[t] = e.yieldGrams;
            }),
            writeNutrientInputs({}),
            document.querySelectorAll("#nutrient-plant-tabs .nutrient-tab").forEach((t) => {
                t.classList.toggle("active", NUTRIENT_TAB_ALL === t.dataset.tab);
            }));
        const a = e.actions || [];
        if (
            ((document.getElementById("ck-light").checked = a.some((t) => t && ACTION_TYPE.LIGHT === t.type)),
            PICKER_ACTIONS.forEach((t) => {
                const e = a.find((e) => e && e.type === t.id);
                ((t.checkbox.checked = !!e), e ? (restorePlants(e, `.${t.id}-plant`, `.${t.id}-plant-all`, ACTION_TYPE.LST === t.id), (t.pickerWrap.style.display = "block")) : (t.pickerWrap.style.display = "none"));
            }),
            document.getElementById("ck-light").checked)
        ) {
            const t = a.find((t) => ACTION_TYPE.LIGHT === t.type);
            (t && ((document.getElementById("light-lux").value = t.lux || ""), (document.getElementById("light-dist").value = t.dist || "")), (document.getElementById("light-inputs").style.display = "block"));
        } else document.getElementById("light-inputs").style.display = "none";
        document.getElementById("new-obs").value = e.obs || "";
        const l = new Set(cyclePlants()),
            i = [];
        (cyclePlants().forEach((t) => {
            const n = e.plantObs?.[t];
            n && n.trim() && i.push({ plant: t, text: n });
        }),
            e.plantObs &&
                "object" == typeof e.plantObs &&
                Object.entries(e.plantObs).forEach(([t, e]) => {
                    !l.has(t) && e && e.trim() && i.push({ plant: t, text: e });
                }),
            resetPlantNotesDraft(i));
    }

    showTab("add");
}
function saveEntry() {
    const t = document.getElementById("new-dt").value;
    if (!t) return void alert("Set a date and time.");
    const e = activeCycle(),
        n = [...cyclePlants()].sort((t, n) => (isFavourite(e, t) ? 0 : 1) - (isFavourite(e, n) ? 0 : 1)),
        a = [];

    // Capture which plants the entry being edited previously flushed so
    // we can recompute their flushedAt if the action is being removed.
    // New entries (no editingEntryId) start with an empty set, so the
    // recompute loop below is a no-op for them.
    const previouslyFlushedPlants = new Set();
    if (draftState.editingEntryId) {
        const prevEntry = e.entries.find((entry) => entry.id === draftState.editingEntryId);
        if (prevEntry && Array.isArray(prevEntry.actions)) {
            for (const action of prevEntry.actions) {
                if (action && action.type === ACTION_TYPE.FLUSH) {
                    (action.plants || []).forEach((p) => previouslyFlushedPlants.add(p));
                }
            }
        }
    }
    const currentlyFlushedPlants = new Set();

    if (
        (PICKER_ACTIONS.forEach((n) => {
            if (!n.checkbox.checked) return;
            const l = n.checked();
            if ((a.push({ type: n.id, plants: l }), ACTION_TYPE.REPOT === n.id)) {
                const dt = t.slice(0, 10);
                l.forEach((p) => {
                    e.plantTypes[p] && "object" == typeof e.plantTypes[p] ? (e.plantTypes[p].repottedAt = dt) : (e.plantTypes[p] = { type: PLANT_TYPE.AUTO, repottedAt: dt });
                });
            } else if (ACTION_TYPE.FLUSH === n.id) {
                const dt = t.slice(0, 10);
                l.forEach((p) => {
                    e.plantTypes[p] && "object" == typeof e.plantTypes[p] ? (e.plantTypes[p].flushedAt = dt) : (e.plantTypes[p] = { type: PLANT_TYPE.AUTO, repottedAt: e.startDate, flushedAt: dt });
                    currentlyFlushedPlants.add(p);
                });
            }
        }),
        document.getElementById("ck-light").checked)
    ) {
        const t = document.getElementById("light-lux").value,
            e = document.getElementById("light-dist").value,
            n = document.getElementById("light-start").value,
            l = document.getElementById("light-end").value;
        a.push({ type: ACTION_TYPE.LIGHT, lux: t, dist: e, start: n, end: l });
    }
    const l = readNutrientInputs();
    ((l.nutrients && Object.keys(l.nutrients).length > 0) || (l.concentrations && Object.keys(l.concentrations).length > 0) || null != l.water) && (nutrientDrafts[nutrientActiveTab] = mergeDrafts(nutrientDrafts[nutrientActiveTab], l));
    const i = {},
        s = nutrientDrafts[NUTRIENT_TAB_ALL] || {};
    n.forEach((t) => {
        const e = nutrientDrafts[t] || {},
            n = {},
            a = {};
        (Object.entries(s.nutrients || {}).forEach(([t, e]) => {
            null != e && (a[t] = e);
        }),
            Object.entries(e.nutrients || {}).forEach(([t, e]) => {
                null != e && (a[t] = e);
            }),
            Object.keys(a).length > 0 && (n.nutrients = a));
        const l = {};
        (Object.entries(s.concentrations || {}).forEach(([t, e]) => {
            null != e && (l[t] = e);
        }),
            Object.entries(e.concentrations || {}).forEach(([t, e]) => {
                null != e && (l[t] = e);
            }),
            Object.keys(l).length > 0 && (n.concentrations = l));
        const d = null != e.water ? e.water : s.water;
        const y = s.yieldGrams || 0;
        y && (i.totalYieldGrams += y);
        (null != d && "" !== d && (n.water = d), Object.keys(n).length > 0 && (i[t] = n));
    });

    const yieldInputs = readYieldInputs();
    Object.entries(yieldInputs).forEach(([plant, val]) => {
        if (val == null) return;
        const slot = i[plant] || (i[plant] = {});
        slot.yieldGrams = val;
    });

    const d = new Set(cyclePlants()),
        c = {};
    draftState.pendingPlantObs.forEach((t) => {
        t.plant && d.has(t.plant) && t.text && t.text.trim() && (c[t.plant] = t.text.trim());
    });
    const o = document.getElementById("new-obs").value.trim();
    if (draftState.editingEntryId) {
        const n = e.entries.find((t) => t.id === draftState.editingEntryId);
        if (!n) {
            draftState.orphanedEdits[draftState.editingEntryId] = snapshotEditForm();
            alert("Couldn't find the entry to update. Please try editing it again.");
            return;
        }
        ((n.dt = t), (n.plants = i), (n.actions = a), (n.obs = o || void 0), (n.plantObs = Object.keys(c).length ? c : {}), delete draftState.orphanedEdits[draftState.editingEntryId], resetDraft());

        // For any plant whose flush action was on the previous version of
        // this entry but isn't on the new one, recompute flushedAt by
        // scanning every entry. The result is either the next-most-recent
        // flush (if one exists in another entry) or null. Plants that are
        // still flushed in this entry keep the date set in the forEach
        // above and are skipped here.
        for (const plant of previouslyFlushedPlants) {
            if (currentlyFlushedPlants.has(plant)) continue;
            const pt = e.plantTypes[plant];
            if (!pt || typeof pt !== "object") continue;
            let latest = null;
            for (const entry of e.entries) {
                if (!entry || !Array.isArray(entry.actions)) continue;
                for (const action of entry.actions) {
                    if (!action || action.type !== ACTION_TYPE.FLUSH) continue;
                    const plants = action.plants || [];
                    if (plants.length === 0 || plants.includes(plant)) {
                        const dt = entry.dt.slice(0, 10);
                        if (!latest || dt > latest) latest = dt;
                        break;
                    }
                }
            }
            pt.flushedAt = latest;
        }
    } else e.entries.unshift({ id: uid(), dt: t, plants: i, actions: a, obs: o || void 0, plantObs: Object.keys(c).length ? c : {} });
    (persist(), resetAddForm(), showTab("log", !0), invalidateLog(), invalidateStats());
}
function cancelEdit() {
    (resetDraft(), resetAddForm(), setDateDefault(), showTab("log", !0));
}
function duplicateEntry(t) {
    for (const e of cycles) {
        const n = e.entries.find((e) => e.id === t);
        if (n) {
            const t = JSON.parse(JSON.stringify(n));
            return ((t.id = uid()), e.entries.unshift(t), persist(), invalidateLog(), void invalidateStats());
        }
    }
}
function deleteEntry(t) {
    if (!confirm("Delete this entry?")) return;
    for (const c of cycles) {
        const idx = c.entries.findIndex((e) => e.id === t);
        if (idx >= 0) {
            c.entries.splice(idx, 1);
            break;
        }
    }
    persist();
    invalidateLog();
    invalidateStats();
}
function deleteCycle(t) {
    const e = cycles.find((e) => e.id === t);
    e && confirm(`Delete "${e.name}" and all its entries? This cannot be undone.`) && ((cycles = cycles.filter((e) => e.id !== t)), activeCycleId === t && ((activeCycleId = cycles.length ? cycles[cycles.length - 1].id : null), saveActiveCycleId(activeCycleId)), persist(), updateGrowAge(), renderAddForm(), invalidateLog(), invalidateStats(), refreshOpenCycleManager());
}
function exportBackup() {
    const t = JSON.stringify(cycles, null, 2),
        e = new Blob([t], { type: "application/json" }),
        n = URL.createObjectURL(e),
        a = document.createElement("a"),
        l = new Date().toISOString().slice(0, 10);
    ((a.href = n), (a.download = `rootine-backup-${l}.json`), a.click(), URL.revokeObjectURL(n));
}
let pendingImportData = null;

function importBackup(t) {
    const e = t.target.files[0];
    if (!e) return;
    const n = new FileReader();
    n.onload = (e) => {
        const n = e.target.result;
        let a;
        try {
            a = JSON.parse(n);
        } catch {
            alert("Invalid backup file.");
            t.target.value = "";
            return;
        }
        if (!isValidCyclesShape(a)) {
            alert("Invalid backup file.");
            t.target.value = "";
            return;
        }
        pendingImportData = a;
        showImportChoice(a);
    };
    n.readAsText(e);
}

function summarizeImport(imported, existing) {
    const existingById = new Map(existing.map((c) => [c.id, c]));
    const newCycles = [];
    const cyclesWithNewEntries = [];
    const cyclesUpToDate = [];
    for (const imp of imported) {
        const local = existingById.get(imp.id);
        if (!local) {
            newCycles.push(imp);
        } else {
            const localEntryIds = new Set((local.entries || []).map((e) => e.id));
            const newEntries = (imp.entries || []).filter((e) => !localEntryIds.has(e.id));
            if (newEntries.length > 0) cyclesWithNewEntries.push({ cycle: imp, newEntries });
            else cyclesUpToDate.push(imp);
        }
    }
    return { newCycles, cyclesWithNewEntries, cyclesUpToDate };
}

function showImportChoice(imported) {
    const summary = summarizeImport(imported, cycles);
    const totalEntries = imported.reduce((s, c) => s + (c.entries || []).length, 0);
    const info = document.getElementById("import-choice-info");
    if (info) {
        info.textContent = `Backup contains ${imported.length} cycle${imported.length === 1 ? "" : "s"} with ${totalEntries} total entr${totalEntries === 1 ? "y" : "ies"}.`;
    }
    renderImportSummary(summary);
    showModal("import-choice-modal");
}

function renderImportSummary(summary) {
    const el = document.getElementById("import-choice-summary");
    if (!el) return;
    const parts = [];
    if (summary.newCycles.length > 0) {
        const n = summary.newCycles.length;
        parts.push(`<div class="import-choice-summary-item">+ ${n} new cycle${n === 1 ? "" : "s"} will be added</div>`);
    }
    if (summary.cyclesWithNewEntries.length > 0) {
        const totalNew = summary.cyclesWithNewEntries.reduce((s, x) => s + x.newEntries.length, 0);
        const c = summary.cyclesWithNewEntries.length;
        parts.push(`<div class="import-choice-summary-item">+ ${totalNew} new entr${totalNew === 1 ? "y" : "ies"} added to ${c} existing cycle${c === 1 ? "" : "s"}</div>`);
    }
    if (summary.cyclesUpToDate.length > 0) {
        const n = summary.cyclesUpToDate.length;
        parts.push(`<div class="import-choice-summary-item import-choice-summary-item--muted">${n} cycle${n === 1 ? "" : "s"} already up to date</div>`);
    }
    if (parts.length === 0) {
        parts.push(`<div class="import-choice-summary-item import-choice-summary-item--muted">Nothing new to add</div>`);
    }
    el.innerHTML = parts.join("");
}

function cancelImport() {
    pendingImportData = null;
    hideModal("import-choice-modal");
    const input = document.getElementById("import-backup-input");
    if (input) input.value = "";
}

function applyImport(mode) {
    if (!pendingImportData) return;
    const result = mode === "replace" ? pendingImportData : mode === "merge" ? mergeCycles(cycles, pendingImportData) : null;
    if (!result) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
    localStorage.removeItem(STORAGE_VERSION_KEY);
    pendingImportData = null;
    location.reload();
}
function mergeCycles(existing, imported) {
    const result = existing.map((c) => ({ ...c, entries: [...(c.entries || [])] }));
    const existingById = new Map(result.map((c) => [c.id, c]));
    for (const impCycle of imported) {
        const localCycle = existingById.get(impCycle.id);
        if (!localCycle) {
            result.push(impCycle);
            continue;
        }
        const localEntryIds = new Set(localCycle.entries.map((e) => e.id));
        for (const impEntry of impCycle.entries || []) {
            if (!localEntryIds.has(impEntry.id)) {
                localCycle.entries.push(impEntry);
            }
        }
        localCycle.entries.sort((a, b) => new Date(b.dt) - new Date(a.dt));
    }
    return result;
}
function triggerImport() {
    document.getElementById("import-backup-input").click();
}
function refreshOpenPlantDetail() {
    const t = document.getElementById("plant-detail-modal");
    if (!t || !t.classList.contains("modal-overlay--visible")) return;
    const e = document.getElementById("plant-detail-name").textContent;
    if (!e) return;
    const n = cycles.find((t) => t.plants && t.plants.includes(e));
    n && renderPlantDetailModal(n, e);
}
function invalidateLog() {
    renderLog(cycles, activeCycleId);
}
function invalidateStats() {
    renderStats(cycles, activeCycleId);
}
function invalidateModal() {
    refreshOpenPlantDetail();
}
function persist() {
    saveCycles(cycles);
}
(on("toggleWeek", "click", (t) => toggleWeek(t.dataset.id, Number(t.dataset.week))),
    on("toggleCycle", "click", (t) => toggleCycle(t.dataset.id)),
    on("toggleEntry", "click", (t) => toggleEntry(t.dataset.id)),
    on("editEntry", "click", (t) => editEntry(t.dataset.id)),
    on("deleteEntry", "click", (t) => deleteEntry(t.dataset.id)),
    on("duplicateEntry", "click", (t) => duplicateEntry(t.dataset.id)),
    on("setStatsCycle", "click", (t) => setStatsCycle(t.dataset.id)),
    on("editCycleName", "click", (t) => {
        const e = cycles.find((e) => e.id === t.dataset.id);
        e && editCycleName(e.id, e.name);
    }),
    on("deleteCycle", "click", (t) => deleteCycle(t.dataset.id)),
    on("togglePlantType", "click", (t) => togglePlantType(Number(t.dataset.index))),
    on("renamePlant", "click", (t) => renamePlant(Number(t.dataset.index))),
    on("deletePlant", "click", (t) => deletePlant(Number(t.dataset.index))),
    on("toggleFavourite", "click", (t) => toggleFavourite(Number(t.dataset.index))),
    on("renameNutrient", "click", (t) => renameNutrient(Number(t.dataset.index))),
    on("deleteNutrient", "click", (t) => deleteNutrient(Number(t.dataset.index))),
    on("editNutrientDefault", "click", (t) => editNutrientDefault(Number(t.dataset.index))),
    on("editPlantObs", "click", (t) => editPlantObs(Number(t.dataset.index))),
    on("removePlantObs", "click", (t) => removePlantObs(Number(t.dataset.index))),
    on("addPlantObs", "click", () => addPlantObs()),
    on("saveEntry", "click", () => saveEntry()),
    on("cancelEdit", "click", () => cancelEdit()),
    on("togglePlantPicker", "change", (t) => togglePlantPicker(t.dataset.pick)),
    on("toggleLightInputs", "change", () => toggleLightInputs()),
    on("saveLightDefaults", "input", () => _saveLightDefaults()),
    on("showTab", "click", (t) => showTab(t.dataset.id)),
    on("toggleObs", "click", () => toggleObs()),
    on("newCycle", "click", () => newCycle()),
    on("openPlantManager", "click", () => openPlantManager()),
    on("openNutrientManager", "click", () => openNutrientManager()),
    on("exportBackup", "click", () => exportBackup()),
    on("importBackup", "change", (t, e) => importBackup(e)),
    on("importMerge", "click", () => applyImport("merge")),
    on("importReplace", "click", () => applyImport("replace")),
    on("cancelImport", "click", () => cancelImport()),
    on("triggerImport", "click", () => triggerImport()),
    on("confirmNewCycle", "click", () => confirmNewCycle()),
    on("cancelNewCycle", "click", () => cancelNewCycle()),
    on("confirmRenameCycle", "click", () => confirmRenameCycle()),
    on("cancelRenameCycle", "click", () => cancelRenameCycle()),
    on("confirmAddPlant", "click", () => confirmAddPlant()),
    on("cancelAddPlant", "click", () => cancelAddPlant()),
    on("confirmRenamePlant", "click", () => confirmRenamePlant()),
    on("cancelRenamePlant", "click", () => cancelRenamePlant()),
    on("closePlantManager", "click", () => closePlantManager()),
    on("closeNutrientManager", "click", () => closeNutrientManager()),
    on("openAddPlant", "click", () => openAddPlant()),
    on("closePlantDetail", "click", () => closePlantDetail()),
    on("confirmAddNutrient", "click", () => confirmAddNutrient()),
    on("cancelAddNutrient", "click", () => cancelAddNutrient()),
    on("confirmRenameNutrient", "click", () => confirmRenameNutrient()),
    on("cancelRenameNutrient", "click", () => cancelRenameNutrient()),
    on("confirmEditNutrientDefault", "click", () => confirmEditNutrientDefault()),
    on("cancelEditNutrientDefault", "click", () => cancelEditNutrientDefault()),
    on("selectPlantType", "click", (t) => selectPlantType(t.dataset.scope, t.dataset.type)),
    on("openPlantDetail", "click", (t) => openPlantDetail(t.dataset.id)),
    on("toggleHeaderMenu", "click", () => toggleHeaderMenu()),
    on("openCycleManager", "click", () => openCycleManager()),
    on("closeCycleManager", "click", () => closeCycleManager()),
    on("newCycleFromManager", "click", () => newCycleFromManager()),
    on("advanceCycleStage", "click", (t) => advanceCycleStage(t.dataset.id)),
    updateGrowAge(),
    setDateDefault(),
    _loadLightDefaults(),
    renderAddForm(),
    scheduleNextLightCheck(),
    window.addEventListener("focus", () => {
        (updateLightStatus(), scheduleNextLightCheck());
    }),
    document.addEventListener("visibilitychange", () => {
        document.hidden ? clearLightStatusTimer() : (updateLightStatus(), scheduleNextLightCheck());
    }));
try {
    (invalidateLog(), invalidateStats(), updateLightStatus());
} catch (t) {}
registerServiceWorker();
