/* ============================================================
   script.js — главная логика конструктора реликвий HSR
   ============================================================ */

// ── Состояние ─────────────────────────────────────────────

let sets = [];
let currentCharacter = null;
let currentEditingSetId = null;

/** Фильтры и сортировка для списка сетов */
let setsSearchQuery   = '';
let setsActiveElement = '';
let setsActiveTag     = '';
let setsSortBy        = 'date-desc';

const SETS_STORAGE_KEY = 'constructor_hsr_sets_v1';

// ── Справочники элементов ──────────────────────────────────

const ELEMENT_COLORS = {
    Lightning: '#c060e0',
    Fire:      '#e07060',
    Ice:       '#60b8d8',
    Wind:      '#50d080',
    Quantum:   '#8060d8',
    Imaginary: '#d4b840',
    Physical:  '#a8a8a8'
};

const ELEMENT_NAMES = {
    Lightning: 'Электрический',
    Fire:      'Огненный',
    Ice:       'Ледяной',
    Wind:      'Ветряной',
    Quantum:   'Квантовый',
    Imaginary: 'Мнимый',
    Physical:  'Физический'
};

// ── DOM-ссылки ─────────────────────────────────────────────

const addSetBtn        = document.getElementById('addSetBtn');
const setsList         = document.getElementById('sets-list');
const createSetModal   = document.getElementById('createSetModal');
const closeModalBtn    = document.querySelector('#createSetModal .close-modal');
const addCharacterBtn  = document.getElementById('addCharacterBtn');
const characterDropdown = document.getElementById('characterDropdown');

// ── Открытие модала создания сета ─────────────────────────

addSetBtn.addEventListener('click', () => {
    createSetModal.classList.add('show');
    addCharacterBtn.classList.remove('hidden');
    characterDropdown.classList.add('hidden');
});

closeModalBtn.addEventListener('click', () => {
    createSetModal.classList.remove('show');
});

window.addEventListener('click', (e) => {
    if (e.target === createSetModal) {
        createSetModal.classList.remove('show');
    }
});

addCharacterBtn.addEventListener('click', () => {
    addCharacterBtn.classList.add('hidden');
    characterDropdown.classList.remove('hidden');
    const input = document.getElementById('charSearchInput');
    if (input) { input.value = ''; charSearchQuery = ''; }
    renderCharacterOptions();
    renderCharElementFilters();
});

// ── Дропдаун персонажей ───────────────────────────────────

let charSearchQuery  = '';
let charActiveElement = '';

function renderCharElementFilters() {
    const container = document.getElementById('charElementFilters');
    if (!container) return;
    const elements = [...new Set(CHARACTERS.map(c => c.element).filter(Boolean))].sort();
    container.innerHTML = `
        <button class="element-chip ${charActiveElement === '' ? 'active' : ''}" data-element=""
                style="--el-color: #00d4ff">Все</button>
        ${elements.map(el => `
            <button class="element-chip ${charActiveElement === el ? 'active' : ''}"
                    data-element="${el}"
                    style="--el-color: ${ELEMENT_COLORS[el] || '#aaa'}">
                ${ELEMENT_NAMES[el] || el}
            </button>
        `).join('')}
    `;
    container.querySelectorAll('.element-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            charActiveElement = btn.dataset.element;
            container.querySelectorAll('.element-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderCharacterOptions();
        });
    });
}

function renderCharacterOptions() {
    const list = document.getElementById('charOptionsList');
    if (!list) return;

    const filtered = CHARACTERS.filter(c => {
        const matchSearch = !charSearchQuery ||
            c.name.toLowerCase().includes(charSearchQuery.toLowerCase());
        const matchElement = !charActiveElement || c.element === charActiveElement;
        return matchSearch && matchElement;
    });

    if (filtered.length === 0) {
        list.innerHTML = '<p class="char-no-results">Персонажи не найдены</p>';
        return;
    }

    list.innerHTML = filtered.map(c => `
        <div class="character-option" data-character="${c.id}">
            <div class="character-icon-wrap">
                <img src="${c.icon}" alt="${c.name}" class="character-icon-img"
                     onerror="this.style.display='none'">
                ${c.element
                    ? `<span class="char-element-dot"
                             style="background:${ELEMENT_COLORS[c.element] || '#aaa'}"
                             title="${ELEMENT_NAMES[c.element] || c.element}"></span>`
                    : ''}
            </div>
            <div class="character-option-info">
                <span class="character-option-name">${c.name}</span>
                ${c.element
                    ? `<span class="character-option-element"
                             style="color:${ELEMENT_COLORS[c.element] || '#aaa'}">
                           ${ELEMENT_NAMES[c.element] || c.element}
                       </span>`
                    : ''}
            </div>
            <span class="char-rarity-star ${c.rarity === '5 Star' ? '' : 'four-star'}">
                ${c.rarity === '5 Star' ? '★★★★★' : '★★★★'}
            </span>
        </div>
    `).join('');

    list.querySelectorAll('.character-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const character = getCharacterById(opt.dataset.character);
            if (!character) return;
            charSearchQuery  = '';
            charActiveElement = '';
            createSetModal.classList.remove('show');
            addCharacterBtn.classList.remove('hidden');
            characterDropdown.classList.add('hidden');
            openArtifactModal(character);
        });
    });
}

function initCharacterOptions() {
    renderCharacterOptions();
    const searchInput = document.getElementById('charSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', e => {
            charSearchQuery = e.target.value;
            renderCharacterOptions();
        });
    }
}

// ── Модал реликвий ────────────────────────────────────────

function openArtifactModal(character, setData) {
    currentCharacter = character;
    currentEditingSetId = setData?.id ?? null;

    const artifactModal = document.getElementById('artifactModal');
    document.getElementById('selectedCharacterName').textContent = character.name;
    document.getElementById('selectedCharacterImg').src = character.photo;

    // Значок элемента
    const elBadge = document.getElementById('selectedCharacterElement');
    if (elBadge) {
        if (character.element) {
            elBadge.textContent = ELEMENT_NAMES[character.element] || character.element;
            elBadge.style.background = ELEMENT_COLORS[character.element] || 'transparent';
            elBadge.style.display = 'inline-flex';
        } else {
            elBadge.style.display = 'none';
        }
    }

    if (setData?.pieces && typeof loadSetIntoPieceData === 'function') {
        loadSetIntoPieceData(setData.pieces);
    } else if (typeof initPieceData === 'function') {
        initPieceData();
        ['head', 'hands', 'body', 'feet', 'sphere', 'rope'].forEach(slot => {
            if (typeof updateCardDisplay === 'function') updateCardDisplay(slot);
        });
    }

    updateModalSummary();
    artifactModal.classList.add('show');
}

/** Обновляет итоговую панель в модале реликвий */
function updateModalSummary() {
    const slots = ['head', 'hands', 'body', 'feet', 'sphere', 'rope'];
    let totalResin = 0;
    let combinedChance = 1;
    let hasAnyChance = false;
    let obtainedCount = 0;
    let configuredCount = 0;

    if (typeof pieceData !== 'undefined') {
        slots.forEach(slot => {
            const d = pieceData[slot];
            if (!d) return;
            if (d.obtained) obtainedCount++;
            if (!d.set || !d.mainStat) return;
            configuredCount++;
            const chance = typeof calculateDropChance === 'function'
                ? calculateDropChance(slot) : null;
            if (chance !== null && chance > 0) {
                hasAnyChance = true;
                const isPlanar = d.set?.type === 'planar';
                const stamPerPiece = isPlanar ? 20 : 10;
                totalResin += Math.round((100 / chance) * stamPerPiece);
                combinedChance *= chance / 100;
            }
        });
    }

    const resinEl   = document.getElementById('totalResinValue');
    const chanceEl  = document.getElementById('totalChanceValue');
    const obtainedEl = document.getElementById('totalObtainedValue');

    if (resinEl) {
        resinEl.textContent = hasAnyChance ? formatStamina(totalResin) : '—';
    }
    if (chanceEl && hasAnyChance) {
        const pct = combinedChance * 100;
        chanceEl.textContent = pct < 1e-6
            ? pct.toExponential(2) + '%'
            : pct.toFixed(6) + '%';
    } else if (chanceEl) {
        chanceEl.textContent = '—';
    }
    if (obtainedEl) {
        obtainedEl.textContent = `${obtainedCount} / ${slots.length}`;
    }
}

window.updateObtainedForCurrentSet = function(slot, obtained) {
    if (!slot || typeof obtained !== 'boolean') return;
    if (currentEditingSetId == null) return;
    const set = sets.find(s => s.id === currentEditingSetId);
    if (!set || !Array.isArray(set.pieces)) return;
    const piece = set.pieces.find(p => p.slot === slot);
    if (piece) {
        piece.obtained = obtained;
        saveSetsToStorage();
    }
    updateModalSummary();
};

// ── Хранилище ─────────────────────────────────────────────

function normalizeSetsForUi(nextSets) {
    if (!Array.isArray(nextSets)) return [];
    return nextSets
        .filter(s => s && typeof s === 'object')
        .map(s => {
            const pieces = Array.isArray(s.pieces) ? s.pieces : [];
            pieces.forEach(p => {
                if (p && typeof p === 'object' && typeof p.obtained !== 'boolean') {
                    p.obtained = false;
                }
            });
            return {
                ...s,
                pieces,
                tags: Array.isArray(s.tags) ? s.tags : [],
                createdAt: s.createdAt || s.id || Date.now()
            };
        });
}

function saveSetsToStorage() {
    try {
        localStorage.setItem(SETS_STORAGE_KEY, JSON.stringify(sets));
    } catch { /* ignore */ }
}

function loadSetsFromStorage() {
    try {
        const raw = localStorage.getItem(SETS_STORAGE_KEY);
        if (!raw) return;
        sets = normalizeSetsForUi(JSON.parse(raw));
    } catch { /* ignore */ }
}

// ── Сохранение сета ───────────────────────────────────────

function saveSet() {
    if (!currentCharacter) {
        alert('Выберите персонажа');
        return;
    }
    const nameSetModal = document.getElementById('nameSetModal');
    const input        = document.getElementById('setNameInput');
    const tagsInput    = document.getElementById('setTagsInput');
    const existing     = currentEditingSetId
        ? sets.find(s => s.id === currentEditingSetId) : null;

    input.value = existing ? existing.setName : '';
    if (tagsInput) tagsInput.value = existing?.tags?.join(', ') || '';

    nameSetModal.classList.add('show');
    input.focus();
}

function openSet(id) {
    const set       = sets.find(s => s.id === id);
    if (!set) return;
    const character = getCharacterById(set.characterId);
    if (!character) return;
    openArtifactModal(character, set);
}

function confirmSetName() {
    const setName = document.getElementById('setNameInput').value.trim();
    if (!setName) { alert('Введите название сета'); return; }

    const tagsInput = document.getElementById('setTagsInput');
    const tags = tagsInput
        ? tagsInput.value.split(',').map(t => t.trim()).filter(Boolean)
        : [];

    const pieces = typeof getAllPiecesForSave === 'function' ? getAllPiecesForSave() : [];

    if (currentEditingSetId !== null) {
        const existing = sets.find(s => s.id === currentEditingSetId);
        if (existing) {
            const obtainedMap = new Map(
                (existing.pieces || []).map(p => [p.slot, !!p.obtained])
            );
            pieces.forEach(p => {
                if (typeof p.obtained !== 'boolean') {
                    p.obtained = obtainedMap.get(p.slot) ?? false;
                }
            });
            existing.setName      = setName;
            existing.characterName = currentCharacter.name;
            existing.characterId   = currentCharacter.id;
            existing.pieces        = pieces;
            existing.tags          = tags;
        }
    } else {
        pieces.forEach(p => { if (typeof p.obtained !== 'boolean') p.obtained = false; });
        sets.push({
            id:            Date.now(),
            createdAt:     Date.now(),
            setName,
            characterName: currentCharacter.name,
            characterId:   currentCharacter.id,
            pieces,
            tags
        });
    }

    sets = normalizeSetsForUi(sets);
    saveSetsToStorage();
    renderSets();
    closeNameModal();
    closeArtifactModal();

    if (currentEditingSetId === null) {
        postBuildToApi(currentCharacter.id, setName, tags, pieces)
            .then(build => showShareModal(build.id))
            .catch(err => console.warn('API share failed:', err));
    }

    currentCharacter     = null;
    currentEditingSetId  = null;
}

function closeNameModal() {
    document.getElementById('nameSetModal').classList.remove('show');
}

// ── Экспорт / Импорт ─────────────────────────────────────

function exportSets() {
    if (sets.length === 0) { alert('Нет сетов для экспорта'); return; }
    const blob = new Blob([JSON.stringify(sets, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `hsr_builds_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function triggerImport() {
    document.getElementById('importFileInput').click();
}

function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
        try {
            const imported = normalizeSetsForUi(JSON.parse(ev.target.result));
            if (!imported.length) { alert('Нет данных для импорта'); return; }
            if (confirm(`Импортировать ${imported.length} сет(ов)? Дубли пропускаются.`)) {
                const existingIds = new Set(sets.map(s => s.id));
                let added = 0;
                imported.forEach(s => {
                    if (!existingIds.has(s.id)) { sets.push(s); added++; }
                });
                sets = normalizeSetsForUi(sets);
                saveSetsToStorage();
                renderSets();
                alert(`Добавлено ${added} сет(ов).`);
            }
        } catch {
            alert('Ошибка чтения файла — убедитесь, что это корректный JSON.');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
}

// ── Фильтрация / сортировка ───────────────────────────────

function getFilteredSortedSets() {
    let result = [...sets];

    if (setsSearchQuery) {
        const q = setsSearchQuery.toLowerCase();
        result = result.filter(s =>
            (s.setName || '').toLowerCase().includes(q) ||
            (s.characterName || '').toLowerCase().includes(q) ||
            (s.tags || []).some(t => t.toLowerCase().includes(q))
        );
    }

    if (setsActiveElement) {
        result = result.filter(s => {
            const char = getCharacterById(s.characterId);
            return char?.element === setsActiveElement;
        });
    }

    if (setsActiveTag) {
        result = result.filter(s =>
            (s.tags || []).includes(setsActiveTag)
        );
    }

    result.sort((a, b) => {
        switch (setsSortBy) {
            case 'date-asc':      return (a.createdAt || a.id) - (b.createdAt || b.id);
            case 'date-desc':     return (b.createdAt || b.id) - (a.createdAt || a.id);
            case 'name-asc':      return (a.setName || '').localeCompare(b.setName || '');
            case 'name-desc':     return (b.setName || '').localeCompare(a.setName || '');
            case 'progress-desc': {
                const pa = (a.pieces || []).filter(p => p.obtained).length;
                const pb = (b.pieces || []).filter(p => p.obtained).length;
                return pb - pa;
            }
            default: return 0;
        }
    });

    return result;
}

// ── Рендер списка сетов ───────────────────────────────────

/** Пересобирает чипы тегов по текущему массиву sets */
function refreshTagFilter() {
    const filterRow  = document.getElementById('setsTagFilter');
    const chipsWrap  = document.getElementById('setsTagChips');
    if (!filterRow || !chipsWrap) return;

    const allTags = [...new Set(sets.flatMap(s => s.tags || []))].sort();

    if (allTags.length === 0) {
        filterRow.classList.add('hidden');
        return;
    }

    filterRow.classList.remove('hidden');
    chipsWrap.innerHTML = allTags.map(tag => `
        <button class="tag-chip ${setsActiveTag === tag ? 'active' : ''}"
                data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
    `).join('');

    chipsWrap.querySelectorAll('.tag-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            // Повторный клик — снимает фильтр
            setsActiveTag = (setsActiveTag === btn.dataset.tag) ? '' : btn.dataset.tag;
            refreshTagFilter();
            renderSets();
        });
    });
}

function renderSets() {
    refreshTagFilter();
    const filtered = getFilteredSortedSets();

    if (sets.length === 0) {
        setsList.innerHTML = `
            <div class="empty-state">
                <p class="empty-message">Нет добавленных сетов</p>
                <p class="empty-hint">Нажмите «Добавить сет», чтобы создать первый билд</p>
            </div>`;
        return;
    }

    if (filtered.length === 0) {
        setsList.innerHTML = '<p class="empty-message">Ничего не найдено по заданным фильтрам</p>';
        return;
    }

    setsList.innerHTML = '';

    filtered.forEach((set, idx) => {
        const character      = getCharacterById(set.characterId);
        const photoSrc       = character?.photo || '';
        const element        = character?.element || '';
        const elColor        = ELEMENT_COLORS[element] || '#aaa';
        const elName         = ELEMENT_NAMES[element] || element;

        const obtainedCount  = (set.pieces || []).filter(p => p.obtained).length;
        const totalPieces    = (set.pieces || []).length || 6;
        const progressPct    = Math.round((obtainedCount / totalPieces) * 100);
        const isComplete     = obtainedCount >= 6;

        // Иконки предметов (индивидуальные piece-иконки)
        const relicIconsHtml = (set.pieces || []).map(p => {
            if (!p.setId) return '';
            const rs = typeof getSetById === 'function' ? getSetById(p.setId) : null;
            if (!rs) return '';
            const item = typeof getItemForSlot === 'function' ? getItemForSlot(rs, p.slot) : null;
            const iconSrc = item?.icon || rs.icon;
            if (!iconSrc) return '';
            return `<img src="${iconSrc}" alt="" class="set-card-relic-icon" title="${rs.name}">`;
        }).filter(Boolean).join('');

        // Теги
        const tagsHtml = (set.tags || []).slice(0, 5).map(tag =>
            `<span class="set-tag">${escapeHtml(tag)}</span>`
        ).join('');

        const item = document.createElement('div');
        item.className = 'set-item';
        item.style.setProperty('--i', idx);
        item.innerHTML = `
            ${photoSrc
                ? `<img src="${photoSrc}" class="set-card-bg-img" alt=""
                        onerror="this.style.display='none'">`
                : ''}
            <div class="set-card-glow"></div>
            <div class="set-card-top" onclick="openSet(${set.id})">
                <div class="set-card-info">
                    <div class="set-card-name">${escapeHtml(set.setName || '')}</div>
                    <div class="set-card-char">
                        ${element
                            ? `<span class="set-char-element-label" style="color:${elColor}">${elName}</span>`
                            : ''}
                        <span class="set-card-charname">${escapeHtml(set.characterName || '')}</span>
                    </div>
                    ${tagsHtml ? `<div class="set-card-tags">${tagsHtml}</div>` : ''}
                </div>
                <div class="set-card-progress-wrap">
                    <div class="set-card-progress-label">${obtainedCount}/6</div>
                    <div class="set-card-progress-bar">
                        <div class="set-card-progress-fill"
                             style="width:${progressPct}%;
                                    background:${isComplete ? '#50d080' : elColor}"></div>
                    </div>
                    <div class="set-card-progress-text">${progressPct}%</div>
                </div>
            </div>
            ${relicIconsHtml
                ? `<div class="set-card-relics-row" onclick="openSet(${set.id})">${relicIconsHtml}</div>`
                : ''}
            <div class="set-item-actions">
                <button class="open-set-btn"   onclick="openSet(${set.id})">Открыть</button>
                <button class="remove-set-btn" onclick="removeSet(${set.id}); event.stopPropagation()">Удалить</button>
            </div>
        `;
        setsList.appendChild(item);
    });
}

function removeSet(id) {
    if (!confirm('Удалить сет?')) return;
    sets = sets.filter(s => s.id !== id);
    // Если активный тег больше не существует — сбросить
    const stillExists = sets.some(s => (s.tags || []).includes(setsActiveTag));
    if (!stillExists) setsActiveTag = '';
    saveSetsToStorage();
    renderSets();
}

// ── Инициализация тулбара ────────────────────────────────

function initToolbar() {
    // Сортировка
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', e => {
            setsSortBy = e.target.value;
            renderSets();
        });
    }

    // Поиск
    const setsSearch = document.getElementById('setsSearchInput');
    if (setsSearch) {
        setsSearch.addEventListener('input', e => {
            setsSearchQuery = e.target.value;
            renderSets();
        });
    }

    // Фильтр по элементу (строка чипов над списком)
    const elFilter = document.getElementById('setsElementFilter');
    if (elFilter && CHARACTERS.length) {
        const elements = [...new Set(CHARACTERS.map(c => c.element).filter(Boolean))].sort();
        elFilter.innerHTML = `
            <button class="element-chip active" data-element="" style="--el-color:#00d4ff">Все</button>
            ${elements.map(el => `
                <button class="element-chip" data-element="${el}"
                        style="--el-color:${ELEMENT_COLORS[el] || '#aaa'}">
                    ${ELEMENT_NAMES[el] || el}
                </button>
            `).join('')}
        `;
        elFilter.querySelectorAll('.element-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                setsActiveElement = btn.dataset.element;
                elFilter.querySelectorAll('.element-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderSets();
            });
        });
    }

    // Экспорт / Импорт
    document.getElementById('exportBtn')?.addEventListener('click', exportSets);
    document.getElementById('importBtn')?.addEventListener('click', triggerImport);
    document.getElementById('importFileInput')?.addEventListener('change', handleImport);
}

// ── Утилиты ───────────────────────────────────────────────

/** Форматирует ожидаемые затраты смолы в читаемый вид */
function formatStamina(stamina) {
    if (!isFinite(stamina) || stamina <= 0) return '—';
    if (stamina < 1000)   return `≈${Math.round(stamina)}`;
    if (stamina < 100000) return `≈${(stamina / 1000).toFixed(1)}K`;
    if (stamina < 1e6)    return `≈${Math.round(stamina / 1000)}K`;
    return `≈${(stamina / 1e6).toFixed(1)}M`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.updateModalSummary = updateModalSummary;

const API_BASE = 'http://localhost:3001/api';

async function postBuildToApi(characterId, name, tags, pieces) {
    const res = await fetch(`${API_BASE}/builds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id: characterId, name, tags, pieces })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
}

function showShareModal(buildId) {
    const url = `${location.origin}${location.pathname}?share=${buildId}`;
    document.getElementById('shareUrlInput').value = url;
    document.getElementById('shareModal').classList.add('show');
}

function closeShareModal() {
    document.getElementById('shareModal').classList.remove('show');
}

function copyShareUrl() {
    const input = document.getElementById('shareUrlInput');
    input.select();
    navigator.clipboard?.writeText(input.value).catch(() => document.execCommand('copy'));
    const btn = document.getElementById('copyShareBtn');
    const orig = btn.textContent;
    btn.textContent = 'Скопировано!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
}

let isReadOnly = false;

async function loadSharedBuild(shareId) {
    try {
        const res = await fetch(`${API_BASE}/builds/${shareId}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const build = await res.json();
        openSharedBuild(build);
    } catch (err) {
        console.error('Failed to load shared build:', err);
        setsList.innerHTML = '<p class="empty-message">Не удалось загрузить сет по ссылке</p>';
    }
}

function openSharedBuild(build) {
    const character = getCharacterById(build.character_id) || {
        id:      build.character_id,
        name:    build.character_name || build.character_id,
        icon:    build.icon_url || '',
        photo:   build.icon_url || '',
        element: build.element || '',
        path:    '',
        rarity:  build.rarity === 5 ? '5 Star' : '4 Star'
    };

    const pieces = (build.pieces || []).map(p => ({
        slot:     p.slot,
        setId:    p.set_id,
        obtained: !!p.obtained,
        mainStat: p.main_stat_id
            ? { id: p.main_stat_id, name: p.main_stat_name || p.main_stat_id, value: p.main_stat_value || '' }
            : null,
        substats: (p.substats || []).map(s => ({
            id:       s.stat_id,
            name:     s.name || s.stat_id,
            upgrades: s.upgrades || 0,
            quality:  s.quality || 'mid',
            value:    s.value || ''
        }))
    }));

    isReadOnly = true;
    openArtifactModal(character, { id: null, pieces });

    const saveBtn = document.getElementById('saveSetBtn');
    if (saveBtn) saveBtn.style.display = 'none';
    document.querySelectorAll('.artifact-card .selectable, .artifact-set-btn').forEach(el => {
        el.style.pointerEvents = 'none';
        el.style.opacity = '0.7';
    });

    const modal = document.getElementById('artifactModal');
    let banner = modal.querySelector('.readonly-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.className = 'readonly-banner';
        banner.textContent = 'Режим просмотра — редактирование недоступно';
        modal.querySelector('.modal-content').prepend(banner);
    }
    banner.style.display = '';
}

function closeArtifactModal() {
    document.getElementById('artifactModal').classList.remove('show');
    currentEditingSetId = null;

    if (isReadOnly) {
        isReadOnly = false;
        const saveBtn = document.getElementById('saveSetBtn');
        if (saveBtn) saveBtn.style.display = '';
        document.querySelectorAll('.artifact-card .selectable, .artifact-set-btn').forEach(el => {
            el.style.pointerEvents = '';
            el.style.opacity = '';
        });
        const banner = document.getElementById('artifactModal')?.querySelector('.readonly-banner');
        if (banner) banner.style.display = 'none';
    }
}

// ── Точка входа ───────────────────────────────────────────

Promise.all([loadCharacters(), loadRelicData()])
    .then(() => {
        initCharacterOptions();
        initArtifactCards();

        const shareId = new URLSearchParams(location.search).get('share');
        if (shareId) {
            loadSharedBuild(shareId);
        } else {
            loadSetsFromStorage();
            renderSets();
        }
        initToolbar();
    })
    .catch(err => {
        console.error('Failed to load data:', err);
        setsList.innerHTML = '<p class="empty-message">Ошибка загрузки данных</p>';
    });
