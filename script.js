// Массив для хранения сетов
let sets = [];

// Получаем элементы
const addSetBtn = document.getElementById('addSetBtn');
const setsList = document.getElementById('sets-list');

// Обработчик добавления сета
addSetBtn.addEventListener('click', () => {
    addSet();
});

// Функция добавления сета
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
