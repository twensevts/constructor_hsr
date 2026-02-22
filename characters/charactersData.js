let CHARACTERS = [];

async function loadCharacters() {
    const response = await fetch('assets/characters.json');
    const data = await response.json();
    CHARACTERS = data.map(c => new Character(c.id, c.name, c.icon, c.splash || c.icon));
    return CHARACTERS;
}

function getCharacterById(id) {
    return CHARACTERS.find(c => c.id === id) || null;
}
