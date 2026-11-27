import { ACTION_BY_TYPE, ACTION_TYPE, CYCLE_STAGE, CYCLE_STAGE_DEFINITIONS, NUTRIENT_COLOR_DEFINITIONS, PLANT_GROWTH_STAGE, PLANT_GROWTH_STAGE_DEFINITIONS } from "./constants.js";

export const NUTRIENT_PALETTE = NUTRIENT_COLOR_DEFINITIONS.map(({ value }) => value);
export function getNutrientColor(t, e) {
    if (!t || !Array.isArray(t.nutrients)) return "neutral";
    const n = t.nutrients.findIndex((t) => t.name === e);
    if (n < 0) return "neutral";
    const stored = t.nutrients[n]?.color;
    return NUTRIENT_PALETTE.includes(stored) ? stored : NUTRIENT_PALETTE[n % NUTRIENT_PALETTE.length];
}
export function abbrevNutrient(t) {
    return t ? t.slice(0, 2).toUpperCase() : "";
}
export function getWeekNum(t, e) {
    const n = new Date(t),
        r = new Date(e),
        a = new Date(n.getFullYear(), n.getMonth(), n.getDate()),
        o = new Date(r.getFullYear(), r.getMonth(), r.getDate()),
        l = Math.floor((a - o) / 864e5);
    return Math.max(1, Math.floor(l / 7) + 1);
}
export function fmtDate(t) {
    return new Date(t).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
export function fmtTime(t) {
    return new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
export function entryType(t) {
    const e = Object.values(t.plants || {});
    return e.some((t) => !(!t || !t.nutrients) && Object.values(t.nutrients).some((t) => t && t > 0)) ? "feed" : e.some((t) => t && t.water > 0) ? "water" : "note";
}
export function uid() {
    return "e" + Date.now() + Math.random().toString(36).slice(2, 6);
}
export function cycleUid() {
    return "cycle-" + Date.now();
}
export function escapeHtml(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function inferredRepottedAt(cycle, plant) {
    let firstEntryDate = null,
        latestRepotDate = null;
    for (const entry of cycle?.entries || []) {
        const date = entry?.dt?.slice(0, 10);
        if (!date) continue;
        if (!firstEntryDate || date < firstEntryDate) firstEntryDate = date;
        for (const action of entry.actions || []) {
            if (!action || action.type !== ACTION_TYPE.REPOT) continue;
            const plants = action.plants || [];
            if ((plants.length === 0 || plants.includes(plant)) && (!latestRepotDate || date > latestRepotDate)) latestRepotDate = date;
        }
    }
    return latestRepotDate || firstEntryDate || cycle?.startDate;
}
export function getPlantMeta(t, e) {
    const n = t?.plantTypes?.[e],
        repottedAt = inferredRepottedAt(t, e);
    const base = n && "object" == typeof n ? n : {};
    return { ...base, type: "string" == typeof n ? n : base.type || "auto", repottedAt, flushedAt: base.flushedAt || null, harvestedAt: base.harvestedAt || null, stageHistory: normalizePlantStageHistory(t, e, base.stageHistory) };
}
export function normalizePlantStageHistory(cycle, plant, history) {
    const valid = new Set(Object.keys(PLANT_GROWTH_STAGE_DEFINITIONS)),
        repottedAt = inferredRepottedAt(cycle, plant),
        rows = (Array.isArray(history) ? history : [])
            .filter((item) => item && valid.has(item.stage) && /^\d{4}-\d{2}-\d{2}$/.test(String(item.dt || "")))
            .map((item) => ({ stage: item.stage, dt: item.dt }))
            .sort((a, b) => a.dt.localeCompare(b.dt));
    if (!rows.length || rows[0].stage !== PLANT_GROWTH_STAGE.SEEDLING) rows.unshift({ stage: PLANT_GROWTH_STAGE.SEEDLING, dt: repottedAt });
    else rows[0] = { ...rows[0], dt: repottedAt };
    const byDate = new Map();
    rows.forEach((item) => byDate.set(item.dt, item));
    return [...byDate.values()].sort((a, b) => a.dt.localeCompare(b.dt));
}
export function getPlantGrowthStageAt(cycle, plant, dt = null) {
    const history = getPlantMeta(cycle, plant).stageHistory,
        target = String(dt || new Date().toISOString()).slice(0, 10);
    let current = history[0] || { stage: PLANT_GROWTH_STAGE.SEEDLING, dt: target };
    history.forEach((item) => item.dt <= target && (current = item));
    return current;
}
export function plantGrowthStageBadge(stage, { compact = false } = {}) {
    const definition = PLANT_GROWTH_STAGE_DEFINITIONS[stage] || PLANT_GROWTH_STAGE_DEFINITIONS[PLANT_GROWTH_STAGE.SEEDLING];
    return `<span class="plant-growth-stage ${definition.className}" title="${escapeHtml(definition.label)}"><span aria-hidden="true">${definition.shortLabel}</span>${compact ? "" : `<em>${escapeHtml(definition.label)}</em>`}</span>`;
}
export function computePlantGrowthStageDurations(cycle, plant) {
    const meta = getPlantMeta(cycle, plant),
        history = meta.stageHistory,
        end = meta.harvestedAt || new Date().toISOString().slice(0, 10),
        durations = Object.fromEntries(Object.keys(PLANT_GROWTH_STAGE_DEFINITIONS).map((stage) => [stage, 0]));
    history.forEach((item, index) => {
        const next = history[index + 1]?.dt || end,
            startMs = new Date(`${item.dt}T00:00:00`).getTime(),
            endMs = new Date(`${next}T00:00:00`).getTime();
        if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) durations[item.stage] += Math.floor((endMs - startMs) / 864e5);
    });
    const current = getPlantGrowthStageAt(cycle, plant, end);
    return { current, durations, history };
}
export function fmtQty(t) {
    return t % 1 == 0 ? String(t) : t.toFixed(1);
}
export function formatAction(t) {
    if (null == t) return "";
    if ("string" == typeof t) return escapeHtml(t);
    const definition = ACTION_BY_TYPE[t.type];
    if (definition?.plantPicker) {
        const label = definition.pastLabel || definition.label;
        return t.plants && 0 !== t.plants.length ? `${label} (${t.plants.map(escapeHtml).join(", ")})` : `${label} (All plants)`;
    }
    switch (t.type) {
        case ACTION_TYPE.LIGHT: {
            const e = [t.lux ? `${escapeHtml(t.lux)}k lux` : null, t.start && t.end ? `${escapeHtml(t.start)}–${escapeHtml(t.end)}` : null].filter(Boolean);
            return e.length ? `Light adjusted (${e.join(", ")})` : "Light adjusted";
        }
        default:
            return escapeHtml(JSON.stringify(t));
    }
}
export function someValue(obj, pred = Boolean) {
    if (!obj) return false;
    for (const k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k) && pred(obj[k])) return true;
    }
    return false;
}
export function cycleStageBadge(stage) {
    const definition = CYCLE_STAGE_DEFINITIONS[stage] || CYCLE_STAGE_DEFINITIONS[CYCLE_STAGE.GROW];
    return `<span class="cycle-badge ${definition.badgeClass}">${definition.label}</span>`;
}
export function renderCycleSelector(cycles, { selectedId, action, showStage = false, includeAll = false, allId = "all", allLabel = "All cycles", newestFirst = false, preserveOrder = false, extraClass = "", buttonClass = "", wrap = true } = {}) {
    const ordered = preserveOrder ? [...cycles] : [...cycles].sort((a, b) => (newestFirst ? -1 : 1) * (new Date(a.startDate) - new Date(b.startDate)));
    const buttons = ordered.map((cycle) => {
        const definition = CYCLE_STAGE_DEFINITIONS[cycle.stage] || CYCLE_STAGE_DEFINITIONS[CYCLE_STAGE.GROW];
        const label = `${escapeHtml(cycle.name)}${showStage ? ` · ${definition.label}` : ""}`;
        return `<button class="stats-cycle-btn${buttonClass ? ` ${buttonClass}` : ""}${cycle.id === selectedId ? " active" : ""}" data-action="${action}" data-id="${escapeHtml(cycle.id)}">${label}</button>`;
    });
    if (includeAll) buttons.push(`<button class="stats-cycle-btn${allId === selectedId ? " active" : ""}" data-action="${action}" data-id="${escapeHtml(allId)}">${escapeHtml(allLabel)}</button>`);
    const content = buttons.join("");
    return wrap ? `<div class="stats-cycle-toggle stats-cycle-toggle--scroll${extraClass ? ` ${extraClass}` : ""}">${content}</div>` : content;
}

