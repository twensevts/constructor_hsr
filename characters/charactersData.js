const CHARACTERS = [
    new Character('castoria', 'Кастория', 'src/images/character_icon_demo.jpg', 'src/images/character_demo.jpg'),
    new Character('acheron', 'Ахерон', 'src/images/character_icon_demo.jpg', 'src/images/character_demo.jpg'),
    new Character('faenon', 'Фаенон', 'src/images/character_icon_demo.jpg', 'src/images/character_demo.jpg'),
    new Character('temen', 'Темень', 'src/images/character_icon_demo.jpg', 'src/images/character_demo.jpg'),
    new Character('aventurin', 'Авантюрин', 'src/images/character_icon_demo.jpg', 'src/images/character_demo.jpg'),
    new Character('anaksa', 'Анакса', 'src/images/character_icon_demo.jpg', 'src/images/character_demo.jpg'),
    new Character('gerta', 'Великая Герта', 'src/images/character_icon_demo.jpg', 'src/images/character_demo.jpg'),
    new Character('tribbie', 'Трибби', 'src/images/character_icon_demo.jpg', 'src/images/character_demo.jpg')
];

function getCharacterById(id) {
    return CHARACTERS.find(c => c.id === id) || null;
}
