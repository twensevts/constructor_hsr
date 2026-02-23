let RELIC_SETS = [];
let RELIC_STATS = null;

async function loadRelicData() {
    const [setsRes, statsRes] = await Promise.all([
        fetch('assets/relic_sets.json'),
        fetch('assets/relic_stats.json')
    ]);
    RELIC_SETS = await setsRes.json();
    RELIC_STATS = await statsRes.json();
}

function getSetsBySlot(slot) {
    const isPlanar = slot === 'sphere' || slot === 'rope';
    return RELIC_SETS.filter(s => (s.type === 'planar') === isPlanar);
}

function getSetById(id) {
    return RELIC_SETS.find(s => s.id === id) || null;
}

function getItemForSlot(relicSet, slot) {
    return relicSet?.items?.find(i => i.slot === slot) || null;
}

function getMainStatsForSlot(slot) {
    return RELIC_STATS?.main_stats?.[slot] || [];
}

function getSubstats() {
    return RELIC_STATS?.substats || [];
}

function getSubstatValue(substatId, quality, upgrades) {
    const sub = RELIC_STATS?.substats?.find(s => s.id === substatId);
    if (!sub) return null;
    const val = sub.values?.[quality] ?? sub.values?.mid ?? 0;
    const unit = sub.unit || '';
    const total = (1 + (upgrades || 0)) * val;
    return unit === '%' ? total.toFixed(1) + '%' : Math.round(total);
}
