import { fmtDate, fmtTime, getWeekNum, escapeHtml, getNutrientColor, fmtQty, formatAction, someValue, cycleStageBadge, renderCycleSelector } from "./utils.js";
import { saveCollapsedWeeks, saveCollapsedCycles } from "./storage.js";
import { on } from "./actions.js";
import { icon } from "./icons.js";
import { ACTION_BY_TYPE, ACTION_TYPE, PLANT_ACTION_TYPES } from "./constants.js";
let collapsedWeeks, collapsedCycles;
let logCycleId = null,
    lastActiveId = null,
    lastCycles = [];
export function getLogCycleId() {
    return logCycleId;
}
function selectLogCycle(id) {
    const changed = logCycleId !== id;
    logCycleId = id;
    document.dispatchEvent(new CustomEvent("rootine:log-cycle-changed", { detail: { cycleId: id } }));
    if (changed) {
        const content = document.getElementById("content");
        if (content) content.scrollTop = 0;
        window.scrollTo(0, 0);
    }
}
export function initLog(e, t) {
    ((collapsedWeeks = e), (collapsedCycles = t), initLogSwipe());
}
function sortedCycles() {
    return [...lastCycles].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}
function initLogSwipe() {
    const list = document.getElementById("log-list");
    if (!list) return;
    let x0 = 0,
        y0 = 0,
        tracking = false;
    list.addEventListener(
        "touchstart",
        (ev) => {
            tracking = ev.touches.length === 1 && !ev.target.closest(".stats-cycle-toggle--scroll");
            if (tracking) ((x0 = ev.touches[0].clientX), (y0 = ev.touches[0].clientY));
        },
        { passive: true }
    );
    list.addEventListener(
        "touchend",
        (ev) => {
            if (!tracking) return;
            tracking = false;
            const dx = ev.changedTouches[0].clientX - x0,
                dy = ev.changedTouches[0].clientY - y0;
            if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy)) return;
            const order = sortedCycles(),
                i = order.findIndex((c) => c.id === logCycleId),
                next = order[i + (dx < 0 ? 1 : -1)];
            next && (selectLogCycle(next.id), renderLog(lastCycles, lastActiveId));
        },
        { passive: true }
    );
}
on("selectLogCycle", "click", (e) => {
    selectLogCycle(e.dataset.id);
    renderLog(lastCycles, lastActiveId);
});
function weekKey(e, t) {
    return `${e}--${t}`;
}
function cycleEffectiveStart(cycle) {
    const dates = (cycle.entries || [])
        .map((entry) => new Date(entry.dt))
        .filter((date) => !Number.isNaN(date.getTime()));
    return dates.length ? new Date(Math.min(...dates.map((date) => date.getTime()))) : new Date(`${cycle.startDate}T00:00:00`);
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
    const t = [...e.entries].sort((e, t) => new Date(t.dt) - new Date(e.dt)),
        effectiveStart = cycleEffectiveStart(e);
    let s = "",
        a = null;
    return (
        t.forEach((t) => {
            const n = getWeekNum(t.dt, effectiveStart),
                l = weekKey(e.id, n);
            if (n !== a) {
                null !== a && (s += "</div>");
                const t = collapsedWeeks.has(l);
                ((s += `\n            <div class="week-header" data-action="toggleWeek" data-id="${escapeHtml(e.id)}" data-week="${n}">\n                <span>Week ${n}</span>\n                ${icon.chevronDown({ className: "week-chevron" + (t ? " collapsed" : ""), id: `week-chev-${l}`, style: "margin-left:5px" })}\n            </div>\n            <div class="week-entries${t ? " collapsed" : ""}" id="week-entries-${l}">`), (a = n));
            }
            s += renderEntryCard(t, e);
        }),
        null !== a && (s += "</div>"),
        s || '<div class="empty" style="padding:20px 0">No entries yet. Tap <span data-action="newCycle" style="color:var(--green);cursor:pointer;text-decoration:underline">Add</span> to start logging or <span data-action="triggerImport" style="color:var(--green);cursor:pointer;text-decoration:underline">Import</span> an existing log.</div>'
    );
}
function hasPlantObs(e) {
    return someValue(e.plantObs, (v) => v && String(v).trim());
}
function renderEntryCard(e, t) {
    const s = Object.values(e.plants || {}),
        a = s.some((p) => p && someValue(p.nutrients, (v) => v && v > 0)),
        n = s.some((p) => p && p.water > 0),
        l = (e.actions || []).some((a) => a && a.type === ACTION_TYPE.LIGHT),
        plantActions = (e.actions || []).filter((a) => a && PLANT_ACTION_TYPES.has(a.type)),
        actionBadges = [...new Set(plantActions.map((action) => action.type))]
            .map((type) => {
                const definition = ACTION_BY_TYPE[type];
                if (!definition) return "";
                return `<span class="badge badge-scissors" style="margin-left:0" title="${escapeHtml(definition.pastLabel || definition.label)}">${icon.action(definition.icon, { width: 13, height: 15 })}</span>`;
            })
            .join(""),
        i = !!e.obs?.trim() || hasPlantObs(e);
    let d = "";
    (a && (d += `<span class="badge badge-feed" style="margin-left:0">${icon.badgeFeed()}</span>`), n && (d += `<span class="badge badge-water" style="margin-left:0">${icon.badgeWater()}</span>`), l && (d += `<span class="badge badge-light" style="margin-left:0;">${icon.badgeLight()}</span>`), (d += actionBadges), i && (d += `<span class="badge badge-note" style="margin-left:0;" title="Has observation">${icon.badgeNote()}</span>`));
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
export function renderLog(cycles, activeId) {
    lastCycles = cycles;
    if (activeId !== lastActiveId) ((logCycleId = activeId), (lastActiveId = activeId));
    if (!cycles.some((c) => c.id === logCycleId)) logCycleId = cycles.some((c) => c.id === activeId) ? activeId : cycles[0]?.id ?? null;
    const list = document.getElementById("log-list"),
        prevStrip = list.querySelector(".stats-cycle-toggle--scroll"),
        prevScroll = prevStrip ? prevStrip.scrollLeft : 0,
        sorted = sortedCycles(),
        selected = sorted.find((c) => c.id === logCycleId);
    if (!selected) {
        list.innerHTML = '<div class="empty">No entries yet. Tap <span data-action="newCycle" style="color:var(--green);cursor:pointer;text-decoration:underline">Add</span> to start logging or <span data-action="triggerImport" style="color:var(--green);cursor:pointer;text-decoration:underline">Import</span> an existing log.</div>';
        return;
    }
    const tabs = renderCycleSelector(sorted, { selectedId: selected.id, action: "selectLogCycle", extraClass: "log-cycle-tabs", buttonClass: "log-cycle-tab" }),
        start = cycleEffectiveStart(selected).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    list.innerHTML = `
        ${tabs}
        <div class="log-cycle-info"><span class="cycle-start">Started ${start}</span>${cycleStageBadge(selected.stage)}</div>
        <div class="log-cycle-entries">${renderEntriesForCycle(selected)}</div>`;
    const strip = list.querySelector(".stats-cycle-toggle--scroll");
    strip.scrollLeft = prevScroll;
    strip.querySelector(".stats-cycle-btn.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
}
