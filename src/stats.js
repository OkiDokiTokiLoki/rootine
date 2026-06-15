import { fmtDate, fmtTime, getWeekNum, entryType } from "./utils.js";

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

function ageInDays(repottedAt, asOf) {
    if (!repottedAt) return 0;
    const start = new Date(repottedAt);
    const end = asOf ? new Date(asOf) : new Date();
    return Math.max(0, Math.floor((end - start) / (24 * 60 * 60 * 1000)));
}

function computeStats(entries) {
    let feeds = 0,
        waters = 0,
        issues = 0;
    const days = new Set();
    const obsEntries = [];

    entries.forEach((e) => {
        const t = entryType(e);
        if (t === "feed") feeds++;
        if (t === "water") waters++;
        if (e.obs) {
            issues++;
            obsEntries.push(e);
        }
        days.add(e.dt.slice(0, 10));
    });

    return { feeds, waters, issues, days, obsEntries };
}

function plantType(cycle, name) {
    const t = cycle?.plantTypes?.[name];
    if (!t) return { type: "photo", repottedAt: cycle?.startDate };
    if (typeof t === "string") return { type: t, repottedAt: cycle?.startDate };
    return { type: t.type || "photo", repottedAt: t.repottedAt || cycle?.startDate };
}

function renderPlantCard(name, totals, type, repottedAt) {
    const safeName = name.replace(/'/g, "\\'");
    const typeBadge = type === "auto" ? "AUTO" : "PHOTO";
    const badgeClass = type === "auto" ? "plant-type-badge auto" : "plant-type-badge photo";

    return `
    <div class="plant-stat-row plant-stat-row-clickable" onclick="openPlantDetail('${safeName}')">
        <div style="display:flex;align-items:center;gap:8px;flex:1">
            <span style="font-weight:600">${name}</span>
            <span class="${badgeClass}" style="font-size:10px;padding:2px 6px">${typeBadge}</span>
        </div>
        <span style="font-size:12px;color:var(--muted)">
            <span style="color:#d0d34e">F ${totals.fish.toFixed(1)}</span> &nbsp;
            <span style="color:#6ecf6e">G ${totals.grow.toFixed(1)}</span> &nbsp;
            <span style="color:#c07df0">B ${totals.bloom.toFixed(1)}</span> &nbsp;
            <span style="color:var(--blue)">W ${totals.water.toFixed(1)}</span>
        </span>
    </div>`;
}

export function renderStats(cycles, activeCycleId) {
    const toggleHtml = `
    <div class="stats-cycle-toggle">
      ${cycles
          .map(
              (c) => `
        <button
          class="stats-cycle-btn${statsMode === c.id || (statsMode === "active" && c.id === activeCycleId) ? " active" : ""}"
          onclick="setStatsCycle('${c.id}')"
        >${c.name}</button>
      `
          )
          .join("")}
      <button class="stats-cycle-btn${statsMode === "all" ? " active" : ""}" onclick="setStatsCycle('all')">All</button>
    </div>`;

    // Determine which cycles feed the stats. For "all" we want every cycle's
    // plants listed; for a single cycle we want just that one.
    let targetCycles;
    if (statsMode === "all") {
        targetCycles = cycles;
    } else {
        const targetId = statsMode === "active" ? activeCycleId : statsMode;
        const cycle = cycles.find((c) => c.id === targetId) || cycles.find((c) => c.id === activeCycleId);
        targetCycles = cycle ? [cycle] : [];
    }

    // Aggregate entries across the target cycles for the headline numbers.
    const entries = targetCycles.flatMap((c) => c.entries);
    const cycleStartDate = statsMode === "all" ? null : targetCycles[0]?.startDate || null;

    const { feeds, waters, issues, days, obsEntries } = computeStats(entries);

    document.getElementById("s-feeds").textContent = feeds;
    document.getElementById("s-waters").textContent = waters;
    document.getElementById("s-days").textContent = days.size;
    document.getElementById("s-issues").textContent = issues;
    document.getElementById("stats-cycle-toggle-container").innerHTML = toggleHtml;

    // Per-cycle plant list. Each cycle is its own block, with that cycle's
    // plants listed even if they have no entries yet.
    let plantsHtml = "";
    targetCycles.forEach((cycle) => {
        const cycleTotals = (() => {
            const t = {};
            cycle.entries.forEach((e) => {
                Object.entries(e.plants || {}).forEach(([p, d]) => {
                    if (!t[p]) t[p] = { fish: 0, grow: 0, bloom: 0, water: 0 };
                    t[p].fish += d.fish || 0;
                    t[p].grow += d.grow || 0;
                    t[p].bloom += d.bloom || 0;
                    t[p].water += d.water || 0;
                });
            });
            return t;
        })();

        const cyclePlants = cycle.plants || [];
        if (cyclePlants.length === 0) {
            plantsHtml += `<div class="stats-cycle-block">
                <div style="color:var(--muted);font-size:13px">No plants in this cycle yet.</div>
            </div>`;
            return;
        }

        plantsHtml += `<div class="stats-cycle-block">`;
        cyclePlants.forEach((p) => {
            const meta = plantType(cycle, p);
            const t = cycleTotals[p] || { fish: 0, grow: 0, bloom: 0, water: 0 };
            plantsHtml += renderPlantCard(p, t, meta.type, meta.repottedAt);
        });
        plantsHtml += `</div>`;
    });

    if (!targetCycles.length) {
        plantsHtml = '<div style="color:var(--muted);font-size:13px">No cycles to show.</div>';
    }
    document.getElementById("stats-plants").innerHTML = plantsHtml;

    // Observations
    obsEntries.sort((a, b) => new Date(b.dt) - new Date(a.dt));
    let obsHtml = "";
    obsEntries.forEach((e) => {
        const wk = cycleStartDate ? `· Week ${getWeekNum(e.dt, cycleStartDate)}` : "";
        obsHtml += `<div class="obs-entry">
      <div class="obs-entry-date">${fmtDate(e.dt)} · ${fmtTime(e.dt)} ${wk}</div>
      <div class="obs-entry-text">${e.obs}</div>
    </div>`;
    });
    document.getElementById("obs-list").innerHTML = obsHtml || '<div class="empty" style="padding:20px 0">No observations logged yet.</div>';
}
