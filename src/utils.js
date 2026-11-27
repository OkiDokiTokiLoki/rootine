import { ACTION_BY_TYPE, ACTION_TYPE, CYCLE_STAGE, CYCLE_STAGE_DEFINITIONS, NUTRIENT_COLOR_DEFINITIONS } from "./constants.js";

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
    return n ? ("string" == typeof n ? { type: n, repottedAt, flushedAt: null, harvestedAt: null } : { type: n.type || "auto", repottedAt, flushedAt: n.flushedAt || null, harvestedAt: n.harvestedAt || null }) : { type: "auto", repottedAt, flushedAt: null, harvestedAt: null };
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
export function renderCycleSelector(cycles, { selectedId, action, showStage = false, includeAll = false, allId = "all", allLabel = "All cycles", newestFirst = false, extraClass = "", buttonClass = "", wrap = true } = {}) {
    const ordered = [...cycles].sort((a, b) => (newestFirst ? -1 : 1) * (new Date(a.startDate) - new Date(b.startDate)));
    const buttons = ordered.map((cycle) => {
        const definition = CYCLE_STAGE_DEFINITIONS[cycle.stage] || CYCLE_STAGE_DEFINITIONS[CYCLE_STAGE.GROW];
        const label = `${escapeHtml(cycle.name)}${showStage ? ` · ${definition.label}` : ""}`;
        return `<button class="stats-cycle-btn${buttonClass ? ` ${buttonClass}` : ""}${cycle.id === selectedId ? " active" : ""}" data-action="${action}" data-id="${escapeHtml(cycle.id)}">${label}</button>`;
    });
    if (includeAll) buttons.push(`<button class="stats-cycle-btn${allId === selectedId ? " active" : ""}" data-action="${action}" data-id="${escapeHtml(allId)}">${escapeHtml(allLabel)}</button>`);
    const content = buttons.join("");
    return wrap ? `<div class="stats-cycle-toggle stats-cycle-toggle--scroll${extraClass ? ` ${extraClass}` : ""}">${content}</div>` : content;
}

