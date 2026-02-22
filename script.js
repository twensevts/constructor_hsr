let sets = [];
let currentCharacter = null;

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

function openArtifactModal(character) {
    currentCharacter = character;
    const artifactModal = document.getElementById('artifactModal');
    document.getElementById('selectedCharacterName').textContent = character.name;
    document.getElementById('selectedCharacterImg').src = character.photo;
    artifactModal.classList.add('show');
}

function saveSet() {
    if (!currentCharacter) {
        alert('Выберите персонажа');
        return;
    }

    const nameSetModal = document.getElementById('nameSetModal');
    nameSetModal.classList.add('show');
    document.getElementById('setNameInput').value = '';
    document.getElementById('setNameInput').focus();
}

function confirmSetName() {
    const setName = document.getElementById('setNameInput').value.trim();

    if (!setName) {
        alert('Введите название сета');
        return;
    }

    const newSet = {
        id: Date.now(),
        setName: setName,
        characterName: currentCharacter.name,
        characterId: currentCharacter.id,
        pieces: []
    };

    sets.push(newSet);
    renderSets();
    closeNameModal();
    closeArtifactModal();
    currentCharacter = null;
}

function closeNameModal() {
    const nameSetModal = document.getElementById('nameSetModal');
    nameSetModal.classList.remove('show');
}

function closeArtifactModal() {
    const artifactModal = document.getElementById('artifactModal');
    artifactModal.classList.remove('show');
}

loadCharacters().then(() => {
    initCharacterOptions();
    renderSets();
}).catch(err => {
    console.error('Failed to load characters:', err);
    setsList.innerHTML = '<p class="empty-message">Ошибка загрузки персонажей</p>';
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
            <span style="font-weight: bold; font-size: 1.1rem;">${set.setName}</span>
            <img src="${photoSrc}" alt="${set.characterName}">
            <button onclick="removeSet(${set.id})" style="background: #ff4757; color: white; border: none; padding: 10px; cursor: pointer; margin-top: auto; border-radius: 5px;">Удалить</button>
        `;
        setsList.appendChild(setItem);
    });
}

function removeSet(id) {
    sets = sets.filter(set => set.id !== id);
    renderSets();
}
