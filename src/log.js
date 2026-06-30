import { fmtDate, fmtTime, getWeekNum, escapeHtml, getNutrientColor, fmtQty, formatAction, someValue, cycleStageBadge } from "./utils.js";
import { saveCollapsedWeeks, saveCollapsedCycles } from "./storage.js";
import { on } from "./actions.js";
import { icon } from "./icons.js";
let collapsedWeeks, collapsedCycles;
export function initLog(e, t) {
    ((collapsedWeeks = e), (collapsedCycles = t));
}
function weekKey(e, t) {
    return `${e}--${t}`;
}
(on("toggleWeek", "click", (e) => toggleWeek(e.dataset.id, Number(e.dataset.week))), on("toggleCycle", "click", (e) => toggleCycle(e.dataset.id)), on("toggleEntry", "click", (e) => toggleEntry(e.dataset.id)));
export function toggleWeek(e, t) {
    const s = weekKey(e, t);
    (collapsedWeeks.has(s) ? collapsedWeeks.delete(s) : collapsedWeeks.add(s), saveCollapsedWeeks(collapsedWeeks), document.getElementById("week-entries-" + s).classList.toggle("collapsed", collapsedWeeks.has(s)), document.getElementById("week-chev-" + s).classList.toggle("collapsed", collapsedWeeks.has(s)));
}
export function toggleCycle(e) {
    (collapsedCycles.has(e) ? collapsedCycles.delete(e) : collapsedCycles.add(e), saveCollapsedCycles(collapsedCycles), document.getElementById("cycle-entries-" + e).classList.toggle("collapsed", collapsedCycles.has(e)), document.getElementById("cycle-chev-" + e).classList.toggle("collapsed", collapsedCycles.has(e)), document.getElementById("cycle-header-" + e).classList.toggle("collapsed", collapsedCycles.has(e)));
}
export function toggleEntry(e) {
    (document.getElementById("body-" + e).classList.toggle("open"), document.getElementById("chev-" + e).classList.toggle("open"), document.getElementById("card-" + e).classList.toggle("open"));
}
function renderEntriesForCycle(e) {
    const t = [...e.entries].sort((e, t) => new Date(t.dt) - new Date(e.dt));
    let s = "",
        a = null;
    return (
        t.forEach((t) => {
            const n = getWeekNum(t.dt, e.startDate),
                l = weekKey(e.id, n);
            if (n !== a) {
                null !== a && (s += "</div>");
                const t = collapsedWeeks.has(l);
                ((s += `\n            <div class="week-header" data-action="toggleWeek" data-id="${escapeHtml(e.id)}" data-week="${n}">\n                <span>Week ${n}</span>\n                ${icon.chevronDown({ className: "week-chevron" + (t ? " collapsed" : ""), id: `week-chev-${l}`, style: "margin-left:5px" })}\n            </div>\n            <div class="week-entries${t ? " collapsed" : ""}" id="week-entries-${l}">`), (a = n));
            }
            s += renderEntryCard(t, e);
        }),
        null !== a && (s += "</div>"),
        s || '<div class="empty" style="padding:20px 0">No entries yet. <span data-action="showTab" data-id="add" style="color:var(--green);cursor:pointer;text-decoration:underline">Change that.</span></div>'
    );
}
function hasPlantObs(e) {
    return someValue(e.plantObs, (v) => v && String(v).trim());
}
function renderEntryCard(e, t) {
    const s = Object.values(e.plants || {}),
        a = s.some((p) => p && someValue(p.nutrients, (v) => v && v > 0)),
        n = s.some((p) => p && p.water > 0),
        l = (e.actions || []).some((a) => a && a.type === "light"),
        c = (e.actions || []).some((a) => a && (a.type === "lst" || a.type === "def" || a.type === "repot")),
        i = !!e.obs?.trim() || hasPlantObs(e);
    let d = "";
    (a && (d += `<span class="badge badge-feed"    style="margin-left:0">${icon.badgeFeed()}</span>`), n && (d += `<span class="badge badge-water"   style="margin-left:0">${icon.badgeWater()}</span>`), l && (d += `<span class="badge badge-light"   style="margin-left:0;">${icon.badgeLight()}</span>`), c && (d += `<span class="badge badge-scissors" style="margin-left:0;">${icon.badgeScissors()}</span>`), i && (d += `<span class="badge badge-note"    style="margin-left:0;" title="Has observation">${icon.badgeNote()}</span>`));
    const o = Object.entries(e.plants || {});
    let r = "";
    return (
        o.length &&
            ((r += "<div>"),
            o.forEach(([e, s]) => {
                let a = "";
                ((t?.nutrients || []).forEach((e) => {
                    const n = s.nutrients?.[e.name];
                    if (n && n > 0) {
                        const s = getNutrientColor(t, e.name);
                        a += `<span class="pill pill--${s}">${escapeHtml(e.name)} - ${fmtQty(n)} cup${1 === n ? "" : "s"}</span>`;
                    }
                }),
                    s.water && (a += `<span class="pill pill-water">Water - ${fmtQty(s.water)} cup${1 === s.water ? "" : "s"}</span>`),
                    (r += `<div class="plant-row"><span class="pname">${escapeHtml(e)}</span><div class="pills">${a || "—"}</div></div>`));
            }),
            (r += "</div>")),
        e.actions && e.actions.length && (r += '<div class="action-list">' + e.actions.map((e) => `<span class="action-tag">${formatAction(e)}</span>`).join("") + "</div>"),
        e.obs && (r += `<div class="obs-box">${escapeHtml(e.obs)}</div>`),
        hasPlantObs(e) &&
            Object.entries(e.plantObs).forEach(([e, t]) => {
                t && t.trim() && (r += `<div class="obs-box obs-box-plant"><div class="obs-box-plant-name">${escapeHtml(e)}</div><div>${escapeHtml(t)}</div></div>`);
            }),
        `\n    <div class="entry-card" id="card-${escapeHtml(e.id)}">\n      <div class="entry-header" data-action="toggleEntry" data-id="${escapeHtml(e.id)}">\n        <div>\n          <div class="entry-date">${fmtDate(e.dt)}</div>\n          <div class="entry-time">${fmtTime(e.dt)}</div>\n        </div>\n        <div style="display:flex;gap:6px">\n            <button class="settings-btn blue-btn" data-action="editEntry" data-id="${escapeHtml(e.id)}" title="Edit entry">${icon.edit()}</button>\n            <button class="settings-btn red-btn" data-action="deleteEntry" data-id="${escapeHtml(e.id)}" title="Delete entry">${icon.trash()}</button>\n            <button class="settings-btn green-btn" data-action="duplicateEntry" data-id="${escapeHtml(e.id)}" title="Duplicate entry">${icon.duplicate()}</button>\n        </div>\n        <span style="display:flex;align-items:center;gap:6px;margin-left:auto">${d}</span>\n        ${icon.chevronDown({ id: `chev-${escapeHtml(e.id)}` })}\n      </div>\n      <div class="entry-body" id="body-${escapeHtml(e.id)}">${r}</div>\n    </div>`
    );
}
export function renderLog(e, t) {
    const s = [...e].sort((e, t) => new Date(t.startDate) - new Date(e.startDate));
    let a = "";
    s.forEach((e, s) => {
        const n = e.id === t,
            l = collapsedCycles.has(e.id),
            c = new Date(e.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
            stageBadge = cycleStageBadge(e.stage),
            activeDot = n ? '<span class="cycle-active-dot" title="Active cycle"></span>' : "",
            i = `${activeDot}${stageBadge}`;
        a += `
        <div class="cycle-block">
            <div class="cycle-header${l ? " collapsed" : ""}"
                 id="cycle-header-${escapeHtml(e.id)}"
                 data-action="toggleCycle"
                 data-id="${escapeHtml(e.id)}">
                <div class="cycle-header-left">
                    <span class="cycle-name">${escapeHtml(e.name)}</span>
                    <span class="cycle-start">${c}</span>
        ${i}
        </div>
                ${icon.chevronDown({ className: "week-chevron" + (l ? " collapsed" : ""), id: `cycle-chev-${escapeHtml(e.id)}`, style: "width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round" })}
            </div>
            <div class="cycle-entries${l ? " collapsed" : ""}" id="cycle-entries-${escapeHtml(e.id)}">
                ${renderEntriesForCycle(e)}
            </div>
        </div>`;
    });
    a || (a = '<div class="empty">No entries yet. Tap <span data-action="newCycle" style="color:var(--green);cursor:pointer;text-decoration:underline">Add</span> to start logging.</div>');
    document.getElementById("log-list").innerHTML = a;
}
