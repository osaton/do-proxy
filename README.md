# Durable Object Proxy

> Simple interface for accessing [Cloudflare Durable Objects](https://developers.cloudflare.com/workers/learning/using-durable-objects/)' storage and class methods.

This library handles request building, fetching and responding behind the scenes via lightweight proxy object which provides interface for accessing DO instance's storage and class methods.

## Install

```text
npm install do-proxy --save-dev
```

## Demo

Try it out at [Stackblitz](https://stackblitz.com/fork/github/osaton/do-proxy/tree/main/examples/basic?file=index.ts&terminal='start-stackblitz').

## Usage briefly

Make your Durable Object class methods accessible by extending the `DOProxy`.

```ts
import { DOProxy } from 'do-proxy';
class MyDOClass extends DOProxy {
  // Arguments & return values have to be JSON serialiazable
  myClassMethod(param: string) {
    // Do what ever you would do inside DO
  }
}
```

Inside your Worker's `fetch` method:

```ts
// TypeScript users: Pass your class as type to `from` method to get proper types for `class` methods
const myDoBinding = DOProxy.from<MyDOClass>(env.MY_DO_BINDING);
const myDo = myDoBinding.get('my-do');

// You can access instance's storage methods
const res1 = await myDO.storage.get('my-store');
// You can also access your class's methods.
const res2 = await myDO.class.myClassMethod('foo');

// Or handle both with a single fetch behind the scenes using `batch` method
const [res3, res4] = await myDO.batch(() => [
  myDO.storage.get('my-store'),
  myDO.class.myClassMethod('foo'),
]);
```

## Usage

You can use `DOProxy` as is for Durable Object bindings. This enables you to use [`storage`](#storage-methods) methods.

Here we expect you to have DO class `Todo` bound to `TODO` inside `wrangler.toml`:

```ts
import { DOProxy } from 'do-proxy';
export { DOProxy as Todo };
export default {
  async fetch(req: Request, env: any) {
    const todo = DOProxy.from(env.TODO).get('my-todo');
    await todo.storage.put('todo:1', 'has to be done');
    const list = Object.fromEntries(await todo.storage.list());
    return Response.json(list);
  },
};
```

Or you can extend it, which enables you to call class methods via `class` property:

```ts
import { DOProxy } from 'do-proxy';

class Todo extends DOProxy {
  state: DurableObjectState;
  constructor(state: DurableObjectState) {
    super(state);
    this.state = state;
  }
  async add(todo: string) {
    const id = Math.ceil(Math.random() * 100);
    this.state.storage.put(`todo:${id}`, todo);
    return id;
  }

  async get(id: number) {
    return this.state.storage.get(`todo:${id}`);
  }
}
export default {
  async fetch(req: Request, env: any) {
    // Remember to add the `<YourClass>` part so you get types for `class` methods
    const todos = Todo.from<Todo>(env.TODO).get('my-todos');
    const id = await todos.class.add('has to be done');
    const todo = await todos.class.get(id);
    return Response.json({
      id,
      todo,
    });
  },
};
export { Todo };
```

You can also utilize the [`batch`](#batch) method which allows you to run multiple methods with one fetch request to DO instance:

```ts
// See previous example for `Todo` details
const [, , list] = await todos.batch(() => [
  todos.class.add('my todo'),
  todos.class.add('my other todo'),
  todos.storage.list(),
]);

return Response.json(Object.fromEntries(list as Map<string, string>));
```

## `storage` methods

`DOProxy` can be used as Durable Object class as is. It gives you access to Durable Object instance's [Transactional storage API](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/#transactional-storage-api) methods (excluding `transaction` which can't be proxied because of JSON serialization. See [batch method](#batch)).

Available methods: `DOProxyInstance.storage.get|put|delete|deleteAll|list|getAlarm|setAlarm|deleteAlarm|sync`

## Batch

If you need to invoke Durable Object instance's multiple times, `DOProxyInstance` has a `batch` method which allows you to run multiple method calls inside one fetch request.

Method calls passed to `batch` will be run in sequence.

```ts
const counter = Counter.from<Counter>(env.Counter).get('counter1');

await counter.batch(() => [
  counter.class.increment(),
  counter.class.increment(),
  counter.storage.deleteAll(),
  counter.class.increment(),
]); // => [1, 2, null, 1]
```

## DOProxy.from

Takes `DurableObjectNamespace` as argument and returns `DOProxyNamespace`.

## `DOProxyNamespace`

methods:

- `get(name:string): DOProxyInstance`: Get by name.
- `getById(id:DurableObjectId): DOProxyInstance`: Get by `DurableObjectId`
- `getByString(id: string): DOProxyInstance`: Get by stringified `DurableObjectId`

## Limitations

Remember that we are still doing fetch requests even if it is done in the background, so everything sent to `class` and `storage` methods must be JSON serializable.

## Other libraries

Not the Durable Object proxy you were looking for?

- [`do-proxy`](https://github.com/fisherdarling/do-proxy) for Rust by [@fisherdarling](https://www.github.com/fisherdarling)
