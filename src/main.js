import "./style.css";
import { uid, cycleUid, fmtDate, fmtTime, escapeHtml, getPlantMeta, getNutrientColor, NUTRIENT_PALETTE, fmtQty } from "./utils.js";
import { loadCycles, saveCycles, loadActiveCycleId, saveActiveCycleId, loadCollapsedCycles, saveCollapsedCycles, loadCollapsedWeeks, loadCollapsedObs, isValidCyclesShape } from "./storage.js";
import { initLog, renderLog, toggleWeek, toggleCycle, toggleEntry } from "./log.js";
import { initStats, renderStats, setStatsMode, initObsCollapsed, toggleObs } from "./stats.js";
import { on, closeHeaderMenu } from "./actions.js";
import { icon } from "./icons.js";
import { registerServiceWorker } from "./sw.js";
let cycles = loadCycles(),
    activeCycleId = loadActiveCycleId(cycles);
const collapsedCycles = loadCollapsedCycles(),
    collapsedWeeks = loadCollapsedWeeks(),
    collapsedObs = loadCollapsedObs();
let nutrientDrafts = {},
    nutrientActiveTab = "__ALL__";
const draftState = { editingEntryId: null, pendingAddPlantType: "auto", pendingRenamePlantType: "auto", pendingPlantObs: [], selectedPlantObsTab: null, editingPlantObsIndex: null };
function resetDraft() {
    ((draftState.editingEntryId = null), (draftState.pendingAddPlantType = "auto"), (draftState.pendingRenamePlantType = "auto"), (draftState.pendingPlantObs = []), (draftState.selectedPlantObsTab = null), (draftState.editingPlantObsIndex = null));
}
function toggleHeaderMenu() {
    const t = document.getElementById("header-menu"),
        e = document.getElementById("header-menu-btn"),
        n = t.classList.toggle("open");
    (e.classList.toggle("is-open", n), e.setAttribute("aria-expanded", n ? "true" : "false"));
}
(initLog(collapsedWeeks, collapsedCycles),
    initStats("active"),
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
    (((e.nutrients && Object.keys(e.nutrients).length > 0) || (e.concentrations && Object.keys(e.concentrations).length > 0) || null != e.water) && (nutrientDrafts[nutrientActiveTab] = mergeDrafts(nutrientDrafts[nutrientActiveTab], e)), (nutrientActiveTab = t));
    (writeNutrientInputs(mergeDrafts(nutrientDrafts.__ALL__ || {}, nutrientDrafts[t] || {})),
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
        ((l.className = "form-row"), (l.innerHTML = `\n            <label class="form-label nutrient-field-label--${a}">${escapeHtml(n.name)}</label>\n            <div class="nutrient-input-group">\n                <input class="form-input" type="number" min="0" step="0.5" placeholder="cups" data-nutrient="${escapeHtml(n.name)}" data-field="amount" />\n                <input class="form-input form-input--conc" type="number" min="0" step="1" placeholder="ml/l" data-nutrient="${escapeHtml(n.name)}" data-field="conc" title="Concentration (ml/l)" />\n            </div>\n        `), t.appendChild(l));
    });
}
function renderAddForm() {
    const t = cyclePlants(),
        e = activeCycle(),
        n = 0 === t.length ? [] : [...t].sort((t, n) => (isFavourite(e, t) ? 0 : 1) - (isFavourite(e, n) ? 0 : 1));
    syncHeaderActions();
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
                (t.dataset.tab = "__ALL__"),
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
                "__ALL__" === nutrientActiveTab || n.includes(nutrientActiveTab) || (delete nutrientDrafts[nutrientActiveTab], (nutrientActiveTab = "__ALL__")),
                Object.keys(nutrientDrafts).forEach((t) => {
                    "__ALL__" === t || n.includes(t) || delete nutrientDrafts[t];
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
    if ((renderNutrientFormRows(), n.length > 0)) {
        (writeNutrientInputs(mergeDrafts(nutrientDrafts.__ALL__ || {}, nutrientDrafts[nutrientActiveTab] || {})),
            a &&
                a.querySelectorAll(".nutrient-tab").forEach((t) => {
                    t.classList.toggle("active", t.dataset.tab === nutrientActiveTab);
                }));
    } else writeNutrientInputs({});
    (["lst", "def", "repot"].forEach((a) => {
        const l = document.getElementById(a + "-plants").querySelector(".plant-picker-list");
        if (!l) return;
        if (((l.innerHTML = ""), 0 === t.length)) return void (l.innerHTML = '<div style="font-size: 12px; color: var(--muted)">No plants available.</div>');
        const i = document.createElement("label");
        i.className = "plant-picker-opt plant-picker-opt-all";
        const s = document.createElement("input");
        ((s.type = "checkbox"),
            (s.className = `${a}-plant-all`),
            (s.onchange = () => {
                l.querySelectorAll(`.${a}-plant`).forEach((t) => {
                    ((t.checked = s.checked), (t.disabled = s.checked));
                });
            }),
            i.appendChild(s),
            i.appendChild(document.createTextNode("All plants")),
            l.appendChild(i),
            n.forEach((t) => {
                const n = document.createElement("label");
                n.className = "plant-picker-opt";
                const i = document.createElement("input");
                if (((i.type = "checkbox"), (i.className = `${a}-plant`), (i.value = t), n.appendChild(i), n.appendChild(document.createTextNode(t)), isFavourite(e, t))) {
                    const t = document.createElement("span");
                    ((t.innerHTML = icon.star({ size: 11, marginRight: 0, verticalAlign: -1 })), n.appendChild(t.firstChild));
                }
                l.appendChild(n);
            }));
    }),
        populatePlantObsTabs(),
        renderPlantObsList());
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
            : (t.innerHTML = draftState.pendingPlantObs.map((t, e) => `\n        <div class="plant-obs-item${draftState.editingPlantObsIndex === e ? " editing" : ""}">\n            <div class="plant-obs-item-header">\n                <span class="plant-obs-item-name">${escapeHtml(t.plant)}</span>\n                <div>\n                    <button class="plant-obs-item-edit" type="button" data-action="editPlantObs" data-index="${e}" title="Edit note" aria-label="Edit note for ${escapeHtml(t.plant)}">\n                        ${icon.edit()}\n                    </button>\n                    <button class="plant-obs-item-remove" type="button" data-action="removePlantObs" data-index="${e}" title="Remove note" aria-label="Remove note for ${escapeHtml(t.plant)}">\n                        ${icon.trash()}\n                    </button>\n                </div>\n            </div>\n            <div class="plant-obs-item-text">${escapeHtml(t.text)}</div>\n        </div>`).join("")),
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
    ((nutrientDrafts = {}), (nutrientActiveTab = "__ALL__"));
    const t = document.getElementById("nutrient-rows");
    t &&
        t.querySelectorAll("input[data-nutrient]").forEach((t) => {
            ((t.value = ""), delete t.dataset.previewHadValue);
        });
    const e = document.getElementById("nutrient-water");
    (e && ((e.value = ""), delete e.dataset.previewHadValue),
        document.querySelector("#nutrient-plant-tabs .nutrient-tab") &&
            document.querySelectorAll("#nutrient-plant-tabs .nutrient-tab").forEach((t) => {
                t.classList.toggle("active", "__ALL__" === t.dataset.tab);
            }),
        ["lst", "def", "repot"].forEach((t) => {
            const e = document.getElementById("ck-" + t);
            e && (e.checked = !1);
        }),
        document.querySelectorAll(".lst-plant, .def-plant, .repot-plant").forEach((t) => {
            ((t.checked = !1), (t.disabled = !1));
        }),
        document.querySelectorAll(".lst-plant-all, .def-plant-all, .repot-plant-all").forEach((t) => (t.checked = !1)),
        (document.getElementById("lst-plants").style.display = "none"),
        (document.getElementById("def-plants").style.display = "none"),
        (document.getElementById("repot-plants").style.display = "none"),
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
    const e = document.getElementById("ck-" + t).checked;
    document.getElementById(t + "-plants").style.display = e ? "block" : "none";
}
function toggleLightInputs() {
    document.getElementById("light-inputs").style.display = document.getElementById("ck-light").checked ? "block" : "none";
}
function getCycleLightDefaults() {
    const t = activeCycle();
    return (t && t.lightDefaults) || {};
}
function parseLightAction(t) {
    return t && "light" === t.type ? { lux: t.lux || null, dist: t.dist || null, start: t.start || null, end: t.end || null } : null;
}
function latestLoggedLight(t) {
    if (!t) return null;
    const e = [...(t.entries || [])].sort((t, e) => new Date(e.dt) - new Date(t.dt));
    for (const t of e) {
        const e = (t.actions || []).find((t) => t && "light" === t.type);
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
    let r = !1;
    const o = [];
    if ((i && o.push(i + "K"), d && c)) {
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
        r = m < y ? p >= m && p < y : p >= m || p < y;
        const g = (t) => {
            const [e, n] = t.split(":"),
                a = parseInt(e);
            return (a % 12 || 12) + ("00" !== n ? ":" + n : "") + (a >= 12 ? "PM" : "AM");
        };
        o.push(g(d) + "–" + g(c) + " (" + i + "/" + s + ")");
    }
    const u = o.length ? o.join("·") : "no active schedule";
    if ((e.textContent !== u && (e.textContent = u), n)) {
        const t = r ? "var(--amber)" : "var(--muted)";
        n.style.fill !== t && (n.style.fill = t);
    }
}
function _saveLightDefaults() {
    const t = activeCycle();
    t && ((t.lightDefaults = { lux: document.getElementById("light-lux").value, dist: document.getElementById("light-dist").value, start: document.getElementById("light-start").value, end: document.getElementById("light-end").value }), persist(), renderAfterChange("modal"), updateLightStatus());
}
function _loadLightDefaults() {
    const t = getCycleLightDefaults();
    ((document.getElementById("light-lux").value = t.lux || ""), (document.getElementById("light-dist").value = t.dist || ""), (document.getElementById("light-start").value = t.start || ""), (document.getElementById("light-end").value = t.end || ""));
}
function openPlantManager() {
    (renderPlantList(), (document.getElementById("plant-manage-modal").style.display = "flex"));
}
function closePlantManager() {
    document.getElementById("plant-manage-modal").style.display = "none";
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
                  i = "auto" === l ? "plant-type-badge auto" : "plant-type-badge photo",
                  s = "auto" === l ? "AUTO" : "PHOTO",
                  d = document.createElement("div");
              ((d.className = "plant-manage-row"),
                  (d.innerHTML = `\n            <div class="plant-manage-name">${escapeHtml(n)}</div>\n            <div class="plant-manage-actions">\n                <span class="${i}" data-action="togglePlantType" data-index="${a}" title="Click to toggle type">${s}</span>\n                <button class="settings-btn blue-btn" data-action="renamePlant" data-index="${a}" aria-label="Rename ${escapeHtml(n)}" title="Rename">${icon.editStroke()}</button>\n                <button class="settings-btn red-btn" data-action="deletePlant" data-index="${a}" aria-label="Delete ${escapeHtml(n)}" title="Delete">${icon.trashStroke()}</button>\n                <button class="settings-btn favourite-btn ${isFavourite(t, n) ? "is-favourite" : ""}" data-action="toggleFavourite" data-index="${a}" aria-label="${isFavourite(t, n) ? "Unfavourite" : "Favourite"} ${escapeHtml(n)}" title="${isFavourite(t, n) ? "Unfavourite" : "Favourite"}">${icon.star({ size: 18, filled: isFavourite(t, n) })}</button>\n            </div>\n        `),
                  e.appendChild(d));
          }))
        : (e.innerHTML = '<div class="plant-empty">No plants yet. Add some to start logging.</div>');
}
function openAddPlant() {
    ((document.getElementById("new-plant-name").value = ""), (draftState.pendingAddPlantType = "auto"), selectPlantType("add", "auto"), (document.getElementById("add-plant-modal").style.display = "flex"), setTimeout(() => document.getElementById("new-plant-name").focus(), 50));
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
    ((e.plantTypes[n] && "object" == typeof e.plantTypes[n]) || (e.plantTypes[n] = { type: a, repottedAt: e.startDate }), (e.plantTypes[n].type = "auto" === a ? "photo" : "auto"), persist(), renderPlantList());
}
function toggleFavourite(t) {
    const e = activeCycle();
    if (!e) return;
    const n = e.plants[t];
    Array.isArray(e.favourites) || (e.favourites = []);
    const a = e.favourites.indexOf(n);
    (a >= 0 ? e.favourites.splice(a, 1) : e.favourites.push(n), persist(), renderPlantList(), renderAddForm(), renderAfterChange("log"), renderAfterChange("stats"));
}
function confirmAddPlant() {
    const t = document.getElementById("new-plant-name").value.trim();
    if (!t) return void alert("Enter a plant name.");
    if (!PLANT_NAME_RE.test(t)) return void alert("Plant name can only contain letters, numbers, spaces, dashes, and underscores.");
    const e = activeCycle();
    e ? (Array.isArray(e.plants) || (e.plants = []), e.plants.includes(t) ? alert("A plant with that name already exists.") : (e.plants.push(t), (e.plantTypes && "object" == typeof e.plantTypes) || (e.plantTypes = {}), (e.plantTypes[t] = draftState.pendingAddPlantType), persist(), (document.getElementById("add-plant-modal").style.display = "none"), renderPlantList(), renderAddForm(), renderAfterChange("stats"))) : alert("No active cycle.");
}
function cancelAddPlant() {
    document.getElementById("add-plant-modal").style.display = "none";
}
function renamePlant(t) {
    const e = activeCycle();
    if (!e) return;
    const n = e.plants[t],
        a = (e.plantTypes || {})[n],
        l = ("object" == typeof a ? a?.type : a) || "auto";
    ((document.getElementById("rename-plant-input").value = n), (draftState.pendingRenamePlantType = l), selectPlantType("rename", l));
    const i = document.getElementById("rename-plant-modal");
    ((i.style.display = "flex"),
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
            cycles.forEach((t) => {
                t.id === e.id &&
                    t.entries.forEach((t) => {
                        (t.plants && t.plants[l] && ((t.plants[s] = t.plants[l]), delete t.plants[l]), Array.isArray(t.actions) && (t.actions = t.actions.map((t) => (t && ("lst" === t.type || "def" === t.type || "repot" === t.type) && Array.isArray(t.plants) ? { ...t, plants: t.plants.map((t) => (t === l ? s : t)) } : t))), t.plantObs && "object" == typeof t.plantObs && t.plantObs[l] && ((t.plantObs[s] = t.plantObs[l]), delete t.plantObs[l]));
                    });
            }));
    }
    ((e.plantTypes[s] = { type: i, repottedAt: e.plantTypes[s]?.repottedAt || e.startDate }), persist(), (t.style.display = "none"), renderPlantList(), renderAddForm(), renderAfterChange("log"), renderAfterChange("stats"));
}
function cancelRenamePlant() {
    document.getElementById("rename-plant-modal").style.display = "none";
}
function deletePlant(t) {
    const e = activeCycle();
    if (!e) return;
    const n = e.plants[t];
    confirm(`Remove plant "${n}"? It will disappear from the Add form. Existing entries that reference it keep their data.`) && (e.plants.splice(t, 1), e.plantTypes && delete e.plantTypes[n], persist(), renderPlantList(), renderAddForm());
}
function isFavourite(t, e) {
    return Array.isArray(t.favourites) && t.favourites.includes(e);
}
function openNutrientManager() {
    (renderNutrientList(), (document.getElementById("nutrient-manage-modal").style.display = "flex"));
}
function closeNutrientManager() {
    document.getElementById("nutrient-manage-modal").style.display = "none";
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
                  (i.innerHTML = `\n            <div class="plant-manage-name">\n                <span class="nutrient-swatch nutrient-swatch--${l}"></span>\n                <span>${escapeHtml(n.name)}</span>\n                ${null != n.defaultConcentration ? `<span class="nutrient-default-hint" title="Starting dilution">${n.defaultConcentration} ml/l</span>` : ""}\n            </div>\n            <div class="plant-manage-actions">\n                <button class="settings-btn blue-btn" data-action="renameNutrient" data-index="${a}" title="Rename ${escapeHtml(n.name)}" aria-label="Rename ${escapeHtml(n.name)}">\n                    ${icon.edit()}\n                </button>\n                <button class="settings-btn red-btn" data-action="deleteNutrient" data-index="${a}" title="Delete ${escapeHtml(n.name)}" aria-label="Delete ${escapeHtml(n.name)}">\n                    ${icon.trash()}\n                </button>\n                <button class="settings-btn amber-btn" data-action="editNutrientDefault" data-index="${a}" title="Set starting dilution for ${escapeHtml(n.name)}" aria-label="Set default concentration for ${escapeHtml(n.name)}">\n                    ${icon.waterDropLine()}\n                </button>\n            </div>\n        `),
                  e.appendChild(i));
          }))
        : (e.innerHTML = '<div class="plant-empty">No nutrients yet. Add some to start logging feeds.</div>');
}
function openAddNutrient() {
    ((document.getElementById("new-nutrient-name").value = ""), (document.getElementById("new-nutrient-conc").value = ""), (document.getElementById("add-nutrient-modal").style.display = "flex"), setTimeout(() => document.getElementById("new-nutrient-name").focus(), 50));
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
    a.some((e) => e.name === t) ? alert("A nutrient with that name already exists.") : (a.push({ name: t, defaultConcentration: n }), persist(), (document.getElementById("add-nutrient-modal").style.display = "none"), renderNutrientList(), renderAddForm(), renderAfterChange("stats"));
}
function cancelAddNutrient() {
    document.getElementById("add-nutrient-modal").style.display = "none";
}
function renameNutrient(t) {
    if (!activeCycle()) return;
    const e = cycleNutrients()[t].name;
    document.getElementById("rename-nutrient-input").value = e;
    const n = document.getElementById("rename-nutrient-modal");
    ((n.style.display = "flex"),
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
                      (t.style.display = "none"),
                      renderNutrientList(),
                      renderAddForm(),
                      renderAfterChange("log"),
                      renderAfterChange("stats"))
                : alert("Nutrient name can only contain letters, numbers, spaces, dashes, and underscores.")
            : (t.style.display = "none")
        : alert("Nutrient name can't be empty.");
}
function cancelRenameNutrient() {
    document.getElementById("rename-nutrient-modal").style.display = "none";
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
        renderAfterChange("stats"));
}
function editNutrientDefault(t) {
    if (!activeCycle()) return;
    const e = cycleNutrients()[t];
    if (!e) return;
    document.getElementById("edit-nutrient-default-name").textContent = e.name;
    const n = document.getElementById("edit-nutrient-default-input");
    n.value = null != e.defaultConcentration ? String(e.defaultConcentration) : "";
    const a = document.getElementById("edit-nutrient-default-modal");
    ((a.style.display = "flex"),
        (a._nutrientIndex = t),
        setTimeout(() => {
            (n.focus(), n.select());
        }, 50));
}
function confirmEditNutrientDefault() {
    const t = document.getElementById("edit-nutrient-default-modal");
    if (!activeCycle()) return;
    const e = cycleNutrients()[t._nutrientIndex];
    if (!e) return void (t.style.display = "none");
    const n = document.getElementById("edit-nutrient-default-input").value.trim();
    if ("" === n) e.defaultConcentration = null;
    else {
        const t = parseFloat(n);
        if (isNaN(t) || t < 0) return void alert("Concentration must be a non-negative number.");
        e.defaultConcentration = t;
    }
    (persist(), (t.style.display = "none"), renderNutrientList(), renderAddForm(), renderAfterChange("modal"));
}
function cancelEditNutrientDefault() {
    document.getElementById("edit-nutrient-default-modal").style.display = "none";
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
function renderPlantDetailModal(t, e) {
    const n = getPlantMeta(t, e),
        a = n.type,
        l = "auto" === a ? "AUTO" : "PHOTO",
        i = "auto" === a ? "plant-type-badge auto" : "plant-type-badge photo",
        s = t.nutrients || [],
        d = { nutrients: {}, concentrations: {}, concDate: {}, water: 0 };
    let c = null,
        r = null,
        o = null,
        u = null,
        p = 0,
        m = 0,
        y = 0,
        g = 0,
        f = 0,
        v = 0,
        b = 0,
        h = 0,
        E = 0;
    const I = Date.now() - 6048e5,
        w = [];
    (t.entries.forEach((t) => {
        new Date(t.dt).getTime() >= I && E++;
        const n = t.plants?.[e];
        if (n) {
            (Object.entries(n.nutrients || {}).forEach(([t, e]) => {
                d.nutrients[t] = (d.nutrients[t] || 0) + (e || 0);
            }),
                Object.entries(n.concentrations || {}).forEach(([e, n]) => {
                    n && (!d.concDate[e] || new Date(t.dt) > new Date(d.concDate[e])) && ((d.concentrations[e] = n), (d.concDate[e] = t.dt));
                }),
                (d.water += n.water || 0));
            const e = n.nutrients && Object.values(n.nutrients).some((t) => t && t > 0),
                a = n.water;
            (e && (p++, (!c || new Date(t.dt) > new Date(c)) && (c = t.dt), new Date(t.dt).getTime() >= I && f++), a && (m++, (!r || new Date(t.dt) > new Date(r)) && (r = t.dt), new Date(t.dt).getTime() >= I && v++));
        }
        (t.plantObs && t.plantObs[e] && t.plantObs[e].trim() && w.push({ dt: t.dt, text: t.plantObs[e] }),
            (t.actions || []).forEach((n) => {
                if (!n || ("lst" !== n.type && "def" !== n.type)) return;
                const a = n.plants || [];
                if (a.length > 0 && !a.includes(e)) return;
                const l = new Date(t.dt);
                "lst" === n.type ? (y++, (!o || l > new Date(o)) && (o = t.dt), l.getTime() >= I && b++) : (g++, (!u || l > new Date(u)) && (u = t.dt), l.getTime() >= I && h++);
            }));
    }),
        w.sort((t, e) => new Date(e.dt) - new Date(t.dt)));
    const A = {};
    s.forEach((n) => {
        let a = n.defaultConcentration ?? null,
            l = 0;
        const i = [...t.entries].sort((t, e) => new Date(t.dt) - new Date(e.dt));
        for (const t of i) {
            const i = t.plants?.[e];
            if (!i) continue;
            const s = i.nutrients?.[n.name],
                d = s && s > 0,
                c = i.concentrations?.[n.name] ?? null;
            (null != c && c !== a && ((a = c), (l = 0)), d && null != c && c === a && l++);
        }
        A[n.name] = l;
    });
    const C = n.repottedAt || t.startDate,
        P = C ? new Date(C) : new Date(t.startDate),
        k = Math.max(0, Math.floor((new Date() - P) / 864e5)),
        N = Math.max(1, Math.ceil(k / 7)),
        T = document.getElementById("plant-detail-name");
    if (((T.innerHTML = ""), isFavourite(t, e))) {
        const t = document.createElement("span");
        ((t.innerHTML = icon.star({ size: 14, marginRight: 6 })), T.appendChild(t.firstChild));
    }
    T.appendChild(document.createTextNode(e));
    const B = document.getElementById("plant-detail-type");
    ((B.className = i), (B.textContent = l));
    const L = new Date(),
        D = (t) => {
            const e = new Date(t),
                n = L - e,
                a = n < 0,
                l = Math.abs(n),
                i = Math.round(l / 6e4),
                s = Math.round(l / 36e5),
                d = Math.floor(l / 864e5);
            let c;
            if (i < 1) c = "just now";
            else if (i < 60) c = `${i} min${1 === i ? "" : "s"} ago`;
            else if (s < 24) c = `${s} hour${1 === s ? "" : "s"} ago`;
            else if (d < 30) c = `${d} day${1 === d ? "" : "s"} ago`;
            else {
                const t = Math.floor(d / 30);
                c = a ? `in ${t} mo` : `${t} mo ago`;
            }
            if (a) {
                return `in ${c.replace(/^in /, "").replace(/ ago$/, "")}`;
            }
            return c;
        },
        $ = (t, e = !1) => {
            if (!t) return "—";
            const n = fmtDate(t);
            return e ? `<span class="plant-detail-rel">${D(t)}</span> ${n}` : n;
        },
        S = P.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        O = 0 === w.length ? '<div class="plant-detail-empty">No plant-specific notes yet.</div>' : w.map((t) => `\n        <div class="plant-detail-obs">\n            <div class="plant-detail-obs-date">${$(t.dt)}</div>\n            <div class="plant-detail-obs-text">${escapeHtml(t.text)}</div>\n        </div>`).join(""),
        x = s
            .map((e) => {
                const n = getNutrientColor(t, e.name),
                    a = d.nutrients[e.name] || 0,
                    l = d.concentrations[e.name],
                    i = d.concDate[e.name],
                    s = null == l && null != e.defaultConcentration,
                    c = null != l ? l : (e.defaultConcentration ?? null),
                    r = i || (s ? t.startDate : null),
                    o = A[e.name] || 0;
                return ((t, e, n, a, l, i, s) =>
                    `\n        <div class="plant-detail-nutrient-block">\n            <div class="plant-detail-nutrient-name ${e}">${t}</div>\n            <div class="plant-detail-row">\n                <div class="plant-detail-label">Active dilution</div>\n                <div class="plant-detail-value">${null != a ? a + " ml/l" : "—"}</div>\n            </div>\n            <div class="plant-detail-row">\n                <div class="plant-detail-label">Used for</div>\n                <div class="plant-detail-value">${i} feed${1 === i ? "" : "s"}</div>\n            </div>\n            <div class="plant-detail-row">\n                <div class="plant-detail-label">Date</div>\n                <div class="plant-detail-value">${l ? `<span class="plant-detail-rel">${D(l)}</span> since ${fmtDate(l)}` : s ? '<span class="plant-detail-rel">since cycle start</span>' : "—"}</div>\n            </div>\n            <div class="plant-detail-row">\n                <div class="plant-detail-label">Cycle total</div>\n                <div class="plant-detail-value ${e}">${n.toFixed(1)} cup${1 === n ? "" : "s"}</div>\n            </div>\n        </div>`)(
                    e.name,
                    `nutrient--${n}`,
                    a,
                    c,
                    r,
                    o,
                    s
                );
            })
            .join(""),
        M = `\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Type</div>\n            <div class="plant-detail-value">${l}</div>\n        </div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Repotted</div>\n            <div class="plant-detail-value">${S}</div>\n        </div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Age (since repot)</div>\n            <div class="plant-detail-value"><span class="plant-detail-rel">${N} week${1 === N ? "" : "s"}</span> ${k} day${1 === k ? "" : "s"}</div>\n        </div>\n        <div class="plant-detail-divider"></div>\n        <div class="plant-detail-section-label">Cumulative nutrients &amp; water</div>\n        ${s.length > 0 ? `\n           <div class="plant-detail-row">\n               <div class="plant-detail-label">Total water</div>\n               <div class="plant-detail-value nutrient--water">${d.water.toFixed(1)} cup${1 === d.water ? "" : "s"}</div>\n           </div>\n           ${x}` : `<div class="plant-detail-row">\n               <div class="plant-detail-label">Total water</div>\n               <div class="plant-detail-value nutrient--water">${d.water.toFixed(1)} cup${1 === d.water ? "" : "s"}</div>\n           </div>\n           <div class="plant-detail-empty">No nutrients configured for this cycle. Add some via the Nutrient Manager to track per-nutrient stats.</div>`}\n        <div class="plant-detail-divider"></div>\n        <div class="plant-detail-section-label">Recount</div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Last fed</div>\n            <div class="plant-detail-value">${$(c, !0)}</div>\n        </div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Last watered</div>\n            <div class="plant-detail-value">${$(r, !0)}</div>\n        </div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Last LST'd</div>\n            <div class="plant-detail-value">${$(o, !0)}</div>\n        </div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Last defoliated</div>\n            <div class="plant-detail-value">${$(u, !0)}</div>\n        </div>\n        <div class="plant-detail-divider"></div>\n        <div class="plant-detail-section-label">Last 7 days</div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Times fed</div>\n            <div class="plant-detail-value${0 === f ? " plant-detail-value--muted" : ""}">${f}</div>\n        </div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Times watered</div>\n            <div class="plant-detail-value${0 === v ? " plant-detail-value--muted" : ""}">${v}</div>\n        </div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Times LST'd</div>\n            <div class="plant-detail-value${0 === b ? " plant-detail-value--muted" : ""}">${b}</div>\n        </div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Times defoliated</div>\n            <div class="plant-detail-value${0 === h ? " plant-detail-value--muted" : ""}">${h}</div>\n        </div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Log entries</div>\n            <div class="plant-detail-value${0 === E ? " plant-detail-value--muted" : ""}">${E}</div>\n        </div>\n        <div class="plant-detail-divider"></div>\n        <div class="plant-detail-section-label">Cycle recap</div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Feed sessions</div>\n            <div class="plant-detail-value">${p}</div>\n        </div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Water sessions</div>\n            <div class="plant-detail-value">${m}</div>\n        </div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Times LST'd</div>\n            <div class="plant-detail-value">${y}</div>\n        </div>\n        <div class="plant-detail-row">\n            <div class="plant-detail-label">Times defoliated</div>\n            <div class="plant-detail-value">${g}</div>\n        </div>\n        <div class="plant-detail-divider"></div>\n        <div class="plant-detail-section-label">Notes</div>\n        ${O}\n    `;
    ((document.getElementById("plant-detail-stats").innerHTML = M), (document.getElementById("plant-detail-modal").style.display = "flex"));
}
function closePlantDetail() {
    document.getElementById("plant-detail-modal").style.display = "none";
}
function newCycle() {
    const t = `Grow #${cycles.length + 1}`;
    ((document.getElementById("new-cycle-input").value = t), (document.getElementById("new-cycle-modal").style.display = "flex"), document.getElementById("new-cycle-input").select());
}
function confirmNewCycle() {
    const t = document.getElementById("new-cycle-input").value.trim() || `Grow #${cycles.length + 1}`;
    ((document.getElementById("new-cycle-modal").style.display = "none"), cycles.forEach((t) => collapsedCycles.add(t.id)), saveCollapsedCycles(collapsedCycles));
    const e = new Date(),
        n = (t) => String(t).padStart(2, "0"),
        a = `${e.getFullYear()}-${n(e.getMonth() + 1)}-${n(e.getDate())}`,
        l = { id: cycleUid(), name: t, startDate: a, plants: [], plantTypes: {}, entries: [], lightDefaults: {}, nutrients: [] };
    (cycles.push(l), (activeCycleId = l.id), persist(), saveActiveCycleId(activeCycleId), updateGrowAge(), renderAddForm(), syncHeaderActions(), resetAddForm(), setDateDefault(), showTab("log", !0), renderAfterChange("log"), renderAfterChange("stats"));
}
function cancelNewCycle() {
    document.getElementById("new-cycle-modal").style.display = "none";
}
function editCycleName(t, e) {
    const n = document.getElementById("rename-cycle-modal"),
        a = document.getElementById("rename-cycle-input");
    ((a.value = e), (n.style.display = "flex"), a.focus(), (n._cycleId = t), (n._currentName = e));
}
function cancelRenameCycle() {
    document.getElementById("rename-cycle-modal").style.display = "none";
}
function confirmRenameCycle() {
    const t = document.getElementById("rename-cycle-modal"),
        e = document.getElementById("rename-cycle-input").value.trim();
    if (!e) return void alert("Cycle name can't be empty.");
    if (e === t._currentName) return void (t.style.display = "none");
    const n = cycles.find((e) => e.id === t._cycleId);
    (n && ((n.name = e), persist(), renderAfterChange("log"), renderAfterChange("stats")), (t.style.display = "none"));
}
function setStatsCycle(t) {
    (setStatsMode("all" === t ? "all" : t), renderStats(cycles, activeCycleId));
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
    if (!e) return;
    (n && n.id !== activeCycleId && ((activeCycleId = n.id), saveActiveCycleId(activeCycleId), updateGrowAge(), renderAddForm(), updateLightStatus()),
        (draftState.editingEntryId = t),
        (document.getElementById("new-dt").value = e.dt),
        (nutrientDrafts = {}),
        Object.entries(e.plants || {}).forEach(([t, e]) => {
            nutrientDrafts[t] = { ...e };
        }),
        (nutrientActiveTab = "__ALL__"),
        writeNutrientInputs({}),
        document.querySelectorAll("#nutrient-plant-tabs .nutrient-tab").forEach((t) => {
            t.classList.toggle("active", "__ALL__" === t.dataset.tab);
        }));
    const a = e.actions || [];
    if (
        ((document.getElementById("ck-lst").checked = a.some((t) => t && "lst" === t.type)),
        (document.getElementById("ck-def").checked = a.some((t) => t && "def" === t.type)),
        (document.getElementById("ck-light").checked = a.some((t) => t && "light" === t.type)),
        (document.getElementById("ck-repot").checked = a.some((t) => t && "repot" === t.type)),
        document.getElementById("ck-lst").checked
            ? (restorePlants(
                  a.find((t) => "lst" === t.type),
                  ".lst-plant",
                  ".lst-plant-all",
                  !0
              ),
              (document.getElementById("lst-plants").style.display = "block"))
            : (document.getElementById("lst-plants").style.display = "none"),
        document.getElementById("ck-def").checked
            ? (restorePlants(
                  a.find((t) => "def" === t.type),
                  ".def-plant",
                  ".def-plant-all",
                  !1
              ),
              (document.getElementById("def-plants").style.display = "block"))
            : (document.getElementById("def-plants").style.display = "none"),
        document.getElementById("ck-repot").checked
            ? (restorePlants(
                  a.find((t) => "repot" === t.type),
                  ".repot-plant",
                  ".repot-plant-all",
                  !1
              ),
              (document.getElementById("repot-plants").style.display = "block"))
            : (document.getElementById("repot-plants").style.display = "none"),
        document.getElementById("ck-light").checked)
    ) {
        const t = a.find((t) => "light" === t.type);
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
        resetPlantNotesDraft(i),
        showTab("add"));
}
function saveEntry() {
    const t = document.getElementById("new-dt").value;
    if (!t) return void alert("Set a date and time.");
    const e = activeCycle(),
        n = [...cyclePlants()].sort((t, n) => (isFavourite(e, t) ? 0 : 1) - (isFavourite(e, n) ? 0 : 1)),
        a = [];
    if (document.getElementById("ck-lst").checked) {
        const t = [...document.querySelectorAll(".lst-plant:checked")].map((t) => t.value);
        a.push({ type: "lst", plants: t });
    }
    if (document.getElementById("ck-def").checked) {
        const t = [...document.querySelectorAll(".def-plant:checked")].map((t) => t.value);
        a.push({ type: "def", plants: t });
    }
    if (document.getElementById("ck-light").checked) {
        const t = document.getElementById("light-lux").value,
            e = document.getElementById("light-dist").value,
            n = document.getElementById("light-start").value,
            l = document.getElementById("light-end").value;
        a.push({ type: "light", lux: t, dist: e, start: n, end: l });
    }
    if (document.getElementById("ck-repot").checked) {
        const n = [...document.querySelectorAll(".repot-plant:checked")].map((t) => t.value);
        a.push({ type: "repot", plants: n });
        const l = t.slice(0, 10);
        n.forEach((t) => {
            e.plantTypes[t] && "object" == typeof e.plantTypes[t] ? (e.plantTypes[t].repottedAt = l) : (e.plantTypes[t] = { type: "auto", repottedAt: l });
        });
    }
    const l = readNutrientInputs();
    ((l.nutrients && Object.keys(l.nutrients).length > 0) || (l.concentrations && Object.keys(l.concentrations).length > 0) || null != l.water) && (nutrientDrafts[nutrientActiveTab] = mergeDrafts(nutrientDrafts[nutrientActiveTab], l));
    const i = {},
        s = nutrientDrafts.__ALL__ || {};
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
        (null != d && "" !== d && (n.water = d), Object.keys(n).length > 0 && (i[t] = n));
    });
    const d = new Set(cyclePlants()),
        c = {};
    draftState.pendingPlantObs.forEach((t) => {
        t.plant && d.has(t.plant) && t.text && t.text.trim() && (c[t.plant] = t.text.trim());
    });
    const r = document.getElementById("new-obs").value.trim();
    if (draftState.editingEntryId) {
        const n = e.entries.find((t) => t.id === draftState.editingEntryId);
        if (!n) return void alert("Couldn't find the entry to update. Please try editing it again.");
        ((n.dt = t), (n.plants = i), (n.actions = a), (n.obs = r || void 0), (n.plantObs = Object.keys(c).length ? c : {}), resetDraft());
    } else e.entries.unshift({ id: uid(), dt: t, plants: i, actions: a, obs: r || void 0, plantObs: Object.keys(c).length ? c : {} });
    (persist(), resetAddForm(), showTab("log", !0), renderAfterChange("log"), renderAfterChange("stats"));
}
function cancelEdit() {
    (resetDraft(), resetAddForm(), setDateDefault(), showTab("log", !0));
}
function duplicateEntry(t) {
    for (const e of cycles) {
        const n = e.entries.find((e) => e.id === t);
        if (n) {
            const t = JSON.parse(JSON.stringify(n));
            return ((t.id = uid()), e.entries.unshift(t), persist(), renderAfterChange("log"), void renderAfterChange("stats"));
        }
    }
}
function deleteEntry(t) {
    confirm("Delete this entry?") &&
        (cycles.forEach((e) => {
            e.entries = e.entries.filter((e) => e.id !== t);
        }),
        persist(),
        renderAfterChange("log"),
        renderAfterChange("stats"));
}
function deleteCycle(t) {
    const e = cycles.find((e) => e.id === t);
    e && confirm(`Delete "${e.name}" and all its entries? This cannot be undone.`) && ((cycles = cycles.filter((e) => e.id !== t)), activeCycleId === t && ((activeCycleId = cycles.length ? cycles[cycles.length - 1].id : null), saveActiveCycleId(activeCycleId)), persist(), updateGrowAge(), renderAddForm(), renderAfterChange("log"), renderAfterChange("stats"));
}
function exportBackup() {
    const t = JSON.stringify(cycles, null, 2),
        e = new Blob([t], { type: "application/json" }),
        n = URL.createObjectURL(e),
        a = document.createElement("a"),
        l = new Date().toISOString().slice(0, 10);
    ((a.href = n), (a.download = `rootine-backup-${l}.json`), a.click(), URL.revokeObjectURL(n));
}
function importBackup(t) {
    const e = t.target.files[0];
    if (!e) return;
    const n = new FileReader();
    ((n.onload = (e) => {
        const n = e.target.result;
        let a;
        try {
            a = JSON.parse(n);
        } catch {
            return (alert("Invalid backup file."), void (t.target.value = ""));
        }
        if (!isValidCyclesShape(a)) return (alert("Invalid backup file."), void (t.target.value = ""));
        confirm(`Import ${a.length} cycle(s)? This will replace all current data.`) ? (localStorage.setItem("grow_cycles", JSON.stringify(a)), localStorage.removeItem("grow_version"), location.reload()) : (t.target.value = "");
    }),
        n.readAsText(e));
}
function triggerImport() {
    document.getElementById("import-backup-input").click();
}
function refreshOpenPlantDetail() {
    const t = document.getElementById("plant-detail-modal");
    if (!t || "none" === t.style.display) return;
    const e = document.getElementById("plant-detail-name").textContent;
    if (!e) return;
    const n = cycles.find((t) => t.plants && t.plants.includes(e));
    n && renderPlantDetailModal(n, e);
}
function renderAfterChange(t) {
    (("log" !== t && "all" !== t) || renderLog(cycles, activeCycleId), ("stats" !== t && "all" !== t) || renderStats(cycles, activeCycleId), ("modal" !== t && "all" !== t) || refreshOpenPlantDetail(), "all" === t && updateLightStatus());
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
    updateGrowAge(),
    setDateDefault(),
    _loadLightDefaults(),
    renderAddForm(),
    setInterval(updateLightStatus, 6e4),
    window.addEventListener("focus", updateLightStatus),
    document.addEventListener("visibilitychange", () => {
        document.hidden || updateLightStatus();
    }));
try {
    renderAfterChange("all");
} catch (t) {}
registerServiceWorker();
