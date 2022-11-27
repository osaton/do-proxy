# Durable Object Storage

This library handles the `fetch` request building / routing for Cloudflare Durable Objects and gives easy access to Durable Object instance's state storage and class methods.

## Accessing `storage` methods

`DOStorage` can be used as Durable Object class as is. It gives you access to Durable Object instance's Transactional storage API methods (excluding `transaction` which can't be proxied because of JSON serialization).

Simple example where `DOStorage` is used as `Counter` class for Durable Object `COUNTER`:

```ts
import { DOStorage as Counter } from 'do-storage';
export { Counter };

export interface Env {
  COUNTER: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env) {
    const counter = Counter.from(env.COUNTER).get('my-counter');

    const count = (await counter.storage.get('counter')) || 0;
    count++;
    await counter.storage.put('counter', count);

    return Response.json({
      count,
    });
  },
};
```

This is okay for testing and for object's that don't get lot of traffic, but remember that each storage method call initiates new fetch request to the durable object's instance. If you want to minimize requests you might want to extend `DOStorage` class and create methods that do the hard work.

Class methods can be accessed from `DOStorageProxy`'s `class` property:

```ts
import { DOStorage } from './do-storage';

export interface Env {
  COUNTER: DurableObjectNamespace;
}

class Counter extends DOStorage {
  state: DurableObjectState;
  constructor(state: DurableObjectState) {
    super(state); // Only thing required by `DOStorage`
    this.state = state;
  }

  async increment() {
    let count = ((await this.state.storage.get('counter')) as number) ?? 0;
    count++;
    await this.state.storage.put('counter', count);
    return count;
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const counter = Counter.from<Counter>(env.COUNTER).get('my-counter');
    // Proxy fetch to Durable Object instance's `increment` method
    const count = await counter.class.increment();

    return Response.json({
      count,
    });
  },
};
```

By extending the `DOStorage` you can access class methods from the `DOStorageProxy`'s `class` property.

## Batch

If you still need to invoke Durable Object instance's multiple times, `DOStorageProxy` has a `batch` method which allows you to run multiple method calls inside one fetch request.

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

## `DOStorage.from` => `todo:StubInitiator`

Pass in the related durable object namespace from env variable.

## Different methods to initiate stub proxy => `todo:DOStorageProxy`

`get`: Get by name (`string`)
`getById`: Get by `DurableObjectId`
`getByString`: Get by stringified `DurableObjectId`

## Limitations

Remember that we are still doing fetching even if it is done in the background, so everything sent to `class` and `storage` methods must be JSON serializable. You can go crazy inside the class methods though.
