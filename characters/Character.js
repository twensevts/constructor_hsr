class Character {
    constructor(id, name, icon, photo, element, path, rarity) {
        this.id = id;
        this.name = name;
        this.icon = icon;
        this.photo = photo;
        this.element = element || '';
        this.path = path || '';
        this.rarity = rarity || '';
    }
}
