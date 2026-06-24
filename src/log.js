import { fmtDate, fmtTime, getWeekNum, escapeHtml, getNutrientColor, fmtQty } from "./utils.js";
import { saveCollapsedWeeks, saveCollapsedCycles } from "./storage.js";

let collapsedWeeks;
let collapsedCycles;

export function initLog(cWeeks, cCycles) {
    collapsedWeeks = cWeeks;
    collapsedCycles = cCycles;
}

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
        <div class="week-header" onclick="toggleWeek('${cycle.id}', ${wk})">
          <span>Week ${wk}</span>
          <svg class="week-chevron${isCollapsed ? " collapsed" : ""}" id="week-chev-${key}" viewBox="0 0 24 24" style="margin-left:5px">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <div class="week-entries${isCollapsed ? " collapsed" : ""}" id="week-entries-${key}">`;
            lastWk = wk;
        }

        html += renderEntryCard(e, cycle);
    });

    if (lastWk !== null) html += "</div>";
    return html || '<div class="empty" style="padding:20px 0">No entries yet. <span onclick="document.querySelectorAll(\'#tabs button\')[1].click()" style="color:var(--green);cursor:pointer;text-decoration:underline">Change that.</span></div>';
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
    const hasLight = (e.actions || []).some((a) => a.startsWith("Light adjusted"));
    const hasNonLightAction = (e.actions || []).some((a) => a.startsWith("LST") || a.startsWith("Defoliate") || a.startsWith("Repot / transplant"));
    const hasObs = !!(e.obs && e.obs.trim()) || hasPlantObs(e);

    let badgeHtml = "";
    if (hasFeed) {
        badgeHtml += `<span class="badge badge-feed" style="margin-left:0"><svg xmlns="http://www.w3.org/2000/svg" style="width:13px;height:15px;fill:currentColor;" viewBox="0 -960 960 960"><path d="M480-160q-56 0-105.5-17.5T284-227l-56 55q-11 11-28 11t-28-11q-11-11-11-28t11-28l55-55q-32-41-49.5-91T160-480q0-134 93-227t227-93h320v320q0 134-93 227t-227 93Zm0-80q100 0 170-70t70-170v-240H480q-100 0-170 70t-70 170q0 39 12 74.5t33 64.5l207-207q11-11 28-11t28 11q12 12 12 28.5T548-491L341-284q29 21 64.5 32.5T480-240Zm0-240Z"/></svg></span>`;
    }

    if (hasWater) {
        badgeHtml += `<span class="badge badge-water" style="margin-left:0"><svg xmlns="http://www.w3.org/2000/svg" style="width:13px;height:15px;fill:currentColor;" viewBox="0 -960 960 960"><path d="M480-100q-133 0-226.5-92T160-416q0-63 24.5-120.5T254-638l226-222 226 222q45 44 69.5 101.5T800-416q0 132-93.5 224T480-100Zm170-148.5Q720-317 720-416q0-47-18-89.5T650-580L480-748 310-580q-34 32-52 74.5T240-416q0 99 70 167.5T480-180q100 0 170-68.5Z"/></svg></span>`;
    }

    if (hasLight) {
        badgeHtml += `<span class="badge badge-light" style="margin-left:0;"><svg xmlns="http://www.w3.org/2000/svg" style="width:13px;height:15px;fill:currentColor;" viewBox="0 -960 960 960"><path d="M400-240q-33 0-56.5-23.5T320-320v-50q-57-39-88.5-100T200-600q0-117 81.5-198.5T480-880q117 0 198.5 81.5T760-600q0 69-31.5 129.5T640-370v50q0 33-23.5 56.5T560-240H400Zm0-80h160v-92l34-24q41-28 63.5-71.5T680-600q0-83-58.5-141.5T480-800q-83 0-141.5 58.5T280-600q0 49 22.5 92.5T366-436l34 24v92Zm0 240q-17 0-28.5-11.5T360-120v-40h240v40q0 17-11.5 28.5T560-80H400Zm80-520Z"/></svg></span>`;
    }

    if (hasNonLightAction) {
        badgeHtml += `<span class="badge badge-scissors" style="margin-left:0;"><svg xmlns="http://www.w3.org/2000/svg" style="width:13px;height:15px;fill:currentColor;" viewBox="0 -960 960 960"><path d="M760-120 480-400l-94 94q8 15 11 32t3 34q0 66-47 113T240-80q-66 0-113-47T80-240q0-66 47-113t113-47q17 0 34 3t32 11l94-94-94-94q-15 8-32 11t-34 3q-66 0-113-47T80-720q0-66 47-113t113-47q66 0 113 47t47 113q0 17-3 34t-11 32l494 494v40H760ZM600-520l-80-80 240-240h120v40L600-520ZM296.5-663.5Q320-687 320-720t-23.5-56.5Q273-800 240-800t-56.5 23.5Q160-753 160-720t23.5 56.5Q207-640 240-640t56.5-23.5ZM494-466q6-6 6-14t-6-14q-6-6-14-6t-14 6q-6 6-6 14t6 14q6 6 14 6t14-6ZM296.5-183.5Q320-207 320-240t-23.5-56.5Q273-320 240-320t-56.5 23.5Q160-273 160-240t23.5 56.5Q207-160 240-160t56.5-23.5Z"/></svg></span>`;
    }

    if (hasObs) {
        badgeHtml += `<span class="badge badge-note" style="margin-left:0;" title="Has observation"><svg xmlns="http://www.w3.org/2000/svg" style="width:13px;height:15px;fill:currentColor;" viewBox="0 -960 960 960"><path d="M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/></svg></span>`;
    }

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
        body += `<div class="action-list">` + e.actions.map((a) => `<span class="action-tag">${escapeHtml(a)}</span>`).join("") + "</div>";
    }
    if (e.obs) body += `<div class="obs-box">${escapeHtml(e.obs)}</div>`;
    if (hasPlantObs(e)) {
        Object.entries(e.plantObs).forEach(([p, text]) => {
            if (!text || !text.trim()) return;
            body += `<div class="obs-box obs-box-plant"><div class="obs-box-plant-name">${escapeHtml(p)}</div><div>${escapeHtml(text)}</div></div>`;
        });
    }

    return `
    <div class="entry-card" id="card-${e.id}">
      <div class="entry-header" onclick="toggleEntry('${e.id}')">
        <div>
          <div class="entry-date">${fmtDate(e.dt)}</div>
          <div class="entry-time">${fmtTime(e.dt)}</div>
        </div>
        <div style="display:flex;gap:6px">
            <button class="settings-btn edit-entry-btn" onclick="editEntry('${e.id}')" title="Edit entry"><svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg></button>
            <button class="settings-btn delete-entry-btn" onclick="deleteEntry('${e.id}')" title="Delete entry"><svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg></button>
            <button class="settings-btn duplicate-entry-btn" onclick="duplicateEntry('${e.id}')" title="Duplicate entry"><svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor"><path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/></svg></button>
        </div>
        <span style="display:flex;align-items:center;gap:6px;margin-left:auto">${badgeHtml}</span>
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
                    <span class="cycle-name">${escapeHtml(cycle.name)}</span>
                    ${activePill}
                    <span class="cycle-start">${startFmt}</span>
                    <button class="settings-btn edit-cycle-btn" onclick="event.stopPropagation();editCycleName('${cycle.id}', '${cycle.name.replace(/'/g, "\\\'")}')" title="Edit cycle name">
                        <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>
                    </button>
                    <button class="settings-btn delete-cycle-btn" onclick="event.stopPropagation();deleteCycle('${cycle.id}')" title="Delete cycle">
                        <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
                    </button>
                </div>
                <svg class="week-chevron${isCollapsed ? " collapsed" : ""}" id="cycle-chev-${cycle.id}" viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </div>
            <div class="cycle-entries${isCollapsed ? " collapsed" : ""}" id="cycle-entries-${cycle.id}">
                ${renderEntriesForCycle(cycle)}
            </div>
        </div>`;
    });

    if (!html) html = '<div class="empty">No entries yet. Tap <span onclick="newCycle()" style="color:var(--green);cursor:pointer;text-decoration:underline">Add</span> to start logging.</div>';
    document.getElementById("log-list").innerHTML = html;
}
