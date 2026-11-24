import { fmtDate, fmtTime, getWeekNum, entryType, escapeHtml, getPlantMeta, getNutrientColor, abbrevNutrient, fmtQty, renderCycleSelector } from "./utils.js";
import { saveCollapsedObs } from "./storage.js";
import { on } from "./actions.js";
import { icon } from "./icons.js";
import { PLANT_TYPE, PLANT_TYPE_DEFINITIONS, STATS_MODE, CYCLE_STAGE, CYCLE_STAGE_DEFINITIONS } from "./constants.js";
let statsMode = STATS_MODE.ACTIVE;
export function initStats(t) {
    statsMode = t || STATS_MODE.ACTIVE;
}
export function setStatsMode(t) {
    statsMode = t;
}
export function getStatsMode() {
    return statsMode;
}
let collapsedObs = !1;
export function initObsCollapsed(t) {
    ((collapsedObs = !!t), applyObsCollapsedClasses());
}
export function toggleObs() {
    ((collapsedObs = !collapsedObs), saveCollapsedObs(collapsedObs), applyObsCollapsedClasses());
}
function applyObsCollapsedClasses() {
    const t = document.getElementById("obs-list"),
        e = document.getElementById("obs-chev"),
        s = document.getElementById("obs-section-header");
    (t && t.classList.toggle("collapsed", collapsedObs), e && e.classList.toggle("collapsed", collapsedObs), s && s.classList.toggle("collapsed", collapsedObs));
}
function computeStatsOnce(t) {
    const e = { feeds: 0, waters: 0, issues: 0, days: new Set(), obsEntries: [] },
        s = [];
    return (
        t.forEach((cycle) => {
            const a = {},
                allowedPlants = new Set(cycle.plants || []),
                allowedNutrients = new Set((cycle.nutrients || []).map((nutrient) => nutrient.name));
            ((cycle.entries || []).forEach((entry) => {
                const plantEntries = Object.entries(entry.plants || {}).filter(([plant]) => allowedPlants.has(plant)),
                    plantData = plantEntries.map(([, data]) => data),
                    n = plantData.some((data) => data?.nutrients && Object.entries(data.nutrients).some(([name, value]) => allowedNutrients.has(name) && value > 0)),
                    l = plantData.some((data) => data && data.water > 0);
                (n && e.feeds++,
                    l && e.waters++,
                    entry.obs && (e.issues++, e.obsEntries.push(entry)),
                    e.days.add(entry.dt.slice(0, 10)),
                    plantEntries.forEach(([plant, data]) => {
                        const totals = a[plant] || (a[plant] = { nutrients: {}, water: 0 });
                        (Object.entries(data.nutrients || {}).forEach(([name, value]) => {
                            if (allowedNutrients.has(name)) totals.nutrients[name] = (totals.nutrients[name] || 0) + (value || 0);
                        }),
                            (totals.water += data.water || 0));
                    }));
            }),
                s.push({ plantTotals: a }));
        }),
        { global: e, perCycle: s }
    );
}
function countPlantNotes(t, e) {
    let s = 0;
    return (
        (t.entries || []).forEach((t) => {
            const a = t.plantObs?.[e];
            a && String(a).trim() && s++;
        }),
        s
    );
}
function renderPlantCard(t, e, s, a, n, l) {
    const typeDefinition = PLANT_TYPE_DEFINITIONS[s] || PLANT_TYPE_DEFINITIONS[PLANT_TYPE.AUTO],
        o = a ? icon.star({ size: 12 }) : "",
        c = typeDefinition.label,
        i = `plant-type-badge ${typeDefinition.className}`,
        d = ((l && l.nutrients) || [])
            .map((t) => {
                const s = (e.nutrients || {})[t.name] || 0;
                return s <= 0 ? "" : `<span class="nutrient-totals__item nutrient--${getNutrientColor(l, t.name)}" title="${escapeHtml(t.name)}">${escapeHtml(abbrevNutrient(t.name))} ${fmtQty(s)}</span>`;
            })
            .join(""),
        yieldTotal = l && CYCLE_STAGE_DEFINITIONS[l.stage || CYCLE_STAGE.GROW]?.showsYield ? (l.entries || []).reduce((sum, ent) => sum + (ent.plants?.[t]?.yieldGrams || 0), 0) : 0,
        y = yieldTotal > 0 ? `<span class="nutrient-totals__item nutrient--amber" title="Yield">Y ${fmtQty(yieldTotal)}g</span>` : "",
        r = `<span class="nutrient-totals__item nutrient--water" title="Water">W ${fmtQty(e.water || 0)}</span>`;
    return `
    <div class="plant-stat-row plant-stat-row-clickable" data-action="openPlantDetail" data-id="${escapeHtml(t)}" data-cycle-id="${escapeHtml(l?.id || "")}">
        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
            <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t)}</span>
            ${o}
            <span class="${i}" style="font-size:10px;padding:2px 6px">${c}</span>
        </div>
        <span class="nutrient-totals">
            ${d}
            ${y}
            ${r}
        </span>
    </div>`;
}

on("openPlantDetail", "click", (t) => openPlantDetail(t.dataset.id, t.dataset.cycleId));
export function renderStats(t, e) {
    const selectedStatsId = STATS_MODE.ACTIVE === statsMode ? e : statsMode,
        s = renderCycleSelector(t, { selectedId: selectedStatsId, action: "setStatsCycle", includeAll: true, allId: STATS_MODE.ALL });
    let a;
    if (STATS_MODE.ALL === statsMode) a = [...t].sort((t, e) => new Date(e.startDate) - new Date(t.startDate));
    else {
        const s = STATS_MODE.ACTIVE === statsMode ? e : statsMode,
            n = t.find((t) => t.id === s) || t.find((t) => t.id === e);
        a = n ? [n] : [];
    }
    const { global: n, perCycle: l } = computeStatsOnce(a),
        o = STATS_MODE.ALL === statsMode ? null : a[0]?.startDate || null;
    ((document.getElementById("s-feeds").textContent = n.feeds), (document.getElementById("s-waters").textContent = n.waters), (document.getElementById("s-days").textContent = n.days.size), (document.getElementById("s-issues").textContent = n.issues), (document.getElementById("stats-cycle-toggle-container").innerHTML = s));
    let c = "";
    (a.forEach((t, s) => {
        const a = l[s].plantTotals,
            n = t.plants || [],
            o = STATS_MODE.ALL === statsMode,
            d = o ? ' style="margin-bottom: 14px"' : "";
        if (0 === n.length) return ((c += `<div class="stats-cycle-block"${d}>`), o && (c += `<div class="stats-cycle-block-label"><span>${escapeHtml(t.name)}</span></div>`), (c += '<div style="color:var(--muted);font-size:13px">No plants in this cycle yet.</div>'), void (c += "</div>"));
        const r = new Set(t.favourites || []),
            p = [...n].sort((t, e) => (r.has(t) ? 0 : 1) - (r.has(e) ? 0 : 1));
        ((c += `<div class="stats-cycle-block"${d}>`),
            o && (c += `<div class="stats-cycle-block-label"><span>${escapeHtml(t.name)}</span></div>`),
            p.forEach((e) => {
                const s = getPlantMeta(t, e),
                    n = a[e] || { nutrients: {}, water: 0 },
                    l = countPlantNotes(t, e);
                c += renderPlantCard(e, n, s.type, r.has(e), l, t);
            }),
            (c += "</div>"));
    }),
        a.length || (c = '<div style="color:var(--muted);font-size:13px">No cycles to show.</div>'),
        (document.getElementById("stats-plants").innerHTML = c));
    const i = n.obsEntries;
    i.sort((t, e) => new Date(e.dt) - new Date(t.dt));
    let d = "";
    (i.forEach((t) => {
        const e = o ? `· Week ${getWeekNum(t.dt, o)}` : "";
        d += `<div class="obs-entry">
      <div class="obs-entry-date">${fmtDate(t.dt)} · ${fmtTime(t.dt)} ${e}</div>
      <div class="obs-entry-text">${escapeHtml(t.obs)}</div>
    </div>`;
    }),
        (document.getElementById("obs-list").innerHTML = d || '<div class="empty" style="padding:20px 0">No observations logged yet.</div>'));
}
