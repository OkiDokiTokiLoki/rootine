import { fmtDate, fmtTime, getWeekNum, entryType, escapeHtml, getPlantMeta, getNutrientColor, abbrevNutrient, fmtQty } from "./utils.js";
import { saveCollapsedObs } from "./storage.js";
import { on } from "./actions.js";

let statsMode = "active";

export function initStats(initialMode) {
    statsMode = initialMode || "active";
}

export function setStatsMode(mode) {
    statsMode = mode;
}

export function getStatsMode() {
    return statsMode;
}

let collapsedObs = false;

export function initObsCollapsed(state) {
    collapsedObs = !!state;
    applyObsCollapsedClasses();
}

export function toggleObs() {
    collapsedObs = !collapsedObs;
    saveCollapsedObs(collapsedObs);
    applyObsCollapsedClasses();
}

function applyObsCollapsedClasses() {
    const list = document.getElementById("obs-list");
    const chev = document.getElementById("obs-chev");
    const header = document.getElementById("obs-section-header");
    if (list) list.classList.toggle("collapsed", collapsedObs);
    if (chev) chev.classList.toggle("collapsed", collapsedObs);
    if (header) header.classList.toggle("collapsed", collapsedObs);
}

// Delegated handler. Reads plant name from el.dataset.id (escaped at render
// time). The .replace(/'/g, "\\'") hack for inline onclick is gone.
on("openPlantDetail", "click", (el) => openPlantDetail(el.dataset.id));

function computeStats(entries) {
    let feeds = 0,
        waters = 0,
        issues = 0;
    const days = new Set();
    const obsEntries = [];

    entries.forEach((e) => {
        const vals = Object.values(e.plants || {});
        if (
            vals.some((p) => {
                if (!p || !p.nutrients) return false;
                return Object.values(p.nutrients).some((v) => v && v > 0);
            })
        )
            feeds++;
        if (vals.some((p) => p && p.water > 0)) waters++;
        if (e.obs) {
            issues++;
            obsEntries.push(e);
        }
        days.add(e.dt.slice(0, 10));
    });

    return { feeds, waters, issues, days, obsEntries };
}

function countPlantNotes(cycle, name) {
    let n = 0;
    (cycle.entries || []).forEach((e) => {
        const t = e.plantObs?.[name];
        if (t && String(t).trim()) n++;
    });
    return n;
}

function renderPlantCard(name, totals, type, isFav, noteCount, cycle) {
    const starSvg = isFav ? `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:12px;height:12px;fill:var(--amber);stroke:var(--amber);flex-shrink:0" stroke-width="2" stroke-linecap="round" stroke-linejoin:round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>` : "";
    const typeBadge = type === "auto" ? "AUTO" : "PHOTO";
    const badgeClass = type === "auto" ? "plant-type-badge auto" : "plant-type-badge photo";

    const nutrientList = (cycle && cycle.nutrients) || [];
    const nutrientChips = nutrientList
        .map((n) => {
            const qty = (totals.nutrients || {})[n.name] || 0;
            if (qty <= 0) return "";
            const color = getNutrientColor(cycle, n.name);
            return `<span class="nutrient-totals__item nutrient--${color}" title="${escapeHtml(n.name)}">${abbrevNutrient(n.name)} ${fmtQty(qty)}</span>`;
        })
        .join("");
    const waterQty = fmtQty(totals.water || 0);
    const waterChip = `<span class="nutrient-totals__item nutrient--water" title="Water">W ${waterQty}</span>`;

    return `
    <div class="plant-stat-row plant-stat-row-clickable" data-action="openPlantDetail" data-id="${escapeHtml(name)}">
        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
            <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(name)}</span>
            ${starSvg}
            <span class="${badgeClass}" style="font-size:10px;padding:2px 6px">${typeBadge}</span>
        </div>
        <span class="nutrient-totals">
            ${nutrientChips}
            ${waterChip}
        </span>
    </div>`;
}

export function renderStats(cycles, activeCycleId) {
    const CYCLE_TOGGLE_SCROLL_THRESHOLD = 0;
    const useScroll = cycles.length + 1 > CYCLE_TOGGLE_SCROLL_THRESHOLD;

    const toggleHtml = `
    <div class="stats-cycle-toggle${useScroll ? " stats-cycle-toggle--scroll" : ""}">
      ${cycles
          .map(
              (c) => `
        <button
          class="stats-cycle-btn${statsMode === c.id || (statsMode === "active" && c.id === activeCycleId) ? " active" : ""}"
          data-action="setStatsCycle"
          data-id="${escapeHtml(c.id)}"
        >${escapeHtml(c.name)}</button>
      `
          )
          .join("")}
      <button class="stats-cycle-btn${statsMode === "all" ? " active" : ""}" data-action="setStatsCycle" data-id="all">All cycles</button>
    </div>`;

    let targetCycles;
    if (statsMode === "all") {
        targetCycles = [...cycles].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    } else {
        const targetId = statsMode === "active" ? activeCycleId : statsMode;
        const cycle = cycles.find((c) => c.id === targetId) || cycles.find((c) => c.id === activeCycleId);
        targetCycles = cycle ? [cycle] : [];
    }

    const entries = targetCycles.flatMap((c) => c.entries);
    const cycleStartDate = statsMode === "all" ? null : targetCycles[0]?.startDate || null;

    const { feeds, waters, issues, days, obsEntries } = computeStats(entries);

    document.getElementById("s-feeds").textContent = feeds;
    document.getElementById("s-waters").textContent = waters;
    document.getElementById("s-days").textContent = days.size;
    document.getElementById("s-issues").textContent = issues;
    document.getElementById("stats-cycle-toggle-container").innerHTML = toggleHtml;

    let plantsHtml = "";
    targetCycles.forEach((cycle) => {
        const cycleTotals = (() => {
            const t = {};
            cycle.entries.forEach((e) => {
                Object.entries(e.plants || {}).forEach(([p, d]) => {
                    if (!t[p]) t[p] = { nutrients: {}, water: 0 };
                    Object.entries(d.nutrients || {}).forEach(([k, v]) => {
                        t[p].nutrients[k] = (t[p].nutrients[k] || 0) + (v || 0);
                    });
                    t[p].water += d.water || 0;
                });
            });
            return t;
        })();

        const cyclePlants = cycle.plants || [];
        const showLabel = statsMode === "all";
        const isActive = cycle.id === activeCycleId;
        const activePill = isActive ? `<span class="cycle-active-badge">Active</span>` : "";
        const blockStyle = showLabel ? ' style="margin-bottom: 14px"' : "";

        if (cyclePlants.length === 0) {
            plantsHtml += `<div class="stats-cycle-block"${blockStyle}>`;
            if (showLabel) {
                plantsHtml += `<div class="stats-cycle-block-label"><span>${escapeHtml(cycle.name)}</span>${activePill}</div>`;
            }
            plantsHtml += `<div style="color:var(--muted);font-size:13px">No plants in this cycle yet.</div>`;
            plantsHtml += `</div>`;
            return;
        }

        const favSet = new Set(cycle.favourites || []);
        const sortedCyclePlants = [...cyclePlants].sort((a, b) => (favSet.has(a) ? 0 : 1) - (favSet.has(b) ? 0 : 1));
        plantsHtml += `<div class="stats-cycle-block"${blockStyle}>`;
        if (showLabel) {
            plantsHtml += `<div class="stats-cycle-block-label"><span>${escapeHtml(cycle.name)}</span>${activePill}</div>`;
        }
        sortedCyclePlants.forEach((p) => {
            const meta = getPlantMeta(cycle, p);
            const t = cycleTotals[p] || { nutrients: {}, water: 0 };
            const noteCount = countPlantNotes(cycle, p);
            plantsHtml += renderPlantCard(p, t, meta.type, favSet.has(p), noteCount, cycle);
        });
        plantsHtml += `</div>`;
    });

    if (!targetCycles.length) {
        plantsHtml = '<div style="color:var(--muted);font-size:13px">No cycles to show.</div>';
    }
    document.getElementById("stats-plants").innerHTML = plantsHtml;

    obsEntries.sort((a, b) => new Date(b.dt) - new Date(a.dt));
    let obsHtml = "";
    obsEntries.forEach((e) => {
        const wk = cycleStartDate ? `· Week ${getWeekNum(e.dt, cycleStartDate)}` : "";
        obsHtml += `<div class="obs-entry">
      <div class="obs-entry-date">${fmtDate(e.dt)} · ${fmtTime(e.dt)} ${wk}</div>
      <div class="obs-entry-text">${escapeHtml(e.obs)}</div>
    </div>`;
    });
    document.getElementById("obs-list").innerHTML = obsHtml || '<div class="empty" style="padding:20px 0">No observations logged yet.</div>';
}
