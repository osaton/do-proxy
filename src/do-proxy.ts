import { getRequestConfig, RequestConfig } from './request-config';
const MODULE_NAME = 'do-proxy';
const storageMethods: SupportedStorageMethods[] = [
  'delete',
  'deleteAlarm',
  'deleteAll',
  'get',
  'getAlarm',
  'list',
  'put',
  'setAlarm',
  'sync',
];

type SupportedStorageMethods =
  | 'delete'
  | 'deleteAlarm'
  | 'deleteAll'
  | 'get'
  | 'getAlarm'
  | 'list'
  | 'put'
  | 'setAlarm'
  | 'sync';

interface FetchResponse {
  data: any;
}

declare abstract class DurableObjectNamespaceProxyClass<T>
  implements Omit<DurableObjectNamespace, 'get'>
{
  newUniqueId(options?: DurableObjectNamespaceNewUniqueIdOptions | undefined): DurableObjectId;
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStubProxy<T>;
}

interface DurableObjectNamespaceExtended<T> extends DurableObjectNamespaceProxyClass<T> {
  /**
   * Get by name
   *
   * Shorthand for `DurableObjectNamespace.get(DurableObjectNamespace.idFromName('name'))`
   */
  getByName: (name: string) => DurableObjectStubProxy<T>;
  /**
   * Get by id
   *
   * Shorthand for `DurableObjectNamespace.get(DurableObjectNamespace.idFromString(hexId))`
   */
  getById: (id: string) => DurableObjectStubProxy<T>;
}

export type DurableObjectNamespaceProxy<T> = T extends ConstructorType
  ? DurableObjectNamespaceExtended<InstanceType<T>>
  : DurableObjectNamespaceExtended<T>;

type DurableObjectProxy<T> = {
  /**
   * Stub's id
   */
  id: DurableObjectId;
  /**
   * The actual stub returned by `DurableObjectNamespace.get`
   */
  stub: DurableObjectStub;
  /**
   * Transactional storage API
   *
   * [See documentation](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/#transactional-storage-api)
   */
  storage: Storage;
  /**
   * Run multiple commands inside DO instance with one fetch command
   */
  batch: <T extends [Promise<unknown>, ...Promise<unknown>[]]>(
    callback: () => T
  ) => BatchResponse<T>;
  /**
   * Methods from the extended class
   */
  class: GetClassMethods<T>;
};

export type DurableObjectStubProxy<T> = keyof GetClassMethods<T> extends never
  ? Omit<DurableObjectProxy<T>, 'class'>
  : DurableObjectProxy<T>;

interface DOProxyNamespace<T> {
  get: (name: string) => DurableObjectStubProxy<T>;
  getById: (id: DurableObjectId) => DurableObjectStubProxy<T>;
  getByString: (id: string) => DurableObjectStubProxy<T>;
}

export type Storage = Pick<DurableObjectStorage, SupportedStorageMethods>;

type UnwrapPromises<Promises> = Promises extends [Promise<infer Value>, ...infer Rest]
  ? [Value, ...UnwrapPromises<Rest>]
  : [];

type BatchResponse<T> = Promise<UnwrapPromises<T>>;

type ConstructorType = abstract new (...args: any) => any;

type PromisifyFunction<TFunc extends (...args: any) => any> = ReturnType<TFunc> extends Promise<any>
  ? TFunc
  : (...args: Parameters<TFunc>) => Promise<ReturnType<TFunc>>;

type GetClassMethods<T> = {
  // Only methods can be proxied
  [K in keyof T as T[K] extends Function ? K : never]: T[K] extends (...args: any) => any
    ? // If the class method is not marked as async, we need to wrap return type with `Promise` as the proxied methods are all async
      PromisifyFunction<T[K]>
    : never;
};

async function handleStorageFetch(state: DurableObjectState, config: RequestConfig) {
  return (state.storage as any)[config.prop](...config.args);
}

async function doFetch(
  stub: DurableObjectStub,
  config: RequestConfig | RequestConfig[]
): Promise<unknown> {
  const res = (await stub
    .fetch(
      new Request('https://do-proxy/', {
        method: 'POST',
        body: JSON.stringify(config),
      })
    )
    .then((res) => res.text())
    .then((text: string) =>
      JSON.parse(text, function reviver(key, value) {
        // Convert received map data back to Map
        if (typeof value === 'object' && value !== null) {
          if (value.__dataType === 'Map') {
            return new Map(value.value);
          }
        }
        return value;
      })
    )) as FetchResponse;

  return res.data;
}

async function resolveConfigs(configs: any[]) {
  const resolved = [];
  for (const cfg of configs) {
    resolved.push(await Promise.resolve(cfg));
  }
  return resolved;
}

function getProxy<T>(stub: DurableObjectStub, methods: Set<string>) {
  let proxyMode = 'execute';

  function getProxyStorage() {
    const obj: Record<string, () => {}> = {};
    storageMethods.forEach((methodName) => {
      obj[methodName] = async function (...args) {
        const config = getRequestConfig('storage', methodName, args);
        if (proxyMode === 'batch') {
          return config;
        }
        return doFetch(stub, config);
      };
    });

    return obj as unknown as Storage;
  }

  function getProxyClass() {
    const obj: Record<string, () => {}> = {};
    for (const prop of methods) {
      obj[prop] = async function (...args: any[]) {
        const config = getRequestConfig('function', prop, args);
        if (proxyMode === 'batch') {
          return config;
        }
        return doFetch(stub, config);
      };
    }

    return obj;
  }

  const storage = getProxyStorage();
  const proxyClass = getProxyClass();

  return new Proxy(
    {
      id: stub.id,
      stub: stub,
    },
    {
      get: (target, prop) => {
        if (prop === 'batch') {
          return async function (jobs: () => any[]) {
            // Switching to batch mode, which skips fetching and only returns configs for our jobs
            proxyMode = 'batch';
            const callbackRes = await jobs();

            if (!Array.isArray(callbackRes)) {
              throw Error(`\`batch\` callback should return an array, got: ${typeof callbackRes}`);
            }

            const configs = await resolveConfigs(callbackRes);

            configs.forEach((cfg, index) => {
              if (!cfg?.type) {
                throw Error(
                  `Returned array has invalid job at index ${index}. Only \`storage\` and \`class\` methods supported.`
                );
              }
            });

            proxyMode = 'execute';

            // Handle all jobs with one fetch
            return doFetch(stub, configs);
          };
        }
        if (prop === 'class' && methods.size > 0) {
          return proxyClass;
        }

        // Handle storage methods
        if (prop === 'storage') {
          return storage;
        }

        const value = (target as any)[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set(target, prop, value) {
        (target as any)[prop] = value;
        return true;
      },
    }
  ) as unknown as DurableObjectStubProxy<T>;
}

export class DOProxy {
  #state: DurableObjectState;

  constructor(state: DurableObjectState, env?: any) {
    this.#state = state;
  }

  private async fetch(request: Request) {
    let config: null | RequestConfig | RequestConfig[] = null;

    const runFetchConfig = async (config: RequestConfig) => {
      if (config.type === 'function') {
        return await (this as any)[config.prop](...config.args);
      } else if (config.type === 'storage') {
        return await handleStorageFetch(this.#state, config);
      }
    };

    try {
      config = (await request.json()) as RequestConfig;
    } catch (e) {}

    if (!config) {
      throw Error(
        `You can't directly call stub's fetch method if you're using ${MODULE_NAME}. Use class methods instead.`
      );
    }

    let data: any = undefined;

    if (Array.isArray(config)) {
      data = [];
      for (const cfg of config) {
        data.push(await runFetchConfig(cfg));
      }
    } else {
      data = await runFetchConfig(config);
    }

    return new Response(
      JSON.stringify(
        {
          data,
        },
        function replacer(_key, value) {
          // Handle Maps. At least `state.storage.list()` returns one
          // We'll convert these back to Map when handling response
          if (value instanceof Map) {
            return {
              __dataType: 'Map',
              value: Array.from(value.entries()),
            };
          } else {
            return value;
          }
        }
      ),
      {
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }

  /**
   * Get `DurableObjectNamespace` wrapped inside proxy

   */
  static wrap<T extends ConstructorType>(
    this: T,
    binding: DurableObjectNamespace
  ): DurableObjectNamespaceProxy<T> {
    const methods = getClassMethods(this.prototype);

    return new Proxy(binding, {
      get: (target, prop) => {
        // `DurableObjectNamespaceProxy.get`
        if (prop === 'get') {
          return function (id: DurableObjectId) {
            const stub = binding.get(id);
            return getProxy<InstanceType<T>>(stub, methods);
          };
        }

        // `DurableObjectNamespaceProxy.getByName`
        if (prop === 'getByName') {
          return function (name: string) {
            const stub = binding.get(binding.idFromName(name));
            return getProxy<InstanceType<T>>(stub, methods);
          };
        }

        // `DurableObjectNamespaceProxy.getById`
        if (prop === 'getById') {
          return function (id: string) {
            const stub = binding.get(binding.idFromString(id));
            return getProxy<InstanceType<T>>(stub, methods);
          };
        }

        // Handle DurableObjectNamespace's builtin properties / methods last, so that possible conflicting updates don't break existing implementations
        if (prop in target) {
          const value = (target as any)[prop];
          return typeof value === 'function' ? value.bind(target) : value;
        }
      },
    }) as unknown as DurableObjectNamespaceProxy<T>;
  }

  /**
   * @deprecated Use `wrap` method instead which allows access to DurableObjectNamespace methods without type quirks
   */
  static from<T extends DOProxy>(binding: DurableObjectNamespace): DOProxyNamespace<T> {
    const methods = getClassMethods(this.prototype);
    return {
      get(name: string) {
        const stub = binding.get(binding.idFromName(name));
        return getProxy<T>(stub, methods);
      },
      getById(id: DurableObjectId) {
        const stub = binding.get(id);
        return getProxy<T>(stub, methods);
      },
      getByString(id: string) {
        const stub = binding.get(binding.idFromString(id));
        return getProxy<T>(stub, methods);
      },
    };
  }
}

function getClassMethods(proto: DOProxy) {
  const exclude = ['constructor', 'fetch'];

  const methods: Set<string> = new Set();
  let o = proto;
  while (o !== null) {
    for (let name of Object.getOwnPropertyNames(o)) {
      if (
        !exclude.includes(name) &&
        typeof (proto as any)[name] === 'function' &&
        proto.hasOwnProperty(name)
      ) {
        methods.add(name);
      }
    }
    o = Object.getPrototypeOf(o);
  }
  return methods;
}
