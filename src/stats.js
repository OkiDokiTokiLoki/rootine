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
function computeStats(t) {
    let e = 0,
        s = 0,
        n = 0;
    const a = new Set(),
        l = [];
    return (
        t.forEach((t) => {
            const o = Object.values(t.plants || {});
            (o.some((t) => !(!t || !t.nutrients) && Object.values(t.nutrients).some((t) => t && t > 0)) && e++, o.some((t) => t && t.water > 0) && s++, t.obs && (n++, l.push(t)), a.add(t.dt.slice(0, 10)));
        }),
        { feeds: e, waters: s, issues: n, days: a, obsEntries: l }
    );
}
function countPlantNotes(t, e) {
    let s = 0;
    return (
        (t.entries || []).forEach((t) => {
            const n = t.plantObs?.[e];
            n && String(n).trim() && s++;
        }),
        s
    );
}
function renderPlantCard(t, e, s, n, a, l) {
    const o = n ? icon.star({ size: 12 }) : "",
        i = "auto" === s ? "AUTO" : "PHOTO",
        c = "auto" === s ? "plant-type-badge auto" : "plant-type-badge photo",
        d = ((l && l.nutrients) || [])
            .map((t) => {
                const s = (e.nutrients || {})[t.name] || 0;
                if (s <= 0) return "";
                return `<span class="nutrient-totals__item nutrient--${getNutrientColor(l, t.name)}" title="${escapeHtml(t.name)}">${escapeHtml(abbrevNutrient(t.name))} ${fmtQty(s)}</span>`;
            })
            .join(""),
        r = `<span class="nutrient-totals__item nutrient--water" title="Water">W ${fmtQty(e.water || 0)}</span>`;
    return `\n    <div class="plant-stat-row plant-stat-row-clickable" data-action="openPlantDetail" data-id="${escapeHtml(t)}">\n        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">\n            <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t)}</span>\n            ${o}\n            <span class="${c}" style="font-size:10px;padding:2px 6px">${i}</span>\n        </div>\n        <span class="nutrient-totals">\n            ${d}\n            ${r}\n        </span>\n    </div>`;
}
on("openPlantDetail", "click", (t) => openPlantDetail(t.dataset.id));
export function renderStats(t, e) {
    const s = `\n    <div class="stats-cycle-toggle${t.length + 1 > 0 ? " stats-cycle-toggle--scroll" : ""}">\n      ${t.map((t) => `\n        <button\n          class="stats-cycle-btn${statsMode === t.id || ("active" === statsMode && t.id === e) ? " active" : ""}"\n          data-action="setStatsCycle"\n          data-id="${escapeHtml(t.id)}"\n        >${escapeHtml(t.name)}</button>\n      `).join("")}\n      <button class="stats-cycle-btn${"all" === statsMode ? " active" : ""}" data-action="setStatsCycle" data-id="all">All cycles</button>\n    </div>`;
    let n;
    if ("all" === statsMode) n = [...t].sort((t, e) => new Date(e.startDate) - new Date(t.startDate));
    else {
        const s = "active" === statsMode ? e : statsMode,
            a = t.find((t) => t.id === s) || t.find((t) => t.id === e);
        n = a ? [a] : [];
    }
    const a = n.flatMap((t) => t.entries),
        l = "all" === statsMode ? null : n[0]?.startDate || null,
        { feeds: o, waters: i, issues: c, days: d, obsEntries: r } = computeStats(a);
    ((document.getElementById("s-feeds").textContent = o), (document.getElementById("s-waters").textContent = i), (document.getElementById("s-days").textContent = d.size), (document.getElementById("s-issues").textContent = c), (document.getElementById("stats-cycle-toggle-container").innerHTML = s));
    let p = "";
    (n.forEach((t) => {
        const s = (() => {
                const e = {};
                return (
                    t.entries.forEach((t) => {
                        Object.entries(t.plants || {}).forEach(([t, s]) => {
                            (e[t] || (e[t] = { nutrients: {}, water: 0 }),
                                Object.entries(s.nutrients || {}).forEach(([s, n]) => {
                                    e[t].nutrients[s] = (e[t].nutrients[s] || 0) + (n || 0);
                                }),
                                (e[t].water += s.water || 0));
                        });
                    }),
                    e
                );
            })(),
            n = t.plants || [],
            a = "all" === statsMode,
            l = t.id === e ? '<span class="cycle-active-badge">Active</span>' : "",
            o = a ? ' style="margin-bottom: 14px"' : "";
        if (0 === n.length) return ((p += `<div class="stats-cycle-block"${o}>`), a && (p += `<div class="stats-cycle-block-label"><span>${escapeHtml(t.name)}</span>${l}</div>`), (p += '<div style="color:var(--muted);font-size:13px">No plants in this cycle yet.</div>'), void (p += "</div>"));
        const i = new Set(t.favourites || []),
            c = [...n].sort((t, e) => (i.has(t) ? 0 : 1) - (i.has(e) ? 0 : 1));
        ((p += `<div class="stats-cycle-block"${o}>`),
            a && (p += `<div class="stats-cycle-block-label"><span>${escapeHtml(t.name)}</span>${l}</div>`),
            c.forEach((e) => {
                const n = getPlantMeta(t, e),
                    a = s[e] || { nutrients: {}, water: 0 },
                    l = countPlantNotes(t, e);
                p += renderPlantCard(e, a, n.type, i.has(e), l, t);
            }),
            (p += "</div>"));
    }),
        n.length || (p = '<div style="color:var(--muted);font-size:13px">No cycles to show.</div>'),
        (document.getElementById("stats-plants").innerHTML = p),
        r.sort((t, e) => new Date(e.dt) - new Date(t.dt)));
    let m = "";
    (r.forEach((t) => {
        const e = l ? `· Week ${getWeekNum(t.dt, l)}` : "";
        m += `<div class="obs-entry">\n      <div class="obs-entry-date">${fmtDate(t.dt)} · ${fmtTime(t.dt)} ${e}</div>\n      <div class="obs-entry-text">${escapeHtml(t.obs)}</div>\n    </div>`;
    }),
        (document.getElementById("obs-list").innerHTML = m || '<div class="empty" style="padding:20px 0">No observations logged yet.</div>'));
}
