import { DurableObjectGetAlarmOptions, DurableObjectPutOptions } from '@cloudflare/workers-types';
const MODULE_NAME = 'do-proxy';
const storageMethods = [
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

interface RequestConfig {
  type: RequestConfigType;
  prop: string;
  args: any[];
}

type RequestConfigType = 'function' | 'storage';

interface FetchResponse {
  data: any;
}

export interface DOProxyNamespace<T> {
  get: (name: string) => DOProxyInstance<T>;
  getById: (id: DurableObjectId) => DOProxyInstance<T>;
  getByString: (id: string) => DOProxyInstance<T>;
}

export interface Storage {
  delete: (key: string, options?: DurableObjectPutOptions | undefined) => Promise<boolean>;
  deleteAlarm: () => {};
  deleteAll: (options?: DurableObjectPutOptions | undefined) => Promise<void>;
  get: (key: string, options?: DurableObjectGetOptions | undefined) => Promise<unknown>;
  getAlarm: (options?: DurableObjectGetAlarmOptions | undefined) => Promise<number | null>;
  list: (
    options?: globalThis.DurableObjectListOptions | undefined
  ) => Promise<Map<string, unknown>>;
  put: (
    key: string,
    value: unknown,
    options?: DurableObjectPutOptions | undefined
  ) => Promise<void>;
  setAlarm: (
    scheduledTime: number | Date,
    options?: globalThis.DurableObjectSetAlarmOptions | undefined
  ) => Promise<void>;
  sync: () => Promise<void>;
}

function getRequestConfig(type: RequestConfigType, prop: PropertyKey, args: any[]): RequestConfig {
  return {
    type,
    prop: String(prop),
    args: args,
  };
}

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
      obj[methodName] = function (...args) {
        const config = getRequestConfig('storage', methodName, args);
        if (proxyMode === 'batch') {
          return config;
        }
        return doFetch(stub, config);
      };
    });

    return obj as unknown as Storage;
  }

  const storage = getProxyStorage();
  return new Proxy(
    {},
    {
      get: (target, prop) => {
        // Handle class methods
        if (prop === 'batch') {
          return async function (jobs: () => any[]) {
            // Switching to batch mode, which skips fetching and only returns configs for our jobs
            proxyMode = 'batch';
            const configs = await resolveConfigs(await jobs());
            if (!Array.isArray(configs)) {
              throw Error(
                `\`batch\` callback should return array of \`DOProxyInstance\` operations, got: ${typeof configs}`
              );
            }

            configs.forEach((cfg, index) => {
              if (!cfg?.type) {
                throw Error(
                  `DOStorageProxy.batch: Returned array has invalid job at index ${index}. Only \`DOProxyInstance\` methods supported.`
                );
              }
            });

            proxyMode = 'execute';

            // Handle all jobs with one fetch
            return doFetch(stub, configs);
          };
        }
        if (prop === 'class') {
          return new Proxy(
            {},
            {
              get: (target, prop) => {
                if (methods.has(prop as string)) {
                  return async function (...args: any[]) {
                    const config = getRequestConfig('function', prop, args);
                    if (proxyMode === 'batch') {
                      return config;
                    }
                    return doFetch(stub, config);
                  };
                }
              },
            }
          );
        }

        // Handle storage methods
        if (prop === 'storage') {
          return storage;
        }

        return (target as any)[prop];
      },
      set(target, prop, value) {
        console.dir({ set: [prop, value] });
        (target as any)[prop] = value;
        return true;
      },
    }
  ) as unknown as DOProxyInstance<T>;
}

export interface DOProxyInstance<T> {
  storage: Storage;
  batch: (callback: () => unknown[]) => Promise<unknown[]>;
  class: T;
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
      if (!exclude.includes(name) && typeof (proto as any)[name] === 'function') {
        methods.add(name);
      }
    }
    o = Object.getPrototypeOf(o);
  }
  return methods;
}
