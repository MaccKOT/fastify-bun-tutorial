// index.ts
import Fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { Database } from "bun:sqlite";

// --- Инициализация SQLite ---
const db = new Database("todo.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT 0
  )
`);

// --- Инициализация Fastify ---
const fastify: FastifyInstance = Fastify({
  logger: true,
});

// --- Настройка Swagger ---
await fastify.register(fastifySwagger, {
  openapi: {
    info: {
      title: "Todo List API",
      description: "A simple CRUD API for managing todos",
      version: "1.0.0",
    },
    servers: [{ url: "http://localhost:3000" }],
  },
  uiConfig: {
    deepLinking: false,
  },
  staticCSP: true,
  transformStaticCSP: (header) => header,
  exposeRoute: true,
});

await fastify.register(fastifySwaggerUi, {
  routePrefix: "/docs",
  uiConfig: {
    deepLinking: false,
    docExpansion: "full",
  },
});

// --- Определение схем ---
const TodoSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    title: { type: "string" },
    completed: { type: "boolean" },
  },
};

const GetTodosResponseSchema = {
  type: "array",
  items: TodoSchema,
};

const GetTodoParamsSchema = {
  type: "object",
  properties: {
    id: { type: "string" }, // Fastify преобразует в число в хуке
  },
  required: ["id"],
};

const GetTodoResponseSchema = TodoSchema;

const CreateTodoBodySchema = {
  type: "object",
  properties: {
    title: { type: "string" },
  },
  required: ["title"],
};

const CreateTodoResponseSchema = TodoSchema;

const UpdateTodoParamsSchema = GetTodoParamsSchema;
const UpdateTodoBodySchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    completed: { type: "boolean" },
  },
};
const UpdateTodoResponseSchema = TodoSchema;

const DeleteTodoParamsSchema = GetTodoParamsSchema;

// --- Хуки ---
const parseIdHook = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const id = parseInt(request.params.id, 10);
  if (isNaN(id) || id <= 0) {
    reply.code(400).send({ error: "Invalid ID" });
    return;
  }
  request.params.id = id as any; // Принудительно переопределяем тип для дальнейшего использования
};

// --- Маршруты ---

// GET /todos - Получить все задачи
fastify.get(
  "/todos",
  {
    schema: {
      description: "Get all todos",
      response: {
        200: GetTodosResponseSchema,
      },
    },
  },
  async () => {
    const stmt = db.prepare("SELECT * FROM todos");
    return stmt.all();
  },
);

// GET /todos/:id - Получить задачу по ID
fastify.get(
  "/todos/:id",
  {
    preHandler: parseIdHook,
    schema: {
      description: "Get a todo by ID",
      params: GetTodoParamsSchema,
      response: {
        200: GetTodoResponseSchema,
        404: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  },
  async (request) => {
    const { id } = request.params as { id: number }; // Уточняем тип после хука
    const stmt = db.prepare("SELECT * FROM todos WHERE id = ?");
    const todo = stmt.get(id);
    if (!todo) {
      throw fastify.httpErrors.notFound("Todo not found");
    }
    return todo;
  },
);

// POST /todos - Создать новую задачу
fastify.post<{ Body: { title: string } }>(
  "/todos",
  {
    schema: {
      description: "Create a new todo",
      body: CreateTodoBodySchema,
      response: {
        201: CreateTodoResponseSchema,
      },
    },
  },
  async (request, reply) => {
    const { title } = request.body;
    const stmt = db.prepare(
      "INSERT INTO todos (title, completed) VALUES (?, 0) RETURNING *",
    );
    const newTodo = stmt.get(title);
    reply.code(201).send(newTodo);
  },
);

// PUT /todos/:id - Обновить задачу по ID
fastify.put<{
  Params: { id: string };
  Body: { title?: string; completed?: boolean };
}>(
  "/todos/:id",
  {
    preHandler: parseIdHook,
    schema: {
      description: "Update a todo by ID",
      params: UpdateTodoParamsSchema,
      body: UpdateTodoBodySchema,
      response: {
        200: UpdateTodoResponseSchema,
        404: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  },
  async (request) => {
    const { id } = request.params as { id: number };
    const { title, completed } = request.body;

    // Проверяем, существует ли задача
    const checkStmt = db.prepare("SELECT 1 FROM todos WHERE id = ?");
    if (!checkStmt.get(id)) {
      throw fastify.httpErrors.notFound("Todo not found");
    }

    // Строим динамический SQL запрос на основе переданных полей
    let sql = "UPDATE todos SET ";
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push("title = ?");
      values.push(title);
    }
    if (completed !== undefined) {
      updates.push("completed = ?");
      values.push(completed ? 1 : 0);
    }

    if (updates.length === 0) {
      // Если ничего не обновляется, просто возвращаем текущую запись
      const selectStmt = db.prepare("SELECT * FROM todos WHERE id = ?");
      return selectStmt.get(id);
    }

    sql += updates.join(", ") + " WHERE id = ? RETURNING *";
    values.push(id);

    const stmt = db.prepare(sql);
    const updatedTodo = stmt.get(...values);

    if (!updatedTodo) {
      // Это может произойти, если запись была удалена между проверкой и обновлением
      throw fastify.httpErrors.internalServerError("Failed to update todo");
    }
    return updatedTodo;
  },
);

// DELETE /todos/:id - Удалить задачу по ID
fastify.delete(
  "/todos/:id",
  {
    preHandler: parseIdHook,
    schema: {
      description: "Delete a todo by ID",
      params: DeleteTodoParamsSchema,
      response: {
        204: { type: "null" }, // 204 No Content
        404: { type: "object", properties: { error: { type: "string" } } },
      },
    },
  },
  async (request, reply) => {
    const { id } = request.params as { id: number };
    const stmt = db.prepare("DELETE FROM todos WHERE id = ?");
    const result = stmt.run(id);
    if (result.changes === 0) {
      throw fastify.httpErrors.notFound("Todo not found");
    }
    reply.code(204).send(); // Отправляем пустое тело с кодом 204
  },
);

// --- Запуск сервера ---
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: "0.0.0.0" });
    console.log(`Server listening at http://localhost:3000`);
    console.log(`Swagger UI available at http://localhost:3000/docs`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
