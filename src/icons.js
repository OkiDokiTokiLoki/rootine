const VIEW_BOX = "0 -960 960 960",
    NS = "http://www.w3.org/2000/svg",
    PATHS = {
        edit: "M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z",
        trash: "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z",
        duplicate: "M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z",
        lightBulb: "M400-240q-33 0-56.5-23.5T320-320v-50q-57-39-88.5-100T200-600q0-117 81.5-198.5T480-880q117 0 198.5 81.5T760-600q0 69-31.5 129.5T640-370v50q0 33-23.5 56.5T560-240H400Zm0-80h160v-92l34-24q41-28 63.5-71.5T680-600q0-83-58.5-141.5T480-800q-83 0-141.5 58.5T280-600q0 49 22.5 92.5T366-436l34 24v92Zm0 240q-17 0-28.5-11.5T360-120v-40h240v40q0 17-11.5 28.5T560-80H400Zm80-520Z",
        waterDrop: "M480-100q-133 0-226.5-92T160-416q0-63 24.5-120.5T254-638l226-222 226 222q45 44 69.5 101.5T800-416q0 132-93.5 224T480-100Zm170-148.5Q720-317 720-416q0-47-18-89.5T650-580L480-748 310-580q-34 32-52 74.5T240-416q0 99 70 167.5T480-180q100 0 170-68.5Z",
        feed: "M480-160q-56 0-105.5-17.5T284-227l-56 55q-11 11-28 11t-28-11q-11-11-11-28t11-28l55-55q-32-41-49.5-91T160-480q0-134 93-227t227-93h320v320q0 134-93 227t-227 93Zm0-80q100 0 170-70t70-170v-240H480q-100 0-170 70t-70 170q0 39 12 74.5t33 64.5l207-207q11-11 28-11t28 11q12 12 12 28.5T548-491L341-284q29 21 64.5 32.5T480-240Zm0-240Z",
        scissors: "M760-120 480-400l-94 94q8 15 11 32t3 34q0 66-47 113T240-80q-66 0-113-47T80-240q0-66 47-113t113-47q17 0 34 3t32 11l94-94-94-94q-15 8-32 11t-34 3q-66 0-113-47T80-720q0-66 47-113t113-47q66 0 113 47t47 113q0 17-3 34t-11 32l494 494v40H760ZM600-520l-80-80 240-240h120v40L600-520ZM296.5-663.5Q320-687 320-720t-23.5-56.5Q273-800 240-800t-56.5 23.5Q160-753 160-720t23.5 56.5Q207-640 240-640t56.5-23.5ZM494-466q6-6 6-14t-6-14q-6-6-14-6t-14 6q-6 6-6 14t6 14q6 6 14 6t14-6ZM296.5-183.5Q320-207 320-240t-23.5-56.5Q273-320 240-320t-56.5 23.5Q160-273 160-240t23.5 56.5Q207-160 240-160t56.5-23.5Z",
        note: "M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z",
        waterDropLine: "M480-100q-133 0-226.5-92T160-416q0-63 24.5-120.5T254-638l226-222 226 222q45 44 69.5 101.5T800-416q0 132-93.5 224T480-100ZM240-416h480q0-47-18-89.5T650-580L480-748 310-580q-34 32-52 74.5T240-416Z",
    };

// Rendered SVGs are cached by (icon-name, size, style) so repeated
// calls don't rebuild the same string. First render builds; every
// subsequent call with the same key is a Map.get.
const cache = new Map();
function cached(key, build) {
    let s = cache.get(key);
    if (s === undefined) {
        s = build();
        cache.set(key, s);
    }
    return s;
}

// Build a Material-icon SVG string. Uses inline styles for width/height
// (not bare attributes) so host CSS can't override the size, and
// fill="currentColor" so the icon picks up the host element's text color.
function materialSvg(name, opts = {}) {
    const path = PATHS[name];
    if (!path) return "";
    if (opts.style) {
        return cached(`m:${name}:style:${opts.style}`, () => `<svg xmlns="${NS}" style="${opts.style}" viewBox="${VIEW_BOX}"><path d="${path}"/></svg>`);
    }
    const size = opts.size ?? 18;
    const w = opts.width ?? size;
    const h = opts.height ?? size;
    const ws = "number" == typeof w ? `${w}px` : w;
    const hs = "number" == typeof h ? `${h}px` : h;
    return cached(`m:${name}:${ws}x${hs}`, () => `<svg xmlns="${NS}" style="width:${ws};height:${hs}" viewBox="${VIEW_BOX}" fill="currentColor"><path d="${path}"/></svg>`);
}

export function edit(t) {
    return materialSvg("edit", t);
}
export function trash(t) {
    return materialSvg("trash", t);
}
export function duplicate(t) {
    return materialSvg("duplicate", t);
}

const BADGE_STYLE = "width:13px;height:15px;fill:currentColor";
function badgeSvg(name) {
    return cached(`b:${name}`, () => {
        const path = PATHS[name];
        return `<svg xmlns="${NS}" style="${BADGE_STYLE}" viewBox="${VIEW_BOX}"><path d="${path}"/></svg>`;
    });
}
export function badgeFeed() {
    return badgeSvg("feed");
}
export function badgeWater() {
    return badgeSvg("waterDrop");
}
export function badgeLight() {
    return badgeSvg("lightBulb");
}
export function badgeScissors() {
    return badgeSvg("scissors");
}
export function badgeNote() {
    return badgeSvg("note");
}

export function waterDropLine(t) {
    return materialSvg("waterDropLine", t);
}

export function editStroke() {
    return cached("s:editStroke", () => '<svg viewBox="0 0 24 24" xmlns="' + NS + '" style="width:18px;height:18px;" fill="none"><path stroke="var(--blue)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.5 7.5l3 3M4 20v-3.5L15.293 5.207a1 1 0 011.414 0l2.086 2.086a1 1 0 010 1.414L7.5 20H4z"></path></svg>');
}
export function trashStroke() {
    return cached("s:trashStroke", () => '<svg viewBox="0 0 24 24" style="width:18px;height:18px;stroke:var(--red);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>');
}

const STAR_POLYGON = "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2";
export function star({ size: t = 11, filled: e = !0, marginRight: r = null, verticalAlign: n = null } = {}) {
    const o = [`width:${t}px`, `height:${t}px`, `fill:${e ? "var(--amber)" : "none"}`, `stroke:${e ? "var(--amber)" : "var(--muted)"}`, "flex-shrink:0", null != r ? `margin-right:${r}px` : null, null != n ? `vertical-align:${n}px` : null].filter(Boolean).join(";");
    return cached(`star:${o}`, () => `<svg viewBox="0 0 24 24" xmlns="${NS}" style="${o}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="${STAR_POLYGON}"/></svg>`);
}

export function chevronDown({ className: t = "chevron", id: e = "", style: r = "" } = {}) {
    const key = `chev:${t}:${e}:${r}`;
    return cached(key, () => `<svg class="${t}"${e ? ` id="${e}"` : ""} viewBox="0 0 24 24"${r ? ` style="${r}"` : ""}><polyline points="6 9 12 15 18 9"/></svg>`);
}

export const icon = { edit: edit, trash: trash, duplicate: duplicate, editStroke: editStroke, trashStroke: trashStroke, badgeFeed: badgeFeed, badgeWater: badgeWater, badgeLight: badgeLight, badgeScissors: badgeScissors, badgeNote: badgeNote, waterDropLine: waterDropLine, star: star, chevronDown: chevronDown };
