let sets = [];
let currentCharacter = null;
let currentEditingSetId = null;

const addSetBtn = document.getElementById('addSetBtn');
const setsList = document.getElementById('sets-list');
const createSetModal = document.getElementById('createSetModal');
const closeModal = document.querySelector('.close-modal');
const addCharacterBtn = document.getElementById('addCharacterBtn');
const characterDropdown = document.getElementById('characterDropdown');

addSetBtn.addEventListener('click', () => {
    createSetModal.classList.add('show');
    addCharacterBtn.classList.remove('hidden');
    characterDropdown.classList.add('hidden');
});

closeModal.addEventListener('click', () => {
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
});

function renderCharacterOptions() {
    characterDropdown.innerHTML = CHARACTERS.map(character => `
        <div class="character-option" data-character="${character.id}">
            <div class="character-icon">
                <img src="${character.icon}" alt="${character.name}">
            </div>
            <span>${character.name}</span>
        </div>
    `).join('');
}

function initCharacterOptions() {
    renderCharacterOptions();
    characterDropdown.querySelectorAll('.character-option').forEach(option => {
        option.addEventListener('click', () => {
            const character = getCharacterById(option.dataset.character);
            if (!character) return;

            createSetModal.classList.remove('show');
            addCharacterBtn.classList.remove('hidden');
            characterDropdown.classList.add('hidden');
            openArtifactModal(character);
        });
    });
}

function openArtifactModal(character, setData) {
    currentCharacter = character;
    currentEditingSetId = setData?.id ?? null;
    const artifactModal = document.getElementById('artifactModal');
    document.getElementById('selectedCharacterName').textContent = character.name;
    document.getElementById('selectedCharacterImg').src = character.photo;
    if (setData?.pieces && typeof loadSetIntoPieceData === 'function') {
        loadSetIntoPieceData(setData.pieces);
    } else if (typeof initPieceData === 'function' && typeof updateCardDisplay === 'function') {
        initPieceData();
        ['head', 'hands', 'body', 'feet', 'sphere', 'rope'].forEach(slot => updateCardDisplay(slot));
    }
    artifactModal.classList.add('show');
}

function saveSet() {
    if (!currentCharacter) {
        alert('Выберите персонажа');
        return;
    }
    const nameSetModal = document.getElementById('nameSetModal');
    const input = document.getElementById('setNameInput');
    const existing = currentEditingSetId ? sets.find(s => s.id === currentEditingSetId) : null;
    input.value = existing ? existing.setName : '';
    nameSetModal.classList.add('show');
    input.focus();
}

function openSet(id) {
    const set = sets.find(s => s.id === id);
    if (!set) return;
    const character = getCharacterById(set.characterId);
    if (!character) return;
    openArtifactModal(character, set);
}

function confirmSetName() {
    const setName = document.getElementById('setNameInput').value.trim();

    if (!setName) {
        alert('Введите название сета');
        return;
    }

    const pieces = typeof getAllPiecesForSave === 'function' ? getAllPiecesForSave() : [];
    if (currentEditingSetId !== null) {
        const existing = sets.find(s => s.id === currentEditingSetId);
        if (existing) {
            existing.setName = setName;
            existing.characterName = currentCharacter.name;
            existing.characterId = currentCharacter.id;
            existing.pieces = pieces;
        }
    } else {
        sets.push({
            id: Date.now(),
            setName,
            characterName: currentCharacter.name,
            characterId: currentCharacter.id,
            pieces
        });
    }
    renderSets();
    closeNameModal();
    closeArtifactModal();
    currentCharacter = null;
    currentEditingSetId = null;
}

function closeNameModal() {
    const nameSetModal = document.getElementById('nameSetModal');
    nameSetModal.classList.remove('show');
}

function closeArtifactModal() {
    const artifactModal = document.getElementById('artifactModal');
    artifactModal.classList.remove('show');
    currentEditingSetId = null;
}

Promise.all([
    loadCharacters(),
    loadRelicData()
]).then(() => {
    initCharacterOptions();
    initArtifactCards();
    renderSets();
}).catch(err => {
    console.error('Failed to load:', err);
    setsList.innerHTML = '<p class="empty-message">Ошибка загрузки</p>';
});

function addSet() {
    const setNumber = sets.length + 1;
    const newSet = {
        id: Date.now(),
        name: `Сет ${setNumber}`,
        pieces: []
    };

    sets.push(newSet);
    renderSets();
}

function renderSets() {
    if (sets.length === 0) {
        setsList.innerHTML = '<p class="empty-message">Нет добавленных сетов</p>';
        return;
    }

    setsList.innerHTML = '';

    sets.forEach(set => {
        const character = getCharacterById(set.characterId);
        const photoSrc = character ? character.photo : 'src/images/character_demo.jpg';
        const setItem = document.createElement('div');
        setItem.className = 'set-item';
        setItem.innerHTML = `
            <span class="set-item-name">${set.setName}</span>
            <img src="${photoSrc}" alt="${set.characterName}" class="set-item-photo" onclick="openSet(${set.id})">
            <div class="set-item-actions">
                <button class="open-set-btn" onclick="openSet(${set.id})">Открыть</button>
                <button class="remove-set-btn" onclick="removeSet(${set.id}); event.stopPropagation()">Удалить</button>
            </div>
        `;
        setsList.appendChild(setItem);
    });
}

function removeSet(id) {
    sets = sets.filter(set => set.id !== id);
    renderSets();
}
