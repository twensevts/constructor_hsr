# HSR Relic Calculator

Веб-приложение для планирования сетов реликвий в Honkai: Star Rail.

## Стек

- **Frontend:** Vanilla JS, HTML/CSS
- **Backend:** Node.js + Express
- **БД:** PostgreSQL

## Быстрый старт

### 1. PostgreSQL

```bash
brew install postgresql@16
brew services start postgresql@16
createdb hsr_constructor
psql hsr_constructor < api/schema.sql
```

### 2. Зависимости и конфиг

```bash
cd api
npm install
cp .env.example .env
```

Отредактировать `api/.env` — заменить `DB_USER` на свой логин macOS, `DB_PASS` оставить пустым (если пароль не задавался).

### 3. Заполнить базу данными

```bash
node api/seed.js
```

### 4. Запустить сервер

```bash
node api/server.js
```

Открыть [http://localhost:3000](http://localhost:3000).

## API

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/health` | Статус сервера и БД |
| GET | `/api/characters` | Список персонажей |
| GET | `/api/builds/:id` | Билд по ID |
| POST | `/api/builds` | Создать билд (анонимно) |

## Шаринг

После сохранения сета появляется ссылка вида `/?share=<uuid>`. По ней сет открывается в режиме просмотра без возможности редактирования.
