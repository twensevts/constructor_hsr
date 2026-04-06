let CHARACTERS = [];

async function loadCharacters() {
    const response = await fetch('/api/characters');
    const data = await response.json();
    const list = Array.isArray(data) ? data : (data.characters || []);

    CHARACTERS = list.map(c => new Character(
        c.id,
        c.name,
        c.icon_url || c.icon,
        c.splash_url || c.icon_url || c.icon,
        c.element || c.combat_type,
        c.path || '',
        c.rarity === 5 || c.rarity === '5 Star' ? '5 Star' : '4 Star'
    ));
    return CHARACTERS;
}

function getCharacterById(id) {
    return CHARACTERS.find(c => c.id === id) || null;
}
