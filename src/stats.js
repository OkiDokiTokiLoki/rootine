import { fmtDate, fmtTime, getWeekNum, entryType, escapeHtml, getPlantMeta, getNutrientColor, abbrevNutrient, fmtQty } from "./utils.js";
import { saveCollapsedObs } from "./storage.js";
import { on } from "./actions.js";
import { icon } from "./icons.js";
let statsMode = "active";
export function initStats(t) {
    statsMode = t || "active";
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
        t.forEach((t) => {
            const a = {};
            ((t.entries || []).forEach((t) => {
                const s = Object.values(t.plants || {}),
                    n = s.some((t) => t && t.nutrients && Object.values(t.nutrients).some((t) => t && t > 0)),
                    l = s.some((t) => t && t.water > 0);
                (n && e.feeds++,
                    l && e.waters++,
                    t.obs && (e.issues++, e.obsEntries.push(t)),
                    e.days.add(t.dt.slice(0, 10)),
                    Object.entries(t.plants || {}).forEach(([t, e]) => {
                        const s = a[t] || (a[t] = { nutrients: {}, water: 0 });
                        (Object.entries(e.nutrients || {}).forEach(([t, e]) => {
                            s.nutrients[t] = (s.nutrients[t] || 0) + (e || 0);
                        }),
                            (s.water += e.water || 0));
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
    const o = a ? icon.star({ size: 12 }) : "",
        c = "auto" === s ? "AUTO" : "PHOTO",
        i = "auto" === s ? "plant-type-badge auto" : "plant-type-badge photo",
        d = ((l && l.nutrients) || [])
            .map((t) => {
                const s = (e.nutrients || {})[t.name] || 0;
                return s <= 0 ? "" : `<span class="nutrient-totals__item nutrient--${getNutrientColor(l, t.name)}" title="${escapeHtml(t.name)}">${escapeHtml(abbrevNutrient(t.name))} ${fmtQty(s)}</span>`;
            })
            .join(""),
        r = `<span class="nutrient-totals__item nutrient--water" title="Water">W ${fmtQty(e.water || 0)}</span>`;
    return `\n    <div class="plant-stat-row plant-stat-row-clickable" data-action="openPlantDetail" data-id="${escapeHtml(t)}">\n        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">\n            <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t)}</span>\n            ${o}\n            <span class="${i}" style="font-size:10px;padding:2px 6px">${c}</span>\n        </div>\n        <span class="nutrient-totals">\n            ${d}\n            ${r}\n        </span>\n    </div>`;
}
on("openPlantDetail", "click", (t) => openPlantDetail(t.dataset.id));
export function renderStats(t, e) {
    const s = `\n    <div class="stats-cycle-toggle${t.length + 1 > 0 ? " stats-cycle-toggle--scroll" : ""}">\n      ${t.map((t) => `\n        <button\n          class="stats-cycle-btn${statsMode === t.id || ("active" === statsMode && t.id === e) ? " active" : ""}"\n          data-action="setStatsCycle"\n          data-id="${escapeHtml(t.id)}"\n        >${escapeHtml(t.name)}</button>\n      `).join("")}\n      <button class="stats-cycle-btn${"all" === statsMode ? " active" : ""}" data-action="setStatsCycle" data-id="all">All cycles</button>\n    </div>`;
    let a;
    if ("all" === statsMode) a = [...t].sort((t, e) => new Date(e.startDate) - new Date(t.startDate));
    else {
        const s = "active" === statsMode ? e : statsMode,
            n = t.find((t) => t.id === s) || t.find((t) => t.id === e);
        a = n ? [n] : [];
    }
    const { global: n, perCycle: l } = computeStatsOnce(a),
        o = "all" === statsMode ? null : a[0]?.startDate || null;
    ((document.getElementById("s-feeds").textContent = n.feeds), (document.getElementById("s-waters").textContent = n.waters), (document.getElementById("s-days").textContent = n.days.size), (document.getElementById("s-issues").textContent = n.issues), (document.getElementById("stats-cycle-toggle-container").innerHTML = s));
    let c = "";
    (a.forEach((t, s) => {
        const a = l[s].plantTotals,
            n = t.plants || [],
            o = "all" === statsMode,
            i = t.id === e ? '<span class="cycle-active-badge">Active</span>' : "",
            d = o ? ' style="margin-bottom: 14px"' : "";
        if (0 === n.length) return ((c += `<div class="stats-cycle-block"${d}>`), o && (c += `<div class="stats-cycle-block-label"><span>${escapeHtml(t.name)}</span>${i}</div>`), (c += '<div style="color:var(--muted);font-size:13px">No plants in this cycle yet.</div>'), void (c += "</div>"));
        const r = new Set(t.favourites || []),
            p = [...n].sort((t, e) => (r.has(t) ? 0 : 1) - (r.has(e) ? 0 : 1));
        ((c += `<div class="stats-cycle-block"${d}>`),
            o && (c += `<div class="stats-cycle-block-label"><span>${escapeHtml(t.name)}</span>${i}</div>`),
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
        d += `<div class="obs-entry">\n      <div class="obs-entry-date">${fmtDate(t.dt)} · ${fmtTime(t.dt)} ${e}</div>\n      <div class="obs-entry-text">${escapeHtml(t.obs)}</div>\n    </div>`;
    }),
        (document.getElementById("obs-list").innerHTML = d || '<div class="empty" style="padding:20px 0">No observations logged yet.</div>'));
}
