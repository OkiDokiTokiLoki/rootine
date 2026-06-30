import { CYCLE_STAGE_LABEL } from "./constants.js";

export const NUTRIENT_PALETTE = ["fish", "grow", "bloom", "blue", "amber", "red"];
export function getNutrientColor(t, e) {
    if (!t || !Array.isArray(t.nutrients)) return "neutral";
    const n = t.nutrients.findIndex((t) => t.name === e);
    return n < 0 ? "neutral" : NUTRIENT_PALETTE[n % NUTRIENT_PALETTE.length];
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
export function getPlantMeta(t, e) {
    const n = t?.plantTypes?.[e];
    return n ? ("string" == typeof n ? { type: n, repottedAt: t?.startDate } : { type: n.type || "auto", repottedAt: n.repottedAt || t?.startDate }) : { type: "auto", repottedAt: t?.startDate };
}
export function fmtQty(t) {
    return t % 1 == 0 ? String(t) : t.toFixed(1);
}
export function formatAction(t) {
    if (null == t) return "";
    if ("string" == typeof t) return escapeHtml(t);
    switch (t.type) {
        case "lst":
        case "def":
        case "repot": {
            const e = { lst: "LST", def: "Defoliate", repot: "Repot / transplant" }[t.type];
            return t.plants && 0 !== t.plants.length ? `${e} (${t.plants.map(escapeHtml).join(", ")})` : `${e} (All plants)`;
        }
        case "light": {
            const e = [t.lux ? `${escapeHtml(t.lux)}k lux` : null, t.dist ? `${escapeHtml(t.dist)}cm` : null, t.start && t.end ? `${escapeHtml(t.start)}–${escapeHtml(t.end)}` : null].filter(Boolean);
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
    if (stage === "harvest") return `<span class="cycle-badge amber-btn">${CYCLE_STAGE_LABEL.harvest}</span>`;
    if (stage === "complete") return `<span class="cycle-badge complete-tag">${CYCLE_STAGE_LABEL.complete}</span>`;
    return `<span class="cycle-badge green-btn">${CYCLE_STAGE_LABEL.grow}</span>`;
}
