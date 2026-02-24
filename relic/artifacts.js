const pieceData = {};
let currentArtifactCard = null;
let currentSubstatIndex = null;
let selectedSubstatForModal = null;

const SLOTS = ['head', 'hands', 'body', 'feet', 'sphere', 'rope'];
const QUALITIES = [
    { id: 'low', name: 'Низкий' },
    { id: 'mid', name: 'Средний' },
    { id: 'high', name: 'Высокий' }
];

function initPieceData() {
    SLOTS.forEach(slot => {
        pieceData[slot] = {
            set: null,
            item: null,
            mainStat: null,
            substats: [null, null, null, null],
            obtained: false
        };
    });
}

function getCardData(card) {
    const slot = card?.dataset?.slot;
    return slot ? pieceData[slot] : null;
}

function openSetSelectionModal(card) {
    currentArtifactCard = card;
    const slot = card.dataset.slot;
    const sets = getSetsBySlot(slot);
    const list = document.getElementById('setSelectionList');
    list.innerHTML = sets.map(s => `
        <div class="selection-option" data-set-id="${s.id}">
            <img src="${s.icon}" alt="" class="set-icon-sm">
            <span>${s.name}</span>
        </div>
    `).join('');
    list.querySelectorAll('.selection-option').forEach(el => {
        el.addEventListener('click', () => selectSet(slot, el.dataset.setId));
    });
    document.getElementById('setSelectionModal').classList.add('show');
}

function closeSetSelectionModal() {
    document.getElementById('setSelectionModal').classList.remove('show');
    currentArtifactCard = null;
}

function selectSet(slot, setId) {
    const relicSet = getSetById(setId);
    const item = getItemForSlot(relicSet, slot);
    pieceData[slot].set = relicSet;
    pieceData[slot].item = item;
    updateCardDisplay(slot);
    closeSetSelectionModal();
}

function openMainStatModal(card) {
    currentArtifactCard = card;
    const slot = card.dataset.slot;
    const data = pieceData[slot];
    if (!data.set) {
        alert('Сначала выберите сет');
        return;
    }
    const mainStats = getMainStatsForSlot(slot);
    const list = document.getElementById('mainStatList');
    list.innerHTML = mainStats.map(ms => `
        <div class="selection-option" data-stat-id="${ms.id}" data-stat-name="${ms.name}" data-stat-value="${ms.value}">
            <span>${ms.name}</span>
            <span class="stat-value">${typeof ms.value === 'number' ? ms.value : ms.value}</span>
        </div>
    `).join('');
    list.querySelectorAll('.selection-option').forEach(el => {
        el.addEventListener('click', () => {
            pieceData[slot].mainStat = {
                id: el.dataset.statId,
                name: el.dataset.statName,
                value: el.dataset.statValue
            };
            updateCardDisplay(slot);
            closeMainStatModal();
        });
    });
    document.getElementById('mainStatModal').classList.add('show');
}

function closeMainStatModal() {
    document.getElementById('mainStatModal').classList.remove('show');
    currentArtifactCard = null;
}

function openSubstatModal(card, subIndex) {
    currentArtifactCard = card;
    currentSubstatIndex = parseInt(subIndex, 10);
    const slot = card.dataset.slot;
    const data = pieceData[slot];
    if (!data.set) {
        alert('Сначала выберите сет');
        return;
    }
    const mainStatId = data.mainStat?.id || '';
    const usedSubIds = data.substats
        .map((s, i) => i !== currentSubstatIndex && s ? s.id : null)
        .filter(Boolean);
    const available = getSubstats().filter(s =>
        s.id !== mainStatId && !usedSubIds.includes(s.id)
    );
    const list = document.getElementById('substatList');
    list.innerHTML = available.map(s => `
        <div class="selection-option" data-substat-id="${s.id}">
            <span>${s.name}</span>
        </div>
    `).join('');
    list.querySelectorAll('.selection-option').forEach(el => {
        el.addEventListener('click', () => {
            selectedSubstatForModal = el.dataset.substatId;
            showSubstatStep2();
        });
    });
    document.getElementById('substatStep1').classList.remove('hidden');
    document.getElementById('substatStep2').classList.add('hidden');
    document.getElementById('substatModal').classList.add('show');
}

let pendingSubstat = { upgrades: 0, quality: 'mid' };

function showSubstatStep2() {
    document.getElementById('substatStep1').classList.add('hidden');
    const upgradesDiv = document.getElementById('upgradesOptions');
    upgradesDiv.innerHTML = [0, 1, 2, 3, 4, 5].map(n => `
        <button type="button" class="option-btn" data-upgrades="${n}">${n}</button>
    `).join('');
    const qualityDiv = document.getElementById('qualityOptions');
    qualityDiv.innerHTML = QUALITIES.map(q => `
        <button type="button" class="option-btn" data-quality="${q.id}">${q.name}</button>
    `).join('');
    pendingSubstat = { upgrades: 0, quality: 'mid' };
    upgradesDiv.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            upgradesDiv.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            pendingSubstat.upgrades = parseInt(btn.dataset.upgrades, 10);
        });
    });
    qualityDiv.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            qualityDiv.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            pendingSubstat.quality = btn.dataset.quality;
        });
    });
    qualityDiv.querySelector('[data-quality="mid"]').classList.add('selected');
    upgradesDiv.querySelector('[data-upgrades="0"]').classList.add('selected');
    document.getElementById('substatStep2').classList.remove('hidden');
}

function confirmSubstat() {
    const slot = currentArtifactCard?.dataset?.slot;
    if (!slot || selectedSubstatForModal == null) return;
    const sub = getSubstats().find(s => s.id === selectedSubstatForModal);
    const pending = pendingSubstat;
    const value = getSubstatValue(sub.id, pending.quality, pending.upgrades);
    pieceData[slot].substats[currentSubstatIndex] = {
        id: sub.id,
        name: sub.name,
        upgrades: pending.upgrades,
        quality: pending.quality,
        value
    };
    updateCardDisplay(slot);
    closeSubstatModal();
}

function closeSubstatModal() {
    document.getElementById('substatModal').classList.remove('show');
    document.getElementById('substatStep1').classList.remove('hidden');
    document.getElementById('substatStep2').classList.add('hidden');
    currentArtifactCard = null;
    currentSubstatIndex = null;
    selectedSubstatForModal = null;
}

function updateCardDisplay(slot) {
    const card = document.querySelector(`.artifact-card[data-slot="${slot}"]`);
    if (!card) return;
    const data = pieceData[slot];
    const setBtn = card.querySelector('.artifact-set-btn');
    if (data.set && data.item) {
        setBtn.innerHTML = `<img src="${data.item.icon}" alt="" class="set-icon-sm">`;
        setBtn.title = data.set.name;
    } else {
        setBtn.innerHTML = '+';
        setBtn.title = 'Выбрать сет';
    }
    const mainStatEl = card.querySelector('.main-stat');
    const subStatEls = card.querySelectorAll('.sub-stat');
    if (data.mainStat) {
        mainStatEl.textContent = `${data.mainStat.name} (${data.mainStat.value})`;
    } else {
        mainStatEl.textContent = 'Главный стат';
    }
    data.substats.forEach((s, i) => {
        subStatEls[i].textContent = s ? `${s.name} +${s.value}` : '—';
    });
    const footerWrap = card.querySelector('.artifact-card-footer');
    const footer = footerWrap?.querySelector('.drop-chance');
    const resinEl = footerWrap?.querySelector('.resin-count');
    if (footer) footer.textContent = '';
    if (resinEl) resinEl.textContent = '';
    const chance = calculateDropChance(slot);
    if (footer && chance !== null) {
        const str = chance < 0.0001 ? chance.toExponential(2) : chance.toFixed(4);
        footer.textContent = `Шанс: ${str}%`;
    }
    if (resinEl && chance !== null) {
        resinEl.textContent = 'Кол-во смолы: 1';
    }

    if (footerWrap) {
        let obtainedCb = footerWrap.querySelector('.obtained-artifact-checkbox');
        if (!obtainedCb) {
            obtainedCb = document.createElement('input');
            obtainedCb.type = 'checkbox';
            obtainedCb.className = 'obtained-artifact-checkbox';
            obtainedCb.title = 'Отметить артефакт как полученный';
            obtainedCb.addEventListener('change', () => {
                data.obtained = obtainedCb.checked;
                if (typeof window.updateObtainedForCurrentSet === 'function') {
                    window.updateObtainedForCurrentSet(slot, obtainedCb.checked);
                }
            });
            footerWrap.appendChild(obtainedCb);
        }

        const shouldShow = chance !== null;
        obtainedCb.checked = !!data.obtained;
        obtainedCb.classList.toggle('hidden', !shouldShow);
    }
}

function factorial(n) {
    if (n < 0 || n > 20) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}

function multinomial(n, parts) {
    let denom = 1;
    for (const p of parts) denom *= factorial(p);
    return factorial(n) / denom;
}

function calculateDropChance(slot) {
    const data = pieceData[slot];
    if (!data.set || !data.mainStat) return null;
    const isPlanar = data.set.type === 'planar';
    const cavernSets = Math.max(1, RELIC_SETS.filter(s => s.type === 'cavern').length);
    const planarSets = Math.max(1, RELIC_SETS.filter(s => s.type === 'planar').length);
    const pSet = isPlanar ? 1 / planarSets : 1 / cavernSets;
    const pPiece = isPlanar ? 1 / 2 : 1 / 4;
    const mainStats = getMainStatsForSlot(slot);
    const mainWeight = mainStats.find(m => m.id === data.mainStat.id)?.weight ?? 1;
    const totalMainWeight = mainStats.reduce((s, m) => s + (m.weight || 1), 0);
    const pMain = mainWeight / totalMainWeight;
    const subs = getSubstats();
    let pSubs = 1;
    const usedIds = [data.mainStat.id];
    for (const sub of data.substats) {
        if (!sub) break;
        const subDef = subs.find(s => s.id === sub.id);
        const available = subs.filter(s => !usedIds.includes(s.id));
        const subWeight = subDef?.weight ?? 1;
        const totalWeight = available.reduce((s, a) => s + (a.weight || 1), 0);
        pSubs *= subWeight / totalWeight;
        usedIds.push(sub.id);
    }
    const filled = data.substats.filter(Boolean);
    const upgradeCounts = filled.map(s => s.upgrades);
    const totalUpgrades = upgradeCounts.reduce((a, b) => a + b, 0);
    const pUpgrades = totalUpgrades > 0
        ? multinomial(totalUpgrades, upgradeCounts) * Math.pow(1 / 4, totalUpgrades)
        : 1;
    const pQuality = filled.length > 0 ? Math.pow(1 / 3, filled.length) : 1;
    let total = pSet * pPiece * pMain * pSubs;
    if (filled.length > 0) {
        total *= pUpgrades * pQuality;
    }
    return total * 100;
}

function getAllPiecesForSave() {
    const result = [];
    SLOTS.forEach(slot => {
        const d = pieceData[slot];
        if (!d.set || !d.mainStat) return;
        result.push({
            slot,
            setId: d.set.id,
            obtained: !!d.obtained,
            mainStat: { id: d.mainStat.id, name: d.mainStat.name, value: d.mainStat.value },
            substats: d.substats.filter(Boolean).map(s => ({
                id: s.id,
                name: s.name,
                upgrades: s.upgrades,
                quality: s.quality,
                value: s.value
            }))
        });
    });
    return result;
}

function loadSetIntoPieceData(pieces) {
    initPieceData();
    if (!pieces || !Array.isArray(pieces)) return;
    pieces.forEach(p => {
        const slot = p.slot;
        if (!SLOTS.includes(slot)) return;
        const relicSet = getSetById(p.setId);
        if (!relicSet) return;
        pieceData[slot].set = relicSet;
        pieceData[slot].item = getItemForSlot(relicSet, slot);
        pieceData[slot].mainStat = p.mainStat ? { ...p.mainStat } : null;
        pieceData[slot].obtained = !!p.obtained;
        const subs = p.substats || [];
        pieceData[slot].substats = [null, null, null, null].map((_, i) => {
            const s = subs[i];
            return s ? { id: s.id, name: s.name, upgrades: s.upgrades || 0, quality: s.quality || 'mid', value: s.value } : null;
        });
        updateCardDisplay(slot);
    });
}

function initArtifactCards() {
    initPieceData();
    document.querySelectorAll('.artifact-card').forEach(card => {
        const setBtn = card.querySelector('.artifact-set-btn');
        const mainStat = card.querySelector('.main-stat.selectable');
        const subStats = card.querySelectorAll('.sub-stat.selectable');
        setBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            openSetSelectionModal(card);
        });
        mainStat?.addEventListener('click', (e) => {
            e.stopPropagation();
            openMainStatModal(card);
        });
        subStats.forEach((el, i) => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                openSubstatModal(card, el.dataset.sub || i);
            });
        });
    });
}
