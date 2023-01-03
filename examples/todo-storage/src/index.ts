/**
 * Search for `@DOProxy` if you just want to see how storage methods are implemented
 */

import { DOProxy } from 'do-proxy';
import { Hono } from 'hono';
import html from './index.html';
export { DOProxy as Todo };

const TODO_LIST_NAME = 'my-todos';
const app = new Hono();

interface Todo {
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
  const stub = DOProxy.wrap(c.env.TODO).getByName(TODO_LIST_NAME);
  const todoMap = (await stub.storage.list({
    prefix: 'todo:',
  })) as Map<string, Todo>;

  // Convert to array of objects
  const list: Todo[] = [];
  for (const [, value] of todoMap) {
    list.push(value);
  }

  // Sort by statusChanged ts
  list.sort(({ statusChanged: a }, { statusChanged: b }) => b - a);
  return c.json({ todos: list });
});

/**
 * Add Todo
 */
app.post('/todos', async (c) => {
  const body = (await c.req.json()) as { title: string };
  const uuid = crypto.randomUUID();
  const data: Todo = {
    id: `todo:${uuid}`,
    title: body.title,
    statusChanged: Date.now(),
    completed: false,
  };

  // @DOProxy
  const stub = DOProxy.wrap(c.env.TODO).getByName(TODO_LIST_NAME);
  const [, todo] = await stub.batch(() => [
    stub.storage.put(data.id, data),
    // This is not mandatory, as we could have just returned the `data`
    // but it's here to demonstrate that you can run sequential operations with
    // only one fetch request to the Durable Object instance
    stub.storage.get(data.id),
  ]);

  return c.json(todo);
});

/**
 * Update todos completed status / title
 */
app.patch('/todos/:todoId', async (c) => {
  const body = (await c.req.json()) as { completed?: boolean; title?: string };
  // @DOProxy
  const stub = DOProxy.wrap(c.env.TODO).getByName(TODO_LIST_NAME);
  const todo = (await stub.storage.get(c.req.param('todoId'))) as Todo;

  if (typeof body.completed === 'boolean') {
    // Update completed status
    todo.completed = body.completed;
    todo.statusChanged = Date.now();
    await stub.storage.put(todo.id, todo);

    return c.json(todo);
  } else if (typeof body.title === 'string') {
    // Update title
    todo.title = body.title;
    await stub.storage.put(todo.id, todo);

    return c.json(todo);
  }
});

/**
 * Delete all storage items
 */
app.delete('/todos', async (c) => {
  // @DOProxy
  const stub = DOProxy.wrap(c.env.TODO).getByName(TODO_LIST_NAME);
  const [list] = await stub.batch(() => [stub.storage.list(), stub.storage.deleteAll()]);

  return c.json({
    count: (list as Map<string, unknown>).size,
  });
});

export default app;
