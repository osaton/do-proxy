import { DOProxy } from 'do-proxy';
export { Todo };

class Todo extends DOProxy {
  state: DurableObjectState;
  id!: number;
  constructor(state: DurableObjectState) {
    super(state);
    this.state = state;

    this.state.blockConcurrencyWhile(async () => {
      this.id = ((await this.state.storage.get('id-increment')) as number) ?? 0;
    });
  }
  async add(todo: string) {
    const id = ++this.id;
    this.state.storage.put(`todo:${id}`, todo);
    this.state.storage.put('id-increment', id);
    return id;
  }

  async get(id: number) {
    return this.state.storage.get(`todo:${id}`);
  }

  alarm() {
    console.log('Remember your todos!');
    this.state.storage.put('last-scheduled-alarm', Date.now());
  }
}

export default {
  async fetch(req: Request, env: any) {
    const url = new URL(req.url);
    const todos = Todo.from<Todo>(env.TODO).get('my-todos');

    if (url.pathname === '/') {
      // Single
      const id = await todos.class.add('basic todo');
      const todo = await todos.class.get(id);

      // Batch
      const batchRes = await todos.batch(() => [
        todos.class.add('batched todo'),
        // set alarm in 3 seconds
        todos.storage.setAlarm(Date.now() + 3000),
        todos.storage.list(),
      ]);

      const list = batchRes.pop();

      return new Response(
        JSON.stringify(
          {
            id,
            todo,
            list: Object.fromEntries(list as Map<string, string>),
          },
          null,
          2
        ),
        {
          headers: {
            'content-type': 'application/json',
          },
        }
      );
    } else if (url.pathname === '/delete-all') {
      await todos.storage.deleteAll();
      return Response.json({
        ok: true,
      });
    }

    return new Response('Not found', { status: 404 });
  },
};
