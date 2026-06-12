import { fmtDate, fmtTime, getWeekNum, entryType } from "./utils.js";
import { saveCollapsedWeeks, saveCollapsedCycles, saveCollapsedActions } from "./storage.js";

let collapsedWeeks;
let collapsedCycles;
let collapsedActions;

export function initLog(cWeeks, cCycles, cActions) {
    collapsedWeeks = cWeeks;
    collapsedCycles = cCycles;
    collapsedActions = cActions;
}

// Week key is scoped per cycle to avoid collisions: "cycleId--weekNum"
function weekKey(cycleId, wk) {
    return `${cycleId}--${wk}`;
}

export function toggleWeek(cycleId, wk) {
    const key = weekKey(cycleId, wk);
    if (collapsedWeeks.has(key)) collapsedWeeks.delete(key);
    else collapsedWeeks.add(key);
    saveCollapsedWeeks(collapsedWeeks);
    document.getElementById("week-entries-" + key).classList.toggle("collapsed", collapsedWeeks.has(key));
    document.getElementById("week-chev-" + key).classList.toggle("collapsed", collapsedWeeks.has(key));
}

export function toggleCycle(cycleId) {
    if (collapsedCycles.has(cycleId)) collapsedCycles.delete(cycleId);
    else collapsedCycles.add(cycleId);
    saveCollapsedCycles(collapsedCycles);
    document.getElementById("cycle-entries-" + cycleId).classList.toggle("collapsed", collapsedCycles.has(cycleId));
    document.getElementById("cycle-chev-" + cycleId).classList.toggle("collapsed", collapsedCycles.has(cycleId));
    document.getElementById("cycle-header-" + cycleId).classList.toggle("collapsed", collapsedCycles.has(cycleId));
}

export function toggleEntry(id) {
    document.getElementById("body-" + id).classList.toggle("open");
    document.getElementById("chev-" + id).classList.toggle("open");
    document.getElementById("card-" + id).classList.toggle("open");
}

export function toggleActionList(entryId) {
    collapsedActions = !collapsedActions;
    saveCollapsedActions(collapsedActions);
    // Toggle all action lists
    document.querySelectorAll(".action-list").forEach((el) => {
        el.classList.toggle("collapsed", collapsedActions);
    });
    document.querySelectorAll(".action-chevron").forEach((el) => {
        el.classList.toggle("collapsed", collapsedActions);
    });
}

function renderEntriesForCycle(cycle) {
    const sorted = [...cycle.entries].sort((a, b) => new Date(b.dt) - new Date(a.dt));
    let html = "";
    let lastWk = null;

    sorted.forEach((e) => {
        const wk = getWeekNum(e.dt, cycle.startDate);
        const key = weekKey(cycle.id, wk);
        const safeKey = key.replace(":", "\\:"); // for getElementById, not CSS.escape

        if (wk !== lastWk) {
            if (lastWk !== null) html += `</div>`;
            const isCollapsed = collapsedWeeks.has(key);
            html += `
        <div class="week-header" onclick="toggleWeek('${cycle.id}', ${wk})">
          <span>Week ${wk}</span>
          <svg class="week-chevron${isCollapsed ? " collapsed" : ""}" id="week-chev-${key}" viewBox="0 0 24 24" style="margin-left:5px">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <div class="week-entries${isCollapsed ? " collapsed" : ""}" id="week-entries-${key}">`;
            lastWk = wk;
        }

        html += renderEntryCard(e);
    });

    if (lastWk !== null) html += "</div>";
    return html || '<div class="empty" style="padding:20px 0">No entries yet.</div>';
}

function renderEntryCard(e) {
    // Check for feed and water separately
    const vals = Object.values(e.plants || {});
    const hasFeed = vals.some((p) => p.fish || p.grow || p.bloom);
    const hasWater = vals.some((p) => p.water);

    // Build badge HTML - show both if present, otherwise single badge
    let badgeHtml = "";
    if (hasFeed && hasWater) {
        badgeHtml = `<span class="badge badge-feed" style="margin-left:0"><svg viewBox="0 0 24 28" style="width:13px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M12 2L6.5 12a6 6 0 1 0 11 0L12 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="2" x2="12" y2="27" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></span><span class="badge badge-water" style="margin-left:0"><svg viewBox="0 0 24 28" style="width:13px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M12 2L6.5 12a6 6 0 1 0 11 0L12 2z"/></svg></span>`;
    } else if (hasFeed) {
        badgeHtml = `<span class="badge badge-feed" style="margin-left:0"><svg viewBox="0 0 24 28" style="width:13px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M12 2L6.5 12a6 6 0 1 0 11 0L12 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="2" x2="12" y2="27" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></span>`;
    } else if (hasWater) {
        badgeHtml = `<span class="badge badge-water" style="margin-left:0"><svg viewBox="0 0 24 28" style="width:13px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M12 2L6.5 12a6 6 0 1 0 11 0L12 2z"/></svg></span>`;
    } else {
        badgeHtml = `<span class="badge badge-note" style="margin-left:0"><svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M9 2 L18 2 L18 22 L6 22 L6 8 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 8 L9 2 L9 8 Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
    }

    const plants = Object.entries(e.plants || {});
    let body = "";
    if (plants.length) {
        body += "<div>";
        plants.forEach(([p, d]) => {
            let pills = "";
            if (d.fish) pills += `<span class="pill pill-fish">Fish ${d.fish}c</span>`;
            if (d.grow) pills += `<span class="pill pill-grow">Grow ${d.grow}c</span>`;
            if (d.bloom) pills += `<span class="pill pill-bloom">Bloom ${d.bloom}c</span>`;
            if (d.water) pills += `<span class="pill pill-water">Water ${d.water}c</span>`;
            body += `<div class="plant-row"><span class="pname">${p}</span><div class="pills">${pills || "—"}</div></div>`;
        });
        body += "</div>";
    }
    if (e.actions && e.actions.length) {
        body += `<div class="action-header" onclick="toggleActionList('${e.id}')"><span>Actions</span><svg class="action-chevron${collapsedActions ? " collapsed" : ""}" viewBox="0 0 24 24" style="width:18px;height:18px"><polyline points="6 9 12 15 18 9" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
        body += `<div class="action-list${collapsedActions ? " collapsed" : ""}">` + e.actions.map((a) => `<span class="action-tag">${a}</span>`).join("") + "</div>";
    }
    if (e.obs) body += `<div class="obs-box">${e.obs}</div>`;
    body += `<div style="display:flex;gap:6px"><button class="edit-entry-btn" onclick="editEntry('${e.id}')" title="Edit entry"><svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M3 17.25V21h3.75L17.81 9.94M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button><button class="delete-entry-btn" onclick="deleteEntry('${e.id}')" title="Delete entry"><svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg></button></div>`;

    const hasLight = (e.actions || []).some((a) => a.startsWith("Light adjusted"));
    const lightIcon = hasLight ? `<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:var(--amber);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.9-3.5 6.2V17a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-1.8A7 7 0 0 1 5 9a7 7 0 0 1 7-7z"/></svg>` : "";

    return `
    <div class="entry-card" id="card-${e.id}">
      <div class="entry-header" onclick="toggleEntry('${e.id}')">
        <div>
          <div class="entry-date">${fmtDate(e.dt)}</div>
          <div class="entry-time">${fmtTime(e.dt)}</div>
        </div>
        <span style="display:flex;align-items:center;gap:6px;margin-left:auto">${lightIcon}${badgeHtml}</span>
        <svg class="chevron" id="chev-${e.id}" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div class="entry-body" id="body-${e.id}">${body}</div>
    </div>`;
}

export function renderLog(cycles, activeCycleId) {
    // Newest cycle first
    const sorted = [...cycles].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    let html = "";

    sorted.forEach((cycle, i) => {
        const isActive = cycle.id === activeCycleId;
        const isCollapsed = collapsedCycles.has(cycle.id);
        const startFmt = new Date(cycle.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const activePill = isActive ? `<span class="cycle-active-badge">Active</span>` : "";

        html += `
      <div class="cycle-block">
        <div class="cycle-header${isCollapsed ? " collapsed" : ""}" id="cycle-header-${cycle.id}" onclick="toggleCycle('${cycle.id}')">
          <div class="cycle-header-left">
            <span class="cycle-name">${cycle.name}</span>
            ${activePill}
            <span class="cycle-start">${startFmt}</span>
            <button class="delete-cycle-btn" onclick="event.stopPropagation();deleteCycle('${cycle.id}')" title="Delete cycle">
              <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
          <svg class="week-chevron${isCollapsed ? " collapsed" : ""}" id="cycle-chev-${cycle.id}" viewBox="0 0 24 24">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <div class="cycle-entries${isCollapsed ? " collapsed" : ""}" id="cycle-entries-${cycle.id}">
          ${renderEntriesForCycle(cycle)}
        </div>
      </div>`;
    });

    if (!html) html = '<div class="empty">No entries yet. Tap Add to start logging.</div>';
    document.getElementById("log-list").innerHTML = html;
}
