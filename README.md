# HSR Relic Calculator

Веб-приложение для планирования сетов реликвий в Honkai: Star Rail.

## Стек

- **Frontend:** Vanilla JS, HTML/CSS
- **Backend:** Node.js + Express
- **БД:** PostgreSQL

## Быстрый старт

### 1. Установить PostgreSQL (Windows)

1. Установите PostgreSQL через официальный инсталлятор:
	https://www.postgresql.org/download/windows/
2. Во время установки запомните пароль пользователя postgres.
3. После установки у вас обычно появляется psql по пути:
	C:\Program Files\PostgreSQL\18\bin\psql.exe

Если команда psql не работает в PowerShell, используйте полный путь к psql.exe (пример ниже).

### 2. Установить зависимости

В корне проекта:

```powershell
npm install
cd api
npm install
cd ..
```

### 3. Настроить api/.env

Скопируйте пример и заполните параметры подключения:

```powershell
Copy-Item api/.env.example api/.env
```

Проверьте, что в api/.env корректные значения:

- DB_HOST=localhost
- DB_PORT=5432
- DB_NAME=hsr_constructor
- DB_USER=postgres
- DB_PASS=ваш_пароль_postgres

### 4. Создать базу и применить схему

Из корня проекта (PowerShell):

```powershell
$env:PGPASSWORD="ваш_пароль_postgres"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -d postgres -c "CREATE DATABASE hsr_constructor;"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -p 5432 -U postgres -d hsr_constructor -f api\schema.sql
```

Если база уже создана, команда CREATE DATABASE вернет ошибку, это нормально.

### 5. Заполнить базу данными

```powershell
node api/seed.js
```

Ожидаемый результат: Seeding complete.

### 6. Запустить сервер

```powershell
node api/server.js
```

Откройте http://localhost:3000

## API

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/health` | Статус сервера и БД |
| GET | `/api/characters` | Список персонажей |
| GET | `/api/builds/:id` | Билд по ID |
| POST | `/api/builds` | Создать билд (анонимно) |

## Шаринг

После сохранения сета появляется ссылка вида `/?share=<uuid>`. По ней сет открывается в режиме просмотра без возможности редактирования.
