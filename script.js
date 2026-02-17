let sets = [];
let currentCharacter = { name: '', id: '' };

const addSetBtn = document.getElementById('addSetBtn');
const setsList = document.getElementById('sets-list');
const createSetModal = document.getElementById('createSetModal');
const closeModal = document.querySelector('.close-modal');
const addCharacterBtn = document.getElementById('addCharacterBtn');
const characterDropdown = document.getElementById('characterDropdown');

addSetBtn.addEventListener('click', () => {
    createSetModal.classList.add('show');
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
    characterDropdown.classList.toggle('hidden');
});

function initCharacterOptions() {
    const characterOptions = document.querySelectorAll('.character-option');
    characterOptions.forEach(option => {
        option.addEventListener('click', () => {
            const characterName = option.querySelector('span:last-child').textContent;
            const characterId = option.dataset.character;

            createSetModal.classList.remove('show');
            characterDropdown.classList.add('hidden');

            openArtifactModal(characterName, characterId);
        });
    });
}

function openArtifactModal(characterName, characterId) {
    currentCharacter = { name: characterName, id: characterId };
    const artifactModal = document.getElementById('artifactModal');
    document.getElementById('selectedCharacterName').textContent = characterName;
    document.getElementById('selectedCharacterImg').src = 'src/images/character_demo.jpg';
    artifactModal.classList.add('show');
}

function saveSet() {
    if (!currentCharacter.name) {
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
    currentCharacter = { name: '', id: '' };
}

function closeNameModal() {
    const nameSetModal = document.getElementById('nameSetModal');
    nameSetModal.classList.remove('show');
}

function closeArtifactModal() {
    const artifactModal = document.getElementById('artifactModal');
    artifactModal.classList.remove('show');
}

initCharacterOptions();

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
        const setItem = document.createElement('div');
        setItem.className = 'set-item';
        setItem.innerHTML = `
            <span style="font-weight: bold; font-size: 1.1rem;">${set.setName}</span>
            <img src="src/images/character_demo.jpg" alt="${set.characterName}">
            <button onclick="removeSet(${set.id})" style="background: #ff4757; color: white; border: none; padding: 10px; cursor: pointer; margin-top: auto; border-radius: 5px;">Удалить</button>
        `;
        setsList.appendChild(setItem);
    });
}

function removeSet(id) {
    sets = sets.filter(set => set.id !== id);
    renderSets();
}

renderSets();
