export function getWeekNum(dateStr, cycleStartDate) {
    const d = new Date(dateStr);
    const start = new Date(cycleStartDate);
    const diff = Math.floor((d - start) / (7 * 24 * 60 * 60 * 1000));
    return Math.max(1, diff + 1);
}

export function fmtDate(s) {
    return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function fmtTime(s) {
    return new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function entryType(e) {
    const vals = Object.values(e.plants || {});
    if (vals.some((p) => p.fish || p.grow || p.bloom)) return "feed";
    if (vals.some((p) => p.water)) return "water";
    return "note";
}

export function uid() {
    return "e" + Date.now() + Math.random().toString(36).slice(2, 6);
}

export function cycleUid() {
    return "cycle-" + Date.now();
}
