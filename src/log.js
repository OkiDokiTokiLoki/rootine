import { fmtDate, fmtTime, getWeekNum, escapeHtml, getNutrientColor, fmtQty, formatAction } from "./utils.js";
import { saveCollapsedWeeks, saveCollapsedCycles } from "./storage.js";
import { on } from "./actions.js";
import { icon } from "./icons.js";

let collapsedWeeks;
let collapsedCycles;

export function initLog(cWeeks, cCycles) {
    collapsedWeeks = cWeeks;
    collapsedCycles = cCycles;
}

// Delegated click handlers. Each looks up its argument from el.dataset —
// no string interpolation of user content into HTML attributes.
on("toggleWeek", "click", (el) => toggleWeek(el.dataset.id, Number(el.dataset.week)));
on("toggleCycle", "click", (el) => toggleCycle(el.dataset.id));
on("toggleEntry", "click", (el) => toggleEntry(el.dataset.id));

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

function renderEntriesForCycle(cycle) {
    const sorted = [...cycle.entries].sort((a, b) => new Date(b.dt) - new Date(a.dt));
    let html = "";
    let lastWk = null;

    sorted.forEach((e) => {
        const wk = getWeekNum(e.dt, cycle.startDate);
        const key = weekKey(cycle.id, wk);

        if (wk !== lastWk) {
            if (lastWk !== null) html += `</div>`;
            const isCollapsed = collapsedWeeks.has(key);
            html += `
            <div class="week-header" data-action="toggleWeek" data-id="${escapeHtml(cycle.id)}" data-week="${wk}">
                <span>Week ${wk}</span>
                ${icon.chevronDown({ className: `week-chevron${isCollapsed ? " collapsed" : ""}`, id: `week-chev-${key}`, style: "margin-left:5px" })}
            </div>
            <div class="week-entries${isCollapsed ? " collapsed" : ""}" id="week-entries-${key}">`;
            lastWk = wk;
        }

        html += renderEntryCard(e, cycle);
    });

    if (lastWk !== null) html += "</div>";
    return html || '<div class="empty" style="padding:20px 0">No entries yet. <span data-action="showTab" data-id="add" style="color:var(--green);cursor:pointer;text-decoration:underline">Change that.</span></div>';
}

function hasPlantObs(e) {
    if (!e.plantObs || typeof e.plantObs !== "object") return false;
    return Object.values(e.plantObs).some((t) => t && String(t).trim());
}

function renderEntryCard(e, cycle) {
    const vals = Object.values(e.plants || {});
    const hasFeed = vals.some((p) => {
        if (!p || !p.nutrients) return false;
        return Object.values(p.nutrients).some((v) => v && v > 0);
    });
    const hasWater = vals.some((p) => p && p.water > 0);
    const hasLight = (e.actions || []).some((a) => a && a.type === "light");
    const hasNonLightAction = (e.actions || []).some((a) => a && (a.type === "lst" || a.type === "def" || a.type === "repot"));
    const hasObs = !!(e.obs && e.obs.trim()) || hasPlantObs(e);

    let badgeHtml = "";
    if (hasFeed) badgeHtml += `<span class="badge badge-feed"    style="margin-left:0">${icon.badgeFeed()}</span>`;
    if (hasWater) badgeHtml += `<span class="badge badge-water"   style="margin-left:0">${icon.badgeWater()}</span>`;
    if (hasLight) badgeHtml += `<span class="badge badge-light"   style="margin-left:0;">${icon.badgeLight()}</span>`;
    if (hasNonLightAction) badgeHtml += `<span class="badge badge-scissors" style="margin-left:0;">${icon.badgeScissors()}</span>`;
    if (hasObs) badgeHtml += `<span class="badge badge-note"    style="margin-left:0;" title="Has observation">${icon.badgeNote()}</span>`;

    const plants = Object.entries(e.plants || {});
    let body = "";
    if (plants.length) {
        body += "<div>";
        plants.forEach(([p, d]) => {
            let pills = "";
            (cycle?.nutrients || []).forEach((n) => {
                const qty = d.nutrients?.[n.name];
                if (qty && qty > 0) {
                    const color = getNutrientColor(cycle, n.name);
                    pills += `<span class="pill pill--${color}">${escapeHtml(n.name)} - ${fmtQty(qty)} cup${qty === 1 ? "" : "s"}</span>`;
                }
            });
            if (d.water) pills += `<span class="pill pill-water">Water - ${fmtQty(d.water)} cup${d.water === 1 ? "" : "s"}</span>`;
            body += `<div class="plant-row"><span class="pname">${escapeHtml(p)}</span><div class="pills">${pills || "—"}</div></div>`;
        });
        body += "</div>";
    }
    if (e.actions && e.actions.length) {
        body += `<div class="action-list">` + e.actions.map((a) => `<span class="action-tag">${formatAction(a)}</span>`).join("") + "</div>";
    }
    if (e.obs) body += `<div class="obs-box">${escapeHtml(e.obs)}</div>`;
    if (hasPlantObs(e)) {
        Object.entries(e.plantObs).forEach(([p, text]) => {
            if (!text || !text.trim()) return;
            body += `<div class="obs-box obs-box-plant"><div class="obs-box-plant-name">${escapeHtml(p)}</div><div>${escapeHtml(text)}</div></div>`;
        });
    }

    return `
    <div class="entry-card" id="card-${escapeHtml(e.id)}">
      <div class="entry-header" data-action="toggleEntry" data-id="${escapeHtml(e.id)}">
        <div>
          <div class="entry-date">${fmtDate(e.dt)}</div>
          <div class="entry-time">${fmtTime(e.dt)}</div>
        </div>
        <div style="display:flex;gap:6px">
            <button class="settings-btn blue-btn" data-action="editEntry" data-id="${escapeHtml(e.id)}" title="Edit entry">${icon.edit()}</button>
            <button class="settings-btn red-btn" data-action="deleteEntry" data-id="${escapeHtml(e.id)}" title="Delete entry">${icon.trash()}</button>
            <button class="settings-btn green-btn" data-action="duplicateEntry" data-id="${escapeHtml(e.id)}" title="Duplicate entry">${icon.duplicate()}</button>
        </div>
        <span style="display:flex;align-items:center;gap:6px;margin-left:auto">${badgeHtml}</span>
        ${icon.chevronDown({ id: `chev-${escapeHtml(e.id)}` })}
      </div>
      <div class="entry-body" id="body-${escapeHtml(e.id)}">${body}</div>
    </div>`;
}

export function renderLog(cycles, activeCycleId) {
    const sorted = [...cycles].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    let html = "";

    sorted.forEach((cycle, i) => {
        const isActive = cycle.id === activeCycleId;
        const isCollapsed = collapsedCycles.has(cycle.id);
        const startFmt = new Date(cycle.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const activePill = isActive ? `<span class="cycle-active-badge">Active</span>` : "";

        html += `
        <div class="cycle-block">
            <div class="cycle-header${isCollapsed ? " collapsed" : ""}"
                 id="cycle-header-${escapeHtml(cycle.id)}"
                 data-action="toggleCycle"
                 data-id="${escapeHtml(cycle.id)}">
                <div class="cycle-header-left">
                    <span class="cycle-name">${escapeHtml(cycle.name)}</span>
                    ${activePill}
                    <span class="cycle-start">${startFmt}</span>
                    <button class="settings-btn blue-btn"
                            data-action="editCycleName"
                            data-id="${escapeHtml(cycle.id)}"
                            title="Edit cycle name">
                        ${icon.edit()}
                    </button>
                    <button class="settings-btn red-btn"
                            data-action="deleteCycle"
                            data-id="${escapeHtml(cycle.id)}"
                            title="Delete cycle">
                        ${icon.trash()}
                    </button>
                </div>
                ${icon.chevronDown({ className: `week-chevron${isCollapsed ? " collapsed" : ""}`, id: `cycle-chev-${escapeHtml(cycle.id)}`, style: "width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round" })}
            </div>
            <div class="cycle-entries${isCollapsed ? " collapsed" : ""}" id="cycle-entries-${escapeHtml(cycle.id)}">
                ${renderEntriesForCycle(cycle)}
            </div>
        </div>`;
    });

    if (!html) html = '<div class="empty">No entries yet. Tap <span data-action="newCycle" style="color:var(--green);cursor:pointer;text-decoration:underline">Add</span> to start logging.</div>';
    document.getElementById("log-list").innerHTML = html;
}
