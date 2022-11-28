# Durable Object Storage

This library handles the `fetch` request building / routing for Cloudflare Durable Objects and gives easy access to Durable Object instance's state storage and class methods.

Usage:

```ts
import {DOStorage} from 'do-storage';

// Can be used as is for Durable Objects
export { DOStorage as Counter1 };

// Or you can extend it
export class Counter2 extends DOstorage {
  this.state: DurableObjectState;
  constructor(state: DurableObjectState) {
    super(state);
    this.state = state;
  }

  increment() {
    let count = ((await this.state.storage.get('counter')) as number) ?? 0;
    count++;
    await this.state.storage.put('counter', count);
    return count;
  }
}

export interface Env {
  COUNTER1: DurableObjectNamespace;,
  COUNTER2: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env) {
    const counter1 = Counter.from(env.COUNTER1).get('my-counter');
    // You can only use storage methods if `DOStorage` class is used as-is
    const count1 = (await counter1.storage.get('counter')) || 0;
    count1++;
    await counter1.storage.put('counter', count1);


    const counter = Counter2.from<Counter>(env.COUNTER2).get('my-counter');
    // By extending `DOStorage` you can also proxy calls to class methods
    const count2 = await counter.class.increment();

    return Response.json({
      count1,
      count2
    });
  },
};
```

## Accessing `storage` methods

`DOStorage` can be used as Durable Object class as is. It gives you access to Durable Object instance's Transactional storage API methods (excluding `transaction` which can't be proxied because of JSON serialization. See [batch method](#batch)).

Simple example where `DOStorage` is used as `Counter` class for Durable Object `COUNTER`:

```ts
const account = Account.from(env.ACCOUNT).get('my-account');
await account.storage.put('name', 'John');
await account.storage.put('email', 'john@example.com');

// Or with single fetch request
const [,,list] = await account.batch(() => [
  account.storage.put('name', 'John'),
  account.storage.put('email', 'john@example.com')
  account.storage.list()
]);
```

This is okay for testing and for objects that don't get lot of traffic, but remember that each storage method call initiates new fetch request to the DO instance, except for `batch` commands which are done with one fetch. If you want to minimize requests you might want to extend `DOStorage` class and create methods that do the more complex stuff.

Class methods can be accessed from `DOStorageProxy`'s `class` property:

```ts
class Account extends DOStorage {
  this.state: DurableObjectState;
  constructor(state:DurableObjectState) {
    super(state);
    this.state = state;
  }

  async add(name, email) {
    this.state.storage.put('account', {
      name,
      email
    });
  }
}

// ....
// Remember to add the `<YOUR_CLASS>` part so you get types for `class` methods
const account = Account.from<Account>(env.ACCOUNT).get('my-account');
// Only limitations is that arguments you call the `class` methods with must be JSON serializable as they are sent with the request
const data = await account.class.add({
  name: 'John',
  email: 'john@example.com'
});

// You can utilize class methods also with batch
const todos = Todo.from<Todo>(env.TODO).get('my-todos');
await todos.batch(() => [
  todos.class.addTodo('todo1'),
  todos.class.addTodo('todo2'),
  todos.class.addTodo('todo3'),
  todos.storage.list()
]) // => [null, null, null, Map(4) { ... }]
```

## Batch

If you need to invoke Durable Object instance's multiple times, `DOStorageProxy` has a `batch` method which allows you to run multiple method calls inside one fetch request.

Method calls passed to `batch` will be run in sequence.

```ts
const counter = Counter.from<Counter>(env.Counter).get('counter1');

const res = await counter.batch(() => [
  counter.class.increment(),
  counter.class.increment(),
  counter.storage.deleteAll(),
  counter.class.increment(),
]); // => [1, 2, null, 1]
```

## `static DOStorage.from(DO:DurableObjectNamespace):DOStorageNamespace`

Takes `DurableObjectNamespace` as argument and returns `DOStorageNamespace`.

## `DOStorageNamespace`

methods:

`get(name:string): DOStorageProxy`: Get by name.
`getById(id:DurableObjectId)`: Get by `DurableObjectId`
`getByString(id: string)`: Get by stringified `DurableObjectId`

## Limitations

Remember that we are still doing fetch requests even if it is done in the background, so everything sent to `class` and `storage` methods must be JSON serializable.
