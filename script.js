// Массив для хранения сетов
let sets = [];

// Получаем элементы
const addSetBtn = document.getElementById('addSetBtn');
const setsList = document.getElementById('sets-list');
const createSetModal = document.getElementById('createSetModal');
const closeModal = document.querySelector('.close-modal');
const addCharacterBtn = document.getElementById('addCharacterBtn');
const characterDropdown = document.getElementById('characterDropdown');

// Обработчик открытия модального окна
addSetBtn.addEventListener('click', () => {
    createSetModal.classList.add('show');
    characterDropdown.classList.add('hidden');
});

// Обработчик закрытия модального окна
closeModal.addEventListener('click', () => {
    createSetModal.classList.remove('show');
});

// Закрытие при клике вне модального окна
window.addEventListener('click', (e) => {
    if (e.target === createSetModal) {
        createSetModal.classList.remove('show');
    }
});

// Показать/скрыть выпадающий список персонажей
addCharacterBtn.addEventListener('click', () => {
    characterDropdown.classList.toggle('hidden');
});

// Обработка выбора персонажа
function initCharacterOptions() {
    const characterOptions = document.querySelectorAll('.character-option');
    characterOptions.forEach(option => {
        option.addEventListener('click', () => {
            const characterName = option.querySelector('span:last-child').textContent;
            const characterId = option.dataset.character;

            console.log(`Выбран персонаж: ${characterName}`);

            // Здесь будет логика добавления персонажа в сет
            // Пока просто скрываем список
            characterDropdown.classList.add('hidden');

            // TODO: Добавить логику создания сета с выбранным персонажем
        });
    });
}

// Инициализация обработчиков выбора персонажа
initCharacterOptions();

// Функция добавления сета (старая версия)
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

// Функция отображения сетов
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
            <span style="font-weight: bold; font-size: 1.1rem;">${set.name}</span>
            <button onclick="removeSet(${set.id})" style="background: #ff4757; color: white; border: none; padding: 10px; cursor: pointer; margin-top: auto;">Удалить</button>
        `;
        setsList.appendChild(setItem);
    });
}

// Функция удаления сета
function removeSet(id) {
    sets = sets.filter(set => set.id !== id);
    renderSets();
}

// Инициализация
renderSets();
