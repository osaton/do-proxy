/**
 * Search for `@DOProxy` if you just want to see how storage methods are implemented
 */
import { DOProxy } from 'do-proxy';
import { Hono } from 'hono';
import html from './index.html';
export { Todo };

const TODO_LIST_NAME = 'my-todos';
const app = new Hono();

// @DOProxy
// Here we extend `DOProxy` class which enables us to use `class` methods of `DurableObjectStubProxy`
// when we intialize the proxy using its static `wrap` method (E.g. `Todo.wrap(env.TODO)`)
class Todo extends DOProxy {
  storage: DurableObjectStorage;

  constructor(state: DurableObjectState) {
    super(state);
    this.storage = state.storage;
  }

  /**
   * Add todo
   */
  async add(title: string) {
    const uuid = crypto.randomUUID();
    const data: TodoItem = {
      id: `todo:${uuid}`,
      title,
      statusChanged: Date.now(),
      completed: false,
    };

    await this.storage.put(data.id, data);
    return data;
  }

  /**
   * Update todo's completed status
   */
  async updateStatus(id: string, completed: boolean) {
    const todo = (await this.storage.get(id)) as TodoItem;

    todo.completed = completed;
    todo.statusChanged = Date.now();
    await this.storage.put(id, todo);

    return todo;
  }

  /**
   * Update todo's title
   */
  async updateTitle(id: string, title: string) {}

  async getList() {
    const todoMap = (await this.storage.list({
      prefix: 'todo:',
    })) as Map<string, TodoItem>;

    // Convert to array of objects
    const list: TodoItem[] = [];
    for (const [, value] of todoMap) {
      list.push(value);
    }

    // Sort by statusChanged ts
    list.sort(({ statusChanged: a }, { statusChanged: b }) => b - a);

    return list;
  }

  /**
   * Delete all items
   */
  async destroy() {
    const list = await this.storage.list();
    await this.storage.deleteAll();
    return list.size;
  }
}

interface TodoItem {
  title: string;
  completed: boolean;
  /**
   * Timestamp of status changes
   *
   * Used for keeping the correct order when toggling completed state
   */
  statusChanged: number;
  id: string;
}

/**
 * Get html for the app
 */
app.get('/', (c) => {
  return c.html(html);
});

/**
 * Get Todo list
 */
app.get('/todos', async (c) => {
  // @DOProxy
  const stub = Todo.wrap(c.env.TODO).getByName(TODO_LIST_NAME);
  const list = await stub.class.getList();
  return c.json({ todos: list });
});

/**
 * Add Todo
 */
app.post('/todos', async (c) => {
  const body = (await c.req.json()) as { title: string };

  // @DOProxy
  const stub = Todo.wrap(c.env.TODO).getByName(TODO_LIST_NAME);
  const todo = await stub.class.add(body.title);

  return c.json(todo);
});

/**
 * Update todo's completed status / title
 */
app.patch('/todos/:todoId', async (c) => {
  const body = (await c.req.json()) as { completed?: boolean; title?: string };
  const id = c.req.param('todoId');
  // @DOProxy
  const stub = Todo.wrap(c.env.TODO).getByName(TODO_LIST_NAME);

  if (typeof body.completed === 'boolean') {
    const todo = await stub.class.updateStatus(id, body.completed);
    return c.json(todo);
  } else if (typeof body.title === 'string') {
    const todo = await stub.class.updateTitle(id, body.title);
    return c.json(todo);
  }
});

/**
 * Delete all storage items
 */
app.delete('/todos', async (c) => {
  // @DOProxy
  const stub = Todo.wrap(c.env.TODO).getByName(TODO_LIST_NAME);
  const count = await stub.class.destroy();

  return c.json({
    count,
  });
});

export default app;
