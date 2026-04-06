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
let setsViewMode      = 'local';

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
const setsWindowTitle  = document.getElementById('setsWindowTitle');
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
            const normalized = {
                ...s,
                id: s.id,
                setName: s.setName || s.name || '',
                characterName: s.characterName || s.character_name || '',
                characterId: s.characterId || s.character_id || null,
                createdAt: s.createdAt || s.created_at || s.id || Date.now(),
                tags: Array.isArray(s.tags) ? s.tags : []
            };
            const pieces = Array.isArray(s.pieces) ? s.pieces : [];
            pieces.forEach(p => {
                if (p && typeof p === 'object' && typeof p.obtained !== 'boolean') {
                    p.obtained = false;
                }
            });
            return {
                ...normalized,
                pieces,
                source: s.source || (setsViewMode === 'public' ? 'public' : 'local')
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
        if (!raw) { sets = []; return; }
        sets = normalizeSetsForUi(JSON.parse(raw));
    } catch { sets = []; }
}

function mapBuildRowToUi(row) {
    const piecesCount = Number(row.pieces_count || 0);
    const obtainedCount = Number(row.obtained_count || 0);
    const pieces = Array.from({ length: piecesCount }).map((_, i) => ({
        slot: `slot_${i}`,
        obtained: i < obtainedCount
    }));

    return {
        id: row.id,
        setName: row.name,
        characterName: row.character_name,
        characterId: row.character_id,
        tags: Array.isArray(row.tags) ? row.tags : [],
        createdAt: row.created_at || Date.now(),
        pieces,
        source: 'owned',
        is_public: !!row.is_public
    };
}

async function loadOwnedBuilds() {
    const res = await fetch(`${API_BASE}/builds?limit=100`);
    if (res.status === 401) {
        sets = [];
        return;
    }
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const payload = await res.json();
    const builds = Array.isArray(payload?.builds) ? payload.builds : [];
    sets = normalizeSetsForUi(builds.map(mapBuildRowToUi));
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

async function openSet(id) {
    const set       = sets.find(s => s.id === id);
    if (!set) return;

    if (set.source === 'public' || set.source === 'owned') {
        try {
            const res = await fetch(`${API_BASE}/builds/${set.id}`);
            if (!res.ok) throw new Error(`API error ${res.status}`);
            const build = await res.json();

            if (set.source === 'owned') {
                const character = getCharacterById(build.character_id) || {
                    id: build.character_id, name: build.character_name || build.character_id,
                    icon: build.icon_url || '', photo: build.icon_url || '',
                    element: build.element || '', path: '', rarity: build.rarity === 5 ? '5 Star' : '4 Star'
                };
                const pieces = (build.pieces || []).map(p => ({
                    slot: p.slot, setId: p.set_id, obtained: !!p.obtained,
                    mainStat: p.main_stat_id ? { id: p.main_stat_id, name: p.main_stat_name || p.main_stat_id, value: p.main_stat_value || '' } : null,
                    substats: (p.substats || []).map(s => ({ id: s.stat_id, name: s.name || s.stat_id, upgrades: s.upgrades || 0, quality: s.quality || 'mid', value: s.value || '' }))
                }));
                openArtifactModal(character, { id: build.id, pieces });
                updateVisibilityRow(build.id, !!build.is_public);
            } else {
                openSharedBuild(build);
            }
        } catch (err) {
            console.error('Не удалось открыть билд:', err);
            alert('Не удалось открыть билд');
        }
        return;
    }

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

    const editingId      = currentEditingSetId;
    const savedCharacter = currentCharacter;
    const savedIsPublic  = currentBuildIsPublic;
    const isPublic       = document.getElementById('setIsPublic')?.checked !== false;

    sets = normalizeSetsForUi(sets);
    if (!window.Auth?.isLoggedIn()) {
        saveSetsToStorage();
    }
    renderSets();
    closeNameModal();
    closeArtifactModal();

    if (editingId === null) {
        postBuildToApi(savedCharacter.id, setName, tags, pieces, isPublic)
            .then(build => { if (isPublic) showShareModal(build.id); })
            .catch(err => console.warn('API save failed:', err));
    } else if (typeof editingId === 'string') {
        fetch(`${API_BASE}/builds/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: setName,
                character_id: savedCharacter.id,
                tags,
                pieces,
                is_public: savedIsPublic ?? true
            })
        }).catch(err => console.warn('API update failed:', err));
    }
}

function closeNameModal() {
    document.getElementById('nameSetModal').classList.remove('show');
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
    const isPublicMode = setsViewMode === 'public';
    const isLoggedIn = !!(window.Auth && window.Auth.isLoggedIn && window.Auth.isLoggedIn());

    if (setsWindowTitle) {
        setsWindowTitle.textContent = isPublicMode
            ? 'Публичные билды'
            : (isLoggedIn ? 'Ваши сеты (аккаунт)' : 'Ваши сеты (локально)');
    }

    if (sets.length === 0) {
        setsList.innerHTML = `
            <div class="empty-state">
                <p class="empty-message">${isPublicMode ? 'Публичные билды не найдены' : 'Нет добавленных сетов'}</p>
                <p class="empty-hint">${isPublicMode ? 'Попробуйте позже или смените фильтры.' : 'Нажмите «Добавить сет», чтобы создать первый билд'}</p>
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

        const safeId = JSON.stringify(set.id);
        const authorHtml = (set.source === 'public' && set.username)
            ? `<div class="set-card-char">
                 <button class="link-btn set-author-link"
                         onclick='event.stopPropagation(); loadUserProfile(${JSON.stringify(set.username)})'>
                   ${escapeHtml(set.username)}
                 </button>
               </div>`
            : '';
        const likeHtml = set.source === 'public'
            ? `<button class="like-btn ${set.user_has_liked ? 'liked' : ''}"
                       onclick='event.stopPropagation(); toggleLike(${safeId})'>
                 ♥ <span class="like-count">${set.likes_count || 0}</span>
               </button>`
            : '';


        const item = document.createElement('div');
        item.className = 'set-item';
        item.dataset.id = String(set.id);
        item.style.setProperty('--i', idx);
        item.innerHTML = `
            ${photoSrc
                ? `<img src="${photoSrc}" class="set-card-bg-img" alt=""
                        onerror="this.style.display='none'">`
                : ''}
            <div class="set-card-glow"></div>
            <div class="set-card-top" onclick='openSet(${safeId})'>
                <div class="set-card-info">
                    <div class="set-card-name">${escapeHtml(set.setName || '')}</div>
                    <div class="set-card-char">
                        ${element
                            ? `<span class="set-char-element-label" style="color:${elColor}">${elName}</span>`
                            : ''}
                        <span class="set-card-charname">${escapeHtml(set.characterName || '')}</span>
                    </div>
                    ${authorHtml}
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
                ? `<div class="set-card-relics-row" onclick='openSet(${safeId})'>${relicIconsHtml}</div>`
                : ''}
            <div class="set-item-actions">
                <button class="open-set-btn" onclick='openSet(${safeId})'>Открыть</button>
                ${likeHtml}
                ${set.source !== 'public'
                    ? `<button class="remove-set-btn" onclick='removeSet(${safeId}); event.stopPropagation()'>Удалить</button>`
                    : ''}
            </div>
        `;
        setsList.appendChild(item);
    });
}

function removeSet(id) {
    if (!confirm('Удалить сет?')) return;

    const target = sets.find(s => s.id === id);
    if (target?.source === 'owned') {
        fetch(`${API_BASE}/builds/${id}`, { method: 'DELETE' })
            .then(res => {
                if (!res.ok) throw new Error(`API error ${res.status}`);
                return loadCurrentViewData();
            })
            .then(() => renderSets())
            .catch(err => {
                console.error('Не удалось удалить билд:', err);
                alert('Не удалось удалить билд');
            });
        return;
    }

    sets = sets.filter(s => s.id !== id);
    const stillExists = sets.some(s => (s.tags || []).includes(setsActiveTag));
    if (!stillExists) setsActiveTag = '';
    saveSetsToStorage();
    renderSets();
}

// ── Инициализация тулбара ────────────────────────────────

function initToolbar() {
    const viewModeSelect = document.getElementById('viewModeSelect');
    if (viewModeSelect) {
        viewModeSelect.value = setsViewMode;
        viewModeSelect.dataset.mode = setsViewMode;
        viewModeSelect.addEventListener('change', async e => {
            setsViewMode = e.target.value === 'public' ? 'public' : 'local';
            e.target.dataset.mode = setsViewMode;
            setsActiveTag = '';
            await loadCurrentViewData();
            renderSets();
            updateViewUiControls();
        });
    }

    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', async e => {
            setsSortBy = e.target.value;
            if (setsViewMode === 'public') {
                await loadPublicBuilds(activeProfileUsername);
            }
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

const API_BASE = '/api';

function updateViewUiControls() {
    const isPublicMode = setsViewMode === 'public';
    if (addSetBtn) addSetBtn.style.display = isPublicMode ? 'none' : '';
}

async function loadPublicBuilds(username = null) {
    const params = new URLSearchParams({ limit: 100 });
    if (username) params.set('username', username);
    if (setsSortBy === 'likes') params.set('sort', 'likes');
    const res = await fetch(`${API_BASE}/builds/public?${params}`);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    const builds = Array.isArray(data?.builds) ? data.builds : [];
    sets = normalizeSetsForUi(builds.map(b => ({
        ...b,
        source: 'public',
        likes_count: Number(b.likes_count || 0),
        user_has_liked: !!b.user_has_liked
    })));
}

async function loadCurrentViewData() {
    if (setsViewMode === 'public') {
        await loadPublicBuilds();
        return;
    }
    if (window.Auth && window.Auth.isLoggedIn && window.Auth.isLoggedIn()) {
        await loadOwnedBuilds();
        return;
    }
    loadSetsFromStorage();
}

window.onAuthStateChanged = async function() {
    if (setsViewMode === 'public') return;
    setsActiveTag = '';
    await loadCurrentViewData();
    renderSets();
    updateViewUiControls();
};

async function postBuildToApi(characterId, name, tags, pieces, is_public = true) {
    const res = await fetch(`${API_BASE}/builds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id: characterId, name, tags, pieces, is_public })
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
    currentBuildIsPublic = null;
    updateVisibilityRow(null, null);

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

// ── Видимость билда (в модалке) ───────────────────────────

let currentBuildIsPublic = null;

function updateVisibilityRow(buildId, isPublic) {
    const row    = document.getElementById('buildVisibilityRow');
    const badge  = document.getElementById('buildVisibilityBadge');
    const toggle = document.getElementById('buildVisibilityToggle');
    const link   = document.getElementById('buildCopyLink');
    if (!row) return;

    if (!buildId) { row.classList.add('hidden'); return; }

    currentBuildIsPublic = isPublic;
    badge.textContent  = isPublic ? 'Публичный' : 'Приватный';
    badge.className    = `visibility-badge ${isPublic ? 'public' : 'private'}`;
    toggle.textContent = isPublic ? 'Скрыть' : 'Опубликовать';
    link.classList.toggle('hidden', !isPublic);
    row.classList.remove('hidden');
}

async function toggleCurrentBuildVisibility() {
    if (currentEditingSetId == null || currentBuildIsPublic === null) return;
    try {
        const res = await fetch(`${API_BASE}/builds/${currentEditingSetId}/visibility`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_public: !currentBuildIsPublic })
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        const set = sets.find(s => s.id === currentEditingSetId);
        if (set) set.is_public = data.is_public;
        updateVisibilityRow(currentEditingSetId, data.is_public);
        renderSets();
    } catch (err) {
        console.warn('toggleVisibility failed:', err);
    }
}

function copyCurrentBuildLink() {
    if (currentEditingSetId == null) return;
    const url = `${location.origin}${location.pathname}?share=${currentEditingSetId}`;
    navigator.clipboard?.writeText(url).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = url; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
    });
    const btn = document.getElementById('buildCopyLink');
    if (btn) { btn.textContent = 'Скопировано!'; setTimeout(() => { btn.textContent = 'Ссылка'; }, 1500); }
}

window.toggleCurrentBuildVisibility = toggleCurrentBuildVisibility;
window.copyCurrentBuildLink = copyCurrentBuildLink;

// ── Лайки ─────────────────────────────────────────────────

async function toggleLike(buildId) {
    if (!window.Auth?.isLoggedIn()) {
        openLoginModal();
        return;
    }
    const set = sets.find(s => s.id === buildId);
    if (!set) return;
    const method = set.user_has_liked ? 'DELETE' : 'POST';
    try {
        const res = await fetch(`${API_BASE}/builds/${buildId}/like`, { method });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        set.likes_count = data.likes_count;
        set.user_has_liked = data.user_has_liked;
        // обновляем только кнопку лайка, не пересоздавая карточки
        const btn = document.querySelector(`.set-item[data-id=${JSON.stringify(String(buildId))}] .like-btn`);
        if (btn) {
            btn.classList.toggle('liked', data.user_has_liked);
            const countEl = btn.querySelector('.like-count');
            if (countEl) countEl.textContent = data.likes_count;
        } else {
            renderSets();
        }
    } catch (err) {
        console.warn('Like failed:', err);
    }
}

// ── Профили пользователей ─────────────────────────────────

let activeProfileUsername = null;

async function loadUserProfile(username) {
    setsViewMode = 'public';
    document.getElementById('viewModeSelect').value = 'public';
    activeProfileUsername = username;

    const banner = document.getElementById('profileBanner');
    if (banner) {
        banner.classList.remove('hidden');
        document.getElementById('profileBannerText').textContent = `Сеты пользователя: ${username}`;
    }

    await loadPublicBuilds(username);
    renderSets();
    updateViewUiControls();
}

function clearProfileFilter() {
    activeProfileUsername = null;
    const banner = document.getElementById('profileBanner');
    if (banner) banner.classList.add('hidden');
    loadPublicBuilds().then(() => renderSets());
}

function goToMyProfile() {
    const usernameEl = document.getElementById('userUsername');
    const username = usernameEl?.textContent?.trim();
    if (username) loadUserProfile(username);
}

window.toggleLike = toggleLike;
window.loadUserProfile = loadUserProfile;
window.clearProfileFilter = clearProfileFilter;
window.goToMyProfile = goToMyProfile;

// ── Точка входа ───────────────────────────────────────────

Promise.allSettled([loadCharacters(), loadRelicData()])
    .then(() => {
        initCharacterOptions();
        initArtifactCards();
        updateViewUiControls();

        const params    = new URLSearchParams(location.search);
        const shareId   = params.get('share');
        const userParam = params.get('user');

        if (shareId) {
            history.replaceState({}, '', location.pathname);
            loadSharedBuild(shareId);
            loadCurrentViewData().then(() => renderSets()).catch(() => { sets = []; renderSets(); });
        } else if (userParam) {
            loadUserProfile(userParam);
        } else {
            loadCurrentViewData()
                .then(() => renderSets())
                .catch(() => { sets = []; renderSets(); });
        }
        initToolbar();
    });
