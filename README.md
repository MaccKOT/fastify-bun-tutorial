# Todo List API на Fastify + Bun + SQLite

Простой сервер для управления списком задач (todo list) с хранением данных в SQLite. Реализован базовый CRUD без авторизации. Включена документация API через Swagger.

## Функционал

- Создание новой задачи (Create)
- Получение списка всех задач (Read)
- Получение конкретной задачи по ID (Read)
- Обновление задачи по ID (Update)
- Удаление задачи по ID (Delete)

## Технологии

- **Runtime:** [Bun](https://bun.sh/)
- **Фреймворк:** [Fastify](https://www.fastify.io/)
- **База данных:** SQLite (встроенный драйвер `bun:sqlite`)
- **Документация API:** [@fastify/swagger](https://github.com/fastify/fastify-swagger), [@fastify/swagger-ui](https://github.com/fastify/fastify-swagger-ui)

## Установка и запуск

1.  Убедитесь, что у вас установлен [Bun](https://bun.sh/docs/installation).
2.  Клонируйте репозиторий или создайте новый проект.
3.  Установите зависимости:
    ```bash
    bun install
    ```
4.  Запустите сервер:
    ```bash
    bun run index.ts
    ```
5.  Сервер будет доступен по адресу `http://localhost:3000`.

## Документация API

После запуска сервера интерактивная документация Swagger UI будет доступна по адресу:
http://localhost:3000/docs

## Примеры запросов (cURL)

### Создать новую задачу

```bash
curl -X POST http://localhost:3000/todos -H "Content-Type: application/json" -d '{"title": "Изучить Fastify и Bun"}'
```
